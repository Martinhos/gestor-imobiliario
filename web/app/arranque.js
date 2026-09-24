/* ================= EXEMPLO =================
   Os dados de exemplo contam também a história do IRS: os imóveis trazem o que
   o Anexo F pede (distrito, código da freguesia, tipo, tipologia, VPT, data de
   aquisição), os NIFs passam o dígito de controlo (irs.js:nifValido —
   são inventados, nunca de pessoas reais), três contratos estão declarados
   com o número que a AT lhes deu e um fica por indicar (é ele que faz aparecer
   o prazo do Modelo 2); nenhum é «não declarado», porque essa é uma escolha
   que a app não faz por ninguém. As rendas levam o mês a que respeitam e o
   recibo eletrónico já emitido — a última sem, para o prazo dos recibos se ver.
   Devolve: nada — enche a base com os dados de exemplo (donos, imóveis,
   contratos, movimentos, modelos e recorrências), sincroniza, grava e redesenha. */
function seed(){
  const o1=normPerson({name:'Maria Costa',phone:'913 000 001',email:'maria@exemplo.pt',nif:'210000007',gender:'f',marital:'Casado(a)',nationality:'Portuguesa'});
  const o2=normPerson({name:'Pedro Costa',phone:'913 000 002',email:'pedro@exemplo.pt',nif:'210000015',gender:'m',marital:'Casado(a)',nationality:'Portuguesa'});
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
      /* o crédito de aquisição começa a 1 de maio: a escritura foi uns dias antes */
      distrito:'Lisboa',freguesiaCodigo:'110659',tipoPredio:'U',tipologia:'T2',vpt:98000,purchaseDate:`${YEAR-6}-04-27`,
      licence:'Alvará de Utilização n.º 26/2013',energyCert:'SCE395442330',energyClass:'D',energyValid:`${YEAR+10}-02-06`,
      listing:'T2 remodelado em Campo de Ourique, 78 m², cozinha equipada, muita luz natural. Perto de transportes e comércio.'}),
    normProp({id:p2,name:'T3 Coimbra',address:'Solum',use:'investimento',rentalMode:'quartos',rooms:[q1,q2,q3,q4],
      value:210000,purchase:168000,ownerIds:[o1.id],
      distrito:'Coimbra',freguesiaCodigo:'060316',tipoPredio:'U',tipologia:'T3',vpt:74000,purchaseDate:`${YEAR-4}-10-15`,
      notes:'Caldeira revista em junho. *Rever o esquentador* antes do inverno.'}),
    normProp({id:p3,name:'Casa de família',address:'Sintra',use:'proprio',value:340000,purchase:290000,ownerIds:[o1.id,o2.id],loans:[l3],
      distrito:'Lisboa',freguesiaCodigo:'111124',tipoPredio:'U',tipologia:'T4',vpt:126000,purchaseDate:`${YEAR-9}-01-10`})
  ];
  const t1=normPerson({name:'Ana Rodrigues',phone:'912 000 001',email:'ana@exemplo.pt',nif:'220000018',gender:'f',marital:'Solteiro(a)'});
  /* sem NIF português: o Anexo F pede então o país de residência */
  const t2=normPerson({name:'Bruno Silva',phone:'912 000 002',gender:'m',nationality:'Brasileira',pais:'Brasil'});
  const t3=normPerson({name:'Carla Matos',phone:'912 000 003',nif:'220000026',gender:'f'});
  const t4=normPerson({name:'Diogo Faria',gender:'m'});
  const t5=normPerson({name:'Eva Nunes',gender:'f'});
  db.tenants=[t1,t2,t3,t4,t5];
  /* três contratos comunicados à AT, cada um com o número que ela devolveu; o
     quarto contrato (c4, o casal do quarto 3) fica por indicar — o senhorio
     ainda não disse, e é isso que faz aparecer o prazo do Modelo 2 */
  const c1=normContract({propertyId:p1,tenantIds:[t1.id],rent:1250,taxRate:25,deposit:2500,payDay:8,
    start:`${YEAR-1}-09-01`,increase:2.5,iban:'PT50 0033 0000 4567 8901 2345 6',
    ownerEmail:o1.email,ownerPhone:o1.phone,tenantEmail:t1.email,tenantPhone:t1.phone,
    fisco:{estado:'declarado',numero:'1043782',finalidade:'hp',celebracao:`${YEAR-1}-08-25`,renovavel:true},
    inventory:[{id:uid(),name:'Sofá de 3 lugares',qty:1,state:'novo'},{id:uid(),name:'Cadeiras de sala',qty:4,state:'usado'},
               {id:uid(),name:'Máquina de lavar roupa',qty:1,state:'usado'}],
    keys:[{id:uid(),name:'Chaves de casa',qty:2},{id:uid(),name:'Chave do correio',qty:1}]});
  const c2=normContract({propertyId:p2,roomId:q1.id,tenantIds:[t2.id],rent:350,taxRate:25,deposit:350,payDay:1,start:`${YEAR}-09-01`,
    fisco:{estado:'declarado',numero:'1188406',finalidade:'hp',celebracao:`${YEAR}-08-25`,renovavel:true}});
  const c3=normContract({propertyId:p2,roomId:q2.id,tenantIds:[t3.id],rent:350,taxRate:25,deposit:350,payDay:1,start:`${YEAR}-09-01`,
    fisco:{estado:'declarado',numero:'1188417',finalidade:'hp',celebracao:`${YEAR}-08-25`,renovavel:true}});
  const c4=normContract({propertyId:p2,roomId:q3.id,tenantIds:[t4.id,t5.id],rent:430,taxRate:25,deposit:430,payDay:1,
    start:`${YEAR}-07-01`,notes:'Casal, quarto com casa de banho privativa',
    ownerEmail:o1.email,ownerPhone:o1.phone,tenantPhone:'912 000 004'});
  db.contracts=[c1,c2,c3,c4];
  db.transactions=[];
  const k1=loanCalc(l1),k1b=loanCalc(l1b),k3=loanCalc(l3);
  for(let m=1;m<=8;m++){
    const d=n=>`${YEAR}-${String(m).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
    const periodo=`${YEAR}-${String(m).padStart(2,'0')}`;
    db.transactions.push(
      /* o recibo eletrónico da última renda ainda não foi emitido: é o prazo dos recibos a mostrar-se */
      normTx({kind:'income',label:'Renda T2 Lisboa',amount:1250,date:d(8),propertyId:p1,contractId:c1.id,paidBy:o1.id,category:'Rendas',sub:'Renda mensal',
        periodo,recibo:m<8}),
      normTx({kind:'expense',label:'Quota do condomínio',amount:55,date:d(8),propertyId:p1,category:'Condomínio',sub:'Quota mensal',tags:['Recorrente'],paidBy:m%2?o1.id:o2.id}),
      /* o capital em dívida do exemplo é o de hoje, depois destas 8 prestações — que, como
         qualquer prestação registada, repõem o seu capital se as apagares */
      normTx({kind:'loan',label:'Prestação aquisição · T2 Lisboa',amount:Math.round(k1.total*100)/100,date:d(10),propertyId:p1,loanId:l1.id,
        interest:Math.round(k1.interest*100)/100,stamp:Math.round(k1.stamp*100)/100,principal:Math.round(k1.principal*100)/100,paidBy:o1.id}),
      normTx({kind:'loan',label:'Prestação obras · T2 Lisboa',amount:Math.round(k1b.total*100)/100,date:d(10),propertyId:p1,loanId:l1b.id,paidBy:o2.id,
        interest:Math.round(k1b.interest*100)/100,stamp:Math.round(k1b.stamp*100)/100,principal:Math.round(k1b.principal*100)/100}),
      normTx({kind:'loan',label:'Prestação casa de família',amount:Math.round(k3.total*100)/100,date:d(10),propertyId:p3,loanId:l3.id,
        interest:Math.round(k3.interest*100)/100,stamp:Math.round(k3.stamp*100)/100,principal:Math.round(k3.principal*100)/100})
    );
    if(m>=7)db.transactions.push(normTx({kind:'income',label:'Renda Quarto 3',amount:430,date:d(1),propertyId:p2,contractId:c4.id,
      category:'Rendas',sub:'Renda mensal',periodo}));
  }
  db.transactions.push(
    normTx({kind:'expense',label:'IMI '+YEAR,amount:435,date:`${YEAR}-04-28`,propertyId:p1,category:'Impostos',sub:'IMI',tags:['Dedutível'],paidBy:o1.id}),
    normTx({kind:'expense',label:'IMI '+YEAR,amount:540,date:`${YEAR}-04-28`,propertyId:p3,category:'Impostos',sub:'IMI'}),
    normTx({kind:'expense',label:'Seguro multirriscos',amount:96,date:`${YEAR}-02-11`,propertyId:p1,category:'Seguros',sub:'Multirriscos'}),
    normTx({kind:'expense',label:'Pintura da sala',amount:780,date:`${YEAR}-03-02`,propertyId:p1,category:'Obras e benfeitorias',sub:'Pintura',paidBy:o2.id,
      notes:'Orçamento do Sr. Manuel, duas demãos. Ficou combinado repetir daqui a 5 anos.'}),
    /* quatro meses antes de o quarto 3 ser arrendado, com o T3 ainda sem contrato:
       é conservação antes do arrendamento — a coluna das obras dos 24 meses */
    normTx({kind:'expense',label:'Pintura do quarto',amount:220,date:`${YEAR}-03-06`,propertyId:p2,category:'Manutenção e reparações',sub:'Pequenas reparações',
      notes:'Quarto 3, antes de o pôr a arrendar.'}),
    normTx({kind:'expense',label:'Reparação da caldeira',amount:245,date:`${YEAR}-06-14`,propertyId:p2,category:'Manutenção e reparações',sub:'Caldeira / AVAC',tags:['Urgente']}),
    normTx({kind:'expense',label:'Certificado energético',amount:130,date:`${YEAR}-07-20`,propertyId:p2,category:'Serviços profissionais',sub:'Certificado energético'}),
    normTx({kind:'owed',label:'Empréstimo para a entrada',amount:15000,date:`${YEAR-6}-05-02`,propertyId:p1,creditor:'Pai',paidBy:o1.id,
      category:'Empréstimos recebidos',sub:'Família',notes:'Combinado devolver _sem juros_, à medida que houver folga.'}),
    normTx({kind:'repay',label:'Devolução ao pai',amount:2000,date:`${YEAR}-01-15`,propertyId:p1,creditor:'Pai',paidBy:o2.id,
      category:'Dívidas a terceiros',sub:'Reembolso de empréstimo'}),
    /* a coluna do Anexo F escolhida no próprio movimento: um esquentador novo podia
       passar por beneficiação, e o senhorio decidiu que é conservação — a escolha
       manda sobre a regra da categoria */
    normTx({kind:'expense',label:'Substituição do esquentador',amount:640,date:`${YEAR}-05-09`,propertyId:p1,category:'Manutenção e reparações',sub:'Caldeira / AVAC',paidBy:o1.id,
      irsCol:'conservacao',split:{mode:'amount',parts:{[o1.id]:400,[o2.id]:240}},notes:'Dividido por valor: a Maria fica com a parte do termostato.'})
  );
  db.templates=[normTpl({name:'Quota do condomínio',tx:{kind:'expense',label:'Quota do condomínio',amount:55,propertyId:p1,category:'Condomínio',sub:'Quota mensal',tags:['Recorrente'],split:{mode:'equal',parts:{}}}})];
  db.recurring=[normRec({name:'Prestação aquisição · T2 Lisboa',every:'month',next:addDays(today(),3),
      tx:{kind:'loan',label:'Prestação aquisição · T2 Lisboa',amount:Math.round(k1.total*100)/100,propertyId:p1,loanId:l1.id,paidBy:o1.id,split:{mode:'equal',parts:{}}}})];
  if(servicoLigado('recurring')){syncAllContractRecs();syncAllLoanRecs()}   // os planeados automáticos são dos Planeados
  save();buildNav();render();toast('Dados de exemplo carregados.');
}

/* ================= ARRANQUE ================= */
/* O teclado de um menu de escolha vem primeiro (componentes.js:selTecla): as
   setas andam pelas opções, e o Escape com um menu aberto fecha o menu — não
   a janela que está por baixo dele. */
document.addEventListener('keydown',e=>{if(selTecla(e))return;if(e.key==='Escape')closeModal('esc')});
document.addEventListener('click',()=>closePops());
/* Enter ativa o que é clicável mas não é botão nativo (cartões, itens do
   menu): é o que falta para a app inteira andar a teclado. */
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const t=e.target;
  if(!t||!t.hasAttribute||!t.hasAttribute('data-click'))return;
  if(/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName)&&e.key===' ')return;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;
  e.preventDefault();t.click();
});
/* O Tab fica dentro da janela de cima: sem isto o foco saía para a página
   tapada e o leitor de ecrã perdia-se atrás do véu. */
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab'||typeof modalStack==='undefined'||!modalStack.length)return;
  const sheet=modalStack[modalStack.length-1].el.querySelector('.sheet');
  const foc=[].slice.call(sheet.querySelectorAll('button,[href],input,select,textarea,[tabindex]'))
    .filter(x=>x.tabIndex>-1&&!x.disabled&&x.offsetParent!==null);
  if(!foc.length)return;
  const primeiro=foc[0],ultimo=foc[foc.length-1],ativo=document.activeElement;
  if(!sheet.contains(ativo)){e.preventDefault();primeiro.focus();return}
  if(e.shiftKey&&ativo===primeiro){e.preventDefault();ultimo.focus()}
  else if(!e.shiftKey&&ativo===ultimo){e.preventDefault();primeiro.focus()}
});
/* o teclado tapava as caixas de texto no fundo do ecrã
   Recebe: t — o elemento com o foco (aguenta null).
   Devolve: true se é um campo onde se escreve (não uma data, um mês, uma hora, uma
   caixa de marcar nem um ficheiro). */
const typing=t=>!!t&&((/^(INPUT|TEXTAREA)$/.test(t.tagName||'')&&!/^(date|month|time|checkbox|file)$/.test(t.type||''))||t.isContentEditable);
/* o seletor de data é uma janela do sistema: ao escolher, larga o foco para o ecrã voltar ao sítio */
document.addEventListener('change',e=>{const t=e.target;if(t&&t.tagName==='INPUT'&&/^(date|month|time)$/.test(t.type||'')){try{t.blur()}catch(x){}
  [].slice.call(document.querySelectorAll('.sheet.kb')).forEach(x=>x.classList.remove('kb'))}});
// a folha (.sheet) da janela que está por cima, ou null se não há nenhuma aberta
// Devolve: o elemento .sheet dessa janela (nó do DOM), ou null sem janela aberta.
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
/* As derivações do arranque, quando já se souber o que o servidor tem.

   O syncAllContractRecs e o syncAllLoanRecs não são leituras: escrevem em
   db.recurring. Criam a renda planeada, movem o cursor — e APAGAM: as duas
   deitam fora as recorrências automáticas cujo contrato ou cuja hipoteca já
   não aparecem no db (planeados.js). No arranque, o db é o que está neste
   aparelho, e aí «já não aparece» quer muitas vezes dizer «ainda não sei que
   existe»: o estado do servidor não chegou, ou chegou sem os movimentos de um
   imóvel onde o cargo não abre as finanças. O save() a seguir grava isso no
   disco e agenda um envio, e a decisão tomada às escuras sobe.

   Adiar não custa nada a quem está sem rede, porque a espera tem tecto
   (espera.js:sabemosOEstado): sem rede o pedido falha depressa e a espera
   acaba logo, no pior caso — a rede pendurada — são seis segundos, e sem
   sessão nenhuma isto corre já, na mesma linha.
   Devolve: nada — deriva os planeados e grava, assim que houver por que se
   guiar. */
function derivarDoArranque(){
  if(!sabemosOEstado())return void setTimeout(derivarDoArranque,300);
  /* os planeados automáticos (renda e prestação) são dos Planeados: sem esse
     serviço nesta conta não há o que derivar */
  if(servicoLigado('recurring')){syncAllContractRecs();syncAllLoanRecs()}
  save();
}
derivarDoArranque();
/* o separador inicial pode estar desligado nesta conta (a lista fica no
   aparelho): a primeira pintura abre no primeiro que abre, em vez do ecrã
   «está desligado» à espera do estado do servidor — que offline nunca vem */
if(!separadorLigado(tab)){tab=primeiroSeparadorLigado();setPage=''}
fitInsets();applyTheme();buildNav();render();cleanFiles();migrateInline();
/* O aviso do arranque espera por saber, e conta as rendas só nessa altura:
   antes do primeiro estado do servidor, anunciava movimentos por confirmar
   que já tinham sido confirmados noutro aparelho. Se ao fim de dois segundos
   ainda não houver estado, cala-se — mais vale não avisar do que avisar mal. */
(function(){
  // sem Planeados nesta conta não há o que confirmar
  const diz=()=>{const n=servicoLigado('recurring')?recLate().length:0,p=servicoLigado('recurring')?recActive().length:0;
    if(n)toast(n===1?'Atenção: há 1 movimento em atraso por confirmar.':'Atenção: há '+n+' movimentos em atraso por confirmar.');
    else if(p)toast(p===1?'Há 1 movimento por confirmar.':'Há '+p+' movimentos por confirmar.')};
  setTimeout(()=>{if(sabemosOEstado())return diz();
    setTimeout(()=>{if(sabemosOEstado())diz()},1400)},600);
})();
try{window.addEventListener('resize',fitInsets)}catch(e){}
