/* ================= AVALIAÇÃO ================= */
// A vista de avaliação: filtros, cartão do portefólio e um cartão por imóvel.
// Devolve: o HTML da vista (string).
function vReports(){
  if(repProp&&!pidProps(repProp).length)repProp='';
  const list=pidProps(repProp);
  const panel=anaPanel(`<div style="display:flex;flex-direction:column;gap:9px">
    ${db.owners.length?`<div style="width:100%">${sel('ownerSel',ownerFilter,[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner'))),'onOwnerFilter')}</div>`:''}
    <div style="width:100%">${sel('repSel',repProp,[{v:'',label:'Todos os imóveis'}].concat(scope().map(p=>({v:p.id,label:p.name}))).concat(gdiv(gOpts('prop'))),'onRepSel')}</div></div>
    <label style="margin-top:10px;max-width:220px">Yield exigido (%)<input type="text" inputmode="decimal" value="${dec(db.settings.capTarget)}" onchange="setSet('capTarget',num(this.value)||5)"></label>
    <div class="hint" style="margin-top:9px">A avaliação por rendimento capitaliza o resultado líquido anual ao yield exigido.</div>`);
  if(!list.length)return panel+`<div class="empty"><b>Sem imóveis para avaliar</b>Adiciona um imóvel primeiro.</div>`;
  return panel+`<div class="toolbar">
    <button class="btn" onclick="shareReport()">Partilhar</button>
    <button class="btn" onclick="downloadCsv()">CSV</button></div>`
    +((!repProp||String(repProp).startsWith('g:'))?portCard(repProp||null):'')+list.map(repCard).join('');
}
// aplica o imóvel (ou grupo) escolhido no seletor e volta a desenhar
// Devolve: nada — guarda o filtro e redesenha a vista.
function onRepSel(){repProp=val('repSel')||'';render()}
/* agregado de todo o portefólio (no âmbito do filtro de proprietário)
   Recebe: pid — 'g:ID' de um grupo de imóveis, ou null/vazio para o portefólio completo.
   Devolve: o HTML do cartão (string); '' sem imóveis no âmbito. */
function portCard(pid){
  const m=metrics(YEAR,pid||null,{share:true}),ps=pidProps(pid);
  if(!ps.length)return '';
  const noi=m.income-m.op,target=(db.settings.capTarget||5)/100;
  const valuation=target?noi/target:0,diff=m.value?valuation/m.value-1:0;
  const inc=monthly(YEAR,pid||null,'income',true),exp=monthly(YEAR,pid||null,'expense',true),ln=monthly(YEAR,pid||null,'loan',true);
  const cs=byCategory(YEAR,pid||null,true);
  return `<div class="card" style="margin-bottom:14px;padding:18px;border-width:2px">
    <div class="row-between"><div style="min-width:0">
      <div class="title" style="font-size:18px">${pid?'Grupo · '+esc((grp(String(pid).slice(2))||{}).name||''):'Portefólio completo'}</div>
      <div class="small">${ps.length} ${ps.length===1?'imóvel':'imóveis'}${ownerFilter?' · '+esc(ownerFilterName()):''}</div></div>
      <span class="badge">${YEAR}</span></div>
    <div class="grid" style="margin-top:14px">
      ${kpi('Valor de mercado',euro(m.value),'','soma dos imóveis',WHY.valorIntro)}
      ${kpi('Valor por rendimento',euro(valuation),diff>=0?'pos':'neg',`a ${pct(target)} de yield exigido`,WHY.valorRend)}
      ${kpi('Diferença',(diff>=0?'+':'')+pct(diff),diff>=0?'pos':'neg',diff>=0?'as rendas justificam mais':'as rendas justificam menos',WHY.diferenca)}
      ${kpi('Equity',euro(m.value-m.debt),'','valor menos dívida',WHY.equity)}</div>
    <div class="cols">
      ${card('Rendas e despesas','Mês a mês em '+YEAR,cBars(inc.map((v,i)=>[{label:'Rendas',value:v,color:PAL[0]},{label:'Despesas',value:-exp[i],color:'#c56b68'},{label:'Prestação',value:-ln[i],color:'#d6a34a'}]),MES,{h:190}))}
      ${card('Estrutura de despesas','',cs.length?cDonut(cs,{sub:'gastos do ano'}):`<div class="hint">Sem gastos em ${YEAR}.</div>`)}</div>
    <div class="cols">
      ${card('Conta de exploração',String(YEAR),`
        <div class="stat"><span>Rendas recebidas</span><b class="pos">${euro(m.income)}</b></div>
        <div class="stat"><span>Despesas operacionais</span><b class="neg">−${euro(m.op)}</b></div>
        <div class="stat"><span>Resultado líquido (NOI)</span><b>${euro(noi)}</b></div>
        <div class="stat"><span>Prestações pagas</span><b class="amber">−${euro(m.loan)}</b></div>
        <div class="stat"><span>Cashflow</span><b class="${m.cf>=0?'pos':'neg'}">${euro(m.cf)}</b></div>`)}
      ${card('Indicadores','',`
        <div class="stat"><span>Renda anual contratada</span><b>${euro(m.annualRent)}</b></div>
        <div class="stat"><span>Yield bruto</span><b>${pct(m.grossYield)}</b></div>
        <div class="stat"><span>Cap rate</span><b>${pct(m.cap)}</b></div>
        <div class="stat"><span>Sobre a aquisição</span><b>${pct(m.coc)}</b></div>
        <div class="stat"><span>LTV</span><b>${pct(m.ltv)}</b></div>`)}</div>
  </div>`;
}
/* O cartão de avaliação de um imóvel: valor introduzido contra valor por rendimento,
   contratos ativos, gráficos do ano, conta de exploração, indicadores e — havendo
   hipotecas — a projeção da dívida até ao fim. Devolve o HTML do cartão.
   Recebe: p — o imóvel (objeto da base local).
   Devolve: o HTML do cartão (string). */
function repCard(p){
  const m=metrics(YEAR,p.id),ls=liveLoans(p);
  const ac=activeContracts(p.id),rentY=rentOf(p)*12,netY=netRentOf(p)*12;
  const noi=m.income-m.op,target=(db.settings.capTarget||5)/100;
  const valuation=target?noi/target:0,diff=p.value?valuation/p.value-1:0;
  const inc=monthly(YEAR,p.id,'income'),exp=monthly(YEAR,p.id,'expense'),ln=monthly(YEAR,p.id,'loan');
  const cs=byCategory(YEAR,p.id),st=propStatus(p),own=ownerNames(p);
  return `<div class="card" style="margin-bottom:14px;padding:18px">
    <div class="row-between"><div style="min-width:0">
      <div class="title" style="font-size:18px">${esc(p.name)}</div>
      <div class="small">${esc(p.address||'')} · ${st.label}${own?' · '+esc(own):''}</div></div>
      <span class="badge ${st.badge}">${YEAR}</span></div>
    <div class="grid" style="margin-top:14px">
      ${kpi('Valor introduzido',euro(p.value),'','valor de mercado',WHY.valorIntro)}
      ${kpi('Valor por rendimento',euro(valuation),diff>=0?'pos':'neg',`a ${pct(target)} de yield exigido`,WHY.valorRend,()=>evoValuation(p,'val'))}
      ${kpi('Diferença',(diff>=0?'+':'')+pct(diff),diff>=0?'pos':'neg',diff>=0?'as rendas justificam mais':'as rendas justificam menos',WHY.diferenca,()=>evoValuation(p,'diff'))}
      ${kpi('Equity',euro(p.value-debtOf(p)),'','valor menos dívida',WHY.equity,()=>evoValuation(p,'equity'))}</div>
    ${ac.length?card('Contratos ativos','',`<div class="tablewrap"><table class="table"><thead><tr>
      <th>${p.rentalMode==='quartos'?'Quarto':'Contrato'}</th><th>Inquilinos</th><th>Renda</th><th>Imposto</th><th>Líquida</th></tr></thead><tbody>
      ${ac.map(x=>`<tr><td><b>${x.roomId?esc(roomName(p,x.roomId)):'Imóvel inteiro'}</b></td>
        <td style="text-align:left;white-space:normal">${esc(ctNames(x))}</td><td>${euro(x.rent)}</td>
        <td class="neg">${x.taxRate?dec(x.taxRate)+'%':'—'}</td><td><b>${euro(netRent(x))}</b></td></tr>`).join('')}
      <tr><td colspan="2"><b>Total mensal</b></td><td><b>${euro(rentOf(p))}</b></td><td></td><td><b>${euro(netRentOf(p))}</b></td></tr>
      </tbody></table></div>`):''}
    <div class="cols">
      ${card('Rendas e despesas','Mês a mês em '+YEAR,cBars(inc.map((v,i)=>[{label:'Rendas',value:v,color:PAL[0]},{label:'Despesas',value:-exp[i],color:'#c56b68'},{label:'Prestação',value:-ln[i],color:'#d6a34a'}]),MES,{h:190}))}
      ${card('Estrutura de despesas','',cs.length?cDonut(cs,{sub:'gastos do ano'})
        :`<div class="hint">Não há gastos atribuídos a este imóvel em ${YEAR}.${orphanExpenses(YEAR).length?` Há ${euro(sum(orphanExpenses(YEAR).map(x=>x.amount)))} em despesas sem imóvel atribuído, que aparecem na visão geral mas não aqui.`:''}</div>`)}</div>
    <div class="cols">
      ${card('Conta de exploração',String(YEAR),`
        <div class="stat"><span>Rendas recebidas</span><b class="pos">${euro(m.income)}</b></div>
        <div class="stat"><span>Despesas operacionais</span><b class="neg">−${euro(m.op)}</b></div>
        <div class="stat"><span>Resultado líquido (NOI)</span><b>${euro(noi)}</b></div>
        <div class="stat"><span>Prestações pagas</span><b class="amber">−${euro(m.loan)}</b></div>
        <div class="stat"><span>Cashflow</span><b class="${m.cf>=0?'pos':'neg'}">${euro(m.cf)}</b></div>`)}
      ${card('Indicadores','',`
        <div class="stat"><span>Renda anual contratada</span><b>${euro(rentY)}</b></div>
        <div class="stat"><span>Renda anual líquida de impostos</span><b>${euro(netY)}</b></div>
        <div class="stat"><span>Yield bruto</span><b>${pct(p.value?rentY/p.value:NaN)}</b></div>
        <div class="stat"><span>Yield líquido (cap rate)</span><b>${pct(p.value?noi/p.value:NaN)}</b></div>
        <div class="stat"><span>Sobre a aquisição</span><b>${pct(p.purchase?m.cf/p.purchase:NaN)}</b></div>
        <div class="stat"><span>LTV</span><b>${pct(p.value?debtOf(p)/p.value:NaN)}</b></div>`)}</div>
    ${balancesCard(p.id)}
    ${ls.length?(()=>{
      const per=ls.map(l=>({l,a:amort(l),c:loanCalc(l)}));
      const nY=Math.max(...per.map(x=>Math.ceil(x.a.rows.length/12)));
      const bal=[...Array(nY)].map((_,i)=>sum(per.map(x=>{const r=x.a.rows[Math.min((i+1)*12-1,x.a.rows.length-1)];
        return (i+1)*12-1<x.a.rows.length?r.bal:0})));
      return card(ls.length>1?ls.length+' hipotecas':'Hipoteca',ls.map(x=>esc(loanName(x))).join(' · '),
        per.map(x=>`<div class="stat"><span>${esc(loanName(x.l))}<div class="small">${RATE[x.l.type]} · ${x.l.years} anos${(x.l.files||[]).length?' · '+x.l.files.length+' doc.':''}</div></span>
          <b>${euro(x.l.outstanding)}<div class="small" style="font-weight:500">${euro2(x.c.total)}/mês</div></b></div>`).join('')
        +`<div class="stat"><span><b>Total em dívida</b></span><b>${euro(debtOf(p))}</b></div>
          <div class="stat"><span>Prestações mensais</span><b>${euro2(payOf(p))}</b></div>
          <div class="stat"><span>Juros até ao fim</span><b class="neg">${euro(sum(per.map(x=>x.a.totInt)))}</b></div>
          <div class="stat"><span>Imposto do selo até ao fim</span><b class="neg">${euro(sum(per.map(x=>x.a.totStamp)))}</b></div>
          <div class="divider"></div>${cLine([{name:'Em dívida',values:bal,color:'#d6a34a'}],
        [...Array(nY)].map((_,i)=>String(YEAR+i)),{h:160,marks:decadeMarks(YEAR,nY)})}`);
    })():''}
  </div>`;
}
/* avaliação por rendimento ano a ano (histórico) e equity projetado com a amortização
   Recebe: p — o imóvel; what — o que evolui: 'val' (avaliação), 'diff' (diferença) ou 'equity' (projeção).
   Devolve: a série para a janela do KPI (objeto {fmt, yearly: [{label, value, extra}], extraTitle, …}). */
function evoValuation(p,what){
  const target=(db.settings.capTarget||5)/100;
  if(what==='equity'){
    const n=Math.max(2,Math.round(db.settings.years));
    return {fmt:euro,yearlyTitle:'Projeção ano a ano',extraTitle:'Em dívida',note:'Valor de mercado atual menos a dívida no fim de cada ano.',
      yearly:[...Array(n)].map((_,i)=>{const debt=sum(liveLoans(p).map(l=>{const a=amort(l,(i+1)*12);return a.rows.length?a.rows[a.rows.length-1].bal:0}));
        return {label:YEAR+i,value:p.value-debt,extra:euro(debt)}})};
  }
  return {fmt:what==='diff'?(v=>pct(v)):euro,extraTitle:'NOI',
    yearly:yearsWithData(p.id).map(y=>{const m=metrics(y,p.id),noi=m.income-m.op,v=target?noi/target:0;
      return {label:y,value:what==='diff'?(p.value?v/p.value-1:NaN):v,extra:euro(noi)}})};
}
// A avaliação em texto simples, para partilhar ou copiar: totais do portefólio,
// contas entre proprietários e cada imóvel com os seus contratos. Respeita o filtro de proprietário.
// Devolve: o texto do relatório (string, várias linhas).
function reportText(){
  const m=metrics(YEAR,null,{share:true}),act=db.contracts.filter(c=>isActive(c)&&inScope(c.propertyId)),cs=c=>sh(prop(c.propertyId));
  return `AVALIAÇÃO DO PORTEFÓLIO — ${YEAR}${ownerFilter?' · '+ownerFilterName():''}

Imóveis: ${m.props.length} · contratos ativos: ${act.length}
Renda contratada ${euro(sum(act.map(c=>c.rent*cs(c))))}/mês · líquida ${euro(sum(act.map(c=>netRent(c)*cs(c))))}/mês
Valor de mercado: ${euro(m.value)} · em dívida ${euro(m.debt)} · líquido ${euro(m.value-m.debt)}

Rendas ${euro(m.income)} · gastos ${euro(m.op)} · NOI ${euro(m.noi)} · prestações ${euro(m.loan)} · cashflow ${euro(m.cf)}
Yield bruto ${pct(m.grossYield)} · cap rate ${pct(m.cap)} · cash-on-cash ${pct(m.coc)} · LTV ${pct(m.ltv)}
${(()=>{const b=ownerBalances(null),ks=Object.keys(b);
  return ks.length?'\nCONTAS ENTRE PROPRIETÁRIOS\n'+ks.map(k=>`  ${(owner(k)||{}).name}: ${b[k]>0?'a receber ':(b[k]<0?'a pagar ':'')}${euro2(Math.abs(b[k]))}`).join('\n'):''})()}

POR IMÓVEL
${m.props.map(p=>{const x=metrics(YEAR,p.id),noi=x.income-x.op,val=noi/((db.settings.capTarget||5)/100);
  return `  ${p.name} [${propStatus(p).label}]${ownerNames(p)?' — '+ownerNames(p):''}
    Valor ${euro(p.value)} · avaliação por rendimento ${euro(val)}
    Renda ${euro(rentOf(p))}/mês · cashflow ${euro(x.cf)}
${activeContracts(p.id).map(c=>`      ${c.roomId?roomName(p,c.roomId):'Imóvel inteiro'}: ${ctNames(c)} — ${euro(c.rent)}`).join('\n')}`}).join('\n')}
`;
}
