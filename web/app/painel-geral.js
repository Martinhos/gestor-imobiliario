/* ================= VISÃO GERAL (serviço dashboard) ================= */
/* O painel: os cartões dos indicadores, o donut das despesas por categoria e
   as despesas sem imóvel. Veio de vistas.js quando a app passou a serviços;
   regista-se no fim (servicos.js:registarServico). */
/* visão geral: proprietário e imóvel
   Devolve: string HTML do painel de análise com os dois seletores. */
function dashBar(){return anaPanelPadrao('dashPropSel',dashProp,'onDashProp')}
// muda o imóvel (ou grupo) em foco na visão geral
// Devolve: nada — redesenha a vista.
function onDashProp(){dashProp=val('dashPropSel')||'';render()}
/* Visão geral: KPIs do ano (com evolução ao toque), gráficos mensais, donut
   das despesas, resumo do portefólio e saldos entre proprietários. Os rácios
   de rentabilidade vivem na Avaliação. Respeita o filtro de proprietário
   (valores na quota-parte) e o imóvel/grupo em foco; devolve o HTML completo da vista.
   Devolve: string com o HTML completo da vista. */
function vDashboard(){
  if(dashProp&&!pidProps(dashProp).length)dashProp='';
  const pid=dashProp||null,m=metrics(YEAR,pid,{share:true});
  const dp=pid&&!String(pid).startsWith('g:')?prop(pid):null;
  const dpName=pid?(dp?dp.name:'Grupo · '+((grp(String(pid).slice(2))||{}).name||'')):'';
  /* o primeiro passo é um imóvel, e o botão é do serviço dos Imóveis: com ele
     desligado nesta conta o botão não se escreve, e a frase diz quem o liga */
  if(!db.properties.length&&!db.transactions.length)
    return esperaDoServidor()||`<div class="empty"><b>Ainda não há nada registado</b>${servicoLigado('properties')?'Começa por adicionar um imóvel'+(podeExemplo()?', ou carrega dados de exemplo':'')+'.':fraseServicoDesligado('properties')}
      <div class="toolbar u-jc-center u-mt-16px">
      ${servicoLigado('properties')?`<button class="btn primary" data-toca="camada" data-click="propModal()">Adicionar imóvel</button>`:''}
      ${podeExemplo()?`<button class="btn" data-toca="dados" data-click="seed()">Carregar exemplo</button>`:''}</div></div>`;
  /* quem só colabora e cujo cargo não abre as finanças não tem nada para somar aqui */
  if(souSoColaborador()&&!scope().length)
    return `<div class="empty"><b>${fraseColaborador()}</b>O teu cargo não abre as finanças destes imóveis — a vista geral não tem nada para somar.
      ${servicoLigado('properties')?`<div class="toolbar u-jc-center u-mt-16px">
      <button class="btn primary" data-toca="ecra" data-click="go('properties')">Ver os imóveis</button></div>`:''}</div>`;
  const nColab=scope().filter(p=>!souDono(p.id)).length;
  const colabHint=nColab?`<div class="hint u-m-n4px-0-12px">Inclui ${nColab} ${nColab===1?'imóvel':'imóveis'} onde és colaborador (valores por inteiro).</div>`:'';
  const inc=monthly(YEAR,pid,'income',true),exp=monthly(YEAR,pid,'expense',true),ln=monthly(YEAR,pid,'loan',true),am=monthly(YEAR,pid,'amort',true);
  let acc=0;const cum=inc.map((v,i)=>acc+=v-exp[i]-ln[i]-am[i]);
  const groups=inc.map((v,i)=>[{label:'Receita',value:v,color:PAL[0]},{label:'Despesas',value:-exp[i],color:'#c56b68'},{label:'Prestações',value:-ln[i],color:'#d6a34a'}]);
  const perProp=m.props.map(p=>({label:p.name+(ownerFilter&&sh(p)<1?' ('+shareText(p)+')':''),value:metrics(YEAR,p.id,{share:true}).cf})).sort((a,b)=>b.value-a.value);
  const act=db.contracts.filter(c=>isActive(c)&&inScope(c.propertyId)&&(!pid||pidProps(pid).some(p=>p.id===c.propertyId)));
  const cs=c=>sh(prop(c.propertyId));
  const quota=ownerFilter?(ownerIsGrp()?`<div class="hint u-m-n4px-0-12px">A ver os imóveis do grupo <b>${esc(ownerFilterName())}</b>.</div>`:`<div class="hint u-m-n4px-0-12px">Valores na quota-parte de <b>${esc(ownerFilterName())}</b>: receitas, despesas e prestações entram pela divisão de cada movimento; valor, aquisição e dívida pela quota do imóvel.</div>`):'';
  /* a marca diz que o numero destes cartoes E o do ano corrente — e por isso
     que a variacao face ao ano anterior pode falar deles (vistas.js:kpi) */
  const E=(field,fmt)=>{const f=()=>evoMoney(field,pid,fmt);f.anual=true;return f};
  /* o cartão dos por confirmar é dos Planeados: só com esse serviço ligado */
  const pendentes=servicoLigado('recurring')?pendingCard():'';
  return dashBar()+quota+colabHint+pendentes+prazosCard()+`<div class="grid">
    ${kpi('Receita',euro(m.income),'pos',YEAR+' · rendas e outros',WHY.receita,E('income'))}
    ${kpi('Despesas',euro(m.op),'neg','impostos, condomínio, obras…',WHY.despesas,E('op'))}
    ${kpi('Prestações',euro(m.loan),'amber','capital, juros e selo'+(m.amort?' · +'+euro(m.amort)+' amortizados':''),WHY.prestacoes,E('loan'))}
    ${kpi('Cashflow',euro(m.cf),m.cf>=0?'pos':'neg','depois de tudo pago',WHY.cashflow,E('cf'))}</div>
  <div class="cols">
    ${card('Entradas e saídas','Mês a mês em '+YEAR,cBars(groups,MES,{h:200}))}
    ${card('Cashflow acumulado','',cLine([{name:'Acumulado',values:cum,color:PAL[0]}],MES,{h:200}))}</div>
  <div class="cols">
    ${donutCard()}
    ${(!pid||String(pid).startsWith('g:'))&&perProp.length>1?card('Cashflow por imóvel','Quem paga e quem pesa',cHBars(perProp)):''}</div>
  <div class="cols">
    ${card(pid?esc(dpName):'Portefólio',ownerFilter?(ownerIsGrp()?'grupo '+esc(ownerFilterName()):'quota-parte de '+esc(ownerFilterName())):'',`
      <div class="stat"><span>Imóveis</span><b>${m.props.length}</b></div>
      <div class="stat"><span>Contratos ativos</span><b>${act.length}</b></div>
      <div class="stat"><span>Renda contratada</span><b>${euro(sum(act.map(c=>c.rent*cs(c))))}/mês</b></div>
      <div class="stat"><span>Renda líquida de impostos (estim.)</span><b>${euro(sum(act.map(c=>netRent(c)*cs(c))))}/mês</b></div>
      <div class="stat"><span>Valor de mercado</span><b>${euro(m.value)}</b></div>
      <div class="stat"><span>Valor de aquisição</span><b>${euro(m.purchase)}</b></div>
      <div class="stat"><span>Em dívida</span><b class="amber">${euro(m.debt)}</b></div>
      <div class="stat"><span>Património líquido</span><b class="pos">${euro(m.value-m.debt)}</b></div>
      <div class="stat"><span>Possíveis mais-valias${m.gainOut?` <span class="small">(${m.gainOut} sem aquisição)</span>`:''}</span>
        <b class="${m.gain>=0?'pos':'neg'}">${euro(m.gain)}</b></div>
      <div class="hint u-mt-10px">Mais-valias em bruto: mercado menos aquisição. Ao vender, o que é tributado desconta ainda
        o IMT e o selo da compra, as obras dos últimos 12 anos, as despesas da venda, e aplica o coeficiente de desvalorização da moeda.</div>`)}
    ${card('Renda por contrato','Peso de cada arrendamento',cHBars(act.map(c=>({label:ctName(c),value:c.rent*cs(c)})),{fmt:v=>euro(v)+'/mês'}))}</div>
  ${pid?'':orphanCard()}
  ${balancesCard(pid)}`;
}
/* donut das despesas: tocar numa categoria mostra as suas subcategorias */
let donutCat='';
// o cartão do donut: categorias ao nível de topo, ou as subcategorias de donutCat
// Devolve: string HTML do cartão.
function donutCard(){
  const items=byCategory(YEAR,dashProp||null,true,donutCat||null);
  return `<div class="card" id="donutCard">
    <div class="row-between u-ai-center">
      <div class="u-minw-0"><div class="title">${donutCat?esc(donutCat):'Despesas por categoria'}</div>
        <div class="small">${donutCat?'Subcategorias em '+YEAR:'Onde foi parar o dinheiro em '+YEAR}</div></div>
      ${donutCat?`<button class="btn sm u-fx-0-0-auto" data-toca="vista" data-click="donutDrill('')">${ic('chev',14)} Voltar</button>`:''}</div>
    <div class="u-mt-13px">${cDonut(items,{sub:donutCat?'total da categoria':'total de despesas',onPick:donutCat?'':'donutDrill'})}</div>
    ${donutCat||!items.length?'':'<div class="hint u-mt-10px">Toca numa categoria para veres as subcategorias.</div>'}</div>`;
}
// entra numa categoria do donut (ou sai, com cat vazio) repintando só o cartão
// Recebe: cat — o nome da categoria a abrir; vazio ('') volta às categorias de topo.
// Devolve: nada — repinta o cartão do donut (ou a vista toda, se o cartão não estiver no DOM).
function donutDrill(cat){
  donutCat=cat||'';
  const e=document.getElementById('donutCard');if(!e)return render();
  e.outerHTML=donutCard();
  /* A roda redesenha-se, e o cartão fica quieto. Chegou a levar a fita de
     virar a página, e era a metáfora errada: entrar numa categoria não é ir
     para outra página — é a MESMA roda a repartir-se de outra maneira, e o que
     se quer ver é os arcos a serem traçados. A marca liga a animação que os
     arcos já sabem fazer, sem depender de a vista ter acabado de chegar
     (index.html:.redesenha). */
  const novo=document.getElementById('donutCard');
  if(novo)novo.classList.add('redesenha');
}
/* despesas sem imóvel atribuído: contam no total mas não aparecem em nenhuma avaliação
   Recebe: y — o ano a filtrar (número ou texto de 4 dígitos).
   Devolve: array dos movimentos de despesa desse ano sem imóvel nem grupo. */
