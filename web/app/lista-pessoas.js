/* ================= PESSOAS, AS LISTAS (serviços tenants e owners) ================= */
/* As listas dos inquilinos e dos proprietários, o cartão de uma pessoa e o
   menu de toque longo. A ficha está em pessoas.js. São dois serviços num
   ficheiro: partilham o cartão e a ficha, e o toque longo decide pelo kind.
   Veio de vistas.js e de componentes.js:lpMenu quando a app passou a
   serviços; regista-se no fim. */
/* cartão de pessoa para as listas: com kind 'tenant' mostra os contratos
   ativos, com 'owner' os imóveis. Ao toque abre a ficha (personModal).
   Recebe: pp — a pessoa (objeto de inquilino ou de proprietário); kind — 'tenant' ou 'owner'.
   Devolve: string HTML do cartão. */
function personCard(pp,kind){
  /* a linha dos contratos (inquilino) ou dos imóveis (proprietário) só com o
     serviço que a alimenta ligado nesta conta: desligado, nem «Sem contrato
     ativo» — seria falar de um serviço que a conta não tem */
  const usa=kind==='tenant'?servicoLigado('contracts'):servicoLigado('properties');
  const cs=!usa?[]:kind==='tenant'?contractsOfTenant(pp.id).filter(ctVivo):propsOf(pp.id);
  return `<div class="card tap" data-lp="per:${esc(kind)}:${esc(pp.id)}" data-fk="per:${esc(kind)}:${esc(pp.id)}" data-toca="camada" data-click="personView('${jsq(kind)}','${jsq(pp.id)}')"><div class="row-between">
    <div class="u-d-flex u-g-12px u-minw-0">
      <div class="avatar">${esc(initials(pp.name))}</div>
      <div class="u-minw-0"><div class="title">${esc(pp.name)}</div>
        <div class="small">${[pp.phone?fmtPhone(pp.phone):'',pp.email].filter(Boolean).map(esc).join(' · ')||'Sem contacto'}${pp.nif?' · NIF '+esc(fmtNIF(pp.nif)):''}</div>
        ${usa?`<div class="small">${kind==='tenant'
          ?(cs.length?cs.map(c=>esc(ctName(c))+' · '+euro(c.rent)+(ctEstado(c)==='futuro'&&c.start?' · a partir de '+dPT(c.start):'')).join('<br>'):'Sem contrato ativo')
          :(cs.length?cs.map(x=>esc(x.name)).join(', '):'Sem imóveis')}</div>`:''}</div></div>
    <div class="u-fx-0-0-auto u-d-flex u-g-6px u-ai-flex-start">
      ${kind==='tenant'&&(pp.files||[]).length?`<span class="badge grey">${ic('clip',12)} ${pp.files.length}</span>`:''}
      ${kebab('per:'+kind+':'+pp.id)}</div></div>
    ${kind==='tenant'&&pp.notes?`<div class="small rich u-mt-10px">${rich(pp.notes)}</div>`:''}</div>`;
}
/* Lista de inquilinos, filtrável por com/sem contrato ativo e por pesquisa;
   ordenação por nome, nº de contratos ou renda.
   Devolve: string com o HTML completo da vista. */
function vTenants(){
  const K='lten',s=lf(K);
  /* o filtro e a ordem por contrato são dos Contratos: desligados nesta
     conta, o seletor some e um filtro guardado de antes deixa de cortar */
  const comCt=servicoLigado('contracts'),ct=comCt?s.ct:'';
  let list=db.tenants.filter(t=>{
    const cs=comCt?contractsOfTenant(t.id).filter(isActive):[];
    const fut=comCt?contractsOfTenant(t.id).filter(c=>ctEstado(c)==='futuro'):[];
    /* três ramos: com dois, quem assinou para 2028 caía em «Sem contrato
       ativo» ao lado de um cartão que mostra o contrato e a data em que
       começa — o ecrã contradizia-se */
    if(ct==='com'&&!cs.length)return false;
    if(ct==='fut'&&!fut.length)return false;
    if(ct==='sem'&&(cs.length||fut.length))return false;
    return lfHit(K,[t.name,t.phone,t.email,t.nif,t.notes,t.nationality,
      comCt?contractsOfTenant(t.id).map(c=>ctName(c)+' '+propName(c.propertyId)).join(' '):''].join(' '));
  });
  list=lfSort(K,list,{nome:t=>t.name,contratos:t=>contractsOfTenant(t.id).filter(isActive).length,
    renda:t=>sum(contractsOfTenant(t.id).filter(isActive).map(c=>c.rent))});
  const head=lfBar(K,comCt?[lfSel(K,'ct',[{v:'',label:'Todos os inquilinos'},{v:'com',label:'Com contrato ativo'},{v:'fut',label:'Com contrato por começar'},{v:'sem',label:'Sem contrato'}])]:[],list.length,
      {opts:[{v:'nome',label:'Ordenar por nome'}].concat(comCt?[{v:'contratos',label:'Ordenar por nº de contratos'},{v:'renda',label:'Ordenar por renda'}]:[])})
    +((!souSoColaborador()||casasComo('tenant.add').length)?fab([{label:'Adicionar inquilino',act:"personModal('tenant')"}]):'');
  if(!db.tenants.length)return head+(esperaDoServidor()||`<div class="empty"><b>Sem inquilinos</b>A ficha guarda só os dados da pessoa. A renda fica no contrato.</div>`);
  if(!list.length)return head+vazioFiltro();
  return head+listaViva('inquilinos',list.map(t=>({chave:'ten:'+t.id,html:personCard(t,'tenant')})));
}
/* Lista de proprietários, filtrável por imóvel, com/sem imóveis e pesquisa;
   ordenação por nome ou nº de imóveis.
   Devolve: string com o HTML completo da vista. */
