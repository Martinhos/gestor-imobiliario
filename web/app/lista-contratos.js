/* ================= CONTRATOS, A LISTA (serviço contracts) ================= */
/* A lista dos contratos, agrupada, com as rendas dos grupos, e o menu de
   toque longo de um contrato. A ficha está em contrato.js e o PDF em
   contrato-pdf.js. Veio de vistas.js e de componentes.js:lpMenu quando a app
   passou a serviços; regista-se no fim. */
/* O total de cada imóvel, escrito depois de a lista estar reconciliada.

   Fica fora da assinatura do grupo de propósito: o rentOf(p) muda sempre que
   um contrato daquele imóvel muda de renda ou de datas, e dentro dela isso
   refazia o grupo inteiro — e com ele todos os cartões, que é o contrário do
   que este motor existe para fazer. É a mesma solução do saldo do mês nos
   movimentos.
   Devolve: nada — enche os spans dos títulos dos grupos. */
function pintarRendasDosGrupos(){
  const raiz=view();if(!raiz)return;
  [].slice.call(raiz.querySelectorAll('[data-chave^="imovel:"]')).forEach(function(g){
    const p=prop(String(g.getAttribute('data-chave')).slice(7));
    const sp=g.querySelector('.ctrenda');
    if(p&&sp)sp.textContent=euroS(rentOf(p))+'/mês';
  });
}
/* Contratos agrupados por imóvel, com a renda mensal de cada um no cabeçalho
   da secção. Filtros: imóvel, ativos/terminados, grupo e pesquisa; ordenação
   por nome, renda ou data de início.
   Devolve: string com o HTML completo da vista. */
function vContracts(){
  const K='lcts',s=lf(K),cgs=grpsOf('contract');
  const head=lfBar(K,[
      lfSel(K,'p',lfPropOpts()),
      lfSel(K,'st',[{v:'',label:'Todos os estados'},{v:'on',label:'Em vigor'},{v:'fut',label:'Por começar'},{v:'off',label:'Terminados'}])]
      .concat(cgs.length?[lfSel(K,'g',[{v:'',label:'Todos os grupos'}].concat(cgs.map(g=>({v:g.id,label:'Grupo · '+g.name}))))]:[]),
      db.contracts.filter(c=>ctFMatch(c,s)).length,
      {opts:[{v:'nome',label:'Ordenar por nome'},{v:'renda',label:'Ordenar por renda'},{v:'inicio',label:'Ordenar por início'}]})
    +(casasComo('contract.add').length?fab([{label:'Novo contrato',act:'ctModal()'}]):'');
  if(!db.properties.length)return head+(esperaDoServidor()||`<div class="empty"><b>Cria primeiro um imóvel</b>Um contrato liga um imóvel a um ou mais inquilinos.
    ${saida('Adicionar imóvel',"go('properties')",'ecra')}</div>`);
  if(!db.contracts.length)return head+`<div class="empty"><b>Sem contratos</b>O contrato é onde vive a renda: podes arrendar o imóvel inteiro, ou um contrato por quarto.</div>`;
  let any=false;
  const grupos=[];
  visiveis().forEach(p=>{
    if(s.p&&p.id!==s.p)return;
    const cs=lfSort(K,contractsOf(p.id).filter(c=>ctFMatch(c,s)),{nome:c=>ctName(c),renda:c=>c.rent,inicio:c=>c.start||''});if(!cs.length)return;
    any=true;
    /* Um grupo é UM elemento: o pecaDe fica com o primeiro filho do html de
       cada item, e dois irmãos — o título e a lista — perdiam o segundo em
       silêncio. E o total do imóvel sai da assinatura para um span vazio,
       preenchido depois de reconciliar: dentro dela, mudar uma renda refazia
       o grupo inteiro e com ele todos os cartões, que é o contrário do que
       este motor existe para fazer. */
    grupos.push({chave:'imovel:'+p.id,sig:'imovel|'+p.id+'|'+p.name,html:`<div class="ctgrupo">
      <div class="section-title u-d-flex u-jc-space-between u-tt-none">
      <span>${esc(p.name)}</span><span class="ctrenda"></span></div>
      `+listaViva('cts:'+p.id,cs.map(c=>({chave:'ct:'+c.id,html:((c)=>{
        const on=ctEstado(c),ts=ctTenants(c);
        return `<div class="card tap" data-lp="ct:${esc(c.id)}" data-fk="ct:${esc(c.id)}" data-toca="camada" data-click="ctView('${jsq(c.id)}')">
        <div class="row-between">
          <div class="u-minw-0">
            <div class="title">${esc(ctName(c))} ${on==='ativo'?'':`<span class="badge ${on==='futuro'?'amber':'grey'}">${on==='futuro'?'por começar':'terminado'}</span>`}</div>
            <div class="small">${c.roomId?esc(roomName(p,c.roomId)):'Imóvel inteiro'} · ${c.start?'De '+dPT(c.start):'Sem data de início'}${c.end?' a '+dPT(c.end):''}</div>
          </div>
          <div class="u-d-flex u-g-8px u-fx-0-0-auto u-ai-flex-start">
            <div class="u-ta-right"><div class="u-fw-750 u-fs-16px">${euro(c.rent)}</div>
            <div class="small">líquido ${euro(netRent(c))} · imposto ${dec(taxRateOf(c))}%${Number(c.taxRate)>0?'':' (estim.)'}</div></div>
            ${kebab('ct:'+c.id)}</div></div>
        ${ts.length?`<div class="u-mt-9px">${ts.map(t=>`<div class="small u-d-flex u-ai-center u-g-7px u-p-2px-0">
          ${ic('users',13)}<span class="u-fx-1 u-minw-0 u-ov-hidden u-to-ellipsis u-ws-nowrap">${esc(t.name)}</span>
</div>`).join('')}</div>`:''}
        <div class="chips">
          ${(c.files||[]).length?`<span class="badge grey">${ic('clip',12)} ${c.files.length}</span>`:''}
          ${(c.inventory||[]).length?`<span class="badge grey">${ic('box',12)} ${c.inventory.length} artigos</span>`:''}</div>
</div>`})(c)})))+`</div>`});
  });
  return head+(any?listaViva('contratos',grupos):vazioFiltro());
}
// um contrato passa nos filtros da lista? imóvel, estado, grupo e pesquisa por texto (nome, inquilinos, IBAN, notas…)
// Recebe: c — o contrato (objeto); s — o estado dos filtros da lista (lf('lcts'): campos p, st, g e a pesquisa).
// Devolve: true se o contrato passa em todos os filtros, false caso contrário.
function ctFMatch(c,s){
  if(s.p&&c.propertyId!==s.p)return false;
  /* três ramos e não a negação de um booleano: com dois, um contrato que
     ainda não começou caía em «Terminados», que é o separador errado com o
     rótulo errado */
  if(s.st==='on'&&ctEstado(c)!=='ativo')return false;
  if(s.st==='fut'&&ctEstado(c)!=='futuro')return false;
  if(s.st==='off'&&ctEstado(c)!=='terminado')return false;
  if(s.g){const g=grp(s.g);if(!g||(g.ids||[]).indexOf(c.id)<0)return false}
  const p=prop(c.propertyId),ts=ctTenants(c);
  return lfHit('lcts',[ctName(c),c.name,p?p.name:'',c.roomId&&p?roomName(p,c.roomId):'',c.iban,c.notes,String(c.rent),
    ts.map(t=>[t.name,t.phone,t.email,t.nif].join(' ')).join(' '),c.tenantEmail,c.tenantPhone,c.ownerEmail,c.ownerPhone].join(' '));
}
/* O menu de toque longo de um contrato (data-lp "ct:<id>"): só o que é dos
   contratos — editar, o PDF, terminar ou reativar, apagar. O «Registar renda»
   é dos movimentos, e são eles que o trazem por lpExtras (servicos.js:
   lpExtrasDe) quando estão ligados nesta conta; desligados, a opção some sem
   este ficheiro dar por isso.
   Recebe: a — as partes do data-lp (['ct', id]).
   Devolve: nada — abre a folha de opções (ou nada, se o contrato já não existir). */
