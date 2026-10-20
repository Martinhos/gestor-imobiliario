/* ================= AVALIAÇÃO ================= */
/* o contador dos ids da página: o herói abre e fecha a explicação pelo seu id
   (vistas.js:kpiPorque), e cada pintura dá ids novos */
let avaN=0;
/* A vista de avaliação, como a prancheta D-Avaliacao: a fila de chips com o
   imóvel em foco e as ações da página (avaChips; o yield exigido está na roda
   dentada do cabeçalho, avaOpcoes), e depois o portefólio — o herói do
   valor de mercado contra o valor por rendimento, os cinco rácios, a conta de
   exploração ao lado das contas entre proprietários, a tabela «Por imóvel» e
   os gráficos do ano. Tocar numa linha da tabela põe esse imóvel em foco
   (repFoco) e a página passa a ser a ficha dele (repCard). Com um imóvel só no
   âmbito, o portefólio É esse imóvel: vai logo a ficha, sem tabela de uma linha.
   Devolve: o HTML da vista (string). */
function vReports(){
  if(repProp&&!pidProps(repProp).length)repProp='';
  /* um imóvel onde só colaboro sem «Ver valores e avaliação» não tem cartão: o servidor não manda os valores */
  const list=pidProps(repProp).filter(p=>pode(p.id,'report.view'));
  /* a saída do vazio leva aos Imóveis: com esse serviço desligado nesta conta
     o botão não se escreve, e a frase diz quem o liga; o chip fica, para se
     poder largar um foco que deixou a página vazia */
  if(!list.length)return avaChips(false)+(esperaDoServidor()||`<div class="empty"><b>Sem imóveis para avaliar</b>A avaliação parte do que cada imóvel rende.
    ${servicoLigado('properties')?saida('Adicionar imóvel',"go('properties')",'ecra'):vazioServicoDesligado('properties')}</div>`);
  const casa=list.length===1?list[0]:null;
  return avaChips(true)+`<div class="ana ava">${casa?repCard(casa):portCard(repProp||null)}</div>`;
}
/* O topo da Avaliação: no sítio da barra dos filtros das listas, só a fila de
   chips — o «Imóvel» em foco, um imóvel ou um grupo (vistas.js:anaChips) —,
   sem pesquisa, sem funil e sem painel; e, na mesma linha, as ações da
   página: partilhar a avaliação e exportar os movimentos. O proprietário não
   tem chip: o filtro global de proprietário está de saída da app. O yield
   exigido já não vive na página: abre-se na roda dentada do cabeçalho
   (avaliacao.js:avaOpcoes).
   Recebe: comAcoes — verdadeiro com avaliação à vista (sem ela não há o que
   partilhar nem exportar).
   Devolve: o HTML (string). */
function avaChips(comAcoes){
  const acoes=comAcoes?`<div class="ana-acoes"><button type="button" class="btn" data-toca="nada" data-click="shareReport()"><span>Partilhar<span class="ana-largo"> avaliação</span></span></button>
    <button type="button" class="btn" data-toca="nada" data-click="downloadCsv()"><span>Exportar<span class="ana-largo"> movimentos (CSV)</span><span class="ana-curto"> CSV</span></span></button></div>`:'';
  return anaChips({id:'repSel',valor:repProp,aplicar:'onRepSel',limpar:'repAnaLimpar();render()',dos:'da avaliação',acoes});
}
/* As opções da avaliação, na janela que a roda dentada do cabeçalho abre
   (vistas.js:ANA_RODA, o «alternar» do registo): o yield exigido, que vivia
   escrito na barra do topo. É o mesmo das Definições › Valores por omissão
   (definicoes.js:vDefaults), no mesmo desenho. Grava ao escrever
   (avaOpcaoYield), e a avaliação por trás acompanha.
   Recebe: nada.
   Devolve: nada — abre a janela (vistas.js:anaOpcoes). */
