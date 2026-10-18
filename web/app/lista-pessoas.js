/* ================= PESSOAS, AS LISTAS (serviços tenants e owners) ================= */
/* As listas dos inquilinos e dos proprietários, a linha de uma pessoa e o
   menu de toque longo. A ficha está em pessoas.js. São dois serviços num
   ficheiro: partilham a linha e a ficha, e o toque longo decide pelo kind.
   Veio de vistas.js e de componentes.js:lpMenu quando a app passou a
   serviços; regista-se no fim.

   O desenho é o do canvas M-Pessoas: por cima, os chips do filtro rápido (o
   segmentado Inquilinos/Proprietários, com quantos há de cada, é da casca —
   navegacao.js:abasDaArea); por baixo, um cartão com uma linha por pessoa: o
   avatar com as iniciais, o nome, onde mora (ou os imóveis de que é dona), os
   selos do que pede atenção e, à direita, a renda. Sem FAB: o «Novo
   inquilino» e o «Novo proprietário» estão no cabeçalho e no + da barra. */

/* A linha de uma pessoa na lista. Num inquilino diz onde mora e desde quando
   (ou que vai morar, ou onde morou), com a renda à direita; num proprietário,
   os imóveis de que é dono e a renda que lhe cabe. Os selos são os do que pede
   atenção: a renda em atraso, o contrato por começar, o cartão de cidadão a
   caducar, a conta Rendorium de outro proprietário. No computador entra ainda
   uma coluna com o contacto. Cada coisa só com o serviço que a alimenta
   ligado nesta conta — desligado, nem «Sem contrato»: seria falar de um
   serviço que a conta não tem; fica o contacto.
   Ao toque abre a ficha (personView); o toque longo abre as opções. Sem o ⋮:
   as opções estão na ficha (o ⋯ da janela) e no toque longo, como nas outras
   listas do canvas.
   Recebe: pp — a pessoa (objeto de inquilino ou de proprietário); kind —
   'tenant' ou 'owner'; sit (opcional) — os contratos do inquilino já
   arrumados (pessoas.js:pesContratos), para a lista não os contar duas vezes.
   Devolve: string HTML da linha. */
function personCard(pp,kind,sit){
  const inq=kind==='tenant',eu=!inq&&!!meuId()&&pp.id===meuId();
  const ver=!inq||pode(casaDoInquilino(pp),'tenant.view');
  const contacto=ver?[pp.phone?fmtPhone(pp.phone):'',pp.email].filter(Boolean).map(esc).join(' · '):'';
  const usa=inq?servicoLigado('contracts'):servicoLigado('properties');
  const selos=[];let sub='',valor=0,apagado=false;
  if(!usa)sub=contacto||(ver?'Sem contacto':'');
  else if(inq){
    const s=sit||pesContratos(pp);
    if(s.ativos.length){
      const c=s.ativos[0];
      sub=s.ativos.length>1?'Mora em '+s.ativos.map(x=>esc(ctLabel(x))).join(', '):(c.roomId?esc(ctLabel(c)):'Mora em '+esc(ctLabel(c)));
      valor=sum(s.ativos.map(x=>Number(x.rent)||0));
      s.ativos.forEach(x=>{const r=pesRenda(x);if(r&&r.cls==='red'&&!selos.length)selos.push(`<span class="badge red">${r.txt}</span>`)});
    }else if(s.futuros.length){
      const f=s.futuros[0];
      sub='Vai morar em '+esc(ctLabel(f))+(f.start?' a partir de '+dPT(f.start):'');
      selos.push('<span class="badge">Por começar</span>');
    }else{
      apagado=true;
      const f=s.findos[0];
      sub=f?'Morou em '+esc(ctLabel(f))+(f.end?' até '+dPT(f.end):''):'Sem contrato';
    }
  }else{
    const casas=propsOf(pp.id);
    sub=casas.length?casas.map(x=>esc(x.name||x.address||'imóvel')).join(' · '):'Sem imóveis';
    valor=pesRendaDoDono(pp,casas);
  }
  if(!inq&&pp._userId&&!eu)selos.push('<span class="badge">Tem conta</span>');
  if(ver)selos.push(pesSeloCC(pp,kind));
  const ss=selos.filter(Boolean).join('');
  return `<div class="linha pes-linha" data-lp="per:${esc(kind)}:${esc(pp.id)}" data-fk="per:${esc(kind)}:${esc(pp.id)}" data-toca="camada" data-click="personView('${jsq(kind)}','${jsq(pp.id)}')">
    ${pesAvatar(pp,false,apagado)}
    <span class="pes-txt"><b class="pes-nome">${esc(pp.name||'(sem nome)')}${eu?' <span class="small">(eu)</span>':''}</b>
      ${sub?`<span class="small pes-sub">${sub}</span>`:''}${ss?`<span class="pes-selos">${ss}</span>`:''}</span>
    <span class="small pes-contacto">${usa?contacto:''}</span>
    <span class="num pes-valor">${valor>0?euro(valor):''}</span></div>`;
}
/* Os chips do filtro rápido (o canvas M-Pessoas): «Todos» e um por valor do
   filtro que o painel já tem (vistas.js:lfSel) — o mesmo estado lf(k)[chave],
   aplicado ao tocar, sem «Aplicar». Cada chip diz quantas pessoas da lista
   (já com a pesquisa) lhe cabem, quando há alguma; o «Todos» não leva número,
   que o segmentado da casca já diz quantos há.
   Recebe: k — a chave da lista ('lten' ou 'lown'); chave — o campo do filtro
   ('ct' ou 'pr'); opcoes — [[valor, rótulo, quantos]]; aria — o nome do grupo,
   para o leitor de ecrã.
   Devolve: o HTML da fila de chips. */
