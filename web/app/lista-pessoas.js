/* ================= PESSOAS, AS LISTAS (serviços tenants e owners) ================= */
/* As listas dos inquilinos e dos proprietários, a linha de uma pessoa e a
   folha das opções (o toque longo nos inquilinos seleciona vários). A ficha
   está em pessoas.js. São dois serviços num ficheiro: partilham a linha e a
   ficha, e a folha das opções decide pelo kind.
   Veio de vistas.js e de componentes.js:lpMenu quando a app passou a
   serviços; regista-se no fim.

   O desenho é o do canvas M-Pessoas, com os filtros dos Movimentos
   (vistas.js:lfCabeca): por cima, a pesquisa à vista com o funil e os chips
   do filtro rápido (o segmentado Inquilinos/Proprietários, com quantos há de
   cada, é da casca — navegacao.js:abasDaArea); por baixo, um cartão com uma linha por pessoa: o
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
   Ao toque abre a ficha (personView). O toque longo num inquilino entra na
   seleção de vários com ele marcado, como nas Casas
   (cloud/selecao-listas.js:lpLongo, que põe a caixa antes do avatar); num
   proprietário não faz nada. Sem o ⋮: as opções de um só estão na ficha (o
   ⋯ da janela), como nas outras listas do canvas.
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
  if(ver)selos.push(pesSeloCC(pp,kind));
  const ss=selos.filter(Boolean).join('');
  return `<div class="linha pes-linha" data-lp="per:${esc(kind)}:${esc(pp.id)}" data-fk="per:${esc(kind)}:${esc(pp.id)}" data-toca="camada" data-click="personView('${jsq(kind)}','${jsq(pp.id)}')">
    ${pesAvatar(pp,false,apagado)}
    <span class="pes-txt"><b class="pes-nome">${esc(pp.name||'(sem nome)')}${eu?' <span class="small">(eu)</span>':''}</b>
      ${sub?`<span class="small pes-sub">${sub}</span>`:''}${ss?`<span class="pes-selos">${ss}</span>`:''}</span>
    <span class="small pes-contacto">${usa?contacto:''}</span>
    <span class="num pes-valor">${valor>0?euro(valor):''}</span></div>`;
}
/* O campo do filtro rápido das pessoas, o primeiro chip da lista e o primeiro
   seletor do painel (vistas.js:lfCabeca): nos inquilinos o contrato, nos
   proprietários os imóveis. Cada escolha diz quantas pessoas da lista (já com
   a pesquisa e os outros filtros) lhe cabem («Com contrato · 2»); o «Todos»
   não leva número, que o segmentado da casca já diz quantos há. Ligado, o
   chip diz o rótulo curto («Por começar»).
   Recebe: k — a chave da lista ('lten' ou 'lown'); chave — o campo do filtro
   ('ct' ou 'pr'); nome — o nome do campo («Contrato»); opcoes — [[valor,
   rótulo curto, rótulo da escolha, quantos]], com o '' primeiro.
   Devolve: o campo {chave, nome, opcoes, curto, rapido, rotulo, aplicar}. */
function pesChips(k,chave,nome,opcoes){
  return {chave:chave,nome:nome,curto:'Todos',rapido:true,aplicar:v=>pesFiltroRapido(k,chave,v),
    rotulo:v=>((opcoes.find(x=>x[0]===v)||[])[1])||v,
    opcoes:opcoes.map(([v,,rot,n])=>v?{v:v,label:rot,n:n||0}:{v:'',label:rot})};
}
/* O filtro rápido das pessoas mudou (o chip ou o seletor do painel): muda o
   filtro e repinta.
   Recebe: k — a chave da lista; chave — o campo do filtro; v — o valor ('' para todos).
   Devolve: nada — repinta a vista. */
