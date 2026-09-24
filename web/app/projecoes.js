/* ================= PROJEÇÕES (serviço projections) ================= */
/* As rendas futuras e os aumentos anuais, imóvel a imóvel. Veio de vistas.js
   quando a app passou a serviços; regista-se no fim. */
let projProp='';
// muda o imóvel (ou grupo) em foco nas projeções
// Devolve: nada — redesenha a vista.
function onProjProp(){projProp=val('projSel')||'';render()}
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
   dos contratos ativos com o aumento anual de cada um, as despesas a partir da
   base de opBase com a inflação, as prestações segundo o plano de cada hipoteca
   (param quando o crédito acaba) e o cashflow; mais a dívida no fim de cada ano.
   Recebe: pid — id do imóvel, 'g:ID' de um grupo, ou null/vazio para o âmbito todo.
   Devolve: {rows, act, debtY, base} — rows é um array de {yr, rent, exp, loan, cf, per}
   (per: a renda de cada contrato, pela ordem de act); act os contratos ativos da vista;
   debtY a dívida no fim de cada ano; base o {op, year, anualizado} de opBase. */
function projRows(pid){
  const s=db.settings,n=Math.max(1,Math.round(s.years)),pps=pidProps(pid);
  /* ctVivo: quem corta por datas é o mesesEmVigor, ano a ano. Filtrar à
     entrada com o isActive apagava o contrato de 2028 de TODOS os anos do
     horizonte, incluindo 2028 — e um portefólio só com ele dizia «Nenhum
     contrato ativo» e não mostrava projeção nenhuma. */
  const act=db.contracts.filter(c=>ctVivo(c)&&inScope(c.propertyId)&&pps.some(p=>p.id===c.propertyId));
  const base=opBase(pid),rows=[];
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
  const head=anaPanelPadrao('projSel',projProp,'onProjProp',`
    <div class="row3 u-mt-10px">
    <label>Horizonte (anos)<input type="text" inputmode="numeric" value="${s.years}" data-change="setSet('years',Math.min(30,Math.max(1,num(this.value))))"></label>
    <label>Aumento anual (%)<input type="text" inputmode="decimal" value="${dec(s.growth)}" data-change="setSet('growth',numTaxa(this.value))"></label>
    <label>Inflação das despesas (%)<input type="text" inputmode="decimal" value="${dec(s.inflation)}" data-change="setSet('inflation',numTaxa(this.value))"></label></div>
    <div class="hint u-mt-9px">Cada contrato tem o seu aumento. Em Portugal há um coeficiente máximo publicado todos os anos.</div>
    <div class="hint u-mt-6px">Despesas: <b>${euro(base.op)}/ano</b> — ${base.anualizado?'o ano corrente anualizado, porque ainda não há um ano completo com despesas':'as de '+base.year+', o último ano completo com despesas'}; crescem com a inflação.</div>`);
  /* a saída do vazio leva aos Contratos ou aos Imóveis: com esse serviço
     desligado nesta conta o botão não se escreve, e a frase diz quem o liga */
  if(!act.length)return head+`<div class="empty u-mt-14px"><b>Nenhum contrato ativo</b>As projeções partem das rendas contratadas.
    ${db.properties.length?(servicoLigado('contracts')?saida('Ver contratos',"go('contracts')",'ecra'):vazioServicoDesligado('contracts'))
      :(servicoLigado('properties')?saida('Adicionar imóvel',"go('properties')",'ecra'):vazioServicoDesligado('properties'))}</div>`;
  const first=rows[0],last=rows[rows.length-1],labels=rows.map(r=>String(r.yr).slice(2));
  const baseTxt=' Aqui: '+euro(base.op)+'/ano, '+(base.anualizado?'o ano corrente anualizado.':'base '+base.year+'.');
  const varRenda=first.rent?last.rent/first.rent-1:0;
  return head+(ownerFilter&&!ownerIsGrp()?`<div class="hint u-mt-12px">Valores na quota-parte de <b>${esc(ownerFilterName())}</b>.</div>`:'')+`<div class="grid u-mt-14px">
    ${kpi('Renda anual hoje',euro(first.rent),'','a preços de '+YEAR,WHY.rendaHoje,()=>({fmt:euro,yearlyTitle:'Projeção ano a ano',yearly:rows.map(r=>({label:r.yr,value:r.rent}))}))}
    ${kpi('Renda em '+last.yr,euro(last.rent),varRenda>=0?'pos':'neg',(varRenda>=0?'+':'')+pct(varRenda)+' acumulado',WHY.rendaFim,()=>({fmt:euro,yearlyTitle:'Projeção ano a ano',yearly:rows.map(r=>({label:r.yr,value:r.rent}))}))}
    ${kpi('Total do período',euro(sum(rows.map(r=>r.rent))),'',n+' anos de rendas',WHY.totalPeriodo,()=>{let a=0;return {fmt:euro,yearlyTitle:'Acumulado ano a ano',yearly:rows.map(r=>({label:r.yr,value:a+=r.rent}))}})}
    ${kpi('Cashflow em '+last.yr,euro(last.cf),last.cf>=0?'pos':'neg','com despesas e prestações',WHY.cashflowFim+baseTxt,()=>({fmt:euro,yearlyTitle:'Projeção ano a ano',extraTitle:'Prestações',yearly:rows.map(r=>({label:r.yr,value:r.cf,extra:euro(r.loan)}))}))}</div>
  <div class="cols">
    ${card('Rendas, prestações e cashflow','',cLine([{name:'Rendas',values:rows.map(r=>r.rent),color:PAL[0]},
      {name:'Prestações',values:rows.map(r=>r.loan),color:'#d6a34a'},
      {name:'Cashflow',values:rows.map(r=>r.cf),color:PAL[1]}],labels,{h:210,marks:decadeMarks(YEAR,n)}))}
    ${card('Dívida por amortizar','Somando os créditos em uso',cLine([{name:'Em dívida',values:debtY,color:'#d6a34a'}],labels,{h:200,marks:decadeMarks(YEAR,n)}))}</div>
  <div class="u-mt-14px">${card('Detalhe ano a ano','Uma coluna por contrato ativo',`<div class="tablewrap"><table class="table"><thead><tr>
    <th>Ano</th>${act.map(c=>`<th>${esc(ctName(c))}</th>`).join('')}<th>Rendas</th><th>Despesas</th><th>Prestações</th><th>Cashflow</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td><b>${r.yr}</b></td>${r.per.map(v=>`<td>${euro(v)}</td>`).join('')}
      <td><b>${euro(r.rent)}</b></td><td class="neg">${euro(r.exp)}</td><td class="amber">${euro(r.loan)}</td>
      <td class="${r.cf>=0?'pos':'neg'}"><b>${euro(r.cf)}</b></td></tr>`).join('')}</tbody></table></div>`)}</div>`;
}
// nº de filtros ativos no painel de análise das projeções: proprietário e imóvel em foco
// Devolve: número de filtros ativos (0 a 2).
function projAnaN(){return (ownerFilter?1:0)+(projProp?1:0)}
// limpa o imóvel em foco das projeções (o proprietário limpa-o a base, anaClear)
// Devolve: nada — limpa o filtro; quem chama repinta.
function projAnaLimpar(){projProp=''}
registarServico({id:'projections',vistas:{projections:'vProjections'},analise:{projections:{n:'projAnaN',limpar:'projAnaLimpar'}}});
