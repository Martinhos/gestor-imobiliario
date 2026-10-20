/* ================= VISÃO GERAL (serviço dashboard) ================= */
/* O painel: o «Pede atenção», os cartões dos indicadores, os gráficos, o
   donut das despesas por categoria, o Portefólio e as despesas sem imóvel.
   Veio de vistas.js quando a app passou a serviços; regista-se no fim
   (servicos.js:registarServico). As regras de aspeto vivem na secção
   «redesign: 1.3.1» do web/estilos.css (classes .vg-…). */
/* visão geral: o imóvel (ou grupo) em foco, e o filtro comum quando os há
   Devolve: string HTML do painel de análise (vistas.js:anaPanelPadrao). */
function dashBar(){return anaPanelPadrao('dashPropSel',dashProp,'onDashProp')}
// muda o imóvel (ou grupo) em foco na visão geral
// Devolve: nada — redesenha a vista.
function onDashProp(){dashProp=val('dashPropSel')||'';render()}
/* Visão geral, pela ordem do canvas de 2026-10 (Main, M-Inicio): o «Pede
   atenção» (pedeAtencao), os quatro indicadores do ano (com evolução ao
   toque), o aviso das despesas sem imóvel, as entradas e saídas mês a mês e o
   cashflow acumulado, as despesas por categoria, o cashflow por imóvel e a
   renda por contrato, e o Portefólio ao lado das contas entre proprietários.
   Cada fila é um .cols: a nuvem parte-as em blocos arrumáveis e dá a cada
   cartão a largura da fila — metade com dois, um terço com três
   (cloud/painel.js). Os rácios de rentabilidade vivem na Avaliação. Respeita o
   imóvel/grupo em foco; não há filtro de proprietário (ambito.js), e os
   valores são por inteiro.
   Devolve: string com o HTML completo da vista. */