function avaOpcoes(){
  anaOpcoes('Opções da avaliação',[
    {id:'avaYield',titulo:'Yield exigido',sub:'O resultado anual de cada imóvel a dividir por este yield dá o valor por rendimento',valor:dec(db.settings.capTarget),modo:'decimal',unidade:'%',
      input:'avaOpcaoYield(this)',change:'avaOpcaoYield(this,1)'}],
    'Tem de ser maior que zero; em branco volta aos 5 %. É o mesmo valor das Definições, em Valores por omissão.');
}
/* O campo do yield exigido da janela das opções mudou. Ao escrever, grava
   pelo capTargetSet o valor que o campo vale (vazio ou zero são 5 %), e a
   avaliação redesenha-se por trás; um valor igual ao gravado não redesenha.
   Ao sair do campo, o campo passa a mostrar o que ficou gravado.
   Recebe: campo — o campo (o this da ação); fim (opcional) — verdadeiro ao
   sair do campo.
   Devolve: nada — grava, e ao sair reescreve o campo. */
function avaOpcaoYield(campo,fim){
  if(!campo)return;
  if(db.settings.capTarget!==NORMA_DOS_VALORES.capTarget(campo.value))capTargetSet(campo.value);
  if(fim)campo.value=dec(db.settings.capTarget);
  anaOpcaoGravada();
}
/* Um cartão da Análise: o título na letra dos títulos, o subtítulo ao lado e,
   à direita, o que o cartão traz no cabeçalho (um botão de informação).
   Recebe: titulo — o título (texto já seguro); sub — o subtítulo ('' sem ele);
   corpo — o HTML do cartão; cls (opcional) — classes a mais; extra (opcional)
   — o HTML do canto direito do cabeçalho.
   Devolve: o HTML do cartão (string). */
function avaCartao(titulo,sub,corpo,cls,extra){
  return `<section class="card ana-cartao${cls?' '+cls:''}"><div class="ana-cab"><h2 class="ana-tit">${titulo}</h2>${sub?`<span class="small">${sub}</span>`:''}${extra?`<span class="ana-extra">${extra}</span>`:''}</div>${corpo}</section>`;
}
/* Põe um imóvel (ou nenhum) em foco e volta a desenhar no topo: é o toque
   numa linha da tabela «Por imóvel», que abre a ficha desse imóvel.
   Recebe: id — o id do imóvel, ou '' para o portefólio.
   Devolve: nada — muda o foco, redesenha e sobe ao topo. */
function repFoco(id){
  repProp=id||'';render();
  try{window.scrollTo(0,0)}catch(e){}
}
/* Aplica o imóvel (ou grupo) escolhido no chip «Imóvel» (vistas.js:anaChips)
   e volta a desenhar. Escolher pelo teclado deixa o foco no botão do chip,
   que o render refaz: volta ao novo, com o mesmo id (vistas.js:lfReporFoco).
   Recebe: nada (lê o seletor #repSel).
   Devolve: nada — guarda o filtro e redesenha a vista. */
function onRepSel(){const antes=document.activeElement;repProp=val('repSel')||'';render();lfReporFoco(antes)}
/* grava o yield exigido: vazio ou zero repõe os 5 %; negativos ficam em 0,1 % — a avaliação
   divide por ele, e um yield negativo dava valores negativos. Grava já; o
   redesenho vai pelo avaRepintar, que devolve o foco a quem o tinha. Quem o
   chama é o campo da janela das opções (avaliacao.js:avaOpcaoYield).
   Recebe: v — o que foi escrito no campo (texto).
   Devolve: nada — grava a definição e agenda o redesenho (avaRepintar). */
