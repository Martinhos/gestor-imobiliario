/* ================= IMÓVEIS, A LISTA (serviço properties) ================= */
/* A lista dos imóveis e o menu de toque longo de um imóvel. A ficha, as
   divisões e as fotos estão em imovel.js. Veio de vistas.js e de
   componentes.js:lpMenu quando a app passou a serviços; regista-se no fim. */
/* Lista de imóveis com pesquisa, filtros (estado, modo de arrendamento) e
   ordenação, como a prancheta M-Casas e com os filtros dos Movimentos
   (vistas.js:lfCabeca): por cima, a pesquisa sempre à vista com o funil do
   painel completo, e os chips rápidos do estado (o do arrendamento só no ecrã
   largo, ou ligado). Não há filtro de proprietário (saiu com o filtro global,
   ambito.js) nem o seletor dos filtros comuns, que aqui não tinham o que
   aplicar; a pesquisa encontra os imóveis pelo nome dos donos. Por baixo,
   um cartão por imóvel com a capa à esquerda (a primeira foto, ou o mosaico
   do imóvel), o nome, a morada, o selo do estado, três números e os selos
   do que pede atenção. Tocar no cartão abre a ficha
   (imovel.js:propView), onde estão o Editar, as ações rápidas e o Apagar: o
   cartão já não tem o ⋮. Os cartões dividem-se pela origem — os meus
   imóveis, os partilhados comigo, aqueles em que colaboro
   (vistas.js:listaPorOrigem) —, e com imóveis de duas origens há o chip
   «Origem» (vistas.js:lfOrigem).
   Devolve: string com o HTML completo da vista. */
function vProperties(){
  const K='lprops',s=lf(K);
  /* o estado (arrendado, vago…) lê-se dos contratos: sem o serviço dos Contratos nesta conta, nem o filtro nem o chip têm de que falar */
  const vEstado=servicoLigado('contracts');
  /* a origem (os meus, partilhados comigo, em que colaboro): o filtro e as secções (vistas.js:lfOrigem, vistas.js:listaPorOrigem) */
  const deOrigem=p=>origemDaCasa(p.id),org=lfOrigem(K,visiveis(),deOrigem);
  const passaSt=p=>!(s.st&&vEstado)||propStatus(p).key===s.st;
  const todos=visiveis().filter(p=>{
    if(s.md){if(p.use!=='investimento')return false;if((p.rentalMode||'inteiro')!==s.md)return false}
    /* a pesquisa encontra também quem lá mora, onde se pode ver os contratos */
    const quem=vEstado&&pode(p.id,'contract.view')?contractsOf(p.id).filter(ctVivo).map(ctNames).join(' '):'';
    return lfHit(K,[p.name,p.address,p.street,p.doorNumber,p.fraction,p.floor,p.postalCode,p.locality,p.concelho,p.freguesia,p.parish,p.notes,ownerNames(p),
      (p.rooms||[]).map(r=>r.name).join(' '),quem].join(' '));
  });
  /* cada campo conta o que passa os OUTROS filtros: o estado conta com a origem, a origem com o estado */
  const resto=org.filtra(todos);
  let list=resto.filter(passaSt);
  /* sem imóveis nenhuns não há o que pesquisar nem filtrar: fica o vazio com o seu botão */
  const head=(!db.properties.length?'':lfCabeca(K,{nome:['imóvel','imóveis'],dos:'dos imóveis',n:list.length,
      campos:[vEstado?imvCampoEstado(resto):null,
        {chave:'md',nome:'Arrendamento',curto:'Todos',rapido:'largo',
          opcoes:[{v:'',label:'Todos os arrendamentos'},{v:'inteiro',label:'Imóvel inteiro'},{v:'quartos',label:'Por quartos'}]},
        org.campo(todos.filter(passaSt),ORIGEM_IMOVEIS.rot)],
      /* a renda e a yield são dos Contratos, a dívida dos Créditos: sem eles, ordenar por elas não ordenava nada */
      ordem:{opcoes:[{v:'nome',label:'Nome'},{v:'valor',label:'Valor'}].concat(vEstado?[{v:'renda',label:'Renda'},{v:'yield',label:'Yield'}]:[])
        .concat(servicoLigado('credits')?[{v:'divida',label:'Dívida'}]:[])}}))
    +(db.properties.length||!podeExemplo()?'':`<div class="toolbar"><button class="btn" data-toca="dados" data-click="seed()">Carregar exemplo</button></div>`);
  list=lfSort(K,list,{nome:p=>p.name,valor:p=>p.value,renda:p=>rentOf(p),divida:p=>debtOf(p),yield:p=>{const r=rentOf(p);return r&&p.value?r*12/p.value:0}});
  if(!list.length){
    const espera=esperaDoServidor();if(espera)return head+espera;
    if(lfCount(K))return head+vazioFiltro();
    return head+`<div class="empty"><b>Sem imóveis</b>Adiciona o primeiro para começares a acompanhar o investimento.${saida('Adicionar imóvel','propModal()','camada')}</div>`;
  }
  const dividas=dividasEntreDonos(list);   /* uma passagem pelos movimentos por pintura, e não seis por cartão */
  const pendentes=imvPendentesPorImovel();   /* e uma pelos planeados */
  return head+listaPorOrigem('imoveis',list,deOrigem,ORIGEM_IMOVEIS.titulos,
    (ps,suf)=>listaViva('imoveis'+suf,ps.map(p=>({chave:'prop:'+p.id,html:imvCartao(p,dividas[p.id]||0,pendentes[p.id]||[])})),'imv-lista'));
}
/* Os textos da origem nos imóveis: os títulos das secções
   (vistas.js:listaPorOrigem) e as escolhas do filtro «Origem» (vistas.js:lfOrigem). */