function vDashboard(){
  if(dashProp&&!pidProps(dashProp).length)dashProp='';
  const pid=dashProp||null,m=metrics(YEAR,pid,{share:true});
  const dp=pid&&!String(pid).startsWith('g:')?prop(pid):null;
  const dpName=pid?(dp?dp.name:'Grupo · '+((grp(String(pid).slice(2))||{}).name||'')):'';
  /* Sem movimentos, a vista é a jornada (cloud/guia.js:jornadaInicial): os
     passos com o atual em destaque, mais o portefólio quando há imóveis — em
     vez de quatro indicadores a 0 € e dois gráficos vazios, que não dizem
     nada a quem ainda não registou nada, e em vez do vazio de baixo, que só
     pedia o imóvel. A marca <!--jornada--> diz ao guia que não insira o
     cartão outra vez. A base não conhece a nuvem por garantia: sem a função
     (ou com a jornada dispensada, que a faz devolver '') fica o de sempre.
     A espera do servidor ganha: antes do primeiro estado não se afirma nada. */
  if(!db.transactions.length&&!souSoColaborador()&&typeof jornadaInicial==='function'){
    const jornada=jornadaInicial();
    if(jornada)return esperaDoServidor()||'<!--jornada-->'+jornada+portefolioInicial(m);
  }
  /* o primeiro passo é um imóvel, e o botão é do serviço dos Imóveis: com ele
     desligado nesta conta o botão não se escreve, e a frase diz quem o liga */
  if(!db.properties.length&&!db.transactions.length)
    return esperaDoServidor()||`<div class="empty"><b>Ainda não há nada registado</b>${servicoLigado('properties')?'Começa por adicionar um imóvel'+(podeExemplo()?', ou carrega dados de exemplo':'')+'.':fraseServicoDesligado('properties')}
      <div class="toolbar u-jc-center u-mt-16px">
      ${servicoLigado('properties')?`<button class="btn primary" data-toca="camada" data-click="propModal()">Adicionar imóvel</button>`:''}
      ${podeExemplo()?`<button class="btn" data-toca="dados" data-click="seed()">Carregar exemplo</button>`:''}</div></div>`;
  /* quem só colabora vê primeiro o que o cargo lhe deixa fazer; sem finanças,
     é isso (e as próximas visitas) em vez das contas */
  const podes=cartaoPodes();
  if(souSoColaborador()&&!scope().length)return podes+proximasVisitasColab();
  const nColab=scope().filter(p=>!souDono(p.id)).length;
  const colabHint=nColab?`<div class="hint u-m-n4px-0-12px">Inclui ${nColab} ${nColab===1?'imóvel':'imóveis'} onde és colaborador (valores por inteiro).</div>`:'';
  /* com imóveis e sem movimentos, quando a jornada não é a vista (dispensada,
     ou sem passos por fazer): um vazio que diz porque não há números e leva
     aos Movimentos, mais o portefólio — e não quatro indicadores a 0 € e dois
     gráficos vazios. O «Pede atenção» (os por confirmar e os prazos) fica por
     cima: é o caminho mais curto para o primeiro movimento. A marca
     <!--sem-movimentos--> diz ao dashDepois que não há blocos para personalizar. */
  if(!db.transactions.length&&!souSoColaborador())
    return esperaDoServidor()||'<!--sem-movimentos-->'+colabHint+pedeAtencao()+`<div class="empty u-mb-14px"><b>Ainda não há dados para mostrar</b>Os indicadores e os gráficos da vista geral saem dos movimentos. Regista a primeira renda recebida ou despesa paga.
      ${servicoLigado('transactions')?saida('Ir para os movimentos',"go('transactions')",'ecra'):vazioServicoDesligado('transactions')}</div>`+portefolioInicial(m);
  const inc=monthly(YEAR,pid,'income',true),exp=monthly(YEAR,pid,'expense',true),ln=monthly(YEAR,pid,'loan',true),am=monthly(YEAR,pid,'amort',true);
  let acc=0;const cum=inc.map((v,i)=>acc+=v-exp[i]-ln[i]-am[i]);
  /* Prestações junto ao eixo e despesas por baixo (o canvas): é a ordem dos
     segmentos que faz a legenda e a leitura, e por isso a descida inverte-se
     no cBars (desceAoContrario), não aqui. */
  const groups=inc.map((v,i)=>[{label:'Receita',value:v,color:COR_SERIE.receita},{label:'Despesas',value:-exp[i],color:COR_SERIE.despesa},{label:'Prestações',value:-ln[i],color:COR_SERIE.prestacao}]);
  /* Os dois gráficos mensais acabam no mês corrente (o canvas: «jan · mai ·
     out»), ou no último com movimento quando há datas futuras, que a app
     aceita — o fim da linha do acumulado tem de bater com o Cashflow. Até
     dezembro, a linha seguia por nov e dez ao nível de hoje e a leitura dizia
     «dez −6 358 €», como se fosse um valor registado. */
  const ate=mesesAMostrar([inc,exp,ln,am]),mesesVistos=MES.slice(0,ate);
  /* o mês que a leitura dos gráficos mostra antes de alguém tocar (o canvas:
     «out 2026 · Receita … · Despesas … · Prestações …»): o corrente, ou o
     último antes dele com algum movimento — no dia 1 o mês ainda está vazio */
  const agora=new Date().getMonth();
  let mesLer=agora;while(mesLer>0&&!inc[mesLer]&&!exp[mesLer]&&!ln[mesLer])mesLer--;
  if(!inc[mesLer]&&!exp[mesLer]&&!ln[mesLer])mesLer=agora;
  const amortizacoes=am.map((v,i)=>v>0.005?'Em '+MES[i]+': amortização de '+euro2(v):'').filter(Boolean);
  /* por imóvel: o cashflow (verde o que dá, laranja o que custa) e o que o
     explica quando ele é baixo — uma amortização deste ano, o uso próprio */
  const porImovel=m.props.map(p=>{const mp=metrics(YEAR,p.id,{share:true});
    return {label:p.name,value:mp.cf,color:mp.cf<0?COR_SERIE.despesa:COR_SERIE.receita,am:mp.amort,nome:p.name,proprio:p.use==='proprio'}}).sort((a,b)=>b.value-a.value);
  const notasImovel=porImovel.filter(x=>x.am>0.005).slice(0,2).map(x=>x.nome+' amortizou '+euro(x.am)+' este ano.')
    .concat(porImovel.filter(x=>x.proprio).slice(0,2).map(x=>x.nome+' é de uso próprio.'));
  const act=db.contracts.filter(c=>isActive(c)&&inScope(c.propertyId)&&(!pid||pidProps(pid).some(p=>p.id===c.propertyId)));
  /* a renda de cada contrato em vigor: quem (o nome do contrato, ou os
     inquilinos) e onde (o quarto, ou o imóvel), da maior para a menor */
  const rendas=act.map(c=>{const p=prop(c.propertyId);
    return {label:String(c.name||'').trim()||ctNames(c),sub:c.roomId?roomName(p,c.roomId):(p?p.name:''),value:c.rent,color:COR_SERIE.receita}}).sort((a,b)=>b.value-a.value);
  /* a marca diz que o numero destes cartoes E o do ano corrente — e por isso
     que a variacao face ao ano anterior pode falar deles (vistas.js:kpi).
     O cartão escreve o valor com os cêntimos (euro2, como o canvas: «29 910,00
     €») e a faixa e a janela arredondam («2025: 27 690 €»): o fmtValor diz à
     comparação com que formatador o cartão foi escrito (vistas.js:falaDoMesmo). */
  const E=field=>{const f=()=>Object.assign(evoMoney(field,pid),{fmtValor:euro2});f.anual=true;return f};
  /* Os quatro indicadores do canvas: o rótulo com a bolinha da cor da série,
     o valor a tinta na letra dos títulos, a variação face ao ano anterior (a
     faixa que o pintarSeriesKpi enche) e uma frase curta. O Cashflow é o
     cartão azul-noite (.vg-kpi.cf); a bolinha dele leva a cor da série no tema
     ESCURO, porque o fundo dele é escuro nos dois temas. As Despesas e as
     Prestações são custos (.custo): a variação delas fica neutra, que um
     «▲» verde por cima de despesas que subiram dizia o contrário. */
  /* serie: a cor das linhas da janela (vistas.js:kpiModal), que é a da série
     no tema — no Cashflow difere da bolinha, que é a do tema escuro */
  const kp=(cls,cor,extra,serie)=>({cls:'vg-kpi'+(cls?' '+cls:''),cor,extra:extra||'',serie:serie||cor});
  /* os fluxos com os cêntimos (o canvas: «+5 000,00 € amortizados», «1 455,00
     €/mês»), como o «Total contratado» ao lado; os stocks (valor de mercado,
     dívida, património) ficam ao euro, como no canvas */
  const amortizado=m.amort?`<div class="vg-kpi-extra num">+${euro2(m.amort)} amortizados</div>`:'';
  const portItens=[
    {rot:'Imóveis · contratos ativos',val:m.props.length+' · '+act.length,so:'estreito'},
    {rot:'Imóveis',val:m.props.length,so:'largo'},
    {rot:'Contratos ativos',val:act.length,so:'largo'},
    {rot:'Renda contratada',val:euro2(sum(act.map(c=>c.rent)))+'<span class="small">/mês</span>'},
    {rot:'Renda líquida de impostos (estim.)',val:euro2(sum(act.map(c=>netRent(c))))+'<span class="small">/mês</span>',so:'largo'},
    {rot:'Valor de mercado',val:euro(m.value)},
    {rot:'Valor de aquisição',val:euro(m.purchase),so:'largo'},
    {rot:'Em dívida',val:euro(m.debt)},
    {rot:'Património líquido',val:euro(m.value-m.debt)},
    {rot:'Possíveis mais-valias',val:euro(m.gain),cls:m.gain<0?'neg':'',so:'largo',
      nota:m.gainOut?m.gainOut+(m.gainOut===1?' imóvel sem valor de aquisição':' imóveis sem valor de aquisição'):''}];
  const avaliacao=servicoLigado('reports')?`<button type="button" class="vg-ligacao vg-cab-acao" data-toca="ecra" data-click="go('reports')">Avaliação</button>`:'';
  return podes+proximasVisitasColab()+dashBar()+colabHint+pedeAtencao()+`<div class="grid" role="group" aria-label="Indicadores de ${YEAR}">
    ${kpi('Receita',euro2(m.income),'','O que entrou este ano. Cauções e empréstimos não contam.',WHY.receita,E('income'),null,kp('',COR_SERIE.receita))}
    ${kpi('Despesas',euro2(m.op),'','Impostos, condomínio, seguros e obras. Sem prestações.',WHY.despesas,E('op'),null,kp('custo',COR_SERIE.despesa))}
    ${kpi('Prestações',euro2(m.loan),'','Capital, juros e imposto do selo das prestações.',WHY.prestacoes,E('loan'),null,kp('custo',COR_SERIE.prestacao,amortizado))}
    ${kpi('Cashflow',euro2(m.cf),'','Receita − despesas − prestações − amortizações.',WHY.cashflow,E('cf'),null,kp('cf',COR_SERIE_ESCURO.cashflow,'',COR_SERIE.cashflow))}</div>
  ${pid?'':orphanCard()}
  <div class="cols">
    ${vgCard('Entradas e saídas','mês a mês em '+YEAR,cBars(groups.slice(0,ate),mesesVistos,{h:GRAF_ALTURA,destaque:mesLer,ler:mesLer,fmt:euro2,desceAoContrario:true})+DICA_DEDO)}
    ${vgCard('Cashflow acumulado',esc(amortizacoes.join(' · ')),cLine([{name:'Acumulado',values:cum.slice(0,ate),color:COR_SERIE.cashflow}],mesesVistos,{h:GRAF_ALTURA,ler:agora,titulo:'Cashflow acumulado',lerFmt:euro2}))}</div>
  <div class="cols">
    ${donutCard()}
    ${(!pid||String(pid).startsWith('g:'))&&porImovel.length>1?vgCard('Cashflow por imóvel','',cHBars(porImovel,{fmt:euro2})+(notasImovel.length?`<p class="small vg-nota">${esc(notasImovel.join(' '))}</p>`:'')):''}
    ${vgCard('Renda por contrato','€/mês, em vigor',rendas.length?cHBars(rendas,{fmt:euro2})+`<p class="small vg-nota num">Total contratado: ${euro2(sum(rendas.map(r=>r.value)))}/mês</p>`:'<p class="small">Nenhum contrato em vigor.</p>')}</div>
  <div class="cols">
    ${vgCard(pid?esc(dpName):'Portefólio','',portefolioHtml(portItens)+
      `<p class="small vg-nota vg-so-largo">Mais-valias em bruto: mercado menos aquisição. Ao vender, o que é tributado desconta ainda o IMT e o selo da compra, as obras dos últimos 12 anos e as despesas da venda, e aplica o coeficiente de desvalorização da moeda.</p>`,{acao:avaliacao})}
    ${contasCard(pid)}</div>`;
}
/* «Percorre com o dedo para ler cada mês.» — a dica do canvas do telemóvel por
   baixo das entradas e saídas; só se vê num ecrã de dedo (estilos.css:.vg-dedo) */