function capTargetSet(v){db.settings.capTarget=Math.max(0.1,num(v)||5);save();avaRepintar()}
/* Redesenha a página sem tirar o foco a quem usa o teclado. O campo do yield
   vivia na barra da página, e gravá-lo (ao sair dele com Tab) refazia a vista inteira já, e o campo seguinte,
   para onde o Tab ia, desaparecia: o foco caía no <body> e o Tab seguinte
   voltava ao topo da página. Quando o change corre, o foco ainda não chegou
   ao campo seguinte — por isso o redesenho espera que ele assente
   (setTimeout), lê o id de quem o tem, redesenha e devolve-lho. O render é
   lido aqui, ao agendar (é o que os testes trocam).
   Recebe: nada.
   Devolve: nada — agenda o redesenho. */
function avaRepintar(){
  const pinta=render;
  setTimeout(()=>{
    const a=document.activeElement,id=a&&a!==document.body?a.id||'':'';
    pinta();
    const e=id?document.getElementById(id):null;
    if(e&&e!==document.activeElement)try{e.focus({preventScroll:true})}catch(x){}
  },0);
}
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
/* A fila dos rácios (a prancheta: cinco cartões de métricas): o Equity à
   cabeça e depois o yield bruto, o cap rate, o retorno sobre a aquisição e o
   LTV, cada um com explicação e evolução ao toque (evoRatio). O rodapé de cada
   um diz a conta, com os valores que entram nela.
   Recebe: m — as métricas do ano (metrics(), com share); pid — id do imóvel,
   'g:ID' ou null (o que evoRatio recebe); eq (opcional) — o HTML do cartão do
   Equity, que o portefólio e o imóvel fazem de maneira diferente.
   Devolve: o HTML da grelha (string). */
function rentGrid(m,pid,eq){
  return `<div class="grid ava-metricas">${eq||''}
    ${kpi('Yield bruto',pct(m.grossYield),'','renda contratada ÷ valor, só imóveis arrendados',WHY.yieldBruto,()=>evoRatio('grossYield',pid))}
    ${kpi('Cap rate',pct(m.cap),'','NOI anualizado ÷ valor de mercado',WHY.cap,()=>evoRatio('cap',pid))}
    ${kpi('Sobre a aquisição',pct(m.coc),'','cashflow ÷ '+euro(m.purchase)+' de aquisição',WHY.aquisicao,()=>evoRatio('coc',pid))}
    ${kpi('LTV',pct(m.ltv),'',euro(m.debt)+' em dívida ÷ valor',WHY.ltv,()=>evoRatio('ltv',pid))}</div>`;
}
/* O herói da Avaliação (a prancheta): o valor de mercado e o valor por
   rendimento em duas barras à mesma escala, e ao lado a diferença em grande,
   a frase que a lê e a conta que a dá. Num imóvel, o valor por rendimento e a
   diferença abrem a evolução ano a ano (evoValuation, pela janela dos
   indicadores: vistas.js:kpiModal, com o registo em KPI_REG). «Como se
   calcula» abre a explicação por baixo, no próprio cartão (vistas.js:kpiPorque).
   Recebe: m — as métricas do ano (metrics(), com share); valuation — o valor
   por rendimento; diff — a fração da diferença (NaN sem valor de mercado);
   p (opcional) — o imóvel, para a evolução; sem ele é o portefólio.
   Devolve: o HTML do cartão (string). */