function orphanExpenses(y){
  return db.transactions.filter(t=>t.kind==='expense'&&!t.propertyId&&!t.groupId&&String(t.date||'').startsWith(String(y)));
}
/* O atalho do aviso das despesas sem imóvel: vai aos Movimentos e, já lá,
   filtra pelos que não têm imóvel. A espera de zero é a de sempre — o filtro
   põe-se depois de o go() ter trocado de vista, senão o render dele apagava-o.
   Era um onclick com uma seta e uma atribuição, que a gramática das ações não
   tem (.unlazy/csp/CONTRATO.md).
   Recebe: nada.
   Devolve: nada — muda para os Movimentos e filtra-os. */
function dashVerSemImovel(){go('transactions');setTimeout(()=>{txProp='__none__';render()},0)}
/* aviso das despesas sem imóvel na visão geral: explica porque é que os
   totais divergem da Avaliação e dá o atalho para as ver nos movimentos.
   Escondido quando há filtro de proprietário ou não há órfãs — e com o serviço
   dos Movimentos desligado nesta conta, que é para lá que o atalho leva.
   Devolve: string HTML do aviso, ou vazia quando não se aplica. */
function orphanCard(){
  if(ownerFilter||!servicoLigado('transactions'))return '';
  const o=orphanExpenses(YEAR);if(!o.length)return '';
  return `<div class="cols"><div class="card">
    <div class="row-between"><div><div class="title">Despesas sem imóvel</div>
      <div class="small">${o.length} movimento${o.length===1?'':'s'} · ${euro(sum(o.map(x=>x.amount)))}</div></div>${ic('swap',22)}</div>
    <div class="hint u-mt-12px">Entram aqui mas não na Avaliação — não estão atribuídas a nenhum imóvel. É por isto que os totais divergem.</div>
    <div class="toolbar u-m-13px-0-0"><button class="btn" data-toca="ecra" data-click="dashVerSemImovel()">Ver esses movimentos</button></div>
  </div></div>`;
}
/* Entra no modo de edição dos cartões, se a camada da nuvem estiver montada.
   O CW só existe com ela (cloud/painel.js:CW.enterEdit), e por isso as duas
   guardas: era um «window.CW&&CW.enterEdit&&CW.enterEdit()» no atributo, e
   numa ação o nome «window» não é da app.
   Recebe: nada.
   Devolve: nada — entra em edição, ou não faz nada sem a camada da nuvem. */