const DICA_DEDO='<p class="small vg-nota vg-dedo">Percorre com o dedo para ler cada mês.</p>';
/* A altura dos dois gráficos mensais, em unidades do desenho (que tem 360 de
   largura e escala com o cartão): 150 dá ~150px num telemóvel e ~235px em
   meio ecrã de computador — as alturas do canvas. Com 200 o gráfico do
   computador passava dos 300px e empurrava tudo para baixo. */
const GRAF_ALTURA=150;
/* O cartão da Visão geral: o título num h3 na letra dos títulos (como o
   canvas), a nota curta ao lado e, à direita, uma ação opcional (uma ligação);
   por baixo, o corpo. O .title fica no h3: é por ele que o painel arrumável
   reconhece cada cartão (cloud/painel.js:dashKey).
   Recebe: t — o título (HTML já escapado); s — a nota ('' sem nota, HTML já
   escapado); b — o corpo em HTML; o (opcional) — {id, cls, acao} (acao: o HTML
   do botão da direita).
   Devolve: o HTML do cartão. */
function vgCard(t,s,b,o){
  o=o||{};
  return `<div class="card vg-cartao${o.cls?' '+o.cls:''}"${o.id?` id="${o.id}"`:''}><div class="vg-card-cab"><h3 class="title vg-tit">${t}</h3>${s?`<span class="small">${s}</span>`:''}${o.acao||''}</div>${b}</div>`;
}
/* O corpo do Portefólio: uma grelha de números no computador e linhas no
   telemóvel (o CSS troca, estilos.css:.vg-port), cada número num .stat com o
   rótulo num <span> e o valor num <b> — é pelo .stat que o painel arrumável o
   reconhece (cloud/painel.js:dashKey). Os que o canvas do telemóvel deixa de
   fora levam .vg-so-largo; o que só ele junta (imóveis · contratos), .vg-so-estreito.
   Recebe: itens — [{rot, val (HTML), cls (classe do valor), nota (texto por baixo), so ('largo'|'estreito')}].
   Devolve: o HTML da grelha. */