function avaHeroi(m,valuation,diff,p){
  const d=diffKpi(diff),id='avaHeroi'+(++avaN),topo=Math.max(m.value,valuation,0);
  const larg=v=>topo>0?Math.max(0,Math.min(100,v/topo*100)).toFixed(1):'0';
  /* a evolução de um imóvel vai pela janela dos indicadores: regista-se como um KPI */
  const reg=(t,why,f)=>{const k='k'+(++kpiN);KPI_REG[k]={title:t,why:why,evo:f,acao:null};return k};
  const frase=!isFinite(diff)?'Diferença: sem valor de mercado na ficha, não há comparação.'
    :diff>=0?'As rendas de hoje justificam mais do que o valor de mercado.':'As rendas de hoje justificam menos do que o valor de mercado.';
  const rend=`<span class="ava-barra-lin"><span>Valor por rendimento</span><b class="disp ava-rend">${euro(valuation)}</b></span>
    <span class="ava-trilho"><span class="ava-enche ava-enche-rend" data-largura="${larg(valuation)}"></span></span>`;
  const pctTxt=`<span class="disp ava-pct ${d.c}">${d.v}</span>`;
  return `<section class="card ava-heroi" id="${id}">
    <div class="ava-barras">
      <div class="ava-barra-bloco"><span class="ava-barra-lin"><span>Valor de mercado</span><b class="disp">${euro(m.value)}</b></span>
        <span class="ava-trilho"><span class="ava-enche" data-largura="${larg(m.value)}"></span></span></div>
      ${p?`<button type="button" class="ava-barra-bloco ava-evo" data-toca="camada" data-click="kpiModal('${reg('Valor por rendimento',WHY.valorRend,()=>evoValuation(p,'val'))}')" aria-label="Valor por rendimento, ${euro(valuation)}: ver a evolução">${rend}</button>`
        :`<div class="ava-barra-bloco">${rend}</div>`}
    </div>
    <div class="ava-dif">
      ${p?`<button type="button" class="ava-evo ava-pct-btn" data-toca="camada" data-click="kpiModal('${reg('Diferença',WHY.diferenca,()=>evoValuation(p,'diff'))}')" aria-label="Diferença, ${d.v}: ver a evolução">${pctTxt}</button>`:pctTxt}
      <p class="ava-frase">${frase}</p>
      <p class="small num">Resultado anualizado de ${euro(m.noiAnual)} ÷ yield exigido de ${pct(capTargetFrac())}.</p>
      <button type="button" class="btn sm ghost ava-porque" data-toca="nada" data-click="kpiPorque('${id}')">${ic('info',16)}Como se calcula</button>
      <div class="hint ava-expl">${WHY.valorIntro} ${WHY.valorRend} ${WHY.diferenca} A avaliação por rendimento capitaliza o resultado líquido anual ao yield exigido (em branco: 5 %). O anualizado é ×12 sobre os meses decorridos.</div>
    </div></section>`;
}
/* a conta de exploração (a prancheta): rendas, despesas, o NOI em destaque,
   prestações, amortizações antecipadas (só quando as há) e o cashflow. O que
   sai leva o «−» e a cor só quando há valor: sem hipotecas era «−0 €» a roxo.
   Recebe: m — as métricas do ano (metrics()).
   Devolve: o HTML do cartão (string). */
function contaCard(m){
  const l=(r,v,c,x)=>`<div class="ava-ce${x?' '+x:''}"><span>${r}</span><b class="${c||''}">${v}</b></div>`;
  /* o teste é sobre o valor arredondado: o euro() mostra-o ao euro, e 0,40 € davam «−0 €» */
  const sai=(r,v,c)=>Math.round(v)?l(r,'−'+euro(v),c):l(r,euro(0),'');
  return avaCartao('Conta de exploração · '+YEAR,'',
    l('Rendas recebidas',euro(m.income),'pos')+sai('Despesas operacionais',m.op,'neg')
    +l('Resultado líquido (NOI)',euro(m.noi),'','ava-ce-noi')
    +sai('Prestações pagas',m.loan,'prest')+(m.amort?sai('Amortizações antecipadas',m.amort,'prest'):'')
    +l('Cashflow',euro(m.cf),m.cf<0?'neg':'','ava-ce-cf'),'ava-conta');
}
/* O cartão ao lado da conta de exploração (a prancheta): as contas entre
   proprietários — quem tem a receber e quem tem a pagar, o plano que as acerta
   e o «Acertar contas» (vistas.js:settleModal), e o «como se chega aos
   saldos» (saldos.js:balancesDetail) — e por baixo as rendas anuais e o NOI
   anualizado. Os saldos são dos proprietários: num imóvel onde só colaboro, ou
   sem saldos, o cartão fica só com os indicadores.
   Recebe: m — as métricas do ano; pid — o id do imóvel, 'g:ID' ou null; netY
   (opcional) — a renda anual líquida de impostos do imóvel (o portefólio não a tem).
   Devolve: o HTML do cartão (string). */
