/* ================= AVALIAÇÃO ================= */
// A vista de avaliação: filtros, cartão do portefólio e um cartão por imóvel.
// Devolve: o HTML da vista (string).
function vReports(){
  if(repProp&&!pidProps(repProp).length)repProp='';
  const list=pidProps(repProp);
  const panel=anaPanel(`<div style="display:flex;flex-direction:column;gap:9px">
    ${db.owners.length?`<div style="width:100%">${sel('ownerSel',ownerFilter,[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner'))),'onOwnerFilter')}</div>`:''}
    <div style="width:100%">${sel('repSel',repProp,[{v:'',label:'Todos os imóveis'}].concat(scope().map(p=>({v:p.id,label:p.name}))).concat(gdiv(gOpts('prop'))),'onRepSel')}</div></div>
    <label style="margin-top:10px;max-width:220px">Yield exigido (%)<input type="text" inputmode="decimal" value="${dec(db.settings.capTarget)}" onchange="capTargetSet(this.value)"></label>
    <div class="hint" style="margin-top:9px">A avaliação por rendimento capitaliza o resultado líquido anual ao yield exigido. No ano corrente, o resultado até hoje é anualizado (×12 sobre os meses decorridos).${ownerFilter&&!ownerIsGrp()?' Valores na quota-parte de <b>'+esc(ownerFilterName())+'</b>.':''}</div>`);
  if(!list.length)return panel+`<div class="empty"><b>Sem imóveis para avaliar</b>Adiciona um imóvel primeiro.</div>`;
  return panel+`<div class="toolbar">
    <button class="btn" onclick="shareReport()">Partilhar</button>
    <button class="btn" onclick="downloadCsv()">CSV</button></div>`
    +((!repProp||String(repProp).startsWith('g:'))?portCard(repProp||null):'')+list.map(repCard).join('');
}
// aplica o imóvel (ou grupo) escolhido no seletor e volta a desenhar
// Devolve: nada — guarda o filtro e redesenha a vista.
function onRepSel(){repProp=val('repSel')||'';render()}
/* grava o yield exigido: vazio ou zero repõe os 5 %; negativos ficam em 0,1 % — a avaliação
   divide por ele, e um yield negativo dava valores negativos
   Recebe: v — o que foi escrito no campo (texto).
   Devolve: nada — grava a definição e redesenha (setSet). */
function capTargetSet(v){setSet('capTarget',Math.max(0.1,num(v)||5))}
/* o yield exigido em fração, nunca abaixo de 0,1 % (dados antigos podiam trazer zero ou negativo)
   Devolve: número, ex.: 0.05 para 5 %. */
const capTargetFrac=()=>Math.max(0.1,Number(db.settings.capTarget)||5)/100;
/* a avaliação por rendimento — o NOI anual capitalizado ao yield exigido — e a diferença
   face ao valor de mercado; sem valor de mercado a diferença é NaN (mostra-se «—»)
   Recebe: noiA — o NOI anual (metrics().noiAnual); value — o valor de mercado (euros).
   Devolve: {valuation, diff} — o valor por rendimento em euros e a fração (valuation/value − 1). */
function valuationOf(noiA,value){const valuation=noiA/capTargetFrac();return {valuation,diff:value>0?valuation/value-1:NaN}}
/* a «Diferença» pronta a mostrar: sinal, cor e rodapé; sem valor de mercado é «—», sem cor nem juízo
   Recebe: diff — a fração (valuation/valor − 1), ou NaN.
   Devolve: {v, c, f} — o texto do valor, a classe de cor e o rodapé. */
function diffKpi(diff){
  if(!isFinite(diff))return {v:'—',c:'',f:'sem valor de mercado'};
  return {v:(diff>=0?'+':'')+pct(diff),c:diff>=0?'pos':'neg',f:diff>=0?'as rendas justificam mais':'as rendas justificam menos'};
}
/* a fila de rentabilidade de um cartão da avaliação: yield bruto, cap rate, sobre a
   aquisição e LTV, cada um com explicação e evolução ao toque (evoRatio)
   Recebe: m — as métricas do ano (metrics(), com share); pid — id do imóvel, 'g:ID' ou null (o que evoRatio recebe).
   Devolve: o HTML da grelha (string). */
function rentGrid(m,pid){
  return `<div class="grid" style="margin-top:11px">
    ${kpi('Yield bruto',pct(m.grossYield),'','imóveis com contrato ativo',WHY.yieldBruto,()=>evoRatio('grossYield',pid))}
    ${kpi('Cap rate',pct(m.cap),'','NOI anualizado / valor de mercado',WHY.cap,()=>evoRatio('cap',pid))}
    ${kpi('Sobre a aquisição',pct(m.coc),'','sobre '+euro(m.purchase)+' de aquisição',WHY.aquisicao,()=>evoRatio('coc',pid))}
    ${kpi('LTV',pct(m.ltv),'',euro(m.debt)+' em dívida',WHY.ltv,()=>evoRatio('ltv',pid))}</div>`;
}
/* a conta de exploração de um cartão: rendas, despesas, NOI, prestações, amortizações
   antecipadas (só quando as há) e cashflow
   Recebe: m — as métricas do ano (metrics()).
   Devolve: o HTML do cartão (string). */
function contaCard(m){
  return card('Conta de exploração',String(YEAR),`
    <div class="stat"><span>Rendas recebidas</span><b class="pos">${euro(m.income)}</b></div>
    <div class="stat"><span>Despesas operacionais</span><b class="neg">−${euro(m.op)}</b></div>
    <div class="stat"><span>Resultado líquido (NOI)</span><b>${euro(m.noi)}</b></div>
    <div class="stat"><span>Prestações pagas</span><b class="amber">−${euro(m.loan)}</b></div>
    ${m.amort?`<div class="stat"><span>Amortizações antecipadas</span><b class="amber">−${euro(m.amort)}</b></div>`:''}
    <div class="stat"><span>Cashflow</span><b class="${m.cf>=0?'pos':'neg'}">${euro(m.cf)}</b></div>`);
}
/* agregado de todo o portefólio (no âmbito do filtro de proprietário, na quota-parte dele)
   Recebe: pid — 'g:ID' de um grupo de imóveis, ou null/vazio para o portefólio completo.
   Devolve: o HTML do cartão (string); '' sem imóveis no âmbito. */
function portCard(pid){
  const m=metrics(YEAR,pid||null,{share:true}),ps=pidProps(pid);
  if(!ps.length)return '';
  const {valuation,diff}=valuationOf(m.noiAnual,m.value),d=diffKpi(diff);
  const inc=monthly(YEAR,pid||null,'income',true),exp=monthly(YEAR,pid||null,'expense',true),ln=monthly(YEAR,pid||null,'loan',true);
  const cs=byCategory(YEAR,pid||null,true);
  return `<div class="card" style="margin-bottom:14px;padding:18px;border-width:2px">
    <div class="row-between"><div style="min-width:0">
      <div class="title" style="font-size:18px">${pid?'Grupo · '+esc((grp(String(pid).slice(2))||{}).name||''):'Portefólio completo'}</div>
      <div class="small">${ps.length} ${ps.length===1?'imóvel':'imóveis'}${ownerFilter?' · '+esc(ownerFilterName()):''}</div></div>
      <span class="badge">${YEAR}</span></div>
    <div class="grid" style="margin-top:14px">
      ${kpi('Valor de mercado',euro(m.value),'','soma dos imóveis',WHY.valorIntro)}
      ${kpi('Valor por rendimento',euro(valuation),d.c,`a ${pct(capTargetFrac())} de yield exigido`,WHY.valorRend)}
      ${kpi('Diferença',d.v,d.c,d.f,WHY.diferenca)}
      ${kpi('Equity',euro(m.value-m.debt),'','valor menos dívida',WHY.equity)}</div>
    ${rentGrid(m,pid||null)}
    <div class="cols">
      ${card('Rendas e despesas','Mês a mês em '+YEAR,cBars(inc.map((v,i)=>[{label:'Rendas',value:v,color:PAL[0]},{label:'Despesas',value:-exp[i],color:'#c56b68'},{label:'Prestação',value:-ln[i],color:'#d6a34a'}]),MES,{h:190}))}
      ${card('Estrutura de despesas','',cs.length?cDonut(cs,{sub:'gastos do ano'}):`<div class="hint">Sem gastos em ${YEAR}.</div>`)}</div>
    <div class="cols">
      ${contaCard(m)}
      ${card('Indicadores','',`
        <div class="stat"><span>Renda anual contratada</span><b>${euro(m.annualRent)}</b></div>
        <div class="stat"><span>NOI anualizado</span><b>${euro(m.noiAnual)}</b></div>`)}</div>
  </div>`;
}
/* O cartão de avaliação de um imóvel: valor introduzido contra valor por rendimento,
   a fila de rentabilidade, contratos ativos, gráficos do ano, conta de exploração,
   indicadores e — havendo hipotecas — a projeção da dívida até ao fim. Com um
   proprietário filtrado, os valores entram na quota-parte dele (como no portefólio);
   a tabela de contratos e o cartão das hipotecas ficam por inteiro, que são factos deles.
   Recebe: p — o imóvel (objeto da base local).
   Devolve: o HTML do cartão (string). */
function repCard(p){
  const m=metrics(YEAR,p.id,{share:true}),ls=liveLoans(p),q=sh(p);
  const ac=activeContracts(p.id),netY=netRentOf(p)*12*q;
  const {valuation,diff}=valuationOf(m.noiAnual,m.value),d=diffKpi(diff);
  const inc=monthly(YEAR,p.id,'income',true),exp=monthly(YEAR,p.id,'expense',true),ln=monthly(YEAR,p.id,'loan',true);
  const cs=byCategory(YEAR,p.id,true),st=propStatus(p),own=ownerNames(p);
  return `<div class="card" style="margin-bottom:14px;padding:18px">
    <div class="row-between"><div style="min-width:0">
      <div class="title" style="font-size:18px">${esc(p.name)}</div>
      <div class="small">${esc(p.address||'')} · ${st.label}${own?' · '+esc(own):''}${q<1?' · quota-parte de '+esc(ownerFilterName())+' ('+pct(q,0)+')':''}</div></div>
      <span class="badge ${st.badge}">${YEAR}</span></div>
    <div class="grid" style="margin-top:14px">
      ${kpi('Valor introduzido',euro(m.value),'','valor de mercado',WHY.valorIntro)}
      ${kpi('Valor por rendimento',euro(valuation),d.c,`a ${pct(capTargetFrac())} de yield exigido`,WHY.valorRend,()=>evoValuation(p,'val'))}
      ${kpi('Diferença',d.v,d.c,d.f,WHY.diferenca,()=>evoValuation(p,'diff'))}
      ${kpi('Equity',euro(m.value-m.debt),'','valor menos dívida',WHY.equity,()=>evoValuation(p,'equity'))}</div>
    ${rentGrid(m,p.id)}
    ${ac.length?card('Contratos ativos','',`<div class="tablewrap"><table class="table"><thead><tr>
      <th>${p.rentalMode==='quartos'?'Quarto':'Contrato'}</th><th>Inquilinos</th><th>Renda</th><th>Imposto</th><th>Líquida</th></tr></thead><tbody>
      ${ac.map(x=>`<tr><td><b>${x.roomId?esc(roomName(p,x.roomId)):'Imóvel inteiro'}</b></td>
        <td style="text-align:left;white-space:normal">${esc(ctNames(x))}</td><td>${euro(x.rent)}</td>
        <td class="neg">${dec(taxRateOf(x))}%${Number(x.taxRate)>0?'':' <span class="small">estim.</span>'}</td><td><b>${euro(netRent(x))}</b></td></tr>`).join('')}
      <tr><td colspan="2"><b>Total mensal</b></td><td><b>${euro(rentOf(p))}</b></td><td></td><td><b>${euro(netRentOf(p))}</b></td></tr>
      </tbody></table></div>`):''}
    <div class="cols">
      ${card('Rendas e despesas','Mês a mês em '+YEAR,cBars(inc.map((v,i)=>[{label:'Rendas',value:v,color:PAL[0]},{label:'Despesas',value:-exp[i],color:'#c56b68'},{label:'Prestação',value:-ln[i],color:'#d6a34a'}]),MES,{h:190}))}
      ${card('Estrutura de despesas','',cs.length?cDonut(cs,{sub:'gastos do ano'})
        :`<div class="hint">Não há gastos atribuídos a este imóvel em ${YEAR}.${orphanExpenses(YEAR).length?` Há ${euro(sum(orphanExpenses(YEAR).map(x=>x.amount)))} em despesas sem imóvel atribuído, que aparecem na visão geral mas não aqui.`:''}</div>`)}</div>
    <div class="cols">
      ${contaCard(m)}
      ${card('Indicadores','',`
        <div class="stat"><span>Renda anual contratada</span><b>${euro(m.annualRent)}</b></div>
        <div class="stat"><span>Renda anual líquida de impostos (estim.)</span><b>${euro(netY)}</b></div>
        <div class="stat"><span>NOI anualizado</span><b>${euro(m.noiAnual)}</b></div>`)}</div>
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
/* avaliação por rendimento ano a ano (histórico, com o NOI anualizado no ano corrente)
   e equity projetado com a amortização — na quota-parte do proprietário filtrado
   Recebe: p — o imóvel; what — o que evolui: 'val' (avaliação), 'diff' (diferença) ou 'equity' (projeção).
   Devolve: a série para a janela do KPI (objeto {fmt, yearly: [{label, value, extra}], extraTitle, …}). */
function evoValuation(p,what){
  const q=sh(p);
  if(what==='equity'){
    const n=Math.max(2,Math.round(db.settings.years));
    return {fmt:euro,yearlyTitle:'Projeção ano a ano',extraTitle:'Em dívida',note:'Valor de mercado atual menos a dívida no fim de cada ano.',
      yearly:[...Array(n)].map((_,i)=>{const debt=q*sum(liveLoans(p).map(l=>{const a=amort(l,(i+1)*12);return a.rows.length?a.rows[a.rows.length-1].bal:0}));
        return {label:YEAR+i,value:p.value*q-debt,extra:euro(debt)}})};
  }
  return {fmt:what==='diff'?(v=>pct(v)):euro,extraTitle:'NOI anual',note:'No ano corrente o NOI é anualizado: o que há até hoje ×12 sobre os meses decorridos.',
    yearly:yearsWithData(p.id).map(y=>{const m=metrics(y,p.id,{share:true}),v=valuationOf(m.noiAnual,m.value);
      return {label:y,value:what==='diff'?v.diff:v.valuation,extra:euro(m.noiAnual)}})};
}
/* série ano a ano de um rácio, para a janela do KPI. cap e coc saem do
   histórico real; grossYield e ltv são projeções para a frente — daí o
   título e a nota diferentes que devolve. Na quota-parte do proprietário filtrado.
   Recebe: field — o rácio ('cap', 'coc', 'grossYield' ou 'ltv'); pid — id do imóvel, 'g:ID' de um grupo, ou null/vazio para o âmbito todo.
   Devolve: objeto {fmt, yearly (array de {label, value, extra?})} para a janela do KPI; nas projeções
   (grossYield e ltv) leva ainda yearlyTitle, extraTitle, marks e note. */
function evoRatio(field,pid){
  if(field==='cap'||field==='coc')return {fmt:v=>pct(v),yearly:yearsWithData(pid).map(y=>({label:y,value:metrics(y,pid,{share:true})[field]}))};
  /* yield bruto e LTV: projeção com os aumentos de renda e a amortização das hipotecas */
  const s=db.settings,n=Math.max(2,Math.round(s.years)),ps=pidProps(pid);
  const value=sum(ps.map(p=>p.value*sh(p)));
  /* o mesmo conjunto das métricas: renda e valor só dos imóveis com contrato ativo */
  const rented=ps.filter(p=>isRented(p)||activeContracts(p.id).length>0);
  const act=db.contracts.filter(c=>isActive(c)&&rented.some(p=>p.id===c.propertyId));
  const rv=sum(rented.map(p=>p.value*sh(p)));
  const out=[];
  for(let i=0;i<n;i++){
    if(field==='grossYield'){
      const rent=sum(act.map(c=>c.rent*sh(prop(c.propertyId))*12*Math.pow(1+((c.increase==null?s.growth:c.increase)/100),i)));
      out.push({label:YEAR+i,value:rv?rent/rv:NaN,extra:euro(rent)});
    }else{
      const debt=sum(ps.map(p=>sh(p)*sum(liveLoans(p).map(l=>{const a=amort(l,(i+1)*12);return a.rows.length?a.rows[a.rows.length-1].bal:0}))));
      out.push({label:YEAR+i,value:value?debt/value:NaN,extra:euro(debt)});
    }
  }
  return {fmt:v=>pct(v),yearly:out,yearlyTitle:'Projeção ano a ano',extraTitle:field==='grossYield'?'Renda anual':'Em dívida',marks:decadeMarks(YEAR,n),
    note:field==='grossYield'?'Renda projetada com o aumento anual de cada contrato, sobre o valor de mercado atual dos imóveis com contrato ativo.':'Dívida no fim de cada ano segundo o plano de cada hipoteca, sobre o valor de mercado atual.'};
}
// A avaliação em texto simples, para partilhar ou copiar: totais do portefólio,
// contas entre proprietários e cada imóvel com os seus contratos. Respeita o filtro de
// proprietário — tudo na quota-parte dele, como os cartões — e usa o mesmo NOI anualizado.
// Devolve: o texto do relatório (string, várias linhas).
function reportText(){
  const m=metrics(YEAR,null,{share:true}),act=db.contracts.filter(c=>isActive(c)&&inScope(c.propertyId)),cs=c=>sh(prop(c.propertyId));
  const v=valuationOf(m.noiAnual,m.value);
  return `AVALIAÇÃO DO PORTEFÓLIO — ${YEAR}${ownerFilter?' · '+ownerFilterName()+(ownerIsGrp()?'':' (na quota-parte)'):''}

Imóveis: ${m.props.length} · contratos ativos: ${act.length}
Renda contratada ${euro(sum(act.map(c=>c.rent*cs(c))))}/mês · líquida de impostos (estim.) ${euro(sum(act.map(c=>netRent(c)*cs(c))))}/mês
Valor de mercado: ${euro(m.value)} · em dívida ${euro(m.debt)} · líquido ${euro(m.value-m.debt)}
Valor por rendimento ${euro(v.valuation)} (a ${pct(capTargetFrac())}, NOI anualizado ${euro(m.noiAnual)}) · diferença ${diffKpi(v.diff).v}

Rendas ${euro(m.income)} · gastos ${euro(m.op)} · NOI ${euro(m.noi)} · prestações ${euro(m.loan)}${m.amort?' · amortizações antecipadas '+euro(m.amort):''} · cashflow ${euro(m.cf)}
Yield bruto ${pct(m.grossYield)} · cap rate ${pct(m.cap)} · sobre a aquisição ${pct(m.coc)} · LTV ${pct(m.ltv)}
${(()=>{const b=ownerBalances(null),ks=Object.keys(b);
  return ks.length?'\nCONTAS ENTRE PROPRIETÁRIOS\n'+ks.map(k=>`  ${(owner(k)||{}).name}: ${b[k]>0?'a receber ':(b[k]<0?'a pagar ':'')}${euro2(Math.abs(b[k]))}`).join('\n'):''})()}

POR IMÓVEL
${m.props.map(p=>{const x=metrics(YEAR,p.id,{share:true}),vp=valuationOf(x.noiAnual,x.value);
  return `  ${p.name} [${propStatus(p).label}]${ownerNames(p)?' — '+ownerNames(p):''}${sh(p)<1?' · quota-parte '+pct(sh(p),0):''}
    Valor ${euro(x.value)} · avaliação por rendimento ${euro(vp.valuation)} · diferença ${diffKpi(vp.diff).v}
    Renda ${euro(rentOf(p)*sh(p))}/mês · cashflow ${euro(x.cf)}
${activeContracts(p.id).map(c=>`      ${c.roomId?roomName(p,c.roomId):'Imóvel inteiro'}: ${ctNames(c)} — ${euro(c.rent)}`).join('\n')}`}).join('\n')}
`;
}