function portefolioHtml(itens){
  return `<div class="vg-port">${itens.map(x=>`<div class="stat${x.so?' vg-so-'+x.so:''}"><span>${x.rot}</span><b${x.cls?` class="${x.cls}"`:''}>${x.val}</b>${x.nota?`<span class="small vg-port-nota">${esc(x.nota)}</span>`:''}</div>`).join('')}</div>`;
}
/* O «Pede atenção» da Visão geral (o canvas): só o que muda decisões. No
   computador, cartões lado a lado — os por confirmar (planeados.js:pendingCard,
   dos Planeados), os prazos legais e fiscais (prazos.js:prazosCard) e, numa
   coluna, os pedidos por responder (o lugar <!--vg-pedidos-->, que a nuvem
   enche com o cartão dela, cloud/painel.js) e a atividade dos outros nas casas
   partilhadas. No telemóvel, um cartão com uma linha por assunto — «3 por
   confirmar · 1 em atraso · 1 660,00 €», «4 prazos · 1 já passou», «1 pedido
   por responder» — que abre o sino filtrado (notificacoes.js:notifModal). O
   CSS escolhe qual se vê (estilos.css:.vg-atencao). A marca <!--fim-atencao-->
   diz à nuvem onde o bloco acaba. Nada antes de saber o estado
   (espera.js:sabemosOEstado): um prazo ou uma renda já tratados noutro
   aparelho apareciam e sumiam.
   Devolve: o HTML da secção, ou '' quando não há nada a pedir atenção. */
