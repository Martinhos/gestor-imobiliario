/* ================= VISTAS ================= */
/* botão de filtros no cabeçalho: análise, registos e movimentos */
let anaOpen={};
const LFK={properties:'lprops',contracts:'lcts',tenants:'lten',owners:'lown',recurring:'lrec',credits:'lcred',visits:'lvis'};
/* toque no botão de filtros do cabeçalho: abre o painel certo consoante o
   separador — dropdown nas listas de registos, modal nos movimentos, painel
   de análise nos restantes.
   Devolve: nada — abre/fecha o painel respetivo e redesenha a vista. */
function hdrFiltToggle(){
  if(LFK[tab])return lfToggle(LFK[tab]);
  if(tab==='transactions')return txFilterModal();
  anaOpen[tab]=!anaOpen[tab];render();
}
// nº de filtros ativos no separador atual — decide o ponto no botão do cabeçalho
// Devolve: número de filtros ativos no separador atual.
function hdrFiltN(){
  if(LFK[tab])return lfCount(LFK[tab]);
  if(tab==='transactions')return txFilterCount()+(String(txSearch||'').trim()?1:0);
  return ANA_N();
}
// fecha o painel de análise do separador atual (os filtros aplicam-se logo ao mexer)
// Devolve: nada — fecha o painel e redesenha a vista.
function anaApply(){anaOpen[tab]=false;render()}
// limpa o proprietário global e o imóvel em foco do separador de análise onde estamos
// Devolve: nada — limpa os filtros e redesenha a vista.
function anaClear(){
  ownerFilter='';
  if(tab==='dashboard')dashProp='';
  if(tab==='projections')projProp='';
  if(tab==='reports')repProp='';
  closePops();render();
}
// nº de filtros ativos nos separadores de análise: proprietário e imóvel em foco
// Devolve: número de filtros ativos (0 a 2; 0 fora dos separadores de análise).
const ANA_N=()=>tab==='dashboard'?((ownerFilter?1:0)+(dashProp?1:0))
  :tab==='projections'?((ownerFilter?1:0)+(projProp?1:0))
  :tab==='reports'?((ownerFilter?1:0)+(repProp?1:0)):0;
/* embrulha os controlos de análise (inner, já em HTML) no painel dropdown do
   cabeçalho, com os botões Limpar/Fechar; o wrapper tem altura 0 para o
   painel flutuar por cima da página em vez de a empurrar.
   Recebe: inner — os controlos do painel, já em HTML (string).
   Devolve: string HTML do painel pronto a inserir na vista. */
function anaPanel(inner){return `<div class="fwrap" style="height:0"><div class="fpanel ${anaOpen[tab]?'on':''}" style="top:0"><div class="card" style="padding:12px">
  ${typeof fcSelector==='function'?fcSelector():''}${inner}
  <div class="toolbar" style="margin:12px 0 0">
    <button class="btn" onclick="anaClear()">${ic('x',15)} Limpar</button>
    <button class="btn primary" onclick="anaApply()">${ic('check',15)} Fechar</button>
  </div></div></div></div>`}
/* Cartões e afins são divs com onclick: sem isto, o teclado não chega a
   nenhuma lista — nem um leitor de ecrã os anuncia como acionáveis. Corre
   depois de cada render e de cada fillModal.
   Recebe: raiz — o elemento do DOM onde procurar os [onclick]; com null não faz nada.
   Devolve: nada — acrescenta tabindex e role aos elementos, no próprio DOM. */
function tornarFocavel(raiz){
  if(!raiz)return;
  [].slice.call(raiz.querySelectorAll('[onclick]')).forEach(e=>{
    if(/^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL)$/.test(e.tagName))return;
    if(!e.hasAttribute('tabindex'))e.setAttribute('tabindex','0');
    if(!e.hasAttribute('role'))e.setAttribute('role','button');
  });
}
/* Redesenha a página inteira: título e subtítulo, botão de filtros do
   cabeçalho, e o HTML da vista do separador atual (vDashboard, vProperties…).
   Substitui o innerHTML de #view, por isso o estado do DOM anterior perde-se;
   no fim torna os cartões focáveis e repinta as miniaturas dos imóveis.
   Devolve: nada — redesenha a vista no DOM. */
function render(){
  const meta=(tab==='settings'&&setPage&&SUBPAGE[setPage])?SUBPAGE[setPage]:TABS.find(x=>x.id===tab);
  document.getElementById('pageTitle').textContent=meta.label;
  document.getElementById('pageSub').textContent=meta.sub;
  const hb=document.getElementById('hdrFilt'),isAna=['dashboard','projections','reports'].indexOf(tab)>-1,
    hasFilt=isAna||LFK[tab]||tab==='transactions';
  if(typeof notifSino==='function')notifSino();
  if(hb){hb.style.display=hasFilt?'':'none';
    if(hasFilt){hb.innerHTML=ic('filter',16)+(hdrFiltN()?'<span class="dot"></span>':'');
      hb.classList.toggle('primary',isAna?!!anaOpen[tab]:(LFK[tab]?!!lf(LFK[tab])._open:false))}}
  let html=({dashboard:vDashboard,visits:vVisits,calendar:vCalendar,properties:vProperties,contracts:vContracts,tenants:vTenants,owners:vOwners,
    transactions:vTransactions,recurring:vRecurring,credits:vCredits,projections:vProjections,reports:vReports,settings:vSettings})[tab]();
  if(html.indexOf('class="fab"')>-1)html+='<div class="fabpad"></div>';
  view().innerHTML=html;
  /* A visão geral era o único ecrã sem criação rápida: registar uma renda
     avulsa custava quatro toques de viagem. Entra aqui, depois do painel
     rearranjar os cartões, para não virar um cartão arrastável. */
  if(tab==='dashboard'&&!view().querySelector('.fab')){
    view().insertAdjacentHTML('beforeend',
      '<div style="text-align:center;margin:2px 0 0"><button type="button" class="btn sm" onclick="window.CW&&CW.enterEdit&&CW.enterEdit()">'+ic('grip',13)+' Personalizar painel</button></div>'+
      fab([{act:'newTxPick()',label:'Novo movimento'}])+'<div class="fabpad"></div>');
  }
  tornarFocavel(view());
  if(tab==='properties')db.properties.forEach(p=>paintThumbs(p.photos,view()));
}
let kpiN=0;const KPI_REG={};
/* evo: função que devolve a série do indicador ao longo do tempo; ao tocar abre-se uma janela com a evolução
   Recebe: l — o rótulo do cartão; v — o valor já formatado (string); c (opcional) — classe de cor ('pos', 'neg',
   'amber' ou vazio); f (opcional) — texto do rodapé; why (opcional) — explicação que abre ao toque;
   evo (opcional) — função sem argumentos que devolve a série ({monthly, yearly, fmt, …}) para a janela de evolução.
   Devolve: string HTML do cartão KPI. */
const kpi=(l,v,c,f,why,evo)=>{
  const id='k'+(++kpiN);
  if(evo){KPI_REG[id]={title:l,why:why||'',evo};
    return `<div class="card kpi evo" id="${id}" onclick="kpiModal('${id}')"><span class="kic">${ic('trend',11)}</span>
      <div class="label">${l}</div><div class="value ${c||''}">${v}</div>${f?`<div class="foot">${f}</div>`:''}</div>`}
  return `<div class="card kpi ${why?'why':''}" id="${id}" ${why?`onclick="document.getElementById('${id}').classList.toggle('open')"`:''}>
    <div class="label">${l}</div><div class="value ${c||''}">${v}</div>${f?`<div class="foot">${f}</div>`:''}
    ${why?`<div class="expl">${why}</div>`:''}</div>`;
};
/* abre a janela de evolução de um KPI: corre o evo() registado no cartão e
   mostra a série mês a mês, a ano a ano e a tabela. Se o evo falhar ou não
   devolver nada, simplesmente não abre.
   Recebe: id — o id do cartão KPI ('k1', 'k2', …) registado em KPI_REG.
   Devolve: nada — abre a janela de evolução (ou nada, se o evo falhar). */
function kpiModal(id){
  const k=KPI_REG[id];if(!k)return;
  let d;try{d=k.evo()}catch(e){d=null}
  if(!d)return;
  const fmt=d.fmt||euro;
  const vals=(d.yearly||[]).map(y=>y.value);
  const body=`<div class="form">
    ${k.why?`<div class="hint">${k.why}</div>`:''}
    ${d.monthly?`<div><div class="flabel">Mês a mês em ${YEAR}</div>${cLine([{name:k.title,values:d.monthly,color:PAL[0]}],MES,{h:170,fmt})}</div>`:''}
    ${(d.yearly||[]).length>1?`<div><div class="flabel">${d.yearlyTitle||'Ano a ano'}</div>${cLine([{name:k.title,values:vals,color:PAL[1]}],d.yearly.map(y=>String(y.label)),{h:170,fmt,marks:d.marks})}</div>`:''}
    ${(d.yearly||[]).length?`<div class="tablewrap"><table class="table"><thead><tr><th>${d.yearlyTitle?'Período':'Ano'}</th><th>${esc(k.title)}</th>${d.yearly[0].extra!==undefined?'<th>'+esc(d.extraTitle||'')+'</th>':''}</tr></thead><tbody>
      ${d.yearly.map(y=>`<tr><td><b>${esc(String(y.label))}</b></td><td>${fmt(y.value)}</td>${y.extra!==undefined?`<td>${y.extra}</td>`:''}</tr>`).join('')}</tbody></table></div>`:''}
    ${d.note?`<div class="hint">${d.note}</div>`:''}</div>`;
  openModal(k.title,body,`<button class="btn" onclick="closeModal()">Fechar</button>`);
}
/* anos com movimentos que contam nesta vista (o mesmo peso das métricas: imóvel,
   grupo ou âmbito todo), mais o corrente
   Recebe: pid (opcional) — id do imóvel ou 'g:ID' de um grupo; vazio/null usa o âmbito do proprietário filtrado.
   Devolve: array de anos (números) por ordem ascendente. */
function yearsWithData(pid){
  const ys={};ys[YEAR]=1;
  db.transactions.forEach(t=>{const y=Number(String(t.date||'').slice(0,4));if(y&&txWeight(t,pid,false)>0)ys[y]=1});
  return Object.keys(ys).map(Number).sort();
}
/* série histórica de um campo monetário das métricas (income, op, loan ou cf):
   mês a mês no ano corrente e ano a ano nos anos com movimentos. pid limita a
   um imóvel ou grupo; sem fmt, formata em euros.
   Recebe: field — o campo das métricas ('income', 'op', 'loan' ou 'cf'); pid (opcional) — id do imóvel ou de grupo
   ('g:…'), null/vazio para o âmbito todo; fmt (opcional) — função de formatação dos valores.
   Devolve: objeto {fmt, monthly (12 totais mensais), yearly (array de {label: ano, value})} para a janela do KPI. */
