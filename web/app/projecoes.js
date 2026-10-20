/* ================= PROJEÇÕES (serviço projections) ================= */
/* As rendas futuras e os aumentos anuais, imóvel a imóvel. Veio de vistas.js
   quando a app passou a serviços; regista-se no fim. */
let projProp='';
/* Muda o imóvel (ou grupo) em foco nas projeções, escolhido no chip «Imóvel»
   (vistas.js:anaChips). Escolher pelo teclado deixa o foco no botão do chip,
   que o render refaz: volta ao novo, com o mesmo id (vistas.js:lfReporFoco).
   Recebe: nada (lê o seletor #projSel).
   Devolve: nada — redesenha a vista. */
function onProjProp(){const antes=document.activeElement;projProp=val('projSel')||'';render();lfReporFoco(antes)}
/* Quantos meses de um ano é que este contrato está em vigor.

   A projeção somava a renda cheia a todos os anos do horizonte, sem olhar às
   datas: um contrato que só começa em 2028 rendia em 2026 e 2027, e um que
   acaba em 2027 continuava a render em 2030.

   Conta-se por meses e não por anos inteiros — um contrato que começa em
   julho rende meio ano nesse ano.
   Recebe: c — o contrato; ano — o ano a contar (número).
   Devolve: 0 a 12. */
function mesesEmVigor(c,ano){
  const mes=(iso,fim)=>{
    if(!iso)return fim?12:0;
    const y=Number(String(iso).slice(0,4)),m=Number(String(iso).slice(5,7))||1;
    if(y<ano)return fim?12:0;
    if(y>ano)return fim?12:12;      /* fora do ano: o corte faz-se abaixo */
    return fim?m:m-1;
  };
  const y0=c.start?Number(String(c.start).slice(0,4)):null;
  const y1=c.end?Number(String(c.end).slice(0,4)):null;
  if(y0!=null&&y0>ano)return 0;     /* ainda não começou */
  if(y1!=null&&y1<ano)return 0;     /* já acabou */
  const de=(y0===ano)?mes(c.start,false):0;
  const ate=(y1===ano)?mes(c.end,true):12;
  return Math.max(0,ate-de);
}
/* Os números da projeção, sem HTML: por ano do horizonte (s.years), as rendas
   dos contratos ativos com o aumento anual de cada um, o IRS sobre elas à taxa
   de cada contrato no ano da coluna (irs.js:taxRateOf, com as regras da versão
   desse ano — a mesma da «renda líquida de impostos»; conta no ano das rendas,
   embora se pague no seguinte), as despesas previstas
   (metricas.js:despesasPrevistas — os planeados de despesa levados ao ano) com
   a inflação, as prestações segundo o plano de cada hipoteca (param quando o
   crédito acaba) e o cashflow; mais a dívida no fim de cada ano e o que ficou
   de fora (metricas.js:despesasDeUmaVez).
   Recebe: pid — id do imóvel, 'g:ID' de um grupo, ou null/vazio para o âmbito todo.
   Devolve: {rows, act, debtY, base} — rows é um array de {yr, rent, irs, exp, loan, cf, per}
   (per: a renda de cada contrato, pela ordem de act); act os contratos ativos da vista;
   debtY a dívida no fim de cada ano; base {op, porCat, n, fora, foraPorCat, foraAno} — as
   despesas previstas por ano e por categoria, quantos planeados entraram, e as de uma vez
   do último ano completo (o total, por categoria, e o ano). */