function vOwners(){
  const K='lown',s=lf(K);
  /* o filtro e a ordem por imóvel são dos Imóveis: desligados nesta conta,
     os seletores somem e um filtro guardado de antes deixa de cortar */
  const comProp=servicoLigado('properties'),pr=comProp?s.pr:'',pf=comProp?s.p:'';
  let list=db.owners.filter(o=>{
    const ps=comProp?propsOf(o.id):[];
    if(pr==='com'&&!ps.length)return false;
    if(pr==='sem'&&ps.length)return false;
    if(pf&&!ps.some(x=>x.id===pf))return false;
    return lfHit(K,[o.name,o.phone,o.email,o.nif,o.notes,ps.map(x=>x.name).join(' ')].join(' '));
  });
  list=lfSort(K,list,{nome:o=>o.name,imoveis:o=>propsOf(o.id).length});
  const head=lfBar(K,comProp?[lfSel(K,'p',[{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p=>({v:p.id,label:'Dono de · '+p.name})))),
      lfSel(K,'pr',[{v:'',label:'Todos os proprietários'},{v:'com',label:'Com imóveis'},{v:'sem',label:'Sem imóveis'}])]:[],list.length,
      {opts:[{v:'nome',label:'Ordenar por nome'}].concat(comProp?[{v:'imoveis',label:'Ordenar por nº de imóveis'}]:[])})
    +fab([{label:'Adicionar proprietário',act:"personModal('owner')"}]);
  if(!db.owners.length)return head+(esperaDoServidor()||`<div class="empty"><b>Sem proprietários</b>Um imóvel pode ter vários. Depois podes filtrar a visão geral por proprietário.</div>`);
  if(!list.length)return head+vazioFiltro();
  return head+listaViva('proprietarios',list.map(o=>({chave:'own:'+o.id,html:personCard(o,'owner')})));
}
/* O menu de toque longo de uma pessoa (data-lp "per:<kind>:<id>"). O handler
   é registado pelos dois serviços e o dono é o do kind: com os Proprietários
   desligados, um cartão de proprietário não abre nada (e o mesmo para os
   Inquilinos). Os outros serviços acrescentam as suas opções por lpExtras.
   Recebe: a — as partes do data-lp (['per', 'owner'|'tenant', id]).
   Devolve: nada — abre a folha de opções (ou nada, se a pessoa já não existir
   ou o serviço do kind estiver desligado). */
function lpPessoa(a){
  const kind=a[1],pid=a[2];
  if(!servicoLigado(kind==='owner'?'owners':'tenants'))return;
  const list=kind==='owner'?db.owners:db.tenants,pp=list.find(x=>x.id===pid);if(!pp)return;
  const ok=kind==='owner'||podeEditarInquilino(pp);
  const opts=ok?[{label:'Editar ficha',icon:'pen',act:()=>personModal(kind,pid)}]:[];
  lpExtrasDe('per',a).forEach(o=>opts.push(o));
  if(ok)opts.push({label:'Apagar',icon:'trash',act:()=>delPerson(kind,pid)});
  return lpShow(pp.name,opts);
}
registarServico({id:'tenants',vistas:{tenants:'vTenants'},lp:{per:'lpPessoa'}});
registarServico({id:'owners',vistas:{owners:'vOwners'},lp:{per:'lpPessoa'}});