function pedeAtencao(){
  if(!sabemosOEstado())return '';
  const rec=servicoLigado('recurring');
  const conf=rec?recActive():[],pz=prazosAtivos(),ped=notifPedidos();
  /* a atividade só depois de o sino ter marcado a primeira leitura: antes
     disso é o notifPartilha que a marca (e grava), e não a vista */
  const ativ=db.settings.notifLidoAte==null?[]:notifPartilha();
  if(!conf.length&&!pz.length&&!ped.length&&!ativ.length)return '';
  const nl=rec?conf.filter(recIsLate).length:0,total=sum(conf.map(r=>Number((r.tx||{}).amount)||0));
  const passou=pz.filter(p=>p.dias<0),quem=n=>String(n.sub||'').split(' · ')[0];
  const linhas=[
    conf.length?atencaoLinha('confirmar',nl?'red':'','repetir',conf.length+' por confirmar',(nl?nl+' em atraso · ':'')+euro2(total)):'',
    pz.length?atencaoLinha('prazos','amber','clock',pz.length+(pz.length===1?' prazo':' prazos'),
      passou.length?(passou.length===1?'1 já passou':passou.length+' já passaram')+' · '+pzPartes(passou[0]).titulo:pzQuando(pz[0])+' · '+pzPartes(pz[0]).titulo):'',
    ped.length?atencaoLinha('pedidos','','pessoaMais',ped.length+(ped.length===1?' pedido por responder':' pedidos por responder'),ped[0].titulo):'',
    ativ.length?atencaoLinha('','','users',ativ.length+(ativ.length===1?' novidade nas casas partilhadas':' novidades nas casas partilhadas'),quem(ativ[0])+' · '+ativ[0].titulo):''
  ].join('');
  return `<section class="vg-atencao" aria-labelledby="vgAtencaoT">
    <div class="vg-atencao-cab"><h2 id="vgAtencaoT">Pede atenção</h2><span class="small">Só o que muda decisões: atrasos, prazos, pedidos e atividade nova.</span></div>
    <div class="vg-atencao-linhas">${linhas}</div>
    <div class="vg-atencao-grade">${rec?pendingCard():''}${prazosCard()}<div class="vg-atencao-pilha"><!--vg-pedidos-->${atividadeCard(ativ)}</div></div>
  </section><!--fim-atencao-->`;
}
/* Uma linha do «Pede atenção» no telemóvel: o ícone na cor do assunto, o que
   é e quanto, e a seta; tocar abre o sino só com esse assunto.
   Recebe: filtro — o filtro do notifModal ('confirmar', 'prazos', 'pedidos'
   ou '' para tudo); cor — a cor do ícone ('red', 'amber' ou '' para o
   cobalto); icone — o nome do ícone (icones.js:ic); titulo e sub — as duas
   linhas de texto (por escapar).
   Devolve: o HTML do botão (.linha). */