function projRows(pid){
  const s=db.settings,n=Math.max(1,Math.round(s.years)),pps=pidProps(pid);
  /* ctVivo: quem corta por datas é o mesesEmVigor, ano a ano. Filtrar à
     entrada com o isActive apagava o contrato de 2028 de TODOS os anos do
     horizonte, incluindo 2028 — e um portefólio só com ele dizia «Nenhum
     contrato ativo» e não mostrava projeção nenhuma. */
  const act=db.contracts.filter(c=>ctVivo(c)&&inScope(c.propertyId)&&pps.some(p=>p.id===c.propertyId));
  const prev=despesasPrevistas(pid),uma=despesasDeUmaVez(pid);
  const base={op:prev.op,porCat:prev.porCat,n:prev.n,fora:uma.fora,foraPorCat:uma.foraPorCat,foraAno:uma.ano},rows=[];
  /* prestações previstas: vêm do plano de cada hipoteca e param quando o crédito acaba */
  const sched=[...Array(n)].map((_,i)=>sum(pps.map(p=>sh(p)*sum(liveLoans(p).map(l=>{
    const a=amort(l),from=i*12,to=Math.min((i+1)*12,a.rows.length);
    let t=0;for(let k=from;k<to;k++)t+=a.rows[k].pay+(a.rows[k].st||0);
    return t;
  })))));
  for(let i=0;i<n;i++){
    const yr=YEAR+i;
    const per=act.map(c=>{
      const meses=mesesEmVigor(c,yr);
      if(!meses)return 0;
      /* o aumento conta a partir do ano em que o contrato começa: um que só
         arranca em 2028 não pode aparecer com dois aumentos já aplicados */
      const desde=Math.max(YEAR,c.start?Number(String(c.start).slice(0,4)):YEAR);
      const anos=Math.max(0,yr-desde);
      return c.rent*sh(prop(c.propertyId))*meses*Math.pow(1+((c.increase==null?s.growth:c.increase)/100),anos);
    });
    /* a taxa do ano de cada coluna (a dos 10 % das rendas moderadas acaba em 2029) */
    const rent=sum(per),irs=sum(per.map((v,j)=>v*taxRateOf(act[j],yr)/100)),exp=base.op*Math.pow(1+s.inflation/100,i),ln=sched[i];
    rows.push({yr:YEAR+i,rent,irs,exp,loan:ln,cf:rent-irs-exp-ln,per});
  }
  const debtY=[...Array(n)].map((_,i)=>sum(pps.map(p=>sh(p)*sum(liveLoans(p).map(l=>{
    const a=amort(l,(i+1)*12);return a.rows.length?a.rows[a.rows.length-1].bal:0})))));
  return {rows,act,debtY,base};
}
/* Os nomes das categorias que mais pesam, para o meio de uma frase: as três
   primeiras e reticências se houver mais. Ficam com a maiúscula: «Água, luz e gás»
   tem vírgulas, e em minúsculas não se via onde acabava uma e começava a outra.
   Recebe: l — array de {label, value}, do maior para o menor.
   Devolve: o texto, ex.: «Impostos, Condomínio, Seguros…»; '' sem categorias. */
function projNomesCats(l){
  const n=l.map(x=>String(x.label));
  return n.length>3?n.slice(0,3).join(', ')+'…':listaE(n);
}
/* O que o cabeçalho das Projeções diz das despesas e do IRS: quanto entra por ano,
   de quantos planeados e de que categorias, e de onde vêm (a ficha de cada imóvel e
   os Planeados); o IRS à taxa de cada contrato e quando se paga; o que ficou de fora
   por ter sido pago de uma vez; e a porta para os Planeados — só com esse serviço
   ligado nesta conta.
   Sem nenhum planeado de despesa as contas fazem-se com zero e as despesas
   previstas não se mencionam: chegou a haver uma frase «Ainda não há despesas
   previstas…» com um botão para os imóveis, e era um aviso solto no topo de
   uma página que só queria mostrar a projeção (o Martinho pediu que saísse).
   Recebe: base — o {op, porCat, n, fora, foraPorCat, foraAno} de projRows.
   Devolve: o HTML (texto) das linhas de ajuda. */
function projDespesasTxt(base){
  const dentro=base.n>0
    ?`Despesas previstas: <b>${euro(base.op)}/ano</b> — ${base.n} planeado${base.n===1?'':'s'} de despesa (${esc(projNomesCats(base.porCat))}): o IMI, o condomínio e o seguro da ficha de cada imóvel e os que marcaste nos Planeados; crescem com a inflação. `
    :'';
  const irs='IRS sobre as rendas à taxa de cada contrato, contado no ano das rendas — a declaração entrega-se de abril a junho e paga-se até 31 de agosto do ano seguinte.';
  /* o «ainda» só faz sentido depois das despesas previstas */
  const fora=base.fora>0?` Em ${base.foraAno} gastaste${base.n>0?' ainda':''} <b>${euro(base.fora)}</b> em despesas de uma vez (${esc(projNomesCats(base.foraPorCat))}), que não se projetam.`:'';
  const porta=base.n>0&&servicoLigado('recurring')?`<button type="button" class="btn sm" data-toca="ecra" data-click="go('recurring')">Ver planeados</button>`:'';
  return `<div class="hint u-mt-12px">${dentro}${irs}${fora}</div>${porta?`<div class="u-mt-8px">${porta}</div>`:''}`;
}
/* O cartão da dívida quando não há dívida: em vez de um gráfico com uma linha
   no zero (e um eixo que, de tão vazio, chegou a dizer «1, 1, 1»), a boa
   notícia dita por extenso — pedido do Martinho. «Registadas», porque a app
   só sabe dos créditos que lhe deram.
   Recebe: nada.
   Devolve: o HTML do corpo do cartão. */
