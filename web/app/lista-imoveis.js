/* ================= IMÓVEIS, A LISTA (serviço properties) ================= */
/* A lista dos imóveis e o menu de toque longo de um imóvel. A ficha, as
   divisões e as fotos estão em imovel.js. Veio de vistas.js e de
   componentes.js:lpMenu quando a app passou a serviços; regista-se no fim. */
/* Lista de imóveis com pesquisa, filtros (estado, modo de arrendamento,
   proprietário — este espelha o filtro global) e ordenação. Cada cartão
   resume estado, renda, yield, dívida, contratos e hipotecas em curso.
   Devolve: string com o HTML completo da vista. */
function vProperties(){
  const K='lprops',s=lf(K);
  let list=visiveis();
  list=list.filter(p=>{
    if(s.st&&propStatus(p).key!==s.st)return false;
    if(s.md){if(p.use!=='investimento')return false;if((p.rentalMode||'inteiro')!==s.md)return false}
    return lfHit(K,[p.name,p.address,p.street,p.doorNumber,p.fraction,p.floor,p.postalCode,p.locality,p.concelho,p.freguesia,p.parish,p.notes,ownerNames(p),
      (p.rooms||[]).map(r=>r.name).join(' ')].join(' '));
  });
  if(!lf(K)._open)lf(K).own=ownerFilter||'';   /* o estado aplicado espelha o filtro global de proprietário */
  const ownSel=db.owners.length?lfSel(K,'own',[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner')))):'';
  /* o estado (arrendado, vago…) lê-se dos contratos: sem o serviço dos Contratos nesta conta, o filtro não tem de que falar */
  const head=lfBar(K,[ownSel,
      servicoLigado('contracts')?lfSel(K,'st',[{v:'',label:'Todos os estados'},{v:'arrendado',label:'Arrendados'},{v:'parcial',label:'Parcialmente arrendados'},{v:'vago',label:'Vagos'},{v:'proprio',label:'Uso próprio'}]):'',
      lfSel(K,'md',[{v:'',label:'Todos os arrendamentos'},{v:'inteiro',label:'Imóvel inteiro'},{v:'quartos',label:'Por quartos'}])],list.length,
      {opts:[{v:'nome',label:'Ordenar por nome'},{v:'valor',label:'Ordenar por valor'},{v:'renda',label:'Ordenar por renda'},{v:'divida',label:'Ordenar por dívida'},{v:'yield',label:'Ordenar por yield'}]})
    +(db.properties.length||!podeExemplo()?'':`<div class="toolbar"><button class="btn" data-toca="dados" data-click="seed()">Carregar exemplo</button></div>`)
    +fab([{label:'Adicionar imóvel',act:'propModal()'}]);
  list=lfSort(K,list,{nome:p=>p.name,valor:p=>p.value,renda:p=>rentOf(p),divida:p=>debtOf(p),yield:p=>{const r=rentOf(p);return r&&p.value?r*12/p.value:0}});
  if(!list.length)return head+(esperaDoServidor()||`<div class="empty"><b>${lfCount(K)?'Nada neste filtro':'Sem imóveis'}</b>${lfCount(K)?'':(db.properties.length?'Nenhum imóvel deste proprietário.':'Adiciona o primeiro para começares a acompanhar o investimento.')}</div>`);
  const dividas=dividasEntreDonos(list);   /* uma passagem pelos movimentos por pintura, e não seis por cartão */
  return head+listaViva('imoveis',list.map(p=>({chave:'prop:'+p.id,html:(p=>{
    const st=propStatus(p),ls=liveLoans(p),ac=activeContracts(p.id),rent=rentOf(p);
    /* um imóvel já prometido tem de o dizer: sem isto o cartão mostra «Vago»,
       sem renda e sem inquilino, e quem olha para a lista pode anunciá-lo ou
       arrendá-lo outra vez */
    const futuros=contractsOf(p.id).filter(c2=>ctEstado(c2)==='futuro');
    const y=rent&&p.value?rent*12/p.value:NaN,own=ownerNames(p);
    /* num imóvel onde só colaboro, cada chip pede a sua permissão; o que o servidor não mandou não se inventa.
       O estado, a renda e os contratos são dos Contratos e a dívida é dos Créditos: com o serviço desligado
       nesta conta, o cartão não os mostra (servicos.js:servicoLigado) */
    const vCt=pode(p.id,'contract.view')&&servicoLigado('contracts'),vRep=pode(p.id,'report.view'),vLoan=pode(p.id,'loan.view')&&servicoLigado('credits'),vFile=pode(p.id,'file.view');
    return `<div class="card tap" data-lp="prop:${esc(p.id)}" data-fk="prop:${esc(p.id)}" data-toca="camada" data-click="propView('${jsq(p.id)}')">
      <div class="row-between">
        <div class="u-minw-0"><div class="title">${esc(p.name)}${seloCargo(p)}</div>
          <div class="small">${esc(p.address||'Sem morada')}${own?' · '+esc(own):''}${ownerFilter&&sh(p)<1?' · <b>'+shareText(p)+'</b>':''}</div></div>
        <div class="u-d-flex u-g-8px u-fx-0-0-auto u-ai-flex-start">
        ${(p.photos||[]).length&&vFile?`<div class="u-fx-0-0-54px"><div class="pcover u-w-54px u-h-44px u-br-10px u-bg-v-chip u-ov-hidden" id="th_${p.photos[0].id}"></div></div>`:''}
        ${kebab('prop:'+p.id)}</div>
      </div>
      <div class="chips">
        ${vCt?`<span class="badge ${st.badge}">${st.label}</span>`:''}
        ${p.use==='investimento'?`<span class="badge grey">${p.rentalMode==='quartos'?'Por quartos':'Imóvel inteiro'}</span>`:''}
        ${rent&&vCt?`<span class="badge">${euroS(rent)}/mês</span>`:''}
        ${isFinite(y)&&vCt&&vRep?`<span class="badge">Yield ${pct(y)}</span>`:''}
        ${vRep?`<span class="badge grey">Valor ${euro(p.value)}</span>`:''}
        ${ls.length&&vLoan?`<span class="badge amber">Dívida ${euro(debtOf(p))}${ls.length>1?' · '+ls.length+' hipotecas':''}</span>`:''}
        ${(dividas[p.id]||0)>0.005?`<span class="badge red">${ic('users',12)} ${euro(dividas[p.id])} entre proprietários</span>`:''}
        ${(p.photos||[]).length&&vFile?`<span class="badge grey">${ic('photo',12)} ${p.photos.length}</span>`:''}
        ${futuros.length&&vCt?`<span class="badge amber">${futuros.length===1?'1 contrato por começar':futuros.length+' contratos por começar'}</span>`:''}
        ${seloColaboradores(p)}</div>
      ${(ac.length||futuros.length)&&vCt?`<div class="small u-mt-10px">${ac.concat(futuros).map(c2=>`${c2.roomId?esc(roomName(p,c2.roomId))+': ':''}${esc(ctNames(c2))} · ${euro(c2.rent)}${ctEstado(c2)==='futuro'&&c2.start?' · a partir de '+dPT(c2.start):''}`).join('<br>')}</div>`:''}
      ${ls.length&&vLoan?`<div class="small u-mt-9px">${ls.map(l=>`${esc(loanName(l))} · ${RATE[l.type]} · ${euro2(loanCalc(l).total)}/mês${(l.files||[]).length?' · '+l.files.length+' doc.':''}`).join('<br>')}
        ${ls.length>1?`<br><b>Total ${euro2(payOf(p))}/mês</b>`:''}</div>`:''}
      </div>`})(p)})));
}
/* O que cada imóvel deve entre os seus proprietários (o propDebt), para uma
   pintura inteira da lista, com uma passagem só pela lista dos movimentos. O
   propDebt de um imóvel lê os acertos e os movimentos dele e os que não têm
   imóvel (os de grupo), e varria a lista inteira três vezes — e o cartão
   chamava-o duas: com 40 imóveis e 4 000 movimentos eram três quartos do
   tempo da pintura, a cada tecla da pesquisa. Aqui os movimentos repartem-se
   uma vez por imóvel, e cada propDebt corre com a db.transactions restrita
   aos do imóvel e aos sem imóvel — a mesma conta (saldos.js:ownerBalances),
   sobre as linhas que ela lê. A lista inteira volta no fim, aconteça o que acontecer.
   Recebe: ps — os imóveis a pintar.
   Devolve: objeto {idDoImóvel: valor em euros} — só dos imóveis de que sou dono. */
function dividasEntreDonos(ps){
  const todos=db.transactions||[],porImovel={},semImovel=[];
  todos.forEach(t=>{if(!t.propertyId)semImovel.push(t);else(porImovel[t.propertyId]||(porImovel[t.propertyId]=[])).push(t)});
  const out={};
  try{(ps||[]).forEach(p=>{if(!souDono(p.id))return;db.transactions=(porImovel[p.id]||[]).concat(semImovel);out[p.id]=propDebt(p.id)})}
  finally{db.transactions=todos}
  return out;
}
/* O que a lista pinta depois de o render pôr o HTML: as miniaturas das fotos.
   Devolve: nada — pinta as miniaturas de cada imóvel dentro do #view. */
function propsDepois(){db.properties.forEach(p=>paintThumbs(p.photos,view()))}
/* O menu de toque longo de um imóvel (data-lp "prop:<id>"). O toque longo é
   para AGIR: ler é o toque simples, que abre a ficha. Um «Ver» aqui duplicava-o
   e nunca mais deixava o menu ficar vazio — e é o menu vazio que faz aparecer
   o aviso «só podes ver este registo». Aqui só entra o que é dos imóveis
   (editar, apagar); o resto vem dos outros serviços, quando estão ligados, por
   lpExtras (servicos.js:lpExtrasDe): «Novo contrato» dos Contratos, a despesa
   dos Movimentos, «Pagamento de crédito» e «Amortização» dos Créditos
   (creditos.js:lpExtrasCreditosImovel).
   Recebe: a — as partes do data-lp (['prop', id]).
   Devolve: nada — abre a folha de opções (ou nada, se o imóvel já não existir). */
function lpImovel(a){
  const id=a[1],p=prop(id);if(!p)return;
  const opts=pode(id,'house.edit')?[{label:'Editar imóvel',icon:'pen',act:()=>propModal(id)}]:[];
  lpExtrasDe('prop',a).forEach(o=>opts.push(o));
  if(souCriador(id))opts.push({label:'Apagar imóvel',icon:'trash',act:()=>delProp(id)});
  return lpShow(p.name,opts);
}
registarServico({id:'properties',vistas:{properties:'vProperties'},depois:{properties:'propsDepois'},lp:{prop:'lpImovel'}});