function avaContasCard(m,pid,netY){
  const ind=`<div class="ava-ind">
    <div><span class="small">Renda anual contratada</span><b>${euro(m.annualRent)}</b></div>
    ${netY!=null?`<div><span class="small">Renda anual líquida de impostos (estim.)</span><b>${euro(netY)}</b></div>`:''}
    <div><span class="small">NOI anualizado</span><b>${euro(m.noiAnual)}</b></div></div>`;
  const dono=!pid||String(pid).startsWith('g:')||souDono(pid),bal=dono?ownerBalances(pid):{},ks=Object.keys(bal);
  if(!ks.length)return avaCartao('Indicadores','',ind,'ava-contas');
  const tot=debtTotal(bal),plan=settlePlan(bal),arg=pid?`'${jsq(pid)}'`:'null';
  const rows=ks.map(k=>({name:(owner(k)||{}).name||'?',v:bal[k]})).sort((a,b)=>b.v-a.v);
  const saldos=`<div class="ava-saldos">${rows.map(r=>{const z=Math.abs(r.v)<0.01;
    return `<div class="ava-saldo${z?'':r.v>0?' in':' out'}"><b>${esc(r.name)}</b><span>${z?'Em dia':r.v>0?'A receber '+euro2(r.v):'A pagar '+euro2(-r.v)}</span></div>`}).join('')}</div>`;
  const acerto=tot>0.005?`<div class="hint">${plan.map(x=>`<b>${esc((owner(x.from)||{}).name)}</b> paga <b>${euro2(x.amount)}</b> a <b>${esc((owner(x.to)||{}).name)}</b>`).join('<br>')}</div>
    <div class="ava-acerto"><button type="button" class="btn primary" data-toca="camada" data-click="settleModal(${arg})">${ic('check',16)}Acertar contas</button></div>`
    :`<div class="hint">Está tudo liquidado.</div>`;
  return avaCartao('Contas entre proprietários',(pid&&!String(pid).startsWith('g:')?'Neste imóvel':'Todos os imóveis')+' · receitas, despesas e prestações com pessoa indicada',
    saldos+acerto+ind,'ava-contas',
    `<button type="button" class="btn sm ghost so-icone" aria-label="Como se chega aos saldos" data-toca="camada" data-click="balancesDetail(${arg})">${ic('info',18)}</button>`);
}
/* o selo da ocupação de um imóvel, nas cores do contrato da linguagem:
   arrendado verde, por quartos cobalto (o .badge sem modificador), vago
   âmbar, uso próprio cinzento. O cobalto é a classe vazia: um «|| 'grey'»
   trocava-a pelo cinzento e o «3/4 quartos» saía igual ao «Uso próprio».
   Recebe: st — o estado (registos.js:propStatus).
   Devolve: a classe do .badge ('in', '', 'amber' ou 'grey'; cinzento para um estado desconhecido). */
function avaSelo(st){
  const m={arrendado:'in',parcial:'',vago:'amber',proprio:'grey'},k=st&&st.key;
  return Object.prototype.hasOwnProperty.call(m,k)?m[k]:'grey';
}
/* os donos de um imóvel para a linha da tabela: o nome, ou os nomes com a
   quota de cada um quando são vários
   Recebe: p — o imóvel.
   Devolve: o texto (ex.: «Maria Costa 60% · Pedro Costa 40%»), ou ''. */