function livreDeDividas(){
  return `<div class="livre"><span class="livre-selo">${ic('check',24)}</span><b>Boa! Não tens dívidas registadas.</b>
    <span>Nenhum crédito em uso nos imóveis desta vista: não há prestações a abater às rendas.</span></div>`;
}
/* Um cartão da Análise nas Projeções: o título na letra dos títulos e o
   subtítulo ao lado (o mesmo desenho da Avaliação e do IRS).
   Recebe: titulo — o título (texto já seguro); sub — o subtítulo ('' sem ele);
   corpo — o HTML do cartão; cls (opcional) — classes a mais.
   Devolve: o HTML do cartão (string). */
function prjCartao(titulo,sub,corpo,cls){
  return `<section class="card ana-cartao${cls?' '+cls:''}"><div class="ana-cab"><h2 class="ana-tit">${titulo}</h2>${sub?`<span class="small">${sub}</span>`:''}</div>${corpo}</section>`;
}
/* O topo das Projeções: no sítio da barra dos filtros das listas, só a fila
   de chips — o «Imóvel» em foco (vistas.js:anaChips), sem pesquisa, sem funil
   e sem painel. O proprietário não tem chip: o filtro global de proprietário
   está de saída da app. Os três números da projeção (o horizonte, o aumento e
   a inflação) já não vivem na página: abrem-se na roda dentada do cabeçalho
   (projecoes.js:prjOpcoes).
   Recebe: nada.
   Devolve: o HTML da fila (string), ou '' sem imóveis. */
function prjChips(){
  return anaChips({id:'projSel',valor:projProp,aplicar:'onProjProp',limpar:'projAnaLimpar();render()',dos:'da projeção'});
}
/* As opções da projeção, na janela que a roda dentada do cabeçalho abre
   (vistas.js:ANA_RODA, o «alternar» do registo): o horizonte, o aumento das
   rendas e a inflação das despesas — os três números que viviam numa barra no
   topo da página, e que lá competiam com os filtros. São os mesmos das
   Definições › Valores por omissão (definicoes.js:vDefaults), no mesmo
   desenho. Gravam ao escrever (prjOpcao), e a projeção por trás acompanha.
   Recebe: nada.
   Devolve: nada — abre a janela (vistas.js:anaOpcoes). */
function prjOpcoes(){
  const s=db.settings;
  anaOpcoes('Opções da projeção',[
    {id:'prjHorizonte',titulo:'Horizonte',sub:'Quantos anos a projeção mostra, de 1 a 30',valor:String(s.years),modo:'numeric',unidade:'anos',
      input:"prjOpcao(this,'years')",change:"prjOpcao(this,'years',1)"},
    {id:'prjAumento',titulo:'Aumento das rendas',sub:'Por ano, nos contratos sem aumento próprio',valor:dec(s.growth),modo:'decimal',unidade:'%',
      input:"prjOpcao(this,'growth')",change:"prjOpcao(this,'growth',1)"},
    {id:'prjInflacao',titulo:'Inflação das despesas',sub:'Por ano, faz crescer as despesas previstas',valor:dec(s.inflation),modo:'decimal',unidade:'%',
      input:"prjOpcao(this,'inflation')",change:"prjOpcao(this,'inflation',1)"}],
    'Cada contrato tem o seu aumento. Em Portugal há um coeficiente máximo publicado todos os anos. Em branco: 1 ano, e 0 % de aumento e de inflação. São os mesmos valores das Definições, em Valores por omissão.');
}
/* Um campo da janela das opções mudou. Ao escrever, grava o valor que o
   campo vale (as regras das Definições, definicoes.js:NORMA_DOS_VALORES: o
   horizonte entre 1 e 30, as taxas com vírgula) e a projeção redesenha-se por
   trás; um valor igual ao gravado não redesenha. Ao sair do campo, o campo
   passa a mostrar o que ficou gravado (o horizonte em branco passa a 1), para
   não dizer uma coisa e a app guardar outra.
   Recebe: campo — o campo (o this da ação); k — 'years', 'growth' ou
   'inflation'; fim (opcional) — verdadeiro ao sair do campo.
   Devolve: nada — grava, e ao sair reescreve o campo. */