const ORIGEM_IMOVEIS={titulos:{meu:'Os meus imóveis',partilhado:'Partilhados comigo',colaboro:'Em que colaboro'},
  rot:{todos:'Todos',meu:'Os meus',partilhado:'Partilhados comigo',colaboro:'Em que colaboro'}};
/* Os estados do filtro rápido: o valor do filtro (o «st» do lf('lprops')), o
   rótulo curto e o do seletor. */
const ESTADOS_RAPIDOS=[['','Todos','Todos os estados'],['arrendado','Arrendados','Arrendados'],['parcial','Parciais','Parcialmente arrendados'],
  ['vago','Vagos','Vagos'],['proprio','Uso próprio','Uso próprio']];
/* O campo do estado, o primeiro chip rápido dos imóveis e o primeiro
   seletor do painel (vistas.js:lfCabeca): cada estado com quantos imóveis
   há nele entre os que passam os outros filtros («Vagos · 2»), e o «Todos os
   estados» com todos eles. Só existe com os Contratos ligados, que é de onde
   o estado se lê. Ligado, o chip diz o rótulo curto («Parciais»).
   Recebe: resto — os imóveis que passam os outros filtros (a pesquisa, o modo).
   Devolve: o campo {chave, nome, opcoes, curto, rapido, rotulo, aplicar}. */
function imvCampoEstado(resto){
  const n={};(resto||[]).forEach(p=>{const k=propStatus(p).key;n[k]=(n[k]||0)+1});
  return {chave:'st',nome:'Estado',curto:'Todos',rapido:true,aplicar:imvFiltroRapido,
    rotulo:v=>(ESTADOS_RAPIDOS.find(x=>x[0]===v)||[])[1]||v,
    opcoes:ESTADOS_RAPIDOS.map(([v,,rot])=>({v,label:rot,n:v?n[v]||0:(resto||[]).length}))};
}
/* Filtra os imóveis por um estado — o chip do estado e o seletor do painel
   passam por aqui.
   Recebe: v — a chave do estado ('' para todos, 'arrendado', 'parcial', 'vago', 'proprio').
   Devolve: nada — repinta a vista. */
function imvFiltroRapido(v){lf('lprops').st=String(v||'');render()}
/* A cor do selo de cada estado, a do contrato do redesign: arrendado verde,
   parcial cobalto, vago âmbar, uso próprio cinzento.
   Recebe: k — a chave do estado (registos.js:propStatus).
   Devolve: a classe do .badge ('' é o cobalto). */
function imvCorDoEstado(k){const c={arrendado:'in',parcial:'',vago:'amber',proprio:'grey'};return k in c?c[k]:'grey'}
/* O mosaico de um imóvel sem fotografia: uma das quatro cores, escolhida pelo
   id — sempre a mesma para o mesmo imóvel, em qualquer aparelho. O id passa
   por um FNV-1a e a cor sai dos bits de cima, que são os bem misturados (os
   de baixo de um hash multiplicativo repetem-se entre ids parecidos).
   Recebe: p — o imóvel.
   Devolve: a classe do mosaico ('imv-t0' a 'imv-t3'). */
