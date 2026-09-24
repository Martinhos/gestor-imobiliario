/* ================= MOVIMENTOS, A LISTA (serviço transactions) ================= */
/* A lista dos movimentos com motor próprio (lista.js), os filtros e a
   pesquisa, o cartão dos credores e o menu de toque longo de um movimento. A
   ficha está em movimento.js. Veio de vistas.js e de componentes.js:lpMenu
   quando a app passou a serviços; regista-se no fim. */
/* Os filtros dos movimentos abrem um painel, como todos os outros. Abriam uma
   janela por cima de tudo — eram os únicos —, e uma janela esconde a lista
   que se está a filtrar, que é precisamente o que se quer ver a mudar
   enquanto se mexe nos filtros. */
let txFiltAberto=false;
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
  return deacc([t.label,t.notes,t.category,t.sub,(t.tags||[]).join(' '),t.creditor,t.date,dPT(t.date),
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
  _qT=setTimeout(()=>{txSearch=v;refrescarMovimentos();
    const i=document.getElementById('tx_q');
    if(i){i.focus();try{i.setSelectionRange(i.value.length,i.value.length)}catch(e){}}},280);
}
/* O ✕ da pesquisa dos movimentos aparece com o campo escrito e some com ele
   vazio. Era um estilo em linha (display) no atributo, e o estado inicial
   passou a ser a classe u-d-none: é a classe que se troca, senão o campo limpo
   continuava a mostrar o ✕ (ou o contrário).
   Recebe: campo — o campo da pesquisa (#tx_q).
   Devolve: nada — põe ou tira a classe no ✕ ao lado. */
function txqMostrarLimpar(campo){campo.nextElementSibling.classList.toggle('u-d-none',!campo.value)}
/* O ✕ da pesquisa dos movimentos: esvazia o campo, refaz a lista sem pesquisa,
   esconde-se e devolve o foco ao campo. Era tudo no atributo, a começar por um
   const, que a gramática das ações não tem. Faz o mesmo e pela mesma ordem.
   Recebe: botao — o próprio ✕.
   Devolve: nada — limpa a pesquisa e agenda o redesenho (onTxSearch). */
function txqLimpar(botao){
  const i=botao.previousElementSibling;
  i.value='';
  onTxSearch('');
  botao.classList.add('u-d-none');
  i.focus();
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
  if(txDe||txAte)p.push(txDe&&txAte?dPT(txDe)+' → '+dPT(txAte):txDe?'desde '+dPT(txDe):'até '+dPT(txAte));
  if(txFilter)p.push(nomeDoTipo(txFilter));
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
  const pid=txProp&&txProp!=='__none__'?txProp:null;
  /* pagar crédito abate capital na ficha do imóvel: sem «Editar a ficha» diz-se antes de abrir o formulário */
  if(kind==='loan'&&pid){const rc=motivoCredito(pid);if(rc)return toast(rc)}
  const daArvore=treeKey(kind)===(cat in catsIn()&&!(cat in cats())?'catsIn':'cats');
  txModal({kind:kind||'income',propId:pid,preset:{paidBy:txPaid||null,category:daArvore?cat:'',sub:daArvore?sub:''}});
}
/* "Novo movimento": primeiro o tipo, num menu
   Recebe: after (opcional) — função chamada com o tipo escolhido, em vez do fluxo normal; sem ela segue
   para newTxFromFilters e o menu inclui a opção "a partir de um modelo".
   Devolve: nada — abre o menu de escolha. */
function newTxPick(after){
  const items=TX_TYPES.map(([k,i,l,sb])=>({v:k,label:l,sub:sb,icon:i}));
  /* os modelos são dos Planeados: sem esse serviço nesta conta, a opção não se oferece */
  if(!after&&servicoLigado('recurring'))items.push({v:'__tpl__',label:'A partir de um modelo…',sub:(db.templates||[]).length?'copia um movimento guardado':'ainda não há modelos: cria o primeiro',icon:'file'});
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
    o=>{chamarServico('recurring','newFromTemplate',o.v)},
    `<button type="button" class="btn u-w-100pc u-jc-center" data-toca="camada" data-click="newTplForTx()">${ic('plus',15)} Criar modelo novo</button>
     <div class="hint u-mt-8px">Ao guardar, o modelo fica criado e o movimento é registado. Os modelos gerem-se em Finanças → Planeados.</div>`);
}
/* criar um modelo a meio de “novo movimento”: guarda o modelo E regista o movimento
   Devolve: nada — abre o fluxo do modelo novo. */