function dashPersonalizarPainel(){if(window.CW&&CW.enterEdit)CW.enterEdit()}
/* O que o painel pinta depois de o render pôr o HTML: a criação rápida.
   A visão geral era o único ecrã sem criação rápida: registar uma renda
   avulsa custava quatro toques de viagem. Entra depois de o painel rearranjar
   os cartões, para não virar um cartão arrastável. O FAB abre um movimento
   novo, que é dos Movimentos: com esse serviço desligado nesta conta fica só
   o botão de personalizar, que é da base.
   Devolve: nada — acrescenta o botão e o FAB ao #view quando fazem sentido. */
function dashDepois(){
  if(view().querySelector('#dashPersonalizar')||!(podeSemImovel()||casasComo('tx.add').length))return;
  const novoTx=servicoLigado('transactions')?fab([{act:'newTxPick()',label:'Novo movimento'}])+'<div class="fabpad"></div>':'';
  view().insertAdjacentHTML('beforeend',
    '<div id="dashPersonalizar" class="u-ta-center u-m-2px-0-0"><button type="button" class="btn sm" data-toca="modo" data-click="dashPersonalizarPainel()">'+ic('grip',13)+' Personalizar painel</button></div>'+novoTx);
}
// nº de filtros ativos no painel de análise da visão geral: proprietário e imóvel em foco
// Devolve: número de filtros ativos (0 a 2).
function dashAnaN(){return (ownerFilter?1:0)+(dashProp?1:0)}
// limpa o imóvel em foco da visão geral (o proprietário limpa-o a base, anaClear)
// Devolve: nada — limpa o filtro; quem chama repinta.
function dashAnaLimpar(){dashProp=''}
// ao mudar de separador, o donut aberto fecha-se: era o go() que o fazia, e o go() não nomeia serviços
// Devolve: nada — só o estado.
function dashAoMudar(){donutCat=''}
registarServico({id:'dashboard',vistas:{dashboard:'vDashboard'},depois:{dashboard:'dashDepois'},analise:{dashboard:{n:'dashAnaN',limpar:'dashAnaLimpar'}},aoMudar:'dashAoMudar'});