function atencaoLinha(filtro,cor,icone,titulo,sub){
  return `<button type="button" class="linha" data-toca="camada" data-click="notifModal('${filtro}')"><span class="ic${cor?' '+cor:''}">${ic(icone,20)}</span>`+
    `<span class="txt"><b>${esc(titulo)}</b><span class="small">${esc(sub)}</span></span><span class="seta">${ic('chevR',18)}</span></button>`;
}
/* O cartão da atividade dos outros nas casas partilhadas, no «Pede atenção»
   do computador (o canvas: «Pedro Costa registou "Canalização — cozinha"»): as
   três mais recentes, cada uma com as iniciais de quem a fez e a porta para o
   separador dela; «Ver tudo» abre o sino, onde se marcam como lidas.
   Recebe: ativ — a lista do notifPartilha ({titulo, sub, ir}).
   Devolve: o HTML do cartão, ou '' sem atividade. */
function atividadeCard(ativ){
  if(!ativ.length)return '';
  const linha=n=>`<div class="vg-item"><button type="button" class="vg-item-abrir" data-toca="ecra" data-click="${n.ir}"><span class="avatar">${esc(initials(String(n.sub||'').split(' · ')[0]||'?'))}</span>`+
    `<span class="vg-item-txt"><b>${esc(n.titulo)}</b><span class="small">${esc(n.sub)}</span></span></button></div>`;
  return vgCard('Atividade nas casas partilhadas','',`<div class="vg-itens">${ativ.slice(0,3).map(linha).join('')}</div>`,
    {cls:'vg-atividade',acao:`<button type="button" class="vg-ligacao vg-cab-acao" data-toca="camada" data-click="notifModal('')">Ver tudo</button>`});
}
/* O cartão do portefólio da jornada: o de baixo reduzido ao que tem números
   antes do primeiro movimento — os imóveis, o valor de mercado, o de
   aquisição, a dívida e o património líquido. Os contratos ativos, a renda
   contratada, as mais-valias e a nota fiscal ficam de fora: sem movimentos
   são zeros e frases sobre zeros. Sem imóveis em foco não há cartão nenhum.
   Recebe: m — as métricas do ano (metrics).
   Devolve: string HTML do cartão, ou vazia sem imóveis. */
function portefolioInicial(m){
  if(!m.props.length)return '';
  /* o cartão genérico (vistas.js:card), e não o vgCard: a jornada é da folha
     dos primeiros passos e o teste dela lê o título como sempre foi; o corpo é
     a mesma grelha de números do Portefólio da vista cheia */
  return card('Portefólio','',portefolioHtml([
    {rot:'Imóveis',val:m.props.length},
    {rot:'Valor de mercado',val:euro(m.value)},
    {rot:'Valor de aquisição',val:euro(m.purchase)},
    {rot:'Em dívida',val:euro(m.debt)},
    {rot:'Património líquido',val:euro(m.value-m.debt)}]));
}
/* O cartão «O que podes fazer», no topo da vista geral de quem só colabora:
   quem acabou de aceitar um convite tem de ver logo o que o cargo lhe deixa
   fazer, sem abrir a gaveta. Um botão por ação (acessos.js:acoesDoColaborador),
   o primeiro primário. Sem finanças, diz porque não há contas e leva aos
   imóveis. O comentário no fim marca onde o cartão acaba: é lá que o guia
   (cloud/guia.js) pendura os primeiros passos, depois deste.
   Devolve: o HTML do cartão, ou '' a quem tem imóveis seus. */