function prjOpcao(campo,k,fim){
  if(!campo||(k!=='years'&&k!=='growth'&&k!=='inflation'))return;
  const v=NORMA_DOS_VALORES[k](campo.value);
  if(db.settings[k]!==v)prjDefinir(k,v);
  if(fim)campo.value=k==='years'?String(v):dec(v);
  anaOpcaoGravada();
}
/* Grava um dos três números das opções (o horizonte, o aumento das rendas ou
   a inflação das despesas) nas definições, como o vistas.js:setSet, mas o
   redesenho vai pelo prjRepintar, que devolve o foco a quem o tinha.
   Recebe: k — a chave em db.settings ('years', 'growth' ou 'inflation'); v — o valor já validado.
   Devolve: nada — grava e agenda o redesenho. */
function prjDefinir(k,v){
  if(k!=='years'&&k!=='growth'&&k!=='inflation')return;
  db.settings[k]=v;save();prjRepintar();
}
/* Redesenha a página sem tirar o foco a quem usa o teclado. Os campos viviam
   numa barra da página, e gravar um (ao sair dele com Tab) refazia a vista
   inteira já, e o campo seguinte, para onde o Tab ia, desaparecia: o foco caía no <body> e o Tab
   seguinte voltava ao topo da página. Quando o change corre, o foco ainda
   não chegou ao campo seguinte — por isso o redesenho espera que ele assente
   (setTimeout), lê o id de quem o tem, redesenha e devolve-lho. O render é
   lido aqui, ao agendar (é o que os testes trocam).
   Recebe: nada.
   Devolve: nada — agenda o redesenho. */
function prjRepintar(){
  const pinta=render;
  setTimeout(()=>{
    const a=document.activeElement,id=a&&a!==document.body?a.id||'':'';
    pinta();
    const e=id?document.getElementById(id):null;
    if(e&&e!==document.activeElement)try{e.focus({preventScroll:true})}catch(x){}
  },0);
}
/* O aviso da prancheta «A projeção não inventa renovações»: os contratos do
   horizonte que acabam antes do fim dele (o mesesEmVigor corta-os aí, e a
   renovação só conta quando está registada no contrato), agrupados pelo ano
   em que acabam, e a porta para os Contratos — com esse serviço ligado nesta
   conta. Sem nenhum a acabar no horizonte, não se escreve.
   Recebe: act — os contratos da projeção; last — a linha do último ano.
   Devolve: o HTML do aviso (string), ou ''. */
function prjRenovacoes(act,last){
  const fimAno=c=>Number(String(c.end||'').slice(0,4));
  const acabam=act.filter(c=>c.end&&fimAno(c)>=YEAR&&(fimAno(c)<last.yr||(fimAno(c)===last.yr&&String(c.end).slice(5,7)!=='12')));
  if(!acabam.length)return '';
  const porAno={};
  acabam.forEach(c=>{const a=fimAno(c);(porAno[a]=porAno[a]||[]).push(ctName(c))});
  const partes=Object.keys(porAno).map(Number).sort((a,b)=>a-b).map((a,i)=>{const ns=porAno[a],v=ns.length>1;
    return (i?(v?'os de ':'o de '):(v?'Os contratos de ':'O contrato de '))+listaE(ns)+(v?' acabam':' acaba')+' em '+a});
  return `<div class="prj-aviso" role="note">${ic('aviso',20)}<p><b>A projeção não inventa renovações.</b> ${esc(listaE(partes))}. Regista as renovações nos contratos para veres anos realistas.</p>${servicoLigado('contracts')?`<button type="button" class="btn sm" data-toca="ecra" data-click="go('contracts')">Ver contratos</button>`:''}</div>`;
}
/* O gráfico das entradas e saídas por ano (a prancheta): as rendas para cima,
   o IRS, as despesas e as prestações para baixo, nas cores das séries
   (tema.js:COR_SERIE; o IRS na categórica, PAL[4]) — e, até seis anos, o
   cashflow de cada ano por baixo da sua coluna.
   Recebe: rows — as linhas de projRows; anos — os anos por extenso (texto).
   Devolve: o HTML do cartão (string). */