function evoMoney(field,pid,fmt){
  const kind={income:'income',op:'expense',loan:'loan'}[field];
  const monthly=kind?monthly_(YEAR,pid,kind):[...Array(12)].map((_,i)=>monthly_(YEAR,pid,'income')[i]-monthly_(YEAR,pid,'expense')[i]-monthly_(YEAR,pid,'loan')[i]-monthly_(YEAR,pid,'amort')[i]);
  return {fmt:fmt||euro,monthly,yearly:yearsWithData(pid).map(y=>({label:y,value:metrics(y,pid,{share:true})[field]}))};
}
// atalho: totais mensais já na quota-parte do proprietário filtrado
// Recebe: y — o ano (número); pid — id do imóvel ou de grupo ('g:…'), ou null para o âmbito todo; kind — 'income', 'expense', 'loan' ou 'amort'.
// Devolve: array de 12 números — o total de cada mês desse ano.
const monthly_=(y,pid,kind)=>monthly(y,pid,kind,true);
const WHY={
  receita:'O que entrou este ano. Não é a renda contratada — é o que foi mesmo lançado. Cauções e empréstimos recebidos ficam de fora: são dinheiro a devolver, não rendimento.',
  despesas:'Soma dos movimentos de despesa do ano: impostos, condomínio, seguros, obras, manutenção. Não inclui prestações do crédito.',
  prestacoes:'Capital, juros e selo das prestações. Separado das despesas porque parte é poupança, não custo. As amortizações antecipadas ficam à parte, no rodapé.',
  cashflow:'Receita menos despesas, prestações e amortizações antecipadas. É o dinheiro que saiu mesmo da carteira — uma amortização também sai, embora seja capital e não custo.',
  yieldBruto:'Renda anual contratada sobre o valor de mercado dos imóveis com contrato ativo — os mesmos imóveis em cima e em baixo. Ignora despesas; serve para comparar com anúncios.',
  cap:'Resultado líquido (rendas menos despesas, sem o banco) a dividir pelo valor de mercado. No ano corrente o resultado é anualizado. Mede o imóvel, não o financiamento — na tua quota, quando há filtro de proprietário.',
  aquisicao:'Cashflow do ano até hoje a dividir pelo preço de compra, com o crédito incluído. Não é o retorno sobre o capital próprio: para isso faltaria tirar ao preço o que o banco emprestou.',
  ltv:'Dívida a dividir pelo valor de mercado — na tua quota, quando há filtro de proprietário. Quanto mais baixo, menos alavancado está o portefólio.',
  valorIntro:'O valor de mercado que introduziste na ficha do imóvel. É a tua estimativa, não um cálculo.',
  valorRend:'Quanto valeria o imóvel se o comprasses hoje exigindo o yield que definiste: resultado líquido anual dividido por esse yield. No ano corrente, o resultado até hoje é anualizado.',
  diferenca:'Positivo: as rendas justificam mais do que o valor que puseste. Sem valor de mercado na ficha não há comparação.',
  equity:'Valor de mercado menos o que ainda está em dívida. É o que sobraria se vendesses e liquidasses as hipotecas hoje.',
  rendaHoje:'Soma das rendas anuais dos contratos ativos, aos valores de hoje.',
  rendaFim:'A mesma soma no último ano do horizonte, já com os aumentos anuais aplicados.',
  totalPeriodo:'Soma de todas as rendas do período projetado.',
  cashflowFim:'Rendas projetadas menos despesas menos as prestações previstas nesse ano. As despesas partem do último ano completo com despesas (sem nenhum, do ano corrente anualizado) e crescem com a inflação.'
};
// cartão genérico das vistas: título, subtítulo opcional e corpo em HTML
// Recebe: t — o título; s — o subtítulo (vazio para não aparecer); b — o corpo, em HTML.
// Devolve: string HTML do cartão.
const card=(t,s,b)=>`<div class="card"><div><div class="title">${t}</div>${s?`<div class="small">${s}</div>`:''}</div><div style="margin-top:13px">${b}</div></div>`;
const stop='event.stopPropagation();';
/* botão "⋮" dos cartões: abre o mesmo menu do toque longo */
const kebab=v=>`<button class="btn sm" style="flex:0 0 auto;padding:7px 9px;align-self:flex-start" onclick="${stop}lpMenu('${v}')">${ic('dots',17)}</button>`;
let _lockY=0;
/* trava o scroll do fundo enquanto houver um modal ou o menu lateral aberto,
   e repõe a posição ao destravar. Corre a cada abrir/fechar (componentes.js e
   navegacao.js chamam-na) e é idempotente: só mexe quando o estado muda.
   Devolve: nada — mexe nas classes do documento e na posição do scroll. */
function lockPage(){try{
  const on=modalStack.length>0||document.body.classList.contains('open'),h=document.documentElement,was=h.classList.contains('noscroll');
  if(on&&!was){_lockY=window.scrollY||0;h.classList.add('noscroll');document.body.style.top=(-_lockY)+'px'}
  else if(!on&&was){h.classList.remove('noscroll');document.body.style.top='';window.scrollTo(0,_lockY)}
}catch(e){}}