function imvMosaico(p){
  const s=String((p&&p.id)||'');let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
  return 'imv-t'+((h>>>28)&3);
}
/* A capa do cartão: o mosaico do imóvel e, com fotos que o cargo deixa ver, a
   primeira por cima (o propsDepois pinta-a, pelo id th_) e quantas são.
   Recebe: p — o imóvel; vFile — se o cargo deixa ver as fotos.
   Devolve: o HTML da capa. */
function imvCapa(p,vFile){
  const fs=vFile?(p.photos||[]):[],f=fs[0];
  return `<div class="imv-capa imv-mosaico ${imvMosaico(p)}${f?' pcover':''}"${f?` id="th_${esc(f.id)}"`:''}>${fs.length?`<span class="imv-nfotos">${fs.length} foto${fs.length===1?'':'s'}</span>`:''}</div>`;
}
/* Os três números do cartão, cada um só se o cargo e os serviços o deixam
   ver: com renda, a renda, a yield e a dívida; num imóvel de arrendamento
   sem renda, a renda vazia, o valor e a dívida; num de uso próprio, o valor,
   a aquisição e a dívida.
   Recebe: p — o imóvel; o — {vCt, vRep, vLoan}.
   Devolve: o HTML dos números, ou '' sem nenhum para mostrar. */