function prjFluxos(rows,anos){
  const comCf=rows.length<=6;
  const g=cBars(rows.map(r=>[{label:'Rendas',value:r.rent,color:COR_SERIE.receita},{label:'IRS',value:-r.irs,color:PAL[4]},
    {label:'Despesas',value:-r.exp,color:COR_SERIE.despesa},{label:'Prestações',value:-r.loan,color:COR_SERIE.prestacao}]),anos,{h:200,titulo:'Entradas e saídas por ano'});
  const cf=comCf?`<div class="prj-cfs" aria-hidden="true">${rows.map(r=>`<span class="${r.cf<0?'neg':'pos'}">${euro(r.cf)}</span>`).join('')}</div>`:'';
  return prjCartao(comCf?'Entradas, saídas e cashflow por ano':'Entradas e saídas por ano','rendas para cima; IRS, despesas e prestações para baixo',g+cf,'prj-fluxos');
}
/* A tabela «Ano a ano» (a prancheta): uma coluna por contrato, as rendas, o
   IRS, as despesas, as prestações, o cashflow e — com créditos em uso — a
   dívida no fim de cada ano.
   Recebe: rows, act, debtY — o que projRows devolve; comDivida — há créditos em uso.
   Devolve: o HTML do cartão (string). */
function prjTabela(rows,act,debtY,comDivida){
  return prjCartao('Ano a ano','uma coluna por contrato · IRS contado no ano das rendas',`<div class="tablewrap"><table class="table ana-fixa prj-tabela"><thead><tr>
    <th>Ano</th>${act.map(c=>`<th>${esc(ctName(c))}</th>`).join('')}<th>Rendas</th><th>IRS</th><th>Despesas</th><th>Prestações</th><th>Cashflow</th>${comDivida?'<th>Dívida no fim</th>':''}</tr></thead><tbody>
    ${rows.map((r,i)=>`<tr><td><b>${r.yr}</b></td>${r.per.map(v=>`<td>${v?euro(v):'—'}</td>`).join('')}
      <td class="pos"><b>${euro(r.rent)}</b></td><td>${euro(r.irs)}</td><td>${euro(r.exp)}</td><td>${euro(r.loan)}</td>
      <td class="${r.cf>=0?'pos':'neg'}"><b>${euro(r.cf)}</b></td>${comDivida?`<td>${euro(debtY[i])}</td>`:''}</tr>`).join('')}</tbody></table></div>`);
}
/* Projeções ao horizonte definido nas definições (s.years), a partir de
   projRows, como a prancheta D-Projecoes: a fila de chips com o imóvel em
   foco (os números da projeção estão na roda dentada do cabeçalho); os
   indicadores; o aviso das renovações; o gráfico das entradas e saídas ao lado da dívida por amortizar (ou da boa notícia); a
   tabela ano a ano com uma coluna por contrato; e, no fim, de onde vêm as
   despesas previstas, o IRS e o que ficou de fora.
   Devolve: string com o HTML completo da vista. */