function cartaoPodes(){
  if(!souSoColaborador())return '';
  const acoes=acoesDoColaborador(),semFin=!scope().length,imoveis=servicoLigado('properties');
  const botoes=acoes.map((a,i)=>`<button type="button" class="btn${i?'':' primary'}" data-toca="${a.toca}" data-click="${a.act}">${ic(a.icon,16)} ${esc(a.rotulo)}</button>`).join('');
  return `<div class="card u-mb-14px" id="colabPodes"><div class="title">O que podes fazer</div>
    <div class="small">${fraseColaborador()}</div>
    ${acoes.length?`<div class="colab-acoes u-mt-12px">${botoes}</div>`:'<div class="hint u-mt-10px">O teu cargo deixa-te consultar estes imóveis, sem adicionar nada.</div>'}
    ${semFin?'<div class="hint u-mt-12px">As finanças destes imóveis ficam com o dono: o teu cargo não as abre, e por isso aqui não há contas.</div>':''}
    ${semFin&&imoveis?`<div class="toolbar u-mt-10px"><button type="button" class="btn${acoes.length?'':' primary'}" data-toca="ecra" data-click="go('properties')">${ic('building',16)} Ver os imóveis</button></div>`:''}<!--fim-podes--></div>`;
}
/* As próximas visitas (até 3) de quem só colabora e vê visitas, com a porta
   para a lista toda. Sem visitas por vir, nada.
   Devolve: o HTML do cartão, ou ''. */
function proximasVisitasColab(){
  if(!souSoColaborador()||!servicoLigado('visits')||!casasComo('visit.view').length)return '';
  const fut=visOrdenadas().filter(v=>!visPassada(v)&&v.estado!=='cancelada');
  if(!fut.length)return '';
  return `<div class="card u-mb-14px"><div class="row-between u-ai-center"><div class="title">Próximas visitas</div>
      <button type="button" class="btn sm" data-toca="ecra" data-click="go('visits')">Ver todas</button></div>
    <div class="list u-g-8px u-mt-12px">${fut.slice(0,3).map(visCard).join('')}</div></div>`;
}
/* donut das despesas: tocar numa categoria mostra as suas subcategorias */
let donutCat='';
/* O cartão do donut: as categorias ao nível de topo, com o total do ano ao
   centro e a legenda ao lado (o canvas: «6 312 € · 2026»), ou as
   subcategorias de donutCat, com o «Voltar» no canto.
   Recebe: nada (lê donutCat e o imóvel em foco, dashProp).
   Devolve: string HTML do cartão. */