function lpContrato(a){
  const id=a[1],c=contract(id);if(!c)return;
  const ok=podeEditar(c.propertyId,'contract.add',c);
  const opts=ok?[{label:'Editar contrato',icon:'pen',act:()=>ctModal(id)}]:[];
  /* o que os outros serviços acrescentam («Registar renda», dos Movimentos)
     entra logo a seguir a Editar, antes do PDF — a ordem de sempre */
  lpExtrasDe('ct',a).forEach(o=>opts.push(o));
  opts.push({label:'Gerar contrato em PDF',icon:'pen',act:()=>generateContractPdf(id)});
  if(ok)opts.push(ctEstado(c)!=='terminado'?{label:'Terminar contrato',icon:'x',act:()=>endContract(id)}:{label:'Reativar contrato',icon:'check',act:()=>reactivateContract(id)},
    {label:'Apagar contrato',icon:'trash',act:()=>delContract(id)});
  return lpShow(ctName(c),opts);
}
/* O que os Contratos acrescentam ao menu de toque longo de um IMÓVEL (data-lp
   "prop:<id>"): «Novo contrato», já com o imóvel escolhido. Só num imóvel de
   arrendamento onde se pode adicionar contratos — a mesma condição de sempre,
   que antes vivia no ficheiro dos imóveis e agora vive aqui, para os imóveis
   não terem de saber que os contratos existem.
   Recebe: a — as partes do data-lp (['prop', id]).
   Devolve: um array de {label, icon, act} — vazio quando não se aplica. */
function lpExtrasContratosImovel(a){
  const id=a[1],p=prop(id);if(!p)return [];
  return p.use==='investimento'&&pode(id,'contract.add')?[{label:'Novo contrato',icon:'contract',act:()=>ctModal(null,id)}]:[];
}
/* O que os Contratos acrescentam ao menu de toque longo de uma PESSOA (data-lp
   "per:<kind>:<id>"): «Novo contrato», já com o inquilino dentro. Só nos
   inquilinos, e só quando há um imóvel de arrendamento onde se pode
   adicionar contratos — sem isso o ctModal só tinha um aviso para dar.
   Recebe: a — as partes do data-lp (['per', 'owner'|'tenant', id]).
   Devolve: um array de {label, icon, act} — vazio quando não se aplica. */
function lpExtrasContratosPessoa(a){
  if(a[1]!=='tenant'||!tenant(a[2]))return [];
  if(!casasComo('contract.add').some(p=>p.use==='investimento'))return [];
  const tid=a[2];
  return [{label:'Novo contrato',icon:'contract',act:()=>ctModal(null,null,tid)}];
}
registarServico({id:'contracts',vistas:{contracts:'vContracts'},depois:{contracts:'pintarRendasDosGrupos'},lp:{ct:'lpContrato'},
  lpExtras:{prop:'lpExtrasContratosImovel',per:'lpExtrasContratosPessoa'}});