function vProjections(){
  if(projProp&&!pidProps(projProp).length)projProp='';
  const {rows,act,debtY,base}=projRows(projProp||null),n=rows.length;
  const head=prjChips()+`<div class="ana prj">`;
  /* a saída do vazio leva aos Contratos ou aos Imóveis: com esse serviço
     desligado nesta conta o botão não se escreve, e a frase diz quem o liga */
  if(!act.length)return head+`<div class="empty"><b>Nenhum contrato ativo</b>As projeções partem das rendas contratadas.
    ${db.properties.length?(servicoLigado('contracts')?saida('Ver contratos',"go('contracts')",'ecra'):vazioServicoDesligado('contracts'))
      :(servicoLigado('properties')?saida('Adicionar imóvel',"go('properties')",'ecra'):vazioServicoDesligado('properties'))}</div></div>`;
  /* o eixo da dívida leva o ano em dois algarismos (cabem mais), a leitura por extenso */
  const first=rows[0],last=rows[rows.length-1],labels=rows.map(r=>String(r.yr).slice(2)),anos=rows.map(r=>String(r.yr));
  /* sem planeados de despesa, a explicação do cashflow não fala de despesas previstas */
  const baseTxt=base.n>0?' Aqui: '+euro(base.op)+'/ano de despesas previstas em '+base.n+' planeado'+(base.n===1?'':'s')+'.':'';
  const varRenda=first.rent?last.rent/first.rent-1:0;
  const comDivida=pidProps(projProp||null).some(p=>liveLoans(p).length);
  return head+`<div class="grid prj-kpis">
    ${kpi('Renda anual hoje',euro(first.rent),'','a preços de '+YEAR,WHY.rendaHoje,()=>({fmt:euro,yearlyTitle:'Projeção ano a ano',yearly:rows.map(r=>({label:r.yr,value:r.rent}))}))}
    ${kpi('Renda em '+last.yr,euro(last.rent),varRenda>=0?'pos':'neg',(varRenda>=0?'+':'')+pct(varRenda)+' acumulado',WHY.rendaFim,()=>({fmt:euro,yearlyTitle:'Projeção ano a ano',yearly:rows.map(r=>({label:r.yr,value:r.rent}))}))}
    ${kpi(n>1?'Rendas de '+first.yr+' a '+last.yr:'Rendas de '+first.yr,euro(sum(rows.map(r=>r.rent))),'',n+(n===1?' ano':' anos')+' · só contratos registados',WHY.totalPeriodo,()=>{let a=0;return {fmt:euro,yearlyTitle:'Acumulado ano a ano',yearly:rows.map(r=>({label:r.yr,value:a+=r.rent}))}})}
    ${kpi('Cashflow em '+last.yr,euro(last.cf),last.cf>=0?'pos':'neg','com IRS, despesas e prestações',WHY.cashflowFim+baseTxt,()=>({fmt:euro,yearlyTitle:'Projeção ano a ano',extraTitle:'Prestações',yearly:rows.map(r=>({label:r.yr,value:r.cf,extra:euro(r.loan)}))}))}
    ${comDivida?kpi('Dívida no fim de '+last.yr,euro(debtY[n-1]),'','pelo plano das hipotecas','O capital em dívida no fim de cada ano, somando os créditos em uso nos imóveis desta vista, pelo plano de cada hipoteca.',()=>({fmt:euro,yearlyTitle:'Projeção ano a ano',yearly:rows.map((r,i)=>({label:r.yr,value:debtY[i]}))})):''}</div>
  ${prjRenovacoes(act,last)}
  <div class="cols">
    ${prjFluxos(rows,anos)}
    ${comDivida
      ?prjCartao('Dívida por amortizar','Somando os créditos em uso',cLine([{name:'Em dívida',values:debtY,color:COR_SERIE.divida}],labels,{h:200,marks:decadeMarks(YEAR,n),rotulos:anos}))
      :prjCartao('Dívida por amortizar','',livreDeDividas())}</div>
  ${prjTabela(rows,act,debtY,comDivida)}
  ${projDespesasTxt(base)}</div>`;
}
// nº de filtros ativos das projeções: o imóvel em foco (o chip «Imóvel»)
// Devolve: número de filtros ativos (0 ou 1).
function projAnaN(){return projProp?1:0}
// limpa o imóvel em foco das projeções (vistas.js:anaClear chama-o)
// Devolve: nada — limpa o filtro; quem chama repinta.
function projAnaLimpar(){projProp=''}
/* o botão do cabeçalho é a roda dentada das opções (vistas.js:ANA_RODA), e
   tocar-lhe é o «alternar» da análise: abre a janela das opções */
registarServico({id:'projections',vistas:{projections:'vProjections'},analise:{projections:{n:'projAnaN',limpar:'projAnaLimpar',alternar:'prjOpcoes'}}});
registarRoda('projections','Opções da projeção');