function donutCard(){
  const items=byCategory(YEAR,dashProp||null,true,donutCat||null);
  const voltar=donutCat?`<button type="button" class="btn sm vg-cab-acao" data-toca="vista" data-click="donutDrill('')">${ic('chev',14)} Voltar</button>`:'';
  return vgCard(donutCat?esc(donutCat):'Despesas por categoria',donutCat?'subcategorias em '+YEAR:'',
    cDonut(items,{sub:donutCat?'total da categoria':String(YEAR),onPick:donutCat?'':'donutDrill'})+
    (donutCat||!items.length?'':'<p class="small vg-nota">Toca numa categoria para veres as subcategorias.</p>'),{id:'donutCard',acao:voltar});
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
/* despesas sem imóvel atribuído: contam no total mas não aparecem em nenhuma avaliação.
   Uma de «Todos os imóveis» ainda por partir (o arranque parte-a) é de todos, não de nenhum.
   Recebe: y — o ano a filtrar (número ou texto de 4 dígitos).
   Devolve: array dos movimentos de despesa desse ano sem imóvel, sem grupo e sem «Todos». */
function orphanExpenses(y){
  return db.transactions.filter(t=>t.kind==='expense'&&!t.propertyId&&!t.groupId&&!t.todos&&String(t.date||'').startsWith(String(y)));
}
/* O atalho do aviso das despesas sem imóvel: vai aos Movimentos e, já lá,
   filtra pelos que não têm imóvel. A espera de zero é a de sempre — o filtro
   põe-se depois de o go() ter trocado de vista, senão o render dele apagava-o.
   Era um onclick com uma seta e uma atribuição, que a gramática das ações não
   tem (.unlazy/csp/CONTRATO.md).
   Recebe: nada.
   Devolve: nada — muda para os Movimentos e filtra-os. */
function dashVerSemImovel(){go('transactions');setTimeout(()=>{txProp='__none__';render()},0)}
/* aviso das despesas sem imóvel na visão geral (o canvas: a faixa âmbar logo
   a seguir aos indicadores): quantas, quanto, porque é que os totais divergem
   da Avaliação, e o atalho para as ver nos movimentos. Ocupa a largura toda
   (.vg-cheia) e diz ao painel arrumável a chave de sempre (data-bloco), a do
   antigo cartão «Despesas sem imóvel» — uma ordem guardada não o perde.
   Escondido quando não há órfãs — e com o serviço
   dos Movimentos desligado nesta conta, que é para lá que o atalho leva.
   Devolve: string HTML do aviso, ou vazia quando não se aplica. */
function orphanCard(){
  if(!servicoLigado('transactions'))return '';
  const o=orphanExpenses(YEAR);if(!o.length)return '';
  const uma=o.length===1;
  return `<div class="card vg-aviso vg-cheia" role="note" data-bloco="card:Despesas sem imóvel"><span class="vg-aviso-ic">${ic('aviso',20)}</span>
    <p><strong class="num">${o.length} despesa${uma?'':'s'} de ${YEAR} sem imóvel · ${euro2(sum(o.map(x=>x.amount)))}.</strong> ${uma?'Conta aqui, mas não na Avaliação: não está atribuída':'Contam aqui, mas não na Avaliação: não estão atribuídas'} a nenhum imóvel, e é por isso que os totais divergem.</p>
    <button type="button" class="vg-ligacao" data-toca="ecra" data-click="dashVerSemImovel()">Ver movimentos sem imóvel</button></div>`;
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
   o botão de personalizar, que é da base. Na jornada e no vazio sem
   movimentos (as marcas <!--jornada--> e <!--sem-movimentos--> de
   vDashboard) não há blocos para arrumar, e um botão que entra num modo
   de edição sem nada para arrastar é um beco: não se escreve; o FAB fica,
   que registar o primeiro movimento é precisamente o passo seguinte.
   Devolve: nada — acrescenta o botão e o FAB ao #view quando fazem sentido. */
function dashDepois(){
  if(view().querySelector('#dashPersonalizar')||!(podeSemImovel()||casasComo('tx.add').length))return;
  const novoTx=servicoLigado('transactions')?fab([{act:'newTxPick()',label:'Novo movimento'}])+'<div class="fabpad"></div>':'';
  const h=view().innerHTML;
  const arrumar=h.indexOf('<!--jornada-->')>-1||h.indexOf('<!--sem-movimentos-->')>-1?'':'<button type="button" class="btn sm" data-toca="modo" data-click="dashPersonalizarPainel()">'+ic('grip',13)+' Personalizar painel</button>';
  view().insertAdjacentHTML('beforeend',
    '<div id="dashPersonalizar" class="u-ta-center u-m-2px-0-0">'+arrumar+'</div>'+novoTx);
}
// nº de filtros ativos no painel de análise da visão geral: o imóvel em foco
// Devolve: número de filtros ativos (0 ou 1).
function dashAnaN(){return dashProp?1:0}
// limpa o imóvel em foco da visão geral (vistas.js:anaClear chama-o)
// Devolve: nada — limpa o filtro; quem chama repinta.
function dashAnaLimpar(){dashProp=''}
// ao mudar de separador, o donut aberto fecha-se: era o go() que o fazia, e o go() não nomeia serviços
// Devolve: nada — só o estado.
function dashAoMudar(){donutCat=''}
registarServico({id:'dashboard',vistas:{dashboard:'vDashboard'},depois:{dashboard:'dashDepois'},analise:{dashboard:{n:'dashAnaN',limpar:'dashAnaLimpar'}},aoMudar:'dashAoMudar'});