// barra com o seletor de proprietário; vazia se não há proprietários registados
// Devolve: string HTML da barra (vazia se não há proprietários).
function ownerBar(){
  if(!db.owners.length)return '';
  const opts=[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner')));
  return `<div class="toolbar"><div style="min-width:230px;max-width:320px">${sel('ownerSel',ownerFilter,opts,'onOwnerFilter')}</div></div>`;
}
// muda o filtro global de proprietário; se o imóvel em foco sair do âmbito, larga-o
// Devolve: nada — redesenha a vista.
function onOwnerFilter(){ownerFilter=val('ownerSel')||'';if(dashProp&&!inScope(dashProp))dashProp='';render()}
/* visão geral: proprietário e imóvel
   Devolve: string HTML do painel de análise com os dois seletores. */
function dashBar(){
  const oo=[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner')));
  const po=[{v:'',label:'Todos os imóveis'}].concat(scope().map(p=>({v:p.id,label:p.name}))).concat(gdiv(gOpts('prop')));
  return anaPanel(`<div style="display:flex;flex-direction:column;gap:9px">
    ${db.owners.length?`<div style="width:100%">${sel('ownerSel',ownerFilter,oo,'onOwnerFilter')}</div>`:''}
    <div style="width:100%">${sel('dashPropSel',dashProp,po,'onDashProp')}</div></div>`);
}
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
  if(!db.properties.length&&!db.transactions.length)
    return `<div class="empty"><b>Ainda não há nada registado</b>Começa por adicionar um imóvel, ou carrega dados de exemplo.
      <div class="toolbar" style="justify-content:center;margin-top:16px">
      <button class="btn primary" onclick="propModal()">Adicionar imóvel</button>
      <button class="btn" onclick="seed()">Carregar exemplo</button></div></div>`;
  const inc=monthly(YEAR,pid,'income',true),exp=monthly(YEAR,pid,'expense',true),ln=monthly(YEAR,pid,'loan',true),am=monthly(YEAR,pid,'amort',true);
  let acc=0;const cum=inc.map((v,i)=>acc+=v-exp[i]-ln[i]-am[i]);
  const groups=inc.map((v,i)=>[{label:'Receita',value:v,color:PAL[0]},{label:'Despesas',value:-exp[i],color:'#c56b68'},{label:'Prestações',value:-ln[i],color:'#d6a34a'}]);
  const perProp=m.props.map(p=>({label:p.name+(ownerFilter&&sh(p)<1?' ('+shareText(p)+')':''),value:metrics(YEAR,p.id,{share:true}).cf})).sort((a,b)=>b.value-a.value);
  const act=db.contracts.filter(c=>isActive(c)&&inScope(c.propertyId)&&(!pid||pidProps(pid).some(p=>p.id===c.propertyId)));
  const cs=c=>sh(prop(c.propertyId));
  const quota=ownerFilter?(ownerIsGrp()?`<div class="hint" style="margin:-4px 0 12px">A ver os imóveis do grupo <b>${esc(ownerFilterName())}</b>.</div>`:`<div class="hint" style="margin:-4px 0 12px">Valores na quota-parte de <b>${esc(ownerFilterName())}</b>: receitas, despesas e prestações entram pela divisão de cada movimento; valor, aquisição e dívida pela quota do imóvel.</div>`):'';
  const E=(field,fmt)=>()=>evoMoney(field,pid,fmt);
  return dashBar()+quota+pendingCard()+prazosCard()+`<div class="grid">
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
      <div class="hint" style="margin-top:10px">Mais-valias em bruto: mercado menos aquisição. Ao vender, o que é tributado desconta ainda
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
    <div class="row-between" style="align-items:center">
      <div style="min-width:0"><div class="title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${donutCat?esc(donutCat):'Despesas por categoria'}</div>
        <div class="small">${donutCat?'Subcategorias em '+YEAR:'Onde foi parar o dinheiro em '+YEAR}</div></div>
      ${donutCat?`<button class="btn sm" style="flex:0 0 auto" onclick="donutDrill('')">${ic('chev',14)} Voltar</button>`:''}</div>
    <div style="margin-top:13px">${cDonut(items,{sub:donutCat?'total da categoria':'total de despesas',onPick:donutCat?'':'donutDrill'})}</div>
    ${donutCat||!items.length?'':'<div class="hint" style="margin-top:10px">Toca numa categoria para veres as subcategorias.</div>'}</div>`;
}
// entra numa categoria do donut (ou sai, com cat vazio) repintando só o cartão
// Recebe: cat — o nome da categoria a abrir; vazio ('') volta às categorias de topo.
// Devolve: nada — repinta o cartão do donut (ou a vista toda, se o cartão não estiver no DOM).
function donutDrill(cat){
  donutCat=cat||'';
  const e=document.getElementById('donutCard');if(!e)return render();
  e.outerHTML=donutCard();
}
/* despesas sem imóvel atribuído: contam no total mas não aparecem em nenhuma avaliação
   Recebe: y — o ano a filtrar (número ou texto de 4 dígitos).
   Devolve: array dos movimentos de despesa desse ano sem imóvel nem grupo. */
function orphanExpenses(y){
  return db.transactions.filter(t=>t.kind==='expense'&&!t.propertyId&&!t.groupId&&String(t.date||'').startsWith(String(y)));
}
/* aviso das despesas sem imóvel na visão geral: explica porque é que os
   totais divergem da Avaliação e dá o atalho para as ver nos movimentos.
   Escondido quando há filtro de proprietário ou não há órfãs.
   Devolve: string HTML do aviso, ou vazia quando não se aplica. */
function orphanCard(){
  if(ownerFilter)return '';
  const o=orphanExpenses(YEAR);if(!o.length)return '';
  return `<div class="cols"><div class="card">
    <div class="row-between"><div><div class="title">Despesas sem imóvel</div>
      <div class="small">${o.length} movimento${o.length===1?'':'s'} · ${euro(sum(o.map(x=>x.amount)))}</div></div>${ic('swap',22)}</div>
    <div class="hint" style="margin-top:12px">Entram aqui mas não na Avaliação — não estão atribuídas a nenhum imóvel. É por isto que os totais divergem.</div>
    <div class="toolbar" style="margin:13px 0 0"><button class="btn" onclick="go('transactions');setTimeout(()=>{txProp='__none__';render()},0)">Ver esses movimentos</button></div>
  </div></div>`;
}

/* cartão reutilizável: saldos entre proprietários (de um imóvel ou de todos)
   Recebe: pid — id do imóvel a que limitar, ou null/vazio para todos os do âmbito.
   Devolve: string HTML do cartão, ou vazia se não há saldos a mostrar. */
function balancesCard(pid){
  const bal=ownerBalances(pid),ks=Object.keys(bal);
  if(!ks.length)return '';
  const tot=debtTotal(bal),plan=settlePlan(bal);
  const rows=ks.map(k=>({id:k,name:(owner(k)||{}).name||'?',v:bal[k]})).sort((a,b)=>b.v-a.v);
  return `<div class="cols"><div class="card">
    <div class="row-between"><div><div class="title">Contas entre proprietários</div>
      <div class="small">${pid?'Neste imóvel':'Todos os imóveis'} · receitas, despesas e prestações com pessoa indicada; dívidas a terceiros não contam</div></div>
      <button class="btn sm" style="flex:0 0 auto;padding:7px" title="Como se chega aos saldos" onclick="${stop}balancesDetail(${pid?`'${pid}'`:'null'})">${ic('info',16)}</button></div>
    <div style="margin-top:13px">
      ${rows.map(r=>`<div class="stat"><span style="display:flex;align-items:center;gap:9px">
        <span class="avatar" style="width:28px;height:28px;font-size:11px;flex:0 0 28px">${esc(initials(r.name))}</span>${esc(r.name)}</span>
        <b class="${Math.abs(r.v)<0.01?'':(r.v>0?'pos':'neg')}">${Math.abs(r.v)<0.01?'em dia':(r.v>0?'a receber '+euro2(r.v):'a pagar '+euro2(-r.v))}</b></div>`).join('')}
      ${tot>0.005?`<div class="divider"></div>
        <div class="hint">${plan.map(x=>`<b>${esc((owner(x.from)||{}).name)}</b> paga <b>${euro2(x.amount)}</b> a <b>${esc((owner(x.to)||{}).name)}</b>`).join('<br>')}</div>
        <div class="toolbar" style="margin:13px 0 0"><button class="btn primary" onclick="settleModal(${pid?`'${pid}'`:'null'})">
          ${ic('check',16)} Pagar todas as dívidas</button></div>`
        :`<div class="hint" style="margin-top:11px">Está tudo liquidado.</div>`}
    </div></div></div>`;
}
/* os acertos que zeram os saldos: um plano por imóvel da vista e, no âmbito todo,
   mais um «Todos os imóveis» para o que os imóveis não explicam — as dívidas dos
   movimentos sem imóvel nem grupo, que ownerBalances(null) conta mas nenhum imóvel tem.
   Recebe: pid — id do imóvel, 'g:ID' de um grupo, ou null para o âmbito todo.
   Devolve: array de {pid, name, plan} — o imóvel (pid null e nome «Todos os imóveis» para
   o resto global) e as transferências de settlePlan; só os alvos com transferências. */
function settleTargets(pid){
  const props=pidProps(pid);
  const out=props.map(p=>({pid:p.id,name:p.name,plan:settlePlan(ownerBalances(p.id))})).filter(x=>x.plan.length);
  if(!pid&&!ownerFilter){
    const tot=ownerBalances(null),per=props.map(p=>ownerBalances(p.id)),resto={};
    Object.keys(tot).forEach(k=>{resto[k]=tot[k]-sum(per.map(b=>b[k]||0))});
    const plan=settlePlan(resto);
    if(plan.length)out.push({pid:null,name:'Todos os imóveis',plan});
  }
  return out;
}
/* pré-visualização do acerto de contas: lista as transferências que vão ser
   registadas (settleTargets), imóvel a imóvel, e as últimas liquidações. pid
   limita a um imóvel ou grupo; null abrange o âmbito todo. Só escreve ao confirmar (doSettle).
   Recebe: pid — id do imóvel ou 'g:ID' de um grupo a que limitar, ou null para o âmbito todo.
   Devolve: nada — abre o modal (ou um toast, se não há dívidas). */
function settleModal(pid){
  const plans=settleTargets(pid);
  const total=sum(plans.map(x=>sum(x.plan.map(y=>y.amount))));
  if(!plans.length)return toast('Não há dívidas para liquidar.');
  const hist=db.transactions.filter(t=>t.kind==='settle').sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-4).reverse();
  openModal('Pagar dívidas entre proprietários',`<div class="form">
    <div class="hint">Vão ser registadas ${plans.reduce((a,x)=>a+x.plan.length,0)} transferências, ${euro2(total)} no total. Os saldos ficam a zero.</div>
    ${plans.map(x=>`<div class="card" style="padding:12px 14px">
      <div class="title" style="font-size:14px">${esc(x.name)}</div>
      ${x.plan.map(y=>`<div class="stat"><span>${esc((owner(y.from)||{}).name)} → ${esc((owner(y.to)||{}).name)}</span><b>${euro2(y.amount)}</b></div>`).join('')}
    </div>`).join('')}
    ${hist.length?`<div class="divider"></div><div class="flabel">Liquidações anteriores</div>
      ${hist.map(h=>`<div class="stat"><span class="small">${h.date} · ${esc(h.propertyId?propName(h.propertyId):'Todos os imóveis')} · ${esc((owner(h.paidBy)||{}).name)} → ${esc((owner(h.toId)||{}).name)}</span><b>${euro2(h.amount)}</b></div>`).join('')}
      <div class="hint">Os acertos ficam nos movimentos, onde podem ser editados.</div>`:''}
    </div>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="doSettle(${pid?`'${pid}'`:'null'})">Registar pagamentos</button>`);
}
/* regista o plano de liquidação (settleTargets) como movimentos "settle" e grava —
   os saldos entre proprietários ficam a zero. Os acertos do resto global ficam sem
   imóvel. É o passo destrutivo do settleModal.
   Recebe: pid — id do imóvel ou 'g:ID' de um grupo a que limitar, ou null para o âmbito todo.
   Devolve: nada — grava os movimentos, fecha o modal e redesenha. */
function doSettle(pid){
  let k=0;
  settleTargets(pid).forEach(x=>x.plan.forEach(y=>{
    db.transactions.push(normTx({kind:'settle',label:'Transferência entre proprietários',date:today(),propertyId:x.pid,paidBy:y.from,toId:y.to,amount:y.amount}));k++;
  }));
  save();closeModal();render();
  toast(k?k+' pagamento(s) registado(s). Saldos a zero.':'Não havia nada a liquidar.');
}

/* Lista de imóveis com pesquisa, filtros (estado, modo de arrendamento,
   proprietário — este espelha o filtro global) e ordenação. Cada cartão
   resume estado, renda, yield, dívida, contratos e hipotecas em curso.
   Devolve: string com o HTML completo da vista. */