function pesChips(k,chave,opcoes,aria){
  const at=lf(k)[chave]||'';
  return `<div class="chips-fila pes-filtros" role="group" aria-label="${esc(aria)}">${opcoes.map(([v,rot,n])=>
    `<button type="button" class="chip${at===v?' on':''}" aria-pressed="${at===v?'true':'false'}" data-toca="vista" data-click="pesFiltroRapido('${jsq(k)}','${jsq(chave)}','${jsq(v)}')">${esc(rot)}${v&&n?` <span class="n">${n}</span>`:''}</button>`).join('')}</div>`;
}
/* Um chip do filtro rápido foi tocado: muda o filtro e repinta.
   Recebe: k — a chave da lista; chave — o campo do filtro; v — o valor ('' para todos).
   Devolve: nada — repinta a vista. */
function pesFiltroRapido(k,chave,v){lf(k)[chave]=String(v||'');render()}
/* Lista de inquilinos (o canvas M-Pessoas), filtrável por com contrato, por
   começar e sem contrato — nos chips e no painel, que são o mesmo filtro — e
   por pesquisa; ordenação por nome, nº de contratos ou renda.
   Devolve: string com o HTML completo da vista. */
function vTenants(){
  const K='lten',s=lf(K);
  /* o filtro e a ordem por contrato são dos Contratos: desligados nesta
     conta, o seletor e os chips somem e um filtro guardado de antes deixa de cortar */
  const comCt=servicoLigado('contracts'),ct=comCt?s.ct:'';
  const sit={};db.tenants.forEach(t=>{sit[t.id]=pesContratos(t)});
  const achados=db.tenants.filter(t=>lfHit(K,[t.name,t.phone,t.email,t.nif,t.notes,t.nationality,
    comCt?contractsOfTenant(t.id).map(c=>ctName(c)+' '+propName(c.propertyId)).join(' '):''].join(' ')));
  /* três ramos: com dois, quem assinou para 2028 caía em «Sem contrato
     ativo» ao lado de uma linha que mostra o contrato e a data em que
     começa — o ecrã contradizia-se */
  const tem={com:t=>sit[t.id].ativos.length>0,fut:t=>sit[t.id].futuros.length>0,sem:t=>!sit[t.id].ativos.length&&!sit[t.id].futuros.length};
  let list=tem[ct]?achados.filter(tem[ct]):achados;
  list=lfSort(K,list,{nome:t=>t.name,contratos:t=>sit[t.id].ativos.length,renda:t=>sum(sit[t.id].ativos.map(c=>c.rent))});
  const adiciona=!souSoColaborador()||casasComo('tenant.add').length;   /* a condição do botão do vazio */
  const n=k=>achados.filter(tem[k]).length;
  const head=lfBar(K,comCt?[lfSel(K,'ct',[{v:'',label:'Todos os inquilinos'},{v:'com',label:'Com contrato ativo'},{v:'fut',label:'Com contrato por começar'},{v:'sem',label:'Sem contrato'}])]:[],list.length,
      {opts:[{v:'nome',label:'Ordenar por nome'}].concat(comCt?[{v:'contratos',label:'Ordenar por nº de contratos'},{v:'renda',label:'Ordenar por renda'}]:[])})
    +(comCt&&db.tenants.length?pesChips(K,'ct',[['','Todos'],['com','Com contrato',n('com')],['fut','Por começar',n('fut')],['sem','Sem contrato',n('sem')]],'Filtrar pelo contrato'):'');
  if(!db.tenants.length)return head+(esperaDoServidor()||`<div class="empty"><b>Sem inquilinos</b>A ficha guarda só os dados da pessoa. A renda fica no contrato.${adiciona?saida('Adicionar inquilino',"personModal('tenant')",'camada'):''}</div>`);
  if(!list.length)return head+vazioFiltro();
  return head+listaViva('inquilinos',list.map(t=>({chave:'ten:'+t.id,html:personCard(t,'tenant',sit[t.id])})),'pes-lista');
}
/* Lista de proprietários, na mesma família: filtrável por imóvel (no painel),
   com e sem imóveis (nos chips e no painel, o mesmo filtro) e pesquisa;
   ordenação por nome ou nº de imóveis.
   Devolve: string com o HTML completo da vista. */