function avaDonos(p){
  const os=ownersOfProp(p);
  if(os.length<2)return ownerNames(p);
  return os.map(o=>((owner(o)||{}).name||'?')+' '+pct(shareOf(p,o),0)).join(' · ');
}
/* A tabela «Por imóvel» (a prancheta): uma linha por imóvel do âmbito, com a
   ocupação, o valor, a renda anual, o NOI anualizado, os rácios e o cashflow
   do ano — os números dos cartões de cada imóvel, na quota-parte do
   proprietário filtrado. Tocar numa linha abre a ficha do imóvel (repFoco).
   Recebe: list — os imóveis (com a permissão de ver a avaliação); pid — o
   'g:ID' do grupo em foco, ou null.
   Devolve: o HTML do cartão (string). */
function avaTabela(list,pid){
  const linha=p=>{const x=metrics(YEAR,p.id,{share:true}),st=propStatus(p),donos=avaDonos(p);
    return `<tr data-toca="vista" data-click="repFoco('${jsq(p.id)}')" aria-label="${esc(p.name)}: abrir a avaliação">
      <td><b>${esc(p.name)}</b>${donos?`<div class="small">${esc(donos)}</div>`:''}</td>
      <td class="u-ta-left"><span class="badge ${avaSelo(st)}">${esc(st.label)}</span></td>
      <td>${euro(x.value)}</td><td>${x.annualRent?euro(x.annualRent):'—'}</td>
      <td class="${x.noiAnual<0?'neg':''}">${euro(x.noiAnual)}</td>
      <td>${pct(x.grossYield)}</td><td>${pct(x.cap)}</td><td>${pct(x.ltv)}</td>
      <td class="${x.cf<0?'neg':''}"><b>${euro(x.cf)}</b></td></tr>`};
  const sub=list.length+' '+(list.length===1?'imóvel':'imóveis')+(pid?' · grupo '+esc((grp(String(pid).slice(2))||{}).name||''):'')+' · toca numa linha para abrir a avaliação do imóvel';
  return avaCartao('Por imóvel',sub,`<div class="tablewrap"><table class="table ana-fixa ava-tabela"><thead><tr>
    <th>Imóvel</th><th class="u-ta-left">Ocupação</th><th>Valor</th><th>Renda anual</th><th>NOI anualizado</th><th>Yield</th><th>Cap rate</th><th>LTV</th><th>Cashflow</th></tr></thead>
    <tbody>${list.map(linha).join('')}</tbody></table></div>`,'ava-por-imovel');
}
/* os dois gráficos do ano, lado a lado: rendas, despesas e prestações mês a mês
   (as cores das séries: tema.js:COR_SERIE) e a estrutura das despesas
   Recebe: pid — id do imóvel, 'g:ID' ou null; vazio — o HTML a mostrar sem gastos no ano.
   Devolve: o HTML da fila dos dois cartões (string). */
function avaGraficos(pid,vazio){
  const inc=monthly(YEAR,pid,'income',true),exp=monthly(YEAR,pid,'expense',true),ln=monthly(YEAR,pid,'loan',true),cs=byCategory(YEAR,pid,true);
  return `<div class="cols">
    ${avaCartao('Rendas e despesas','Mês a mês em '+YEAR,cBars(inc.map((v,i)=>[{label:'Rendas',value:v,color:COR_SERIE.receita},{label:'Despesas',value:-exp[i],color:COR_SERIE.despesa},{label:'Prestação',value:-ln[i],color:COR_SERIE.prestacao}]),MES,{h:190}))}
    ${avaCartao('Estrutura de despesas','Gastos do ano',cs.length?cDonut(cs,{sub:'gastos do ano'}):vazio)}</div>`;
}
/* O portefólio (no âmbito do filtro de proprietário, na quota-parte dele, ou
   de um grupo de imóveis): o herói, os rácios, a conta de exploração com as
   contas entre proprietários, a tabela «Por imóvel» e os gráficos do ano.
   Recebe: pid — 'g:ID' de um grupo de imóveis, ou null/vazio para o portefólio completo.
   Devolve: o HTML (string); '' sem imóveis no âmbito. */