function newTplForTx(){
  newTxPick(k=>txModal({kind:k,modo:'tpl',alsoTx:true}));
}
/* os filtros vivem numa janela por cima da lista: mudar um filtro atualiza a lista e a própria janela
   Devolve: nada — redesenha a vista e, se estiver aberto, o modal de filtros. */
function txRerender(){
  refrescarMovimentos();
  /* o painel repinta-se no sítio, para os seletores dependentes (a
     subcategoria depende da categoria) acompanharem sem fechar nada */
  const p=document.getElementById('txFpanel');
  if(p&&txFiltAberto){const c=p.querySelector('.card');
    if(c)c.innerHTML=txFilterBody()+`<div class="toolbar u-m-12px-0-0">${txFilterFoot()}</div>`}
}
/* corpo do modal de filtros dos movimentos: pesquisa, tipo, imóvel,
   categoria/subcategoria, pessoas, datas e ordenação. Cada controlo aplica
   logo (handlers onTx*), e no fim mostra o resumo e quantos movimentos passam.
   Devolve: string HTML do corpo do modal. */
function txFilterBody(){
  const kinds=[['','Todos os tipos'],['income','Receitas'],['expense','Despesas'],['loan','Pagamentos de crédito'],
    ['debt','Dívidas (recebidas e pagas)'],['owed','Dívidas recebidas'],['repay','Dívidas pagas'],['settle','Transferências entre proprietários']];
  const props=[{v:'',label:'Todos os imóveis'},{v:'__none__',label:'Sem imóvel atribuído'}].concat(scope().map(p=>({v:p.id,label:p.name}))).concat(gdiv(gOpts('prop')));
  const payers=[{v:'',label:'Qualquer proprietário'}].concat(db.owners.map(o=>({v:o.id,label:o.name})));
  const owners=[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner')));
  const tree=allCats(txFilter==='debt'?'expense':txFilter),catOpts=[{v:'',label:'Todas as categorias'},{v:'__none__',label:'Sem categoria'}].concat(Object.keys(tree).map(c=>({v:c,label:c})));
  const subsF=txCat&&txCat!=='__none__'?(tree[txCat]||[]):[];
  const subOpts=[{v:'',label:'Todas as subcategorias'},{v:'__none__',label:'Sem subcategoria'}].concat(subsF.map(x=>({v:x,label:x})));
  return `<div class="form">
    ${fcSelector()}
    <div class="qwrap"><input id="tx_q" class="txq" type="search" value="${esc(txSearch)}" placeholder="Pesquisar…" autocomplete="off"
      data-input="onTxSearch(this.value);txqMostrarLimpar(this)">
      <button class="qclear${txSearch?'':' u-d-none'}" data-toca="vista" data-click="txqLimpar(this)">✕</button></div>
    <label>Tipo${sel('txKind',txFilter,kinds.map(k=>({v:k[0],label:k[1]})),'onTxFilter','vista')}</label>
    ${servicoLigado('properties')?`<label>Imóvel${sel('txPropF',txProp,props,'onTxProp','vista')}</label>`:''}
    <div class="row"><label>Categoria${sel('txCatF',txCat,catOpts,'onTxCat','vista')}</label>
      ${txCat&&txCat!=='__none__'?`<label>Subcategoria${sel('txSubF',txSub,subOpts,'onTxSub','vista')}</label>`:''}</div>
    ${db.owners.length&&servicoLigado('owners')?`<label>Proprietário${sel('txOwnerF',ownerFilter,owners,'onTxOwner','vista')}</label>
    <label>Pago / recebido por${sel('txPaidF',txPaid,payers,'onTxPaid','vista')}</label>
    <label class="check"><input type="checkbox" id="txNoPayer" ${txNoPayer?'checked':''} data-change="onTxNoPayer()"> Incluir movimentos sem pessoa atribuída</label>`:''}
    <div class="row lado-a-lado"><label>De<input id="txDeF" type="date" value="${txDe}" data-change="onTxDatas()"></label>
      <label>Até<input id="txAteF" type="date" value="${txAte}" data-change="onTxDatas()"></label></div>
    <div class="row"><label>Ordenar por${sel('txSortF',txSort,[{v:'date',label:'Data'},{v:'amount',label:'Valor'}],'onTxSort','vista')}</label>
      <label>Ordem${sel('txDirF',txDir,[{v:'desc',label:'Descendente'},{v:'asc',label:'Ascendente'}],'onTxDir','vista')}</label></div>
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
function txFilterFoot(){return `${txFilterCount()?`<button class="btn" data-toca="vista" data-click="clearTxFilters()">${ic('x',15)} Limpar</button>`:''}<button class="btn primary" data-toca="camada" data-click="txFilterFechar()">${ic('check',15)} Fechar</button>`}
// abre o modal de filtros dos movimentos
// Devolve: nada — abre o modal.
/* O painel de filtros dos movimentos, ancorado ao botão do cabeçalho — o
   mesmo .fwrap/.fpanel das outras listas.
   Devolve: o HTML do painel, ou vazio quando está fechado. */
function txFilterPainel(){
  return `<div class="fwrap u-h-0"><div class="fpanel ${txFiltAberto?'on':''} u-t-0" id="txFpanel">
    <div class="card u-p-12px">${txFilterBody()}
      <div class="toolbar u-m-12px-0-0">${txFilterFoot()}</div></div></div></div>`;
}
// fecha o painel de filtros dos movimentos (os filtros aplicam-se logo ao mexer)
// Devolve: nada — fecha o painel e redesenha a vista.
function txFilterFechar(){txFiltAberto=false;closePops();render()}
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
/* O «Pagar» do cartão das dívidas a terceiros: abre o formulário de uma dívida
   paga, já com o imóvel, a pessoa e o que falta devolver. Era um objeto
   literal escrito no atributo, que a gramática das ações não tem; faz o mesmo,
   com os mesmos valores.
   Recebe: propId — o id do imóvel (null quando a linha não é de um imóvel);
   credor — o nome da pessoa (vazio na linha dos sem nome); valor — o que falta
   devolver (número em euros).
   Devolve: nada — abre o modal do movimento. */
function pagarCredor(propId,credor,valor){
  txModal({kind:'repay',propId:propId,preset:{creditor:credor,amount:valor}});
}
/* dívidas a terceiros: recebido, devolvido e o que falta, com botão para pagar
   Recebe: pid — id do imóvel a que limitar, ou null/vazio para todo o âmbito.
   Devolve: string HTML do cartão, ou vazia se não há dívidas registadas. */
function creditorsCard(pid){
  const rows=creditorBalances(pid);if(!rows.length)return '';
  const due=sum(rows.map(r=>r.due));
  return `<div class="cols"><div class="card">
    <div class="row-between"><div><div class="title">Dívidas a terceiros</div>
      <div class="small">${due>0.005?euro2(due)+' por devolver':'Tudo devolvido'}</div></div>${ic('users',22)}</div>
    <div class="u-mt-10px">
      ${rows.map(r=>`<div class="stat u-ai-center"><span class="u-minw-0"><b>${esc(r.creditor)}</b>${r.propertyId?` <span class="small">· ${esc(propName(r.propertyId))}</span>`:''}
          <div class="small">recebido ${euro2(r.received)} · devolvido ${euro2(r.repaid)}</div></span>
        <span class="u-d-flex u-ai-center u-g-8px u-fx-0-0-auto"><b class="${r.due>0.005?'neg':'pos'}">${r.due>0.005?euro2(r.due):'liquidado'}</b>
          ${r.due>0.005?`<button class="btn sm" data-toca="camada" data-click="${stop}pagarCredor(${r.propertyId?`'${jsq(r.propertyId)}'`:'null'},'${jsq(r.creditor==='—'?'':r.creditor)}',${r.due})">Pagar</button>`:''}</span></div>`).join('')}
    </div></div></div>`;
}
/* Quantas linhas a última pintura dos Movimentos desenhou. A camada da nuvem
   lê-a para saber se ainda há alguma coisa para marcar (cloud/selecao.js):
   antes contava as linhas no HTML já parseado, e agora não há HTML parseado. */
let txLinhasPintadas=0;
/* O que a camada da nuvem tem a acrescentar a UMA linha de movimento. Por
   omissão, nada — quem a substitui é cloud/selecao.js.

   Existe por uma razão medida: a nuvem decorava as linhas pegando na vista
   inteira já gerada, metendo-a num <div> avulso, mexendo-lhe linha a linha e
   serializando-a de volta. Com 500 movimentos isso custava 42 dos 58 ms de
   cada repintura — dentro E fora do modo de seleção — e era a razão pela qual
   nenhuma repintura parcial podia ser segura: quem repintasse uma linha
   sozinha nascia sem as decorações e ninguém dava por isso.

   ATENÇÃO ao attrs: não pode trazer um class. O template já escreve o seu — e
   nele vão os utilitários que eram o style= —, e com dois atributos iguais o
   parser fica com o PRIMEIRO; por isso o attrs entra depois, para que um class
   que venha por engano seja ignorado em vez de apagar o do template. Quem
   precisar mesmo de classes, use o cls.

   Recebe: t — o movimento desta linha; mes — o 'AAAA-MM' do bloco onde entra.
   Devolve: {attrs,cls,onclick,caixa,acoes} — attrs são atributos extra da
   linha, cls classes extra, onclick substitui o da linha se não for vazio,
   caixa é HTML colado no início da linha e acoes HTML colado no fim da coluna
   direita. Tudo opcional; o vazio devolve um objeto sem nada. */
function txLinhaExtra(t,mes){return {}}
/* O mesmo para o título de um mês, que em modo de seleção ganha caixa própria.
   Vale aqui o mesmo aviso do attrs sem class — e aqui doía mais, porque é no
   class do título que vive o display:flex que põe o saldo do mês à direita.
   Recebe: mes — o mês em 'AAAA-MM'.
   Devolve: {attrs,cls,caixa} — atributos e classes extra do título, e HTML a
   colar antes do nome do mês. Tudo opcional. */
function txMesExtra(mes){return {}}
/* Movimentos: KPIs do filtro atual (com evolução ao toque), saldos entre
   proprietários, dívidas a terceiros e a lista agrupada por mês com o saldo
   de cada um. Tudo respeita os filtros e a ordenação escolhidos no modal.
   Devolve: string com o HTML completo da vista. */
function vTransactions(){
  const nF=txFilterCount();
  const head=txFilterPainel()
  +`${nF||txSearch.trim()?`<div class="small u-m-2px-0-10px">${filterSummary()}${txSearch.trim()?(nF?' · ':'')+'pesquisa: “'+esc(txSearch.trim())+'”':''}</div>`:''}`
  +((podeSemImovel()||casasComo('tx.add').length)?fab([{label:'Novo movimento',act:'newTxPick()'}]):'');
  txLinhasPintadas=0;
  if(!db.transactions.length)return head+(esperaDoServidor()||`<div class="empty"><b>Sem movimentos</b>Regista a primeira renda recebida ou despesa paga.</div>`);
  const list=db.transactions.filter(txMatch).sort((a,b)=>{const d=txDir==='desc'?-1:1;
    if(txSort==='amount')return d*((a.amount||0)-(b.amount||0))||String(a.date).localeCompare(String(b.date));
    return d*String(a.date).localeCompare(String(b.date))});
  if(!list.length)return head+vazioFiltro()
    +balancesCard(txProp||null);   /* pode não haver movimentos e haver contas por acertar */
  txLinhasPintadas=list.length;
  const tot={income:0,expense:0,loan:0,owed:0,repay:0,settle:0};list.forEach(t=>{if(countsInTotals(t))tot[t.kind]=(tot[t.kind]||0)+t.amount});
  const saldo=tot.income+tot.owed-tot.expense-tot.loan-tot.repay;
  const evoTx=k=>()=>{
    const L=db.transactions.filter(txMatch).filter(countsInTotals),f=t=>k==='saldo'?(isIn(t.kind)?t.amount:isOut(t.kind)?-t.amount:0):(t.kind===k?t.amount:0);
    const ys={};ys[YEAR]=1;L.forEach(t=>{const y=Number(String(t.date).slice(0,4));if(y)ys[y]=1});
    return {fmt:euro,monthly:[...Array(12)].map((_,i)=>sum(L.filter(t=>String(t.date).startsWith(`${YEAR}-${String(i+1).padStart(2,'0')}`)).map(f))),
      yearly:Object.keys(ys).map(Number).sort().map(y=>({label:y,value:sum(L.filter(t=>String(t.date).startsWith(String(y))).map(f))}))};
  };
  /* cada cartão leva a sua lista: abrir o indicador e ficar a ver só esse tipo é
     o caminho que se fazia à mão pelo modal de filtros. O Saldo é a volta atrás. */
  const ver=(k,rot)=>({label:rot,act:`txVerTipo('${k}')`});
  const jaSo=k=>txFilter===k;
  const resumo=`<div class="grid u-mb-4px">
    ${kpi('Receitas',euro(tot.income),'pos','no filtro atual','Soma das receitas dos movimentos que passam no filtro.',evoTx('income'),jaSo('income')?null:ver('income','Ver só as receitas'))}
    ${kpi('Despesas',euro(tot.expense),'neg','no filtro atual','Soma das despesas dos movimentos que passam no filtro.',evoTx('expense'),jaSo('expense')?null:ver('expense','Ver só as despesas'))}
    ${kpi('Prestações',euro(tot.loan),'amber','no filtro atual','Prestações do crédito dos movimentos que passam no filtro.',evoTx('loan'),jaSo('loan')?null:ver('loan','Ver só as prestações'))}
    ${tot.owed?kpi('Dívidas recebidas',euro(tot.owed),'amber','de terceiros','Dinheiro recebido de terceiros.',evoTx('owed'),jaSo('owed')?null:ver('owed','Ver só as dívidas recebidas')):''}
    ${tot.repay?kpi('Dívidas pagas',euro(tot.repay),'neg','a terceiros','Devoluções a terceiros.',evoTx('repay'),jaSo('repay')?null:ver('repay','Ver só as dívidas pagas')):''}
    ${kpi('Saldo',euro(saldo),saldo>=0?'pos':'neg',list.length+' movimentos','Entradas menos saídas dos movimentos que passam no filtro.',evoTx('saldo'),txFilter?ver('','Ver todos os tipos'):null)}</div>`;
  txLista=list;
  return head+resumo+balancesCard(txProp||null)+creditorsCard(txProp&&txProp!=='__none__'?txProp:null)
    +`<div id="txLista"></div>`;
}
/* Os movimentos que a última pintura da vista escolheu, para a lista se poder
   repintar sozinha sem voltar a filtrar e a ordenar tudo. */
let txLista=[];
/* Quem pagou (ou recebeu) e como se dividiu, na linha de um movimento.
   Recebe: t — o movimento.
   Devolve: HTML da linha pequena, ou '' quando nao ha pagador. */
function txQuem(t){
  if(t.kind==='settle')return `<div class="small"><b>${esc((owner(t.paidBy)||{}).name||'?')}</b> \u2192 <b>${esc((owner(t.toId)||{}).name||'?')}</b></div>`;
  if(!(t.paidBy&&owner(t.paidBy)))return '';
  return `<div class="small">${isIn(t.kind)?'Recebido por':'Pago por'} <b>${esc(owner(t.paidBy).name)}</b>${splitLabel(t)?' \u00b7 dividido '+splitLabel(t):''}</div>`;
}
/* O HTML de UMA linha de movimento. Esta a parte porque e a peca que a lista
   viva compara consigo propria: o texto que sai daqui e a assinatura da linha
   (lista.js), e e por ele que se sabe se ha alguma coisa a refazer.
   Recebe: t — o movimento; mo — o mes 'AAAA-MM' do bloco onde a linha entra.
   Devolve: o HTML da linha (string). */
function txLinhaHtml(t,mo){
  const k=KIND[t.kind]||KIND.expense,c=t.contractId?contract(t.contractId):null;
  const x=txLinhaExtra(t,mo)||{};
  return `<div class="card tap txrow${x.cls?' '+x.cls:''} u-p-13px-15px" data-lp="tx:${esc(t.id)}" data-fk="tx:${esc(t.id)}" ${x.attrs||''} data-toca="camada" data-click="${x.onclick||`txView('${jsq(t.id)}')`}"><div class="row-between">
    ${x.caixa||''}<div class="u-minw-0"><div class="title u-fs-14p5px">${esc(t.label)}</div>
      <div class="small">${dPT(t.date)} \u00b7 ${k.short}${t.category?' \u00b7 '+esc(t.category)+(t.sub?' / '+esc(t.sub):''):''}${t.propertyId?' \u00b7 '+esc(propName(t.propertyId)):''}${t.creditor?' \u00b7 '+esc(t.creditor):''}</div>
      ${c?`<div class="small">${ic('contract',12)} ${esc(ctName(c))}</div>`:''}
      ${txQuem(t)}
      ${t.kind==='loan'&&(t.principal||t.interest||t.fee)?`<div class="small">${t.payType==='amortizacao'?`Amortiza\u00e7\u00e3o \u00b7 capital ${euro2(t.principal||0)} \u00b7 comiss\u00e3o ${euro2(t.fee||0)}`:`Capital ${euro2(t.principal||0)} \u00b7 juros ${euro2(t.interest||0)} \u00b7 selo ${euro2(t.stamp||0)}`}</div>`:''}
      ${(!countsInTotals(t)||(t.tags||[]).length)?`<div class="chips">${countsInTotals(t)?'':'<span class="badge grey">fora dos totais</span>'}${(t.tags||[]).map(g=>`<span class="badge grey">${esc(g)}</span>`).join('')}</div>`:''}</div>
    <div class="u-ta-right u-fx-0-0-auto"><div class="${k.color}${t.kind==='settle'?' u-c-v-muted':''} u-fw-750">${k.sign}${euro2(t.amount)}</div>
      ${t.notes?`<div class="small u-mt-3px" title="Tem coment\u00e1rios">${ic('pen',12)}</div>`:''}${x.acoes||''}</div>
  </div></div>`;
}
// "set 2026" a partir de uma data AAAA-MM-DD (ou AAAA-MM), para os títulos dos
// meses e as perguntas. Vive aqui, e não nos Planeados, porque a lista e a
// ficha dos movimentos precisam dele sem os Planeados carregados.
// Recebe: iso — data AAAA-MM-DD ou AAAA-MM (texto).
// Devolve: o mês abreviado e o ano (texto), ex.: "set 2026".
const mesPt=iso=>(MES[Number(String(iso).slice(5,7))-1]||'')+' '+String(iso).slice(0,4);
/* O bloco de um mes: o titulo, e a caixa das linhas VAZIA — quem a enche e o
   pintarListaTx, para as linhas serem comparadas uma a uma em vez de o mes
   inteiro ser refeito por causa de uma.

   O saldo do mes NAO vem aqui, e a razao e a mesma: medido, com o saldo dentro
   da assinatura, filtrar refazia tres meses inteiros e recriava as 63 linhas
   que sobravam, com zero nos reaproveitados — porque o numero muda com o
   filtro e o texto do bloco deixava de bater certo. Fica um <span> vazio, que
   o pintarListaTx enche depois de reconciliar.
   Recebe: mo — o mes 'AAAA-MM'.
   Devolve: o HTML do bloco (string). */
function txMesHtml(mo){
  const xm=txMesExtra(mo)||{};
  return `<div class="txmes"><div class="section-title${xm.cls?' '+xm.cls:''} u-d-flex u-jc-space-between u-tt-none" ${xm.attrs||''}>
    ${xm.caixa||''}<span>${esc(mesPt(mo))}</span><span class="txnet"></span></div>
    <div class="list"></div></div>`;
}
/* Enche (ou acerta) a lista dos movimentos dentro do #txLista, mexendo so no
   que mudou. Dois niveis: os meses, e as linhas de cada mes — assim uma linha
   que muda nao obriga a refazer o mes, e um mes que desaparece leva as linhas
   dele sem as comparar uma a uma.
   Devolve: {meses,linhas} — o que aconteceu em cada nivel (lista.js diz o
   formato), ou null se nao estamos na vista dos movimentos. */
function pintarListaTx(){
  const alvo=document.getElementById('txLista');if(!alvo)return null;
  const by={};txLista.forEach(t=>{const k=String(t.date).slice(0,7);(by[k]=by[k]||[]).push(t)});
  const meses=Object.keys(by);
  const cMes=reconciliar(alvo,meses.map(mo=>({chave:'mes:'+mo,html:txMesHtml(mo)})));
  const cLin={mantidas:0,refeitas:0,criadas:0,movidas:0,removidas:0};
  meses.forEach(mo=>{
    const bl=alvo.querySelector('[data-chave="mes:'+mo+'"]');if(!bl)return;
    const c=reconciliar(bl.querySelector('.list'),by[mo].map(t=>({chave:'tx:'+t.id,html:txLinhaHtml(t,mo)})));
    Object.keys(cLin).forEach(k=>cLin[k]+=c[k]);
    /* o saldo do mes escreve-se aqui, e nao na assinatura do bloco */
    const net=sum(by[mo].map(t=>!countsInTotals(t)?0:isIn(t.kind)?t.amount:(isOut(t.kind)?-t.amount:0)));
    const sp=bl.querySelector('.txnet');
    if(sp){sp.textContent=euro(net);sp.className='txnet '+(net>=0?'pos':'neg')}
  });
  tornarFocavel(alvo);
  /* as marcas da selecao vivem no DOM, e as linhas refeitas nasceram sem elas */
  try{if(window.CW&&CW.selMode&&CW.selPintar)CW.selPintar()}catch(e){}
  return {meses:cMes,linhas:cLin};
}
/* Repinta so o que a lista dos movimentos precisa: a moldura (indicadores,
   saldos e dividas, que sao cem nos e nao custam nada) e a lista, linha a
   linha. Nao passa pelo render — e esse o ponto.

   Serve os caminhos que so mexem no que se ve e nao no ecra em que se esta:
   escrever na pesquisa, mudar um filtro, trocar a ordenacao. Fora da vista dos
   movimentos, ou se a moldura ainda nao existe, cai para o render de sempre.
   Devolve: o que o pintarListaTx devolver, ou null se caiu para o render. */
function refrescarMovimentos(){
  const antigaLista=document.getElementById('txLista');
  if(tab!=='transactions'||!antigaLista){render();return null}
  const v=view();
  const molde=document.createElement('div');molde.innerHTML=vTransactions();
  const novaLista=molde.querySelector('#txLista');
  if(!novaLista){render();return null}
  /* a moldura e tudo o que vem antes da lista: troca-se de uma vez, que e
     barato, e a lista fica de fora para ser comparada peca a peca */
  for(let n=antigaLista.previousElementSibling;n;){const p=n.previousElementSibling;n.remove();n=p}
  const nova=[];
  for(let n=novaLista.previousElementSibling;n;n=n.previousElementSibling)nova.unshift(n);
  nova.forEach(n=>v.insertBefore(n,antigaLista));
  const r=pintarListaTx();
  tornarFocavel(v);
  pintarBotaoFiltros();
  return r;
}
// muda o filtro de tipo; categoria e subcategoria caem porque a árvore muda com o tipo
// Devolve: nada — redesenha a lista e o modal.
function onTxFilter(){txFilter=val('txKind')||'';txCat='';txSub='';txRerender()}
const TX_PLURAL={income:'as receitas',expense:'as despesas',loan:'as prestações',owed:'as dívidas recebidas',repay:'as dívidas pagas',settle:'as transferências',debt:'as dívidas'};
/* Filtra os movimentos por um tipo, a partir da janela de um cartão de resumo.
   A categoria e a subcategoria limpam-se: as que havia eram do tipo anterior.
   Recebe: k — o tipo ('income', 'expense', 'loan', 'owed', 'repay'), ou '' para todos.
   Devolve: nada — muda o filtro e redesenha. */
function txVerTipo(k){txFilter=k||'';txCat='';txSub='';txRerender();toast(k?'A ver só '+(TX_PLURAL[k]||'este tipo')+'.':'A ver todos os tipos.')}
/* O menu de toque longo de um movimento (data-lp "tx:<id>"). Os outros
   serviços acrescentam as suas opções por lpExtras.
   Recebe: a — as partes do data-lp (['tx', id]).
   Devolve: nada — abre a folha de opções (ou nada, se o movimento já não existir). */
function lpMovimento(a){
  const id=a[1],t=db.transactions.find(x=>x.id===id);if(!t)return;
  const ok=podeEditar(t.propertyId,'tx.add',t);
  const opts=ok?[{label:'Editar movimento',icon:'pen',act:()=>txModal({id})}]:[];
  lpExtrasDe('tx',a).forEach(o=>opts.push(o));
  if(ok)opts.push({label:'Apagar movimento',icon:'trash',act:()=>delTx(id)});
  return lpShow(t.label,opts);
}
// nº de filtros ativos nos movimentos, pesquisa incluída — o ponto no botão do cabeçalho
// Devolve: número de filtros ativos.
function txFiltrosN(){return txFilterCount()+(String(txSearch||'').trim()?1:0)}
// o botão de filtros do cabeçalho, nos movimentos: abre ou fecha o painel dos filtros
// Devolve: nada — troca o estado, repinta e marca a entrada do painel.
function txFiltrosAlternar(){txFiltAberto=!txFiltAberto;render();fpanelEntra(txFiltAberto)}
// fecha o painel dos filtros dos movimentos no estado (ao mudar de separador); quem chama repinta
// Devolve: nada — só o estado.
function txFiltrosFechar(){txFiltAberto=false}
// limpa os filtros próprios dos movimentos no estado (o botão dos estados vazios,
// via limparFiltroAtual → anaClear, que limpa o proprietário e repinta)
// Devolve: nada — só o estado.
function txFiltrosLimpar(){txFilter='';txProp='';txPaid='';txCat='';txSub='';txNoPayer=true;txSearch='';txDe='';txAte=''}
/* O que os Movimentos acrescentam ao menu de toque longo de um IMÓVEL (data-lp
   "prop:<id>"): «Registar despesa», já com o imóvel escolhido. Só onde posso
   adicionar movimentos — a condição que vivia no ficheiro dos imóveis e agora
   vive aqui, para os imóveis não terem de saber que os movimentos existem.
   Recebe: a — as partes do data-lp (['prop', id]).
   Devolve: um array de {label, icon, act} — vazio quando não se aplica. */
function lpExtrasMovimentosImovel(a){
  const id=a[1];
  if(!prop(id)||!pode(id,'tx.add'))return [];
  return [{label:'Registar despesa',icon:'dn',act:()=>txModal({kind:'expense',propId:id})}];
}
/* O que os Movimentos acrescentam ao menu de toque longo de um CONTRATO
   (data-lp "ct:<id>"): «Registar renda», já com o imóvel e o contrato
   escolhidos. Só num contrato em vigor onde posso adicionar movimentos. O
   menu de um contrato só abre com os Contratos ligados, mas diz-se na linha.
   Recebe: a — as partes do data-lp (['ct', id]).
   Devolve: um array de {label, icon, act} — vazio quando não se aplica. */
function lpExtrasMovimentosContrato(a){
  const id=a[1],c=servicoLigado('contracts')?contract(id):null;
  if(!c||!isActive(c)||!pode(c.propertyId,'tx.add'))return [];
  return [{label:'Registar renda',icon:'up',act:()=>txModal({kind:'income',propId:c.propertyId,ctId:id})}];
}
registarServico({id:'transactions',vistas:{transactions:'vTransactions'},depois:{transactions:'pintarListaTx'},lp:{tx:'lpMovimento'},
  lpExtras:{prop:'lpExtrasMovimentosImovel',ct:'lpExtrasMovimentosContrato'},
  analise:{transactions:{n:'txFiltrosN',limpar:'txFiltrosLimpar',alternar:'txFiltrosAlternar',fechar:'txFiltrosFechar'}}});