function vOwners(){
  const K='lown',s=lf(K);
  /* o filtro e a ordem por imóvel são dos Imóveis: desligados nesta conta,
     os seletores e os chips somem e um filtro guardado de antes deixa de cortar */
  const comProp=servicoLigado('properties'),pr=comProp?s.pr:'',pf=comProp?s.p:'';
  const achados=db.owners.filter(o=>{
    const ps=comProp?propsOf(o.id):[];
    if(pf&&!ps.some(x=>x.id===pf))return false;
    return lfHit(K,[o.name,o.phone,o.email,o.nif,o.notes,ps.map(x=>x.name).join(' ')].join(' '));
  });
  const tem={com:o=>propsOf(o.id).length>0,sem:o=>!propsOf(o.id).length};
  let list=tem[pr]?achados.filter(tem[pr]):achados;
  list=lfSort(K,list,{nome:o=>o.name,imoveis:o=>propsOf(o.id).length});
  const n=k=>achados.filter(tem[k]).length;
  const head=lfBar(K,comProp?[lfSel(K,'p',[{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p=>({v:p.id,label:'Dono de · '+p.name})))),
      lfSel(K,'pr',[{v:'',label:'Todos os proprietários'},{v:'com',label:'Com imóveis'},{v:'sem',label:'Sem imóveis'}])]:[],list.length,
      {opts:[{v:'nome',label:'Ordenar por nome'}].concat(comProp?[{v:'imoveis',label:'Ordenar por nº de imóveis'}]:[])})
    +(comProp&&db.owners.length?pesChips(K,'pr',[['','Todos'],['com','Com imóveis',n('com')],['sem','Sem imóveis',n('sem')]],'Filtrar pelos imóveis'):'');
  if(!db.owners.length)return head+(esperaDoServidor()||`<div class="empty"><b>Sem proprietários</b>Um imóvel pode ter vários. Depois podes filtrar a visão geral por proprietário.${saida('Adicionar proprietário',"personModal('owner')",'camada')}</div>`);
  if(!list.length)return head+vazioFiltro();
  return head+listaViva('proprietarios',list.map(o=>({chave:'own:'+o.id,html:personCard(o,'owner')})),'pes-lista');
}
/* O menu de toque longo de uma pessoa (data-lp "per:<kind>:<id>"). O handler
   é registado pelos dois serviços e o dono é o do kind: com os Proprietários
   desligados, um cartão de proprietário não abre nada (e o mesmo para os
   Inquilinos). Os outros serviços acrescentam as suas opções por lpExtras.
   O «Editar ficha» segue a mesma regra do «Editar» da ficha
   (pessoas.js:personEditavel): o perfil de outro proprietário com conta só
   o edita quem tem a conta (o que se gravasse aqui perdia-se no pull
   seguinte), e o meu perfil abre o «O meu perfil» da nuvem, que é quem sabe
   guardá-lo — sem a nuvem (os testes do serviço sozinho), a ficha local.
   Recebe: a — as partes do data-lp (['per', 'owner'|'tenant', id]).
   Devolve: nada — abre a folha de opções (ou nada, se a pessoa já não existir
   ou o serviço do kind estiver desligado; no perfil de outro com conta e sem
   opções, o aviso de quem o edita). */
function lpPessoa(a){
  const kind=a[1],pid=a[2];
  if(!servicoLigado(kind==='owner'?'owners':'tenants'))return;
  const list=kind==='owner'?db.owners:db.tenants,pp=list.find(x=>x.id===pid);if(!pp)return;
  const ok=personEditavel(kind,pp);
  const euSou=kind==='owner'&&!!(window.CW&&CW.user&&CW.user.id===pp.id&&CW.editProfile);
  const opts=ok?[{label:'Editar ficha',icon:'pen',act:euSou?()=>CW.editProfile():()=>personModal(kind,pid)}]:[];
  lpExtrasDe('per',a).forEach(o=>opts.push(o));
  if(ok&&personApagavel(kind,pp))opts.push({label:'Apagar',icon:'trash',act:()=>delPerson(kind,pid)});
  /* sem opções, o lpShow diz que é o cargo que não deixa; no perfil de outro
     proprietário com conta não é o cargo, é de quem é (a nota da ficha) */
  if(!opts.length&&kind==='owner'&&!ok){closeAllModals();return toast('Este perfil é de '+(pp.name||'quem tem a conta')+', que tem conta: só quem tem a conta o edita.')}
  return lpShow(pp.name,opts);
}
registarServico({id:'tenants',vistas:{tenants:'vTenants'},lp:{per:'lpPessoa'}});
registarServico({id:'owners',vistas:{owners:'vOwners'},lp:{per:'lpPessoa'}});