function portCard(pid){
  const m=metrics(YEAR,pid||null,{share:true}),ps=pidProps(pid);
  if(!ps.length)return '';
  const {valuation,diff}=valuationOf(m.noiAnual,m.value);
  return avaHeroi(m,valuation,diff,null)
    +rentGrid(m,pid||null,kpi('Equity',euro(m.value-m.debt),'','mercado − dívida',WHY.equity))
    +`<div class="cols">${contaCard(m)}${avaContasCard(m,pid||null,null)}</div>`
    +avaTabela(ps.filter(p=>pode(p.id,'report.view')),pid||null)
    +avaGraficos(pid||null,`<div class="hint">Sem gastos em ${YEAR}.</div>`);
}
/* A avaliação de um imóvel (a ficha que a linha da tabela abre): o nome, a
   morada e a ocupação; o herói do valor de mercado contra o valor por
   rendimento; os rácios; a conta de exploração com as contas entre
   proprietários e os indicadores; os contratos ativos; os gráficos do ano; e
   — havendo hipotecas — a projeção da dívida até ao fim. Com um proprietário
   filtrado, os valores entram na quota-parte dele (como no portefólio); a
   tabela de contratos e o cartão das hipotecas ficam por inteiro, que são
   factos deles.
   Recebe: p — o imóvel (objeto da base local).
   Devolve: o HTML (string). */