function pesFiltroRapido(k,chave,v){lf(k)[chave]=String(v||'');render()}
/* Lista de inquilinos (o canvas M-Pessoas), com os filtros dos Movimentos
   (vistas.js:lfCabeca): a pesquisa à vista com o funil do painel completo e o
   chip do contrato — com contrato, por começar, sem contrato —, que é o mesmo
   filtro do seletor do painel; ordenação por nome, nº de contratos ou renda
   (no painel e, no ecrã largo, no chip). Sem inquilinos não há barra: fica o
   vazio com o seu botão. As linhas dividem-se pela origem da casa de cada um
   — os meus inquilinos, os partilhados comigo, aqueles em que colaboro
   (vistas.js:listaPorOrigem) —, e com inquilinos de duas origens há o chip
   «Origem» (vistas.js:lfOrigem).
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
  /* a origem segue a casa do inquilino (acessos.js:origemDoInquilino): o filtro
     e as secções (vistas.js:lfOrigem, vistas.js:listaPorOrigem); cada campo
     conta o que passa os OUTROS filtros */
  const org=lfOrigem(K,db.tenants,origemDoInquilino),doCt=xs=>tem[ct]?xs.filter(tem[ct]):xs;
  const resto=org.filtra(achados);
  let list=doCt(resto);
  list=lfSort(K,list,{nome:t=>t.name,contratos:t=>sit[t.id].ativos.length,renda:t=>sum(sit[t.id].ativos.map(c=>c.rent))});
  const adiciona=!souSoColaborador()||casasComo('tenant.add').length;   /* a condição do botão do vazio */
  const n=k=>resto.filter(tem[k]).length;
  /* sem inquilinos nenhuns não há o que pesquisar nem filtrar: fica o vazio com o seu botão */
  if(!db.tenants.length)return esperaDoServidor()||`<div class="empty"><b>Sem inquilinos</b>A ficha guarda só os dados da pessoa. A renda fica no contrato.${adiciona?saida('Adicionar inquilino',"personModal('tenant')",'camada'):''}</div>`;
  const head=lfCabeca(K,{nome:['inquilino','inquilinos'],dos:'dos inquilinos',n:list.length,
    campos:[comCt?pesChips(K,'ct','Contrato',[['','Todos','Todos os inquilinos'],['com','Com contrato','Com contrato ativo',n('com')],
      ['fut','Por começar','Com contrato por começar',n('fut')],['sem','Sem contrato','Sem contrato',n('sem')]]):null,
      org.campo(doCt(achados),ORIGEM_INQUILINOS.rot)],
    ordem:{opcoes:[{v:'nome',label:'Nome'}].concat(comCt?[{v:'contratos',label:'Nº de contratos'},{v:'renda',label:'Renda'}]:[]),rapido:'largo'}});
  if(!list.length)return head+vazioFiltro();
  return head+listaPorOrigem('inquilinos',list,origemDoInquilino,ORIGEM_INQUILINOS.titulos,
    (ts,suf)=>listaViva('inquilinos'+suf,ts.map(t=>({chave:'ten:'+t.id,html:personCard(t,'tenant',sit[t.id])})),'pes-lista'));
}
/* Os textos da origem nos inquilinos: os títulos das secções
   (vistas.js:listaPorOrigem) e as escolhas do filtro «Origem» (vistas.js:lfOrigem). */
const ORIGEM_INQUILINOS={titulos:{meu:'Os meus inquilinos',partilhado:'Partilhados comigo',colaboro:'Em que colaboro'},
  rot:{todos:'Todos',meu:'Os meus',partilhado:'Partilhados comigo',colaboro:'Em que colaboro'}};
/* A partilha entre contas, por baixo da lista dos proprietários: as
   ligações a outros utilizadores, os pedidos e a ligação de partilha. É da
   nuvem (cloud/partilha.js:comproprietariosHtml põe-na aqui); sem ela, nada.
   Devolve: o HTML (texto), ou ''. */