function vProperties(){
  const K='lprops',s=lf(K);
  let list=scope();
  list=list.filter(p=>{
    if(s.st&&propStatus(p).key!==s.st)return false;
    if(s.md){if(p.use!=='investimento')return false;if((p.rentalMode||'inteiro')!==s.md)return false}
    return lfHit(K,[p.name,p.address,p.street,p.doorNumber,p.fraction,p.floor,p.postalCode,p.locality,p.concelho,p.freguesia,p.parish,p.notes,ownerNames(p),
      (p.rooms||[]).map(r=>r.name).join(' ')].join(' '));
  });
  if(!lf(K)._open)lf(K).own=ownerFilter||'';   /* o estado aplicado espelha o filtro global de proprietário */
  const ownSel=db.owners.length?lfSel(K,'own',[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner')))):'';
  const head=lfBar(K,[ownSel,
      lfSel(K,'st',[{v:'',label:'Todos os estados'},{v:'arrendado',label:'Arrendados'},{v:'parcial',label:'Parcialmente arrendados'},{v:'vago',label:'Vagos'},{v:'proprio',label:'Uso próprio'}]),
      lfSel(K,'md',[{v:'',label:'Todos os arrendamentos'},{v:'inteiro',label:'Imóvel inteiro'},{v:'quartos',label:'Por quartos'}])],list.length,
      {opts:[{v:'nome',label:'Ordenar por nome'},{v:'valor',label:'Ordenar por valor'},{v:'renda',label:'Ordenar por renda'},{v:'divida',label:'Ordenar por dívida'},{v:'yield',label:'Ordenar por yield'}]})
    +(db.properties.length?'':`<div class="toolbar"><button class="btn" onclick="seed()">Carregar exemplo</button></div>`)
    +fab([{label:'Adicionar imóvel',act:'propModal()'}]);
  list=lfSort(K,list,{nome:p=>p.name,valor:p=>p.value,renda:p=>rentOf(p),divida:p=>debtOf(p),yield:p=>{const r=rentOf(p);return r&&p.value?r*12/p.value:0}});
  if(!list.length)return head+`<div class="empty"><b>${lfCount(K)?'Nada neste filtro':'Sem imóveis'}</b>${lfCount(K)?'':(db.properties.length?'Nenhum imóvel deste proprietário.':'Adiciona o primeiro para começares a acompanhar o investimento.')}</div>`;
  return head+`<div class="list">${list.map(p=>{
    const st=propStatus(p),ls=liveLoans(p),ac=activeContracts(p.id),rent=rentOf(p);
    const y=rent&&p.value?rent*12/p.value:NaN,own=ownerNames(p);
    return `<div class="card tap" data-lp="prop:${esc(p.id)}" onclick="propModal('${jsq(p.id)}')">
      <div class="row-between">
        <div style="min-width:0"><div class="title">${esc(p.name)}</div>
          <div class="small">${esc(p.address||'Sem morada')}${own?' · '+esc(own):''}${ownerFilter&&sh(p)<1?' · <b>'+shareText(p)+'</b>':''}</div></div>
        <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
        ${(p.photos||[]).length?`<div style="flex:0 0 54px"><div class="pcover" id="th_${p.photos[0].id}" style="width:54px;height:44px;border-radius:10px;background:var(--chip);overflow:hidden"></div></div>`:''}
        ${kebab('prop:'+p.id)}</div>
      </div>
      <div class="chips">
        <span class="badge ${st.badge}">${st.label}</span>
        ${p.use==='investimento'?`<span class="badge grey">${p.rentalMode==='quartos'?'Por quartos':'Imóvel inteiro'}</span>`:''}
        ${rent?`<span class="badge">${euroS(rent)}/mês</span>`:''}
        ${isFinite(y)?`<span class="badge">Yield ${pct(y)}</span>`:''}
        <span class="badge grey">Valor ${euro(p.value)}</span>
        ${ls.length?`<span class="badge amber">Dívida ${euro(debtOf(p))}${ls.length>1?' · '+ls.length+' hipotecas':''}</span>`:''}
        ${propDebt(p.id)>0.005?`<span class="badge red">${ic('users',12)} ${euro(propDebt(p.id))} entre proprietários</span>`:''}
        ${(p.photos||[]).length?`<span class="badge grey">${ic('photo',12)} ${p.photos.length}</span>`:''}</div>
      ${ac.length?`<div class="small" style="margin-top:10px">${ac.map(c2=>`${c2.roomId?esc(roomName(p,c2.roomId))+': ':''}${esc(ctNames(c2))} · ${euro(c2.rent)}`).join('<br>')}</div>`:''}
      ${ls.length?`<div class="small" style="margin-top:9px">${ls.map(l=>`${esc(loanName(l))} · ${RATE[l.type]} · ${euro2(loanCalc(l).total)}/mês${(l.files||[]).length?' · '+l.files.length+' doc.':''}`).join('<br>')}
        ${ls.length>1?`<br><b>Total ${euro2(payOf(p))}/mês</b>`:''}</div>`:''}
      </div>`}).join('')}</div>`;
}

let ctGroupF='';
// handler do antigo seletor de grupo ('ctGroupSel'); a vista atual filtra grupos via lfSel, por isso só dispara se esse seletor existir no DOM
// Devolve: nada — redesenha a vista.
function onCtGroupF(){ctGroupF=val('ctGroupSel')||'';render()}
/* Contratos agrupados por imóvel, com a renda mensal de cada um no cabeçalho
   da secção. Filtros: imóvel, ativos/terminados, grupo e pesquisa; ordenação
   por nome, renda ou data de início.
   Devolve: string com o HTML completo da vista. */
function vContracts(){
  const K='lcts',s=lf(K),cgs=grpsOf('contract');
  const head=lfBar(K,[
      lfSel(K,'p',lfPropOpts()),
      lfSel(K,'st',[{v:'',label:'Ativos e terminados'},{v:'on',label:'Ativos'},{v:'off',label:'Terminados'}])]
      .concat(cgs.length?[lfSel(K,'g',[{v:'',label:'Todos os grupos'}].concat(cgs.map(g=>({v:g.id,label:'Grupo · '+g.name}))))]:[]),
      db.contracts.filter(c=>ctFMatch(c,s)).length,
      {opts:[{v:'nome',label:'Ordenar por nome'},{v:'renda',label:'Ordenar por renda'},{v:'inicio',label:'Ordenar por início'}]})
    +fab([{label:'Novo contrato',act:'ctModal()'}]);
  if(!db.properties.length)return head+`<div class="empty"><b>Cria primeiro um imóvel</b>Um contrato liga um imóvel a um ou mais inquilinos.</div>`;
  if(!db.contracts.length)return head+`<div class="empty"><b>Sem contratos</b>O contrato é onde vive a renda: podes arrendar o imóvel inteiro, ou um contrato por quarto.</div>`;
  let any=false;
  const body=scope().map(p=>{
    if(s.p&&p.id!==s.p)return '';
    const cs=lfSort(K,contractsOf(p.id).filter(c=>ctFMatch(c,s)),{nome:c=>ctName(c),renda:c=>c.rent,inicio:c=>c.start||''});if(!cs.length)return '';
    any=true;
    return `<div class="section-title" style="display:flex;justify-content:space-between;text-transform:none">
      <span>${esc(p.name)}</span><span>${euroS(rentOf(p))}/mês</span></div>
      <div class="list">${cs.map(c=>{
        const on=isActive(c),ts=ctTenants(c);
        return `<div class="card tap" data-lp="ct:${esc(c.id)}" onclick="ctModal('${jsq(c.id)}')">
        <div class="row-between">
          <div style="min-width:0">
            <div class="title">${esc(ctName(c))} ${on?'':'<span class="badge grey">terminado</span>'}</div>
            <div class="small">${c.roomId?esc(roomName(p,c.roomId)):'Imóvel inteiro'} · ${c.start?'De '+c.start:'Sem data de início'}${c.end?' a '+c.end:''}</div>
          </div>
          <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
            <div style="text-align:right"><div style="font-weight:750;font-size:16px">${euro(c.rent)}</div>
            <div class="small">líquido ${euro(netRent(c))} · imposto ${dec(taxRateOf(c))}%${Number(c.taxRate)>0?'':' (estim.)'}</div></div>
            ${kebab('ct:'+c.id)}</div></div>
        ${ts.length?`<div style="margin-top:9px">${ts.map(t=>`<div class="small" style="display:flex;align-items:center;gap:7px;padding:2px 0">
          ${ic('users',13)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.name)}</span>
</div>`).join('')}</div>`:''}
        <div class="chips">
          ${(c.files||[]).length?`<span class="badge grey">${ic('clip',12)} ${c.files.length}</span>`:''}
          ${(c.inventory||[]).length?`<span class="badge grey">${ic('box',12)} ${c.inventory.length} artigos</span>`:''}</div>
</div>`}).join('')}</div>`}).join('');
  return head+(any?body:`<div class="empty"><b>Nada neste filtro</b><div style="margin-top:10px"><button type="button" class="btn sm" onclick="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`);
}
// um contrato passa nos filtros da lista? imóvel, estado, grupo e pesquisa por texto (nome, inquilinos, IBAN, notas…)
// Recebe: c — o contrato (objeto); s — o estado dos filtros da lista (lf('lcts'): campos p, st, g e a pesquisa).
// Devolve: true se o contrato passa em todos os filtros, false caso contrário.
function ctFMatch(c,s){
  if(s.p&&c.propertyId!==s.p)return false;
  if(s.st==='on'&&!isActive(c))return false;
  if(s.st==='off'&&isActive(c))return false;
  if(s.g){const g=grp(s.g);if(!g||(g.ids||[]).indexOf(c.id)<0)return false}
  const p=prop(c.propertyId),ts=ctTenants(c);
  return lfHit('lcts',[ctName(c),c.name,p?p.name:'',c.roomId&&p?roomName(p,c.roomId):'',c.iban,c.notes,String(c.rent),
    ts.map(t=>[t.name,t.phone,t.email,t.nif].join(' ')).join(' '),c.tenantEmail,c.tenantPhone,c.ownerEmail,c.ownerPhone].join(' '));
}

/* cartão de pessoa para as listas: com kind 'tenant' mostra os contratos
   ativos, com 'owner' os imóveis. Ao toque abre a ficha (personModal).
   Recebe: pp — a pessoa (objeto de inquilino ou de proprietário); kind — 'tenant' ou 'owner'.
   Devolve: string HTML do cartão. */
function personCard(pp,kind){
  const cs=kind==='tenant'?contractsOfTenant(pp.id).filter(isActive):propsOf(pp.id);
  return `<div class="card tap" data-lp="per:${esc(kind)}:${esc(pp.id)}" onclick="personModal('${jsq(kind)}','${jsq(pp.id)}')"><div class="row-between">
    <div style="display:flex;gap:12px;min-width:0">
      <div class="avatar">${esc(initials(pp.name))}</div>
      <div style="min-width:0"><div class="title">${esc(pp.name)}</div>
        <div class="small">${[pp.phone?fmtPhone(pp.phone):'',pp.email].filter(Boolean).map(esc).join(' · ')||'Sem contacto'}${pp.nif?' · NIF '+esc(fmtNIF(pp.nif)):''}</div>
        <div class="small">${kind==='tenant'
          ?(cs.length?cs.map(c=>esc(ctName(c))+' · '+euro(c.rent)).join('<br>'):'Sem contrato ativo')
          :(cs.length?cs.map(x=>esc(x.name)).join(', '):'Sem imóveis')}</div></div></div>
    <div style="flex:0 0 auto;display:flex;gap:6px;align-items:flex-start">
      ${kind==='tenant'&&(pp.files||[]).length?`<span class="badge grey">${ic('clip',12)} ${pp.files.length}</span>`:''}
      ${kebab('per:'+kind+':'+pp.id)}</div></div>
    ${kind==='tenant'&&pp.notes?`<div class="small rich" style="margin-top:10px">${rich(pp.notes)}</div>`:''}</div>`;
}
/* Lista de inquilinos, filtrável por com/sem contrato ativo e por pesquisa;
   ordenação por nome, nº de contratos ou renda.
   Devolve: string com o HTML completo da vista. */
function vTenants(){
  const K='lten',s=lf(K);
  let list=db.tenants.filter(t=>{
    const cs=contractsOfTenant(t.id).filter(isActive);
    if(s.ct==='com'&&!cs.length)return false;
    if(s.ct==='sem'&&cs.length)return false;
    return lfHit(K,[t.name,t.phone,t.email,t.nif,t.notes,t.nationality,
      contractsOfTenant(t.id).map(c=>ctName(c)+' '+propName(c.propertyId)).join(' ')].join(' '));
  });
  list=lfSort(K,list,{nome:t=>t.name,contratos:t=>contractsOfTenant(t.id).filter(isActive).length,
    renda:t=>sum(contractsOfTenant(t.id).filter(isActive).map(c=>c.rent))});
  const head=lfBar(K,[lfSel(K,'ct',[{v:'',label:'Todos os inquilinos'},{v:'com',label:'Com contrato ativo'},{v:'sem',label:'Sem contrato ativo'}])],list.length,
      {opts:[{v:'nome',label:'Ordenar por nome'},{v:'contratos',label:'Ordenar por nº de contratos'},{v:'renda',label:'Ordenar por renda'}]})
    +fab([{label:'Adicionar inquilino',act:"personModal('tenant')"}]);
  if(!db.tenants.length)return head+`<div class="empty"><b>Sem inquilinos</b>A ficha guarda só os dados da pessoa. A renda fica no contrato.</div>`;
  if(!list.length)return head+`<div class="empty"><b>Nada neste filtro</b><div style="margin-top:10px"><button type="button" class="btn sm" onclick="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`;
  return head+`<div class="list">${list.map(t=>personCard(t,'tenant')).join('')}</div>`;
}
/* Lista de proprietários, filtrável por imóvel, com/sem imóveis e pesquisa;
   ordenação por nome ou nº de imóveis.
   Devolve: string com o HTML completo da vista. */
function vOwners(){
  const K='lown',s=lf(K);
  let list=db.owners.filter(o=>{
    const ps=propsOf(o.id);
    if(s.pr==='com'&&!ps.length)return false;
    if(s.pr==='sem'&&ps.length)return false;
    if(s.p&&!ps.some(x=>x.id===s.p))return false;
    return lfHit(K,[o.name,o.phone,o.email,o.nif,o.notes,ps.map(x=>x.name).join(' ')].join(' '));
  });
  list=lfSort(K,list,{nome:o=>o.name,imoveis:o=>propsOf(o.id).length});
  const head=lfBar(K,[lfSel(K,'p',[{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p=>({v:p.id,label:'Dono de · '+p.name})))),
      lfSel(K,'pr',[{v:'',label:'Todos os proprietários'},{v:'com',label:'Com imóveis'},{v:'sem',label:'Sem imóveis'}])],list.length,
      {opts:[{v:'nome',label:'Ordenar por nome'},{v:'imoveis',label:'Ordenar por nº de imóveis'}]})
    +fab([{label:'Adicionar proprietário',act:"personModal('owner')"}]);
  if(!db.owners.length)return head+`<div class="empty"><b>Sem proprietários</b>Um imóvel pode ter vários. Depois podes filtrar a visão geral por proprietário.</div>`;
  if(!list.length)return head+`<div class="empty"><b>Nada neste filtro</b><div style="margin-top:10px"><button type="button" class="btn sm" onclick="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`;
  return head+`<div class="list">${list.map(o=>personCard(o,'owner')).join('')}</div>`;
}

// nº de filtros ativos nos movimentos (a pesquisa não conta: soma-se à parte no cabeçalho)
// Devolve: número de filtros ativos (as datas contam como um só).
function txFilterCount(){
  // as datas contam como UM filtro, tenham uma ponta ou as duas
  const datas=(txDe||txAte)?1:0;
  return datas+txFilterCountSem();
}
// a mesma contagem sem as datas; atenção: desligar "sem pessoa atribuída" conta como um filtro
// Devolve: número de filtros ativos, sem contar as datas.
function txFilterCountSem(){
  return (txFilter?1:0)+(txProp?1:0)+(txPaid?1:0)+(ownerFilter?1:0)+(txCat?1:0)+(txSub?1:0)+(txNoPayer?0:1);
}
/* pesquisa por palavras e por frases entre aspas, sem ligar a acentos */
const deacc=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
// parte a pesquisa em termos: palavras soltas e frases entre aspas, tudo sem acentos
// Devolve: array de termos (strings já desacentuadas); vazio sem pesquisa.
function txTerms(){
  const out=[];
  const rest=String(txSearch||'').replace(/"([^"]*)"/g,(m,ph)=>{if(ph.trim())out.push(deacc(ph.trim()));return ' '});
  rest.split(/\s+/).forEach(w=>{if(w)out.push(deacc(w))});
  return out;
}
/* o "palheiro" onde a pesquisa procura: rótulo, notas, categorias, etiquetas,
   imóvel, contrato, pessoas, data e valor do movimento, tudo desacentuado.
   Recebe: t — o movimento (objeto de transação).
   Devolve: string única, desacentuada, com todos os campos pesquisáveis. */