function repCard(p){
  const m=metrics(YEAR,p.id,{share:true}),ls=liveLoans(p),q=sh(p);
  const ac=activeContracts(p.id),netY=netRentOf(p)*12*q;
  const {valuation,diff}=valuationOf(m.noiAnual,m.value);
  const st=propStatus(p),own=ownerNames(p);
  /* a tabela dos contratos é dos Contratos, e a frase das despesas sem imóvel
     é da Visão geral (painel-geral.js:orphanExpenses): cada uma só com o seu
     serviço ligado nesta conta */
  const comContratos=servicoLigado('contracts')&&ac.length>0;
  const orfas=servicoLigado('dashboard')?orphanExpenses(YEAR):[];
  const linhaSub=[p.address||'',own,q<1?'quota-parte de '+ownerFilterName()+' ('+pct(q,0)+')':''].filter(Boolean).map(esc).join(' · ');
  return `<div class="ava-cab-imovel"><div class="u-minw-0"><h2 class="ava-nome">${esc(p.name)}</h2>${linhaSub?`<p class="small">${linhaSub}</p>`:''}</div>
      <span class="badge ${avaSelo(st)}">${esc(st.label)}</span></div>
    ${avaHeroi(m,valuation,diff,p)}
    ${rentGrid(m,p.id,kpi('Equity',euro(m.value-m.debt),'','mercado − dívida',WHY.equity,()=>evoValuation(p,'equity')))}
    <div class="cols">${contaCard(m)}${avaContasCard(m,p.id,netY)}</div>
    ${comContratos?avaCartao('Contratos ativos',ac.length+' '+(ac.length===1?'contrato':'contratos')+' · renda por mês',`<div class="tablewrap"><table class="table ana-fixa"><thead><tr>
      <th>${p.rentalMode==='quartos'?'Quarto':'Contrato'}</th><th class="u-ta-left">Inquilinos</th><th>Renda</th><th>Imposto</th><th>Líquida</th></tr></thead><tbody>
      ${ac.map(x=>`<tr><td><b>${x.roomId?esc(roomName(p,x.roomId)):'Imóvel inteiro'}</b></td>
        <td class="u-ta-left u-ws-normal">${esc(ctNames(x))}</td><td>${euro(x.rent)}</td>
        <td class="neg">${dec(taxRateOf(x))}%${Number(x.taxRate)>0?'':' <span class="small">estim.</span>'}</td><td><b>${euro(netRent(x))}</b></td></tr>`).join('')}
      <tr class="ana-total"><td><b>Total mensal</b></td><td></td><td><b>${euro(rentOf(p))}</b></td><td></td><td><b>${euro(netRentOf(p))}</b></td></tr>
      </tbody></table></div>`):''}
    ${avaGraficos(p.id,`<div class="hint">Não há gastos atribuídos a este imóvel em ${YEAR}.${orfas.length?` Há ${euro(sum(orfas.map(x=>x.amount)))} em despesas sem imóvel atribuído, que aparecem na visão geral mas não aqui.`:''}</div>`)}
    ${ls.length?(()=>{
      const per=ls.map(l=>({l,a:amort(l),c:loanCalc(l)}));
      const nY=Math.max(...per.map(x=>Math.ceil(x.a.rows.length/12)));
      const bal=[...Array(nY)].map((_,i)=>sum(per.map(x=>{const r=x.a.rows[Math.min((i+1)*12-1,x.a.rows.length-1)];
        return (i+1)*12-1<x.a.rows.length?r.bal:0})));
      /* os números e o gráfico lado a lado (estilos.css:.ava-hip): a toda a
         largura do cartão, o desenho escalava pelo viewBox até 526px de altura
         e letras dos eixos com 35px; a meia largura fica à escala dos outros */
      return avaCartao(ls.length>1?ls.length+' hipotecas':'Hipoteca',ls.map(x=>esc(loanName(x))).join(' · '),
        `<div class="ava-hip"><div>${per.map(x=>`<div class="stat"><span>${esc(loanName(x.l))}<div class="small">${RATE[x.l.type]} · ${x.l.years} anos${(x.l.files||[]).length?' · '+x.l.files.length+' doc.':''}</div></span>
          <b>${euro(x.l.outstanding)}<div class="small u-fw-500">${euro2(x.c.total)}/mês</div></b></div>`).join('')}
          <div class="stat"><span><b>Total em dívida</b></span><b>${euro(debtOf(p))}</b></div>
          <div class="stat"><span>Prestações mensais</span><b>${euro2(payOf(p))}</b></div>
          <div class="stat"><span>Juros até ao fim</span><b class="neg">${euro(sum(per.map(x=>x.a.totInt)))}</b></div>
          <div class="stat"><span>Imposto do selo até ao fim</span><b class="neg">${euro(sum(per.map(x=>x.a.totStamp)))}</b></div></div>
          ${cLine([{name:'Em dívida',values:bal,color:COR_SERIE.divida}],
        [...Array(nY)].map((_,i)=>String(YEAR+i)),{h:160,marks:decadeMarks(YEAR,nY)})}</div>`);
    })():''}`;
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
  /* ctVivo: é uma projeção de anos, e não a pergunta de hoje — com o
     isActive, um contrato que começa em 2028 sumia da série toda */
  const act=db.contracts.filter(c=>ctVivo(c)&&rented.some(p=>p.id===c.propertyId));
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
/* ---- registo do serviço (servicos.js) ---- */
// nº de filtros ativos da avaliação: o imóvel em foco (o chip «Imóvel»)
// Devolve: número de filtros ativos (0 ou 1).
function repAnaN(){return repProp?1:0}
// limpa o imóvel em foco da avaliação (vistas.js:anaClear chama-o)
// Devolve: nada — limpa o filtro; quem chama repinta.
function repAnaLimpar(){repProp=''}
/* o botão do cabeçalho é a roda dentada das opções (vistas.js:ANA_RODA), e
   tocar-lhe é o «alternar» da análise: abre a janela das opções */
registarServico({id:'reports',vistas:{reports:'vReports'},analise:{reports:{n:'repAnaN',limpar:'repAnaLimpar',alternar:'avaOpcoes'}}});
registarRoda('reports','Opções da avaliação');