function imvNumeros(p,o){
  const rent=o.vCt?rentOf(p):0,kv=[];
  if(rent>0){kv.push(['Renda',imvEuroCurto(rent)]);if(o.vRep)kv.push(['Yield',p.value?pct(rent*12/p.value):'—'])}
  else if(p.use==='investimento'&&o.vCt){kv.push(['Renda','—']);if(o.vRep)kv.push(['Valor',p.value?imvEuroCurto(p.value):'—'])}
  else if(o.vRep){kv.push(['Valor',p.value?imvEuroCurto(p.value):'—']);kv.push(['Aquisição',p.purchase?imvEuroCurto(p.purchase):'—'])}
  if(o.vLoan)kv.push(['Dívida',liveLoans(p).length?imvEuroCurto(debtOf(p)):'—']);
  return kv.length?`<div class="imv-nums">${kv.map(([k,v])=>`<div class="imv-kv"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`:'';
}
/* Um valor em euros para a coluna estreita do cartão. Até ao milhão é o de
   sempre («975 000 €»); a partir dele, em milhões («1,25 M€»), porque sete
   algarismos não cabem nos 75px de uma coluna no telemóvel, e a reticência
   num número de dinheiro esconde o próprio valor (o € e, com mais um
   algarismo, o fim do número). O valor inteiro vai no title (rato) e para os
   leitores de ecrã, que leem «1 250 000 €» e não a abreviatura.
   Recebe: v — o valor em euros (número).
   Devolve: o HTML do valor. */
function imvEuroCurto(v){
  const n=Number(v)||0;
  if(Math.round(Math.abs(n))<1e6)return euro(n);   /* o euro() arredonda: 999 999,60 € já são sete algarismos */
  const m=Math.round(Math.abs(n)/1e4)/100;
  const curto=(n<0?'−':'')+dec(String(m))+' M€';
  return `<span title="${euro(n)}" aria-hidden="true">${curto}</span><span class="imv-so-leitor">${euro(n)}</span>`;
}
/* Os planeados por confirmar de cada imóvel, numa passagem só pelos
   planeados (e não uma por cartão). Nada antes de se saber o estado do
   servidor (espera.js:sabemosOEstado), e nada sem os Planeados nesta conta.
   Devolve: objeto {idDoImóvel: [planeados por confirmar]}. */
function imvPendentesPorImovel(){
  if(!servicoLigado('recurring')||!sabemosOEstado())return {};
  const out={};
  recActive().forEach(r=>{const pid=r.tx&&r.tx.propertyId;if(pid)(out[pid]||(out[pid]=[])).push(r)});
  return out;
}
/* O selo dos por confirmar de um imóvel: vermelho com os que passaram da
   data («1 renda em atraso»), cobalto com os que esperam («2 por confirmar»).
   Só chega cá com os Planeados ligados (imvPendentesPorImovel).
   Recebe: rs — os planeados por confirmar do imóvel.
   Devolve: o HTML do selo, ou ''. */
function imvSeloPendentes(rs){
  if(!rs||!rs.length)return '';
  const late=rs.filter(recIsLate);
  if(late.length){
    const rendas=late.every(r=>r.tx&&r.tx.kind==='income');
    return `<span class="badge red">${late.length}${rendas?(late.length===1?' renda':' rendas'):''} em atraso</span>`;
  }
  return `<span class="badge">${rs.length} por confirmar</span>`;
}
/* O cartão de um imóvel na lista. Num imóvel onde só colaboro, cada número e
   cada selo pede a sua permissão; o que o servidor não mandou não se inventa.
   O estado, a renda e os contratos são dos Contratos, a dívida dos Créditos e
   os por confirmar dos Planeados: com o serviço desligado nesta conta, o
   cartão não os mostra (servicos.js:servicoLigado).
   Recebe: p — o imóvel; divida — o que está por acertar entre os donos
   (dividasEntreDonos); pend — os planeados por confirmar dele.
   Devolve: o HTML do cartão. */
function imvCartao(p,divida,pend){
  const vCt=pode(p.id,'contract.view')&&servicoLigado('contracts'),vRep=pode(p.id,'report.view'),vLoan=pode(p.id,'loan.view')&&servicoLigado('credits'),vFile=pode(p.id,'file.view');
  const st=vCt?propStatus(p):null;
  /* um imóvel já prometido tem de o dizer: sem isto o cartão mostra «Vago»,
     sem renda e sem inquilino, e quem olha para a lista pode anunciá-lo ou
     arrendá-lo outra vez */
  const futuros=vCt?contractsOf(p.id).filter(c2=>ctEstado(c2)==='futuro').length:0;
  const verPend=souDono(p.id)||pode(p.id,'rec.view');
  const selos=[verPend?imvSeloPendentes(pend):'',
    futuros?`<span class="badge">${futuros===1?'1 contrato por começar':futuros+' contratos por começar'}</span>`:'',
    divida>0.005?`<span class="badge grey">${ic('users',12)} ${euro(divida)} entre proprietários</span>`:'',
    p.use==='investimento'&&p.rentalMode==='quartos'?'<span class="badge grey">Por quartos</span>':'',
    seloColaboradores(p)].filter(Boolean).join('');
  return `<div class="card tap imv-card" data-lp="prop:${esc(p.id)}" data-fk="prop:${esc(p.id)}" data-toca="camada" data-click="propView('${jsq(p.id)}')">
    ${imvCapa(p,vFile)}
    <div class="imv-corpo">
      <div class="row-between imv-topo">
        <div><div class="title imv-nome">${esc(p.name)}${seloCargo(p)}</div>
          <div class="small imv-morada">${esc(p.address||'Sem morada')}</div></div>
        ${st?`<span class="badge ${imvCorDoEstado(st.key)}">${esc(st.label)}</span>`:''}
      </div>
      ${imvNumeros(p,{vCt,vRep,vLoan})}
      ${selos?`<div class="imv-selos">${selos}</div>`:''}
      ${souDono(p.id)?'':`<div class="small">${esc(fraseCurtaPodes(p.id))}</div>`}
    </div></div>`;
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
   (creditos.js:lpExtrasCreditosImovel). Num imóvel onde colaboro entram
   também as ações do cargo (acessos.js:acoesNoImovel) que ainda lá não estão —
   as mesmas dos botões da ficha.
   Recebe: a — as partes do data-lp (['prop', id]).
   Devolve: nada — abre a folha de opções (ou nada, se o imóvel já não existir). */
function lpImovel(a){
  const id=a[1],p=prop(id);if(!p)return;
  const opts=pode(id,'house.edit')?[{label:'Editar imóvel',icon:'pen',act:()=>propModal(id)}]:[];
  lpExtrasDe('prop',a).forEach(o=>opts.push(o));
  acoesNoImovel(id).forEach(x=>{if(x.perm!=='house.edit'&&!opts.some(o=>o.label===x.rotulo))opts.push({label:x.rotulo,icon:x.icon,act:()=>correrAcao(x.act)})});
  /* num imóvel que não criei, o mesmo «Apagar imóvel» é sair dele (imovel.js:imvSair, pelo delProp) */
  if(imvPossoApagar(id))opts.push({label:'Apagar imóvel',icon:'trash',act:()=>delProp(id)});
  return lpShow(p.name,opts);
}
registarServico({id:'properties',vistas:{properties:'vProperties'},depois:{properties:'propsDepois'},lp:{prop:'lpImovel'}});