function txHay(t){
  const c=t.contractId?contract(t.contractId):null;
  return deacc([t.label,t.notes,t.category,t.sub,(t.tags||[]).join(' '),t.creditor,t.date,
    propName(t.propertyId),t.groupId?((grp(t.groupId)||{}).name||''):'',c?ctName(c):'',
    t.paidBy&&owner(t.paidBy)?owner(t.paidBy).name:'',t.toId&&owner(t.toId)?owner(t.toId).name:'',
    String(t.amount),euro2(t.amount)].join(' '));
}
let _qT=null;
/* pesquisa dos movimentos com atraso de 280 ms para não redesenhar a cada
   tecla; como o render recria o campo, devolve-lhe o foco com o cursor no fim.
   Recebe: v — o texto escrito no campo de pesquisa.
   Devolve: nada — agenda o redesenho da vista. */
function onTxSearch(v){
  clearTimeout(_qT);
  _qT=setTimeout(()=>{txSearch=v;render();
    const i=document.getElementById('tx_q');
    if(i){i.focus();try{i.setSelectionRange(i.value.length,i.value.length)}catch(e){}}},280);
}
/* um movimento passa em TODOS os filtros ativos? Tipo ('debt' junta owed e
   repay), imóvel/grupo ('__none__' = sem imóvel; um imóvel apanha também os
   movimentos de grupo com quota nele), âmbito do proprietário, pessoa que
   pagou/recebeu, pesquisa, categoria/subcategoria e intervalo de datas.
   Recebe: t — o movimento (objeto de transação).
   Devolve: true se passa em todos os filtros ativos, false caso contrário. */
function txMatch(t){
  if(txFilter==='debt'){if(t.kind!=='owed'&&t.kind!=='repay')return false}
  else if(txFilter&&t.kind!==txFilter)return false;
  if(txProp==='__none__'){if(t.propertyId||t.groupId)return false}
  else if(String(txProp||'').startsWith('g:')){const gid=txProp.slice(2),g=grp(gid),gids=(g||{}).ids||[];
    if(!(t.groupId===gid||(t.propertyId&&gids.indexOf(t.propertyId)>-1)))return false}
  else if(txProp){if(t.propertyId){if(t.propertyId!==txProp)return false}else if(t.groupId&&txPropShare(t,txProp)<=0)return false}   /* sem imóvel = de todos */
  if(t.propertyId){if(!inScope(t.propertyId))return false}
  else if(t.groupId){if(ownerFilter&&!txProps(t).some(p=>inScope(p.id)))return false}
  else if(ownerFilter)return false;
  if(txPaid&&!(t.paidBy===txPaid||t.toId===txPaid||(!t.paidBy&&txNoPayer)))return false;
  if(!txNoPayer&&!t.paidBy)return false;
  if(txSearch.trim()){const hay=txHay(t);for(const term of txTerms())if(hay.indexOf(term)<0)return false}
  if(txCat==='__none__'){if(t.category)return false}
  else if(txCat&&t.category!==txCat)return false;
  if(txSub==='__none__'){if(t.sub)return false}
  else if(txSub&&t.sub!==txSub)return false;
  // entre datas: as ISO comparam-se como texto, e vazio é "sem limite"
  if(txDe&&t.date<txDe)return false;
  if(txAte&&t.date>txAte)return false;
  return true;
}
// descreve os filtros ativos numa linha legível, para o topo da lista e do modal
// Devolve: string (já escapada para HTML) com os filtros ativos; vazia sem filtros.
function filterSummary(){
  const p=[];
  if(txDe||txAte)p.push(txDe&&txAte?txDe+' → '+txAte:txDe?'desde '+txDe:'até '+txAte);
  if(txFilter)p.push((KIND[txFilter]||{}).short||txFilter);
  if(txProp==='__none__')p.push('sem imóvel');
  else if(String(txProp||'').startsWith('g:'))p.push('grupo '+((grp(txProp.slice(2))||{}).name||''));
  else if(txProp)p.push(propName(txProp));
  if(ownerFilter)p.push('de '+ownerFilterName());
  if(txPaid)p.push('pago/recebido por '+((owner(txPaid)||{}).name||''));
  if(txCat==='__none__')p.push('sem categoria');else if(txCat)p.push(txCat+(txSub&&txSub!=='__none__'?' / '+txSub:''));
  if(txSub==='__none__')p.push('sem subcategoria');
  if(!txNoPayer)p.push('só com pessoa atribuída');
  return esc(p.join(' · '));
}
/* um movimento novo assume os filtros ativos; sem filtro, o campo fica vazio
   Recebe: kind (opcional) — o tipo do movimento ('income', 'expense', …); sem ele assume 'income'.
   Devolve: nada — abre o modal do novo movimento. */
function newTxFromFilters(kind){
  const cat=txCat&&txCat!=='__none__'?txCat:'',sub=txSub&&txSub!=='__none__'?txSub:'';
  txModal(null,kind||'income',txProp&&txProp!=='__none__'?txProp:null,null,null,{paidBy:txPaid||null,category:treeKey(kind)===(cat in catsIn()&&!(cat in cats())?'catsIn':'cats')?cat:'',sub:treeKey(kind)===(cat in catsIn()&&!(cat in cats())?'catsIn':'cats')?sub:''});
}
/* "Novo movimento": primeiro o tipo, num menu
   Recebe: after (opcional) — função chamada com o tipo escolhido, em vez do fluxo normal; sem ela segue
   para newTxFromFilters e o menu inclui a opção "a partir de um modelo".
   Devolve: nada — abre o menu de escolha. */
function newTxPick(after){
  const items=TX_TYPES.map(([k,i,l,sb])=>({v:k,label:l,sub:sb,icon:i}));
  if(!after)items.push({v:'__tpl__',label:'A partir de um modelo…',sub:(db.templates||[]).length?'copia um movimento guardado':'ainda não há modelos: cria o primeiro',icon:'file'});
  pickModal('Que movimento?',items,o=>{
    if(o.v==='__tpl__')return useTemplateNew();   /* fica por cima: voltar regressa a este menu */
    closeAllModals();
    if(after)return after(o.v);
    newTxFromFilters(o.v);
  });
}
/* "a partir de um modelo": escolhe um modelo guardado e regista um movimento
   com base nele; sem modelos, salta logo para criar o primeiro.
   Devolve: nada — abre o modal de escolha do modelo (ou o fluxo de criar um). */
function useTemplateNew(){
  const tp=db.templates||[];
  if(!tp.length)return newTplForTx();
  pickModal('Usar modelo',tp.map(x=>({v:x.id,label:x.name,sub:(KIND[x.tx.kind]||{}).short+(x.tx.amount?' · '+euro2(x.tx.amount):'')+(x.tx.propertyId?' · '+propName(x.tx.propertyId):''),icon:'file'})),
    o=>{newFromTemplate(o.v)},
    `<button type="button" class="btn" style="width:100%;justify-content:center" onclick="newTplForTx()">${ic('plus',15)} Criar modelo novo</button>
     <div class="hint" style="margin-top:8px">Ao guardar, o modelo fica criado e o movimento é registado. Os modelos gerem-se em Finanças → Planeados.</div>`);
}
/* criar um modelo a meio de “novo movimento”: guarda o modelo E regista o movimento
   Devolve: nada — abre o fluxo do modelo novo. */