let partilhaDosDonos=null;
/* O que a nuvem põe por baixo da lista dos proprietários (partilhaDosDonos),
   e um erro lá não leva a lista consigo.
   Recebe: nada.
   Devolve: o HTML (texto), ou ''. */
function partilhaNosDonos(){
  if(!partilhaDosDonos)return '';
  try{const h=partilhaDosDonos();return h||''}catch(e){return ''}
}
/* Lista de proprietários, na mesma família: a pesquisa à vista com o funil,
   o chip dos imóveis — com e sem imóveis, o mesmo filtro do seletor do painel
   — e o do imóvel de que é dono (só no ecrã largo, ou ligado); ordenação por
   nome ou nº de imóveis. Sem proprietários não há barra. Por baixo, com
   sessão, a partilha com outras contas (partilhaNosDonos) — a não ser à
   espera do servidor, em que fica só a roda.
   Devolve: string com o HTML completo da vista. */
function vOwners(){
  const K='lown',s=lf(K);
  /* o filtro e a ordem por imóvel são dos Imóveis: desligados nesta conta,
     os seletores e os chips somem e um filtro guardado de antes deixa de cortar */
  const comProp=servicoLigado('properties'),pr=comProp?s.pr:'',pf=comProp?s.p:'';
  const donos=donosComPartilha();
  const achados=donos.filter(o=>{
    const ps=comProp?propsOf(o.id):[];
    if(pf&&!ps.some(x=>x.id===pf))return false;
    return lfHit(K,[o.name,o.phone,o.email,o.nif,o.notes,ps.map(x=>x.name).join(' ')].join(' '));
  });
  const tem={com:o=>propsOf(o.id).length>0,sem:o=>!propsOf(o.id).length};
  let list=tem[pr]?achados.filter(tem[pr]):achados;
  list=lfSort(K,list,{nome:o=>o.name,imoveis:o=>propsOf(o.id).length});
  const n=k=>achados.filter(tem[k]).length;
  /* sem ninguém com quem partilhe não há o que pesquisar nem filtrar: fica o
     vazio, que diz como a lista se enche — a ligação a outra conta, logo por
     baixo; não há ficha à mão para criar */
  if(!donos.length)return esperaDoServidor()||'<div class="empty"><b>Sem proprietários</b>Aqui ficam as outras contas Rendorium com quem partilhas casas. Liga-te a outra conta em «Partilhar com outras contas», aqui por baixo.</div>'+partilhaNosDonos();
  const head=lfCabeca(K,{nome:['proprietário','proprietários'],dos:'dos proprietários',n:list.length,
    campos:comProp?[pesChips(K,'pr','Imóveis',[['','Todos','Todos os proprietários'],['com','Com imóveis','Com imóveis',n('com')],['sem','Sem imóveis','Sem imóveis',n('sem')]]),
      db.properties.length?{chave:'p',nome:'Dono de',curto:'Qualquer imóvel',rapido:'largo',rotulo:v=>'Dono de '+propName(v),
        opcoes:[{v:'',label:'Qualquer imóvel'}].concat(db.properties.map(p=>({v:p.id,label:p.name})))}:null]:[],
    ordem:{opcoes:[{v:'nome',label:'Nome'}].concat(comProp?[{v:'imoveis',label:'Nº de imóveis'}]:[]),rapido:'largo'}});
  if(!list.length)return head+vazioFiltro()+partilhaNosDonos();
  return head+listaViva('proprietarios',list.map(o=>({chave:'own:'+o.id,html:personCard(o,'owner')})),'pes-lista')+partilhaNosDonos();
}
/* A folha das opções de uma pessoa (data-lp "per:<kind>:<id>"), a que o
   componentes.js:lpMenu dá a vez. Na lista o toque longo já não a abre —
   entra na seleção de vários (cloud/selecao-listas.js:lpLongo) —, mas fica
   como o handler do prefixo: é por ela que os outros serviços juntam as suas
   opções (lpExtras), e o lpMenu continua a abri-la. O handler
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