function newTplForTx(){
  newTxPick(k=>{txModal(null,k,null);tForm._tplNew=true;tForm._alsoTx=true;
    const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Novo modelo';repaintTx()});
}
/* os filtros vivem numa janela por cima da lista: mudar um filtro atualiza a lista e a própria janela
   Devolve: nada — redesenha a vista e, se estiver aberto, o modal de filtros. */
function txRerender(){
  render();
  const top=modalTop();
  if(top&&top.title==='Filtros'){modalBodyEl().innerHTML=txFilterBody();const f=document.getElementById('modalFoot');if(f)f.innerHTML=txFilterFoot()}
}
/* corpo do modal de filtros dos movimentos: pesquisa, tipo, imóvel,
   categoria/subcategoria, pessoas, datas e ordenação. Cada controlo aplica
   logo (handlers onTx*), e no fim mostra o resumo e quantos movimentos passam.
   Devolve: string HTML do corpo do modal. */
function txFilterBody(){
  const kinds=[['','Todos os tipos'],['income','Receitas'],['expense','Despesas'],['loan','Pagamentos de crédito'],['debt','Dívidas'],['settle','Transferências entre proprietários']];
  const props=[{v:'',label:'Todos os imóveis'},{v:'__none__',label:'Sem imóvel atribuído'}].concat(scope().map(p=>({v:p.id,label:p.name}))).concat(gdiv(gOpts('prop')));
  const payers=[{v:'',label:'Qualquer proprietário'}].concat(db.owners.map(o=>({v:o.id,label:o.name})));
  const owners=[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner')));
  const tree=allCats(txFilter==='debt'?'expense':txFilter),catOpts=[{v:'',label:'Todas as categorias'},{v:'__none__',label:'Sem categoria'}].concat(Object.keys(tree).map(c=>({v:c,label:c})));
  const subsF=txCat&&txCat!=='__none__'?(tree[txCat]||[]):[];
  const subOpts=[{v:'',label:'Todas as subcategorias'},{v:'__none__',label:'Sem subcategoria'}].concat(subsF.map(x=>({v:x,label:x})));
  return `<div class="form">
    ${typeof fcSelector==='function'?fcSelector():''}
    <div class="qwrap"><input id="tx_q" class="txq" type="search" value="${esc(txSearch)}" placeholder="Pesquisar…" autocomplete="off"
      oninput="onTxSearch(this.value);this.nextElementSibling.style.display=this.value?'':'none'">
      <button class="qclear" style="display:${txSearch?'':'none'}" onclick="const i=this.previousElementSibling;i.value='';onTxSearch('');this.style.display='none';i.focus()">✕</button></div>
    <label>Tipo${sel('txKind',txFilter,kinds.map(k=>({v:k[0],label:k[1]})),'onTxFilter')}</label>
    <label>Imóvel${sel('txPropF',txProp,props,'onTxProp')}</label>
    <div class="row"><label>Categoria${sel('txCatF',txCat,catOpts,'onTxCat')}</label>
      ${txCat&&txCat!=='__none__'?`<label>Subcategoria${sel('txSubF',txSub,subOpts,'onTxSub')}</label>`:''}</div>
    ${db.owners.length?`<label>Proprietário${sel('txOwnerF',ownerFilter,owners,'onTxOwner')}</label>
    <label>Pago / recebido por${sel('txPaidF',txPaid,payers,'onTxPaid')}</label>
    <label class="check"><input type="checkbox" id="txNoPayer" ${txNoPayer?'checked':''} onchange="onTxNoPayer()"> Incluir movimentos sem pessoa atribuída</label>`:''}
    <div class="row lado-a-lado"><label>De<input id="txDeF" type="date" value="${txDe}" onchange="onTxDatas()"></label>
      <label>Até<input id="txAteF" type="date" value="${txAte}" onchange="onTxDatas()"></label></div>
    <div class="row"><label>Ordenar por${sel('txSortF',txSort,[{v:'date',label:'Data'},{v:'amount',label:'Valor'}],'onTxSort')}</label>
      <label>Ordem${sel('txDirF',txDir,[{v:'desc',label:'Descendente'},{v:'asc',label:'Ascendente'}],'onTxDir')}</label></div>
    <div class="hint">${txFilterCount()?filterSummary()+' · '+db.transactions.filter(txMatch).length+' movimentos':'Sem filtros: a lista mostra tudo.'}</div></div>`;
}
// muda o campo de ordenação dos movimentos (data ou valor)
// Devolve: nada — redesenha a lista e o modal.
function onTxSort(){txSort=val('txSortF')||'date';txRerender()}
// muda o sentido da ordenação dos movimentos
// Devolve: nada — redesenha a lista e o modal.
function onTxDir(){txDir=val('txDirF')||'desc';txRerender()}
// rodapé do modal de filtros: Limpar (só quando há filtros) e Fechar
// Devolve: string HTML do rodapé.
function txFilterFoot(){return `${txFilterCount()?`<button class="btn" onclick="clearTxFilters()">${ic('x',15)} Limpar</button>`:''}<button class="btn primary" onclick="closeModal()">${ic('check',15)} Fechar</button>`}
// abre o modal de filtros dos movimentos
// Devolve: nada — abre o modal.
function txFilterModal(){openModal('Filtros',txFilterBody(),txFilterFoot())}
// muda o filtro de imóvel/grupo dos movimentos
// Devolve: nada — redesenha a lista e o modal.
function onTxProp(){txProp=val('txPropF')||'';txRerender()}
// muda o proprietário em foco; o filtro de imóvel cai porque o âmbito mudou
// Devolve: nada — redesenha a lista e o modal.
function onTxOwner(){ownerFilter=val('txOwnerF')||'';txProp='';txRerender()}
// muda o filtro de quem pagou ou recebeu
// Devolve: nada — redesenha a lista e o modal.
function onTxPaid(){txPaid=val('txPaidF')||'';txRerender()}
// muda a categoria; a subcategoria cai porque pertencia à anterior
// Devolve: nada — redesenha a lista e o modal.
function onTxCat(){txCat=val('txCatF')||'';txSub='';txRerender()}
// muda o filtro de subcategoria
// Devolve: nada — redesenha a lista e o modal.
function onTxSub(){txSub=val('txSubF')||'';txRerender()}
// liga/desliga a inclusão de movimentos sem pessoa atribuída
// Devolve: nada — redesenha a lista e o modal.
function onTxNoPayer(){txNoPayer=chk('txNoPayer');txRerender()}
// lê o intervalo de datas do modal e aplica-o à lista
// Devolve: nada — redesenha a lista e o modal.
function onTxDatas(){
  txDe=val('txDeF')||'';txAte=val('txAteF')||'';
  if(txDe&&txAte&&txAte<txDe){const x=txDe;txDe=txAte;txAte=x}   // trocadas endireitam-se
  txRerender();
}
// repõe todos os filtros dos movimentos na origem, incluindo a pesquisa e o proprietário global
// Devolve: nada — redesenha a lista e o modal.
function clearTxFilters(){txFilter='';txProp='';txPaid='';txCat='';txSub='';ownerFilter='';txNoPayer=true;txSearch='';txDe='';txAte='';closePops();txRerender()}
/* ================= FILTROS DAS LISTAS =================
   Pesquisa por texto + seletores no topo de cada página de registos, ao estilo dos movimentos. */
let listF={};
const lf=k=>listF[k]||(listF[k]={});
let _lqT=null;
/* pesquisa das listas com atraso de 280 ms para não redesenhar a cada tecla;
   como o render recria o campo, devolve-lhe o foco com o cursor no fim.
   Recebe: k — a chave da lista ('lprops', 'lcts', …); v — o texto escrito no campo de pesquisa.
   Devolve: nada — agenda o redesenho da vista. */
function lfSearch(k,v){
  clearTimeout(_lqT);
  _lqT=setTimeout(()=>{lf(k).q=v;render();
    const i=document.getElementById('lq_'+k);
    if(i){i.focus();try{i.setSelectionRange(i.value.length,i.value.length)}catch(e){}}},280);
}
/* limpa o filtro do separador atual, seja ele qual for — para o botão dos
   estados vazios não ter de saber onde está
   Devolve: nada — limpa os filtros e redesenha a vista. */
function limparFiltroAtual(){
  if(typeof LFK!=='undefined'&&LFK[tab])return lfClear(LFK[tab]);
  if(tab==='transactions'&&typeof clearTxFilters==='function')return clearTxFilters();
  if(typeof anaClear==='function')anaClear();
}
// limpa os filtros da lista k sem mexer no painel; nos imóveis larga também o proprietário global
// Recebe: k — a chave da lista ('lprops', 'lcts', …).
// Devolve: nada — redesenha a vista.
function lfClear(k){
  const s=lf(k);listF[k]={_open:s._open};
  if(k==='lprops')ownerFilter='';
  closePops();render();
}
// nº de filtros ativos da lista k — a ordenação (sb/sd) e o estado do painel não contam
// Recebe: k — a chave da lista.
// Devolve: número de filtros ativos.
function lfCount(k){const s=lf(k);return Object.keys(s).reduce((n,f)=>{
  if(f==='_open'||f==='sb'||f==='sd')return n;
  return n+(f==='q'?(String(s.q||'').trim()?1:0):(s[f]?1:0))},0)}
// a pesquisa da lista k encontra-se em hay? palavras e frases entre aspas, sem acentos; sem pesquisa passa tudo
// Recebe: k — a chave da lista; hay — o texto onde procurar (os campos do registo juntos numa string).
// Devolve: true se todos os termos da pesquisa aparecem em hay (ou não há pesquisa), false caso contrário.
function lfHit(k,hay){const q=String(lf(k).q||'');if(!q.trim())return true;
  const h=deacc(hay),terms=[];
  q.replace(/"([^"]*)"/g,(m,ph)=>{if(ph.trim())terms.push(deacc(ph.trim()));return ' '}).split(/\s+/).forEach(w=>{if(w)terms.push(deacc(w))});
  for(const t of terms)if(h.indexOf(t)<0)return false;return true}
/* Os três painéis de filtro tinham três feitios: rascunho com Aplicar nas
   listas, aplicação imediata no modal dos movimentos, imediata com um botão
   chamado «Aplicar» nas análises. Fica UM modelo mental: mexes, a lista
   muda logo atrás; «Limpar» à esquerda, «Fechar» primário à direita, em
   todo o lado. O rascunho foi-se com a razão de ser dele.
   Recebe: k — a chave da lista; key — o nome do campo no estado do filtro (ex.: 'st', 'own', 'sb');
   opts — array de opções {v, label} para o seletor.
   Devolve: string HTML do seletor (e regista o handler global que aplica o filtro). */
function lfSel(k,key,opts){
  const id='lfsel_'+k+'_'+key,fn='onlf_'+k+'_'+key;
  window[fn]=()=>{lf(k)[key]=val(id)||'';if(k==='lprops')ownerFilter=lf(k).own||'';render()};
  return `<div style="width:100%">${sel(id,lf(k)[key]||'',opts,fn)}</div>`;
}
// abre/fecha o painel de filtros da lista k
// Recebe: k — a chave da lista.
// Devolve: nada — redesenha a vista.
function lfToggle(k){
  const s=lf(k);s._open=!s._open;render();
}
// fecha o painel da lista k (os filtros aplicam-se logo ao mexer)
// Recebe: k — a chave da lista.
// Devolve: nada — redesenha a vista.
function lfApply(k){
  lf(k)._open=false;closePops();render();
}
/* o dropdown de filtros (aberto pelo botão do cabeçalho) inclui a pesquisa no topo
   Recebe: k — a chave da lista; sels — array de seletores já em HTML (saídos de lfSel); found — nº de resultados
   com os filtros ativos; sorts (opcional) — {opts: [{v, label}], defLabel} com as opções de ordenação.
   Devolve: string HTML do dropdown, com a linha de resultados quando há filtros ativos. */
function lfBar(k,sels,found,sorts){
  const n=lfCount(k),s=lf(k);
  const sortRow=sorts?`<div style="display:flex;flex-direction:column;gap:9px;margin-top:9px">
      ${lfSel(k,'sb',[{v:'',label:sorts.defLabel||'Ordem original'}].concat(sorts.opts))}
      ${lfSel(k,'sd',[{v:'',label:'Ascendente'},{v:'desc',label:'Descendente'}])}</div>`:'';
  return `<div class="fwrap" style="height:0"><div class="fpanel ${s._open?'on':''}" style="top:0"><div class="card" style="padding:12px">
    ${k==='lprops'&&typeof fcSelector==='function'?fcSelector():''}
    <div class="qwrap"><input id="lq_${k}" class="txq" type="search" value="${esc(lf(k).q||'')}" placeholder="Pesquisar…" autocomplete="off"
      oninput="lfSearch('${k}',this.value);this.nextElementSibling.style.display=this.value?'':'none'">
      <button class="qclear" style="display:${(lf(k).q||'')?'':'none'}" onclick="const i=this.previousElementSibling;i.value='';lfSearch('${k}','');this.style.display='none';i.focus()">✕</button></div>
    <div style="display:flex;flex-direction:column;gap:9px;margin-top:9px">${sels.join('')}</div>
    ${sortRow}
    <div class="toolbar" style="margin:12px 0 0">
      <button class="btn" onclick="lfClear('${k}')">${ic('x',15)} Limpar</button>
      <button class="btn primary" onclick="lfApply('${k}')">${ic('check',15)} Fechar</button>
    </div>
  </div></div></div>
  ${n?`<div class="small" style="margin:2px 0 10px">${found} resultado${found===1?'':'s'} com os filtros ativos${String(s.q||'').trim()?' · pesquisa: “'+esc(s.q.trim())+'”':''}.</div>`:''}`;
}
/* aplica a ordenação escolhida; sem escolha, mantém a ordem dada
   Recebe: k — a chave da lista; list — o array a ordenar; keys — objeto {opção: função que extrai o valor a comparar}.
   Devolve: novo array ordenado (ou a própria list, intacta, sem escolha de ordenação). */
function lfSort(k,list,keys){
  const s=lf(k),f=keys[s.sb];if(!f)return list;
  const dir=s.sd==='desc'?-1:1;
  return list.slice().sort((a,b)=>{const x=f(a),y=f(b);
    if(typeof x==='string'||typeof y==='string')return dir*String(x??'').localeCompare(String(y??''),'pt');
    return dir*((Number(x)||0)-(Number(y)||0))});
}
/* botão flutuante de adicionar, no canto inferior direito (o espaço no fundo da página é acrescentado no render)
   Recebe: actions — array de {act: código do onclick, label, icon (opcional)}; com um só item sai o botão simples,
   com vários sai também o menu.
   Devolve: string HTML do botão (e do menu, quando há vários). */
function fab(actions){
  if(actions.length===1)return `<button class="fab" onclick="${actions[0].act}" title="${esc(actions[0].label||'')}">${ic('plus',26)}</button>`;
  return `<div class="fabmenu" id="fabMenu">${actions.map(a=>`<button class="btn primary" onclick="document.getElementById('fabMenu').classList.remove('on');${a.act}">${ic(a.icon||'plus',15)} ${esc(a.label)}</button>`).join('')}</div>
  <button class="fab" onclick="document.getElementById('fabMenu').classList.toggle('on')">${ic('plus',26)}</button>`;
}
// opções de imóvel para os seletores das listas: "Todos os imóveis" + um por imóvel
// Recebe: withAll (opcional) — sem efeito atual: as opções saem sempre com "Todos os imóveis" à cabeça.
// Devolve: array de opções {v, label} para um seletor.
const lfPropOpts=(withAll)=>[{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p=>({v:p.id,label:p.name})));
/* dívidas a terceiros: recebido, devolvido e o que falta, com botão para pagar
   Recebe: pid — id do imóvel a que limitar, ou null/vazio para todo o âmbito.
   Devolve: string HTML do cartão, ou vazia se não há dívidas registadas. */
function creditorsCard(pid){
  const rows=creditorBalances(pid);if(!rows.length)return '';
  const due=sum(rows.map(r=>r.due));
  return `<div class="cols"><div class="card">
    <div class="row-between"><div><div class="title">Dívidas a terceiros</div>
      <div class="small">${due>0.005?euro2(due)+' por devolver':'Tudo devolvido'}</div></div>${ic('users',22)}</div>
    <div style="margin-top:10px">
      ${rows.map(r=>`<div class="stat" style="align-items:center"><span style="min-width:0"><b>${esc(r.creditor)}</b>${r.propertyId?` <span class="small">· ${esc(propName(r.propertyId))}</span>`:''}
          <div class="small">recebido ${euro2(r.received)} · devolvido ${euro2(r.repaid)}</div></span>
        <span style="display:flex;align-items:center;gap:8px;flex:0 0 auto"><b class="${r.due>0.005?'neg':'pos'}">${r.due>0.005?euro2(r.due):'liquidado'}</b>
          ${r.due>0.005?`<button class="btn sm" onclick="${stop}txModal(null,'repay',${r.propertyId?`'${r.propertyId}'`:'null'},null,null,{creditor:'${jsq(r.creditor==='—'?'':r.creditor)}',amount:${r.due}})">Pagar</button>`:''}</span></div>`).join('')}
    </div></div></div>`;
}
/* Movimentos: KPIs do filtro atual (com evolução ao toque), saldos entre
   proprietários, dívidas a terceiros e a lista agrupada por mês com o saldo
   de cada um. Tudo respeita os filtros e a ordenação escolhidos no modal.
   Devolve: string com o HTML completo da vista. */
function vTransactions(){
  const kinds=[['','Todos os tipos'],['income','Receitas'],['expense','Despesas'],['loan','Pagamentos de crédito'],['debt','Dívidas'],['settle','Transferências entre proprietários']];
  const props=[{v:'',label:'Todos os imóveis'},{v:'__none__',label:'Sem imóvel atribuído'}].concat(scope().map(p=>({v:p.id,label:p.name}))).concat(gdiv(gOpts('prop')));
  const payers=[{v:'',label:'Qualquer pessoa'}].concat(db.owners.map(o=>({v:o.id,label:o.name})));
  const owners=[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner')));
  const tree=allCats(txFilter),catOpts=[{v:'',label:'Todas as categorias'},{v:'__none__',label:'Sem categoria'}].concat(Object.keys(tree).map(c=>({v:c,label:c})));
  const subsF=txCat&&txCat!=='__none__'?(tree[txCat]||[]):[];
  const subOpts=[{v:'',label:'Todas as subcategorias'},{v:'__none__',label:'Sem subcategoria'}].concat(subsF.map(x=>({v:x,label:x})));
  const nF=txFilterCount();
  const head=`${nF||txSearch.trim()?`<div class="small" style="margin:2px 0 10px">${filterSummary()}${txSearch.trim()?(nF?' · ':'')+'pesquisa: “'+esc(txSearch.trim())+'”':''}</div>`:''}`
  +fab([{label:'Novo movimento',act:'newTxPick()'}]);
  if(!db.transactions.length)return head+`<div class="empty"><b>Sem movimentos</b>Regista a primeira renda recebida ou despesa paga.</div>`;
  const list=db.transactions.filter(txMatch).sort((a,b)=>{const d=txDir==='desc'?-1:1;
    if(txSort==='amount')return d*((a.amount||0)-(b.amount||0))||String(a.date).localeCompare(String(b.date));
    return d*String(a.date).localeCompare(String(b.date))});
  if(!list.length)return head+`<div class="empty"><b>Nada neste filtro</b><div style="margin-top:10px"><button type="button" class="btn sm" onclick="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`
    +balancesCard(txProp||null);   /* pode não haver movimentos e haver contas por acertar */
  const tot={income:0,expense:0,loan:0,owed:0,repay:0,settle:0};list.forEach(t=>{if(countsInTotals(t))tot[t.kind]=(tot[t.kind]||0)+t.amount});
  const saldo=tot.income+tot.owed-tot.expense-tot.loan-tot.repay;
  const evoTx=k=>()=>{
    const L=db.transactions.filter(txMatch).filter(countsInTotals),f=t=>k==='saldo'?(isIn(t.kind)?t.amount:isOut(t.kind)?-t.amount:0):(t.kind===k?t.amount:0);
    const ys={};ys[YEAR]=1;L.forEach(t=>{const y=Number(String(t.date).slice(0,4));if(y)ys[y]=1});
    return {fmt:euro,monthly:[...Array(12)].map((_,i)=>sum(L.filter(t=>String(t.date).startsWith(`${YEAR}-${String(i+1).padStart(2,'0')}`)).map(f))),
      yearly:Object.keys(ys).map(Number).sort().map(y=>({label:y,value:sum(L.filter(t=>String(t.date).startsWith(String(y))).map(f))}))};
  };
  const resumo=`<div class="grid" style="margin-bottom:4px">
    ${kpi('Receitas',euro(tot.income),'pos','no filtro atual','Soma das receitas dos movimentos que passam no filtro.',evoTx('income'))}
    ${kpi('Despesas',euro(tot.expense),'neg','no filtro atual','Soma das despesas dos movimentos que passam no filtro.',evoTx('expense'))}
    ${kpi('Prestações',euro(tot.loan),'amber','no filtro atual','Prestações do crédito dos movimentos que passam no filtro.',evoTx('loan'))}
    ${tot.owed?kpi('Dívidas recebidas',euro(tot.owed),'amber','de terceiros','Dinheiro recebido de terceiros.',evoTx('owed')):''}
    ${tot.repay?kpi('Dívidas pagas',euro(tot.repay),'neg','a terceiros','Devoluções a terceiros.',evoTx('repay')):''}
    ${kpi('Saldo',euro(saldo),saldo>=0?'pos':'neg',list.length+' movimentos','Entradas menos saídas dos movimentos que passam no filtro.',evoTx('saldo'))}</div>`;
  const by={};list.forEach(t=>{const k=String(t.date).slice(0,7);(by[k]=by[k]||[]).push(t)});
  const who=t=>{
    if(t.kind==='settle')return `<div class="small"><b>${esc((owner(t.paidBy)||{}).name||'?')}</b> → <b>${esc((owner(t.toId)||{}).name||'?')}</b></div>`;
    if(!(t.paidBy&&owner(t.paidBy)))return '';
    return `<div class="small">${isIn(t.kind)?'Recebido por':'Pago por'} <b>${esc(owner(t.paidBy).name)}</b>${splitLabel(t)?' · dividido '+splitLabel(t):''}</div>`;
  };
  return head+resumo+balancesCard(txProp||null)+creditorsCard(txProp&&txProp!=='__none__'?txProp:null)+Object.keys(by).map(mo=>{
    const rows=by[mo],net=sum(rows.map(t=>!countsInTotals(t)?0:isIn(t.kind)?t.amount:(isOut(t.kind)?-t.amount:0)));
    return `<div class="section-title" style="display:flex;justify-content:space-between;text-transform:none">
      <span>${mo}</span><span class="${net>=0?'pos':'neg'}">${euro(net)}</span></div>
      <div class="list">${rows.map(t=>{const k=KIND[t.kind]||KIND.expense,c=t.contractId?contract(t.contractId):null;
      return `<div class="card tap txrow" data-lp="tx:${esc(t.id)}" style="padding:13px 15px" onclick="txModal('${jsq(t.id)}')"><div class="row-between">
        <div style="min-width:0"><div class="title" style="font-size:14.5px">${esc(t.label)}</div>
          <div class="small">${esc(t.date)} · ${k.short}${t.category?' · '+esc(t.category)+(t.sub?' / '+esc(t.sub):''):''}${t.propertyId?' · '+esc(propName(t.propertyId)):''}${t.creditor?' · '+esc(t.creditor):''}</div>
          ${c?`<div class="small">${ic('contract',12)} ${esc(ctName(c))}</div>`:''}
          ${who(t)}
          ${t.kind==='loan'&&(t.principal||t.interest||t.fee)?`<div class="small">${t.payType==='amortizacao'?`Amortização · capital ${euro2(t.principal||0)} · comissão ${euro2(t.fee||0)}`:`Capital ${euro2(t.principal||0)} · juros ${euro2(t.interest||0)} · selo ${euro2(t.stamp||0)}${t.retro?' · retroativa, não abateu capital':''}`}</div>`:''}
          ${(!countsInTotals(t)||(t.tags||[]).length)?`<div class="chips">${countsInTotals(t)?'':'<span class="badge grey">fora dos totais</span>'}${(t.tags||[]).map(g=>`<span class="badge grey">${esc(g)}</span>`).join('')}</div>`:''}</div>
        <div style="text-align:right;flex:0 0 auto"><div class="${k.color}" style="font-weight:750${t.kind==='settle'?';color:var(--muted)':''}">${k.sign}${euro2(t.amount)}</div>
          ${t.notes?`<div class="small" style="margin-top:3px" title="Tem comentários">${ic('pen',12)}</div>`:''}</div>
      </div></div>`}).join('')}</div>`}).join('');
}
// muda o filtro de tipo; categoria e subcategoria caem porque a árvore muda com o tipo
// Devolve: nada — redesenha a lista e o modal.
function onTxFilter(){txFilter=val('txKind')||'';txCat='';txSub='';txRerender()}

let projProp='';
// muda o imóvel (ou grupo) em foco nas projeções
// Devolve: nada — redesenha a vista.
function onProjProp(){projProp=val('projSel')||'';render()}
/* Os números da projeção, sem HTML: por ano do horizonte (s.years), as rendas
   dos contratos ativos com o aumento anual de cada um, as despesas a partir da
   base de opBase com a inflação, as prestações segundo o plano de cada hipoteca
   (param quando o crédito acaba) e o cashflow; mais a dívida no fim de cada ano.
   Recebe: pid — id do imóvel, 'g:ID' de um grupo, ou null/vazio para o âmbito todo.
   Devolve: {rows, act, debtY, base} — rows é um array de {yr, rent, exp, loan, cf, per}
   (per: a renda de cada contrato, pela ordem de act); act os contratos ativos da vista;
   debtY a dívida no fim de cada ano; base o {op, year, anualizado} de opBase. */
function projRows(pid){
  const s=db.settings,n=Math.max(1,Math.round(s.years)),pps=pidProps(pid);
  const act=db.contracts.filter(c=>isActive(c)&&inScope(c.propertyId)&&pps.some(p=>p.id===c.propertyId));
  const base=opBase(pid),rows=[];
  /* prestações previstas: vêm do plano de cada hipoteca e param quando o crédito acaba */
  const sched=[...Array(n)].map((_,i)=>sum(pps.map(p=>sh(p)*sum(liveLoans(p).map(l=>{
    const a=amort(l),from=i*12,to=Math.min((i+1)*12,a.rows.length);
    let t=0;for(let k=from;k<to;k++)t+=a.rows[k].pay+(a.rows[k].st||0);
    return t;
  })))));
  for(let i=0;i<n;i++){
    const per=act.map(c=>c.rent*sh(prop(c.propertyId))*12*Math.pow(1+((c.increase==null?s.growth:c.increase)/100),i));
    const rent=sum(per),exp=base.op*Math.pow(1+s.inflation/100,i),ln=sched[i];
    rows.push({yr:YEAR+i,rent,exp,loan:ln,cf:rent-exp-ln,per});
  }
  const debtY=[...Array(n)].map((_,i)=>sum(pps.map(p=>sh(p)*sum(liveLoans(p).map(l=>{
    const a=amort(l,(i+1)*12);return a.rows.length?a.rows[a.rows.length-1].bal:0})))));
  return {rows,act,debtY,base};
}
/* Projeções ao horizonte definido nas definições (s.years), a partir de
   projRows: KPIs, gráficos e tabela ano a ano com uma coluna por contrato. O
   cabeçalho diz de onde vem a base das despesas.
   Devolve: string com o HTML completo da vista. */
function vProjections(){
  if(projProp&&!pidProps(projProp).length)projProp='';
  const s=db.settings,{rows,act,debtY,base}=projRows(projProp||null),n=rows.length;
  const head=anaPanel(`<div style="display:flex;flex-direction:column;gap:9px">
    ${db.owners.length?`<div style="width:100%">${sel('ownerSel',ownerFilter,[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner'))),'onOwnerFilter')}</div>`:''}
    <div style="width:100%">${sel('projSel',projProp,[{v:'',label:'Todos os imóveis'}].concat(scope().map(p=>({v:p.id,label:p.name}))).concat(gdiv(gOpts('prop'))),'onProjProp')}</div></div>
    <div class="row3" style="margin-top:10px">
    <label>Horizonte (anos)<input type="text" inputmode="numeric" value="${s.years}" onchange="setSet('years',Math.min(30,Math.max(1,num(this.value))))"></label>
    <label>Aumento anual (%)<input type="text" inputmode="decimal" value="${dec(s.growth)}" onchange="setSet('growth',num(this.value))"></label>
    <label>Inflação das despesas (%)<input type="text" inputmode="decimal" value="${dec(s.inflation)}" onchange="setSet('inflation',num(this.value))"></label></div>
    <div class="hint" style="margin-top:9px">Cada contrato tem o seu aumento. Em Portugal há um coeficiente máximo publicado todos os anos.</div>
    <div class="hint" style="margin-top:6px">Despesas: <b>${euro(base.op)}/ano</b> — ${base.anualizado?'o ano corrente anualizado, porque ainda não há um ano completo com despesas':'as de '+base.year+', o último ano completo com despesas'}; crescem com a inflação.</div>`);
  if(!act.length)return head+`<div class="empty" style="margin-top:14px"><b>Nenhum contrato ativo</b>As projeções partem das rendas contratadas.</div>`;
  const first=rows[0],last=rows[rows.length-1],labels=rows.map(r=>String(r.yr).slice(2));
  const baseTxt=' Aqui: '+euro(base.op)+'/ano, '+(base.anualizado?'o ano corrente anualizado.':'base '+base.year+'.');
  const varRenda=first.rent?last.rent/first.rent-1:0;
  return head+(ownerFilter&&!ownerIsGrp()?`<div class="hint" style="margin-top:12px">Valores na quota-parte de <b>${esc(ownerFilterName())}</b>.</div>`:'')+`<div class="grid" style="margin-top:14px">
    ${kpi('Renda anual hoje',euro(first.rent),'','a preços de '+YEAR,WHY.rendaHoje,()=>({fmt:euro,yearlyTitle:'Projeção ano a ano',yearly:rows.map(r=>({label:r.yr,value:r.rent}))}))}
    ${kpi('Renda em '+last.yr,euro(last.rent),varRenda>=0?'pos':'neg',(varRenda>=0?'+':'')+pct(varRenda)+' acumulado',WHY.rendaFim,()=>({fmt:euro,yearlyTitle:'Projeção ano a ano',yearly:rows.map(r=>({label:r.yr,value:r.rent}))}))}
    ${kpi('Total do período',euro(sum(rows.map(r=>r.rent))),'',n+' anos de rendas',WHY.totalPeriodo,()=>{let a=0;return {fmt:euro,yearlyTitle:'Acumulado ano a ano',yearly:rows.map(r=>({label:r.yr,value:a+=r.rent}))}})}
    ${kpi('Cashflow em '+last.yr,euro(last.cf),last.cf>=0?'pos':'neg','com despesas e prestações',WHY.cashflowFim+baseTxt,()=>({fmt:euro,yearlyTitle:'Projeção ano a ano',extraTitle:'Prestações',yearly:rows.map(r=>({label:r.yr,value:r.cf,extra:euro(r.loan)}))}))}</div>
  <div class="cols">
    ${card('Rendas, prestações e cashflow','',cLine([{name:'Rendas',values:rows.map(r=>r.rent),color:PAL[0]},
      {name:'Prestações',values:rows.map(r=>r.loan),color:'#d6a34a'},
      {name:'Cashflow',values:rows.map(r=>r.cf),color:PAL[1]}],labels,{h:210,marks:decadeMarks(YEAR,n)}))}
    ${card('Dívida por amortizar','Somando os créditos em uso',cLine([{name:'Em dívida',values:debtY,color:'#d6a34a'}],labels,{h:200,marks:decadeMarks(YEAR,n)}))}</div>
  <div style="margin-top:14px">${card('Detalhe ano a ano','Uma coluna por contrato ativo',`<div class="tablewrap"><table class="table"><thead><tr>
    <th>Ano</th>${act.map(c=>`<th>${esc(ctName(c))}</th>`).join('')}<th>Rendas</th><th>Despesas</th><th>Prestações</th><th>Cashflow</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td><b>${r.yr}</b></td>${r.per.map(v=>`<td>${euro(v)}</td>`).join('')}
      <td><b>${euro(r.rent)}</b></td><td class="neg">${euro(r.exp)}</td><td class="amber">${euro(r.loan)}</td>
      <td class="${r.cf>=0?'pos':'neg'}"><b>${euro(r.cf)}</b></td></tr>`).join('')}</tbody></table></div>`)}</div>`;
}
// marcas para os gráficos de longo prazo: um traço em cada ano terminado em 0 dentro do horizonte
// Recebe: y0 — o primeiro ano (número); n — quantos anos tem o horizonte.
// Devolve: array de {i: índice no eixo, label: o ano em texto}, um por ano terminado em 0.
const decadeMarks=(y0,n)=>{const out=[];for(let i=0;i<n;i++)if((y0+i)%10===0)out.push({i,label:String(y0+i)});return out};
// escreve uma definição, grava na base e redesenha — usado pelos inputs das definições e das projeções
// Recebe: k — o nome da definição (ex.: 'years', 'growth', 'inflation'); v — o novo valor.
// Devolve: nada — grava na base e redesenha a vista.
function setSet(k,v){db.settings[k]=v;save();render()}
