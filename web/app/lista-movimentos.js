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
/* As etiquetas por que se filtram os movimentos (os nomes, pela ordem em que
   se escolheram). Podem ser várias, e um movimento passa se tiver PELO MENOS
   UMA delas (txMatch). Vazio = sem filtro. Vive aqui e não com os outros
   filtros (navegacao.js), porque só os Movimentos o leem; troca-se sempre por
   um array novo, nunca se mexe no que está. */
let txEtiq=[];
// nº de filtros ativos nos movimentos (a pesquisa não conta: soma-se à parte no cabeçalho)
// Devolve: número de filtros ativos (as datas contam como um só).
function txFilterCount(){
  // as datas contam como UM filtro, tenham uma ponta ou as duas
  const datas=(txDe||txAte)?1:0;
  return datas+txFilterCountSem();
}
// a mesma contagem sem as datas; atenção: desligar "sem pessoa atribuída" conta como um filtro;
// as etiquetas, como as datas, contam como UM, sejam uma ou várias
// Devolve: número de filtros ativos, sem contar as datas.
function txFilterCountSem(){
  return (txFilter?1:0)+(txProp?1:0)+(txPaid?1:0)+(txCat?1:0)+(txSub?1:0)+(txNoPayer?0:1)+(txEtiq.length?1:0);
}
/* As etiquetas que se podem escolher no filtro: as da lista mestra
   (db.settings.tags, pela ordem de lá), as que algum movimento usa e já não
   estão nela (por ordem alfabética), e as escolhidas que já não existem em
   lado nenhum — para se poderem desligar. Sem repetidas nem vazias.
   Devolve: array de nomes (texto); vazio quando a conta não tem etiquetas. */
function txEtiquetasDisponiveis(){
  const out=[],visto=Object.create(null);
  const junta=g=>{g=String(g==null?'':g);if(g.trim()&&!visto[g]){visto[g]=1;out.push(g)}};
  ((db.settings||{}).tags||[]).forEach(junta);
  const usadas=[];
  (db.transactions||[]).forEach(t=>(t.tags||[]).forEach(g=>{if(!visto[g]&&usadas.indexOf(g)<0)usadas.push(g)}));
  usadas.sort((a,b)=>String(a).localeCompare(String(b),'pt')).forEach(junta);
  txEtiq.forEach(junta);
  return out;
}
/* Um movimento passa no filtro das etiquetas? Sem etiquetas escolhidas passa
   sempre; com elas, basta ter UMA das escolhidas.
   Recebe: t — o movimento.
   Devolve: true/false. */
function txTemEtiqueta(t){
  if(!txEtiq.length)return true;
  return (t.tags||[]).some(g=>txEtiq.indexOf(g)>-1);
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
   Numa parte de um lote o valor é o total do lote — o que se escreveu, como
   num movimento de grupo — e o grupo do lote entra pelo nome.
   Recebe: t — o movimento (objeto de transação).
   Devolve: string única, desacentuada, com todos os campos pesquisáveis. */
function txHay(t){
  const c=t.contractId?contract(t.contractId):null,l=t.lote||null;
  const gl=l&&String(l.alvo||'').startsWith('g:')?grp(String(l.alvo).slice(2)):null;
  const v=l&&isFinite(Number(l.total))?Number(l.total):t.amount;
  return deacc([t.label,t.notes,t.category,t.sub,(t.tags||[]).join(' '),t.creditor,t.date,dPT(t.date),
    propName(t.propertyId),t.groupId?((grp(t.groupId)||{}).name||''):'',gl?gl.name||'':'',c?ctName(c):'',
    t.paidBy&&owner(t.paidBy)?owner(t.paidBy).name:'',t.toId&&owner(t.toId)?owner(t.toId).name:'',
    String(v),euro2(v)].join(' '));
}
let _qT=null;
/* pesquisa dos movimentos com atraso de 280 ms para não redesenhar a cada
   tecla. A lista viva guarda o próprio campo (refrescarMovimentos), que não
   perde o foco nem o cursor; só quando o caminho caiu para o render, que
   recria o campo, se lhe devolve o foco com o cursor no fim.
   Recebe: v — o texto escrito no campo de pesquisa.
   Devolve: nada — agenda o redesenho da vista. */
function onTxSearch(v){
  clearTimeout(_qT);
  _qT=setTimeout(()=>{txSearch=v;refrescarMovimentos();
    const i=document.getElementById('tx_q');
    if(i&&document.activeElement!==i){i.focus();try{i.setSelectionRange(i.value.length,i.value.length)}catch(e){}}},280);
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
   repay), imóvel/grupo ('__none__' = sem imóvel atribuído; um imóvel apanha
   os movimentos dele, as partes dos lotes que lhe cabem e os movimentos de
   grupo antigos com quota nele), âmbito das contas (ambito.js:inScope),
   pessoa que pagou/recebeu, pesquisa, categoria/subcategoria, etiquetas
   (basta uma das escolhidas: txTemEtiqueta) e intervalo de datas.
   «Sem imóvel» quer dizer mesmo sem imóvel: um movimento sem imóvel, sem
   grupo e sem «Todos os imóveis» não é de nenhum imóvel, e um filtro por
   imóvel deixa-o de fora (entrava, como se fosse de todos). Passa sem filtro
   e em «Sem imóvel atribuído».
   Recebe: t — o movimento (objeto de transação).
   Devolve: true se passa em todos os filtros ativos, false caso contrário. */
function txMatch(t){
  if(txFilter==='debt'){if(t.kind!=='owed'&&t.kind!=='repay')return false}
  else if(txFilter&&t.kind!==txFilter)return false;
  if(txProp==='__none__'){if(t.propertyId||t.groupId||t.todos)return false}
  else if(String(txProp||'').startsWith('g:')){const gid=txProp.slice(2),g=grp(gid),gids=(g||{}).ids||[];
    if(!(t.groupId===gid||(t.propertyId&&gids.indexOf(t.propertyId)>-1)))return false}
  else if(txProp){if(t.propertyId){if(t.propertyId!==txProp)return false}
    else if(!(t.groupId||t.todos)||txPropShare(t,txProp)<=0)return false}   /* sem imóvel não é de nenhum imóvel */
  /* o âmbito das contas (ambito.js): sem titular é tudo; a canalização fica
     inteira, como a quota do saldos.js, e só o IRS ainda põe um titular */
  if(t.propertyId){if(!inScope(t.propertyId))return false}
  else if(t.groupId||t.todos){if(ownerFilter&&!txProps(t).some(p=>inScope(p.id)))return false}
  else if(ownerFilter)return false;
  if(txPaid&&!(t.paidBy===txPaid||t.toId===txPaid||(!t.paidBy&&txNoPayer)))return false;
  if(!txNoPayer&&!t.paidBy)return false;
  if(txSearch.trim()){const hay=txHay(t);for(const term of txTerms())if(hay.indexOf(term)<0)return false}
  if(txCat==='__none__'){if(t.category)return false}
  else if(txCat&&t.category!==txCat)return false;
  if(txSub==='__none__'){if(t.sub)return false}
  else if(txSub&&t.sub!==txSub)return false;
  if(!txTemEtiqueta(t))return false;
  // entre datas: as ISO comparam-se como texto, e vazio é "sem limite"
  if(txDe&&t.date<txDe)return false;
  if(txAte&&t.date>txAte)return false;
  return true;
}
/* O valor de um movimento como os filtros o veem: a parte que cabe ao imóvel
   filtrado, ao grupo ou ao proprietário em foco, pesada pelo txWeight — o
   mesmo peso das métricas — e ao cêntimo. Vale por inteiro o que não tem por
   onde se cortar: um acerto, um movimento sem imóvel nem grupo (só se vê sem
   filtro ou em «Sem imóvel atribuído»: um filtro por imóvel já não o deixa
   entrar) e um de grupo cujo grupo já não tem imóveis — aí o peso dava 0 e a
   linha dizia 0 € de um movimento que existe.
   A linha de um lote (linhasDaLista: a primeira parte com _partes) vale a
   soma das partes que passaram no filtro, cada uma pesada como as outras.
   Recebe: t — o movimento, ou a linha de um lote.
   Devolve: euros (número, 2 casas). */
function valorNaVista(t){
  if(t._partes)return Math.round(sum(t._partes.map(valorNaVista))*100)/100;
  const v=Math.round((Number(t.amount)||0)*100)/100;   /* cêntimos também por inteiro: é com isto que a frase da parte compara */
  if(t.kind==='settle'||!(t.propertyId||t.groupId||t.todos)||((t.groupId||t.todos)&&!txProps(t).length))return v;
  return Math.round(v*txWeight(t,txProp&&txProp!=='__none__'?txProp:null,true)*100)/100;
}
/* A linha pequena de um movimento cortado pelos filtros: de que é parte e
   qual é o total. Corta o filtro por imóvel (a parte de um movimento de grupo
   nesse imóvel, ou no âmbito: «parte de <grupo>»), a quota do proprietário em
   foco («a tua parte»), ou os dois («a tua parte em <imóvel>»). A linha de um
   lote tem a sua (fraseDoLoteNaLista).
   Recebe: t — o movimento, ou a linha de um lote.
   Devolve: o texto, já escapado; '' quando o valor na vista é o total. */
function fraseDaParte(t){
  if(t._partes)return fraseDoLoteNaLista(t);
  const v=valorNaVista(t),tot=Math.round((Number(t.amount)||0)*100)/100;
  if(v===tot)return '';
  const pid=txProp&&txProp!=='__none__'?txProp:null,total=' · total '+euro2(tot);
  /* o que o imóvel ou o âmbito deixam passar, ainda sem a quota do dono */
  const semDono=Math.round(tot*txWeight(t,pid,false)*100)/100;
  if(v===semDono)return 'parte de '+esc((grp(t.groupId)||{}).name||'')+total;
  return 'a tua parte'+(semDono!==tot&&pid&&!String(pid).startsWith('g:')?' em '+esc(propName(pid)):'')+total;
}
/* O que um movimento pesa no saldo da vista: a entrada positiva, a saída
   negativa; nada num acerto ou fora dos totais.
   Recebe: t — o movimento.
   Devolve: euros (número), com sinal. */
function saldoNaVista(t){return !countsInTotals(t)?0:isIn(t.kind)?valorNaVista(t):isOut(t.kind)?-valorNaVista(t):0}
/* As linhas da lista: um movimento de vários imóveis (um lote) é guardado
   como uma parte por imóvel, e na lista volta a ser UMA linha — sem filtro, o
   lote inteiro; com o filtro num imóvel, a parte desse imóvel. Só a forma dos
   dados conta (t.lote.id): as partes de um lote que passaram no filtro juntam-se
   na linha, que é uma cópia da primeira delas pela ordem dos imóveis (a mesma
   da ficha) com _partes. A cópia é da linha e não da base: o _partes nunca
   chega a ser gravado. O id da linha é o da primeira parte — é a chave da
   lista viva ('tx:'+id), o data-lp, o txView e o data-tx da seleção — e o
   valor, a frase e o sítio mudam com o filtro, que é o que refaz a linha.
   Um movimento sem lote (os normais e os de grupo antigos) passa tal e qual.
   Recebe: lista — os movimentos que passaram nos filtros (array).
   Devolve: as linhas (array), pela ordem da lista: cada lote no lugar da
   primeira parte dele que lá aparece. */
function linhasDaLista(lista){
  const out=[],lotes=Object.create(null),ordem=Object.create(null);
  (db.properties||[]).forEach((p,i)=>{ordem[p.id]=i});
  const pos=t=>t.propertyId!=null&&t.propertyId in ordem?ordem[t.propertyId]:Infinity;
  (lista||[]).forEach(t=>{
    const lid=t&&t.lote?t.lote.id:null;
    if(lid==null||lid===''){out.push(t);return}
    if(!lotes[lid]){lotes[lid]=[];out.push(lotes[lid])}
    lotes[lid].push(t);
  });
  return out.map(x=>{
    if(!Array.isArray(x))return x;
    const ps=x.slice().sort((a,b)=>(pos(a)-pos(b))||String(a.id).localeCompare(String(b.id)));
    return Object.assign({},ps[0],{_partes:ps});
  });
}
/* O total de um lote, ao cêntimo: o que se escreveu no movimento (lote.total);
   sem ele, a soma das partes que a linha tem.
   Recebe: t — a linha de um lote (linhasDaLista).
   Devolve: euros (número, 2 casas). */
function totalDoLoteNaLista(t){
  const l=t.lote||{},ps=t._partes||[t];
  const v=l.total!=null&&l.total!==''&&isFinite(Number(l.total))?Number(l.total):sum(ps.map(p=>p.amount));
  return Math.round(v*100)/100;
}
/* A linha pequena de um lote: todas as partes na vista — «dividido por N
   imóveis» (e, se o proprietário em foco só leva uma quota, «a tua parte» e o
   total); só algumas, porque o filtro cortou as outras ou porque há imóveis
   do lote que não vês — «parte de «<rótulo>» · total <total do lote>».
   Recebe: t — a linha de um lote (linhasDaLista).
   Devolve: o texto, já escapado. */
function fraseDoLoteNaLista(t){
  const l=t.lote||{},ps=t._partes||[t],n=Math.max(Number(l.n)||0,ps.length);
  const tot=totalDoLoteNaLista(t),total=' · total '+euro2(tot);
  if(ps.length<n)return 'parte de «'+esc(t.label)+'»'+total;
  return 'dividido por '+n+(n===1?' imóvel':' imóveis')+(valorNaVista(t)!==tot?' · a tua parte'+total:'');
}
/* Onde é um lote, no lugar do nome do imóvel na linha: o nome do grupo (se
   ainda existir nesta base) ou «Todos os imóveis», e por quantos imóveis se
   dividiu. De um grupo que já não existe, só quantos são — dizer «Todos os
   imóveis» seria mentir.
   Recebe: t — a linha de um lote (linhasDaLista).
   Devolve: o texto, já escapado (ex.: «Bloco · 3 imóveis»). */
function ondeDoLoteNaLista(t){
  const l=t.lote||{},n=Math.max(Number(l.n)||0,(t._partes||[t]).length),alvo=String(l.alvo||'');
  const g=alvo.startsWith('g:')?grp(alvo.slice(2)):null;
  const nome=alvo==='todos'?'Todos os imóveis':g&&g.name?g.name:'';
  return (nome?esc(nome)+' · ':'')+n+(n===1?' imóvel':' imóveis');
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
  if(txPaid)p.push('pago/recebido por '+((owner(txPaid)||{}).name||''));
  if(txCat==='__none__')p.push('sem categoria');else if(txCat)p.push(txCat+(txSub&&txSub!=='__none__'?' / '+txSub:''));
  if(txSub==='__none__')p.push('sem subcategoria');
  if(txEtiq.length)p.push((txEtiq.length===1?'etiqueta ':'etiquetas ')+txEtiq.join(' ou '));
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
     <div class="hint u-mt-8px">Ao guardar, o modelo fica criado e o movimento é registado. Os modelos gerem-se em Dinheiro → Planeados.</div>`);
}
/* criar um modelo a meio de “novo movimento”: guarda o modelo E regista o movimento
   Devolve: nada — abre o fluxo do modelo novo. */
function newTplForTx(){
  newTxPick(k=>txModal({kind:k,modo:'tpl',alsoTx:true}));
}
/* Mudar um filtro atualiza a lista e o próprio painel, no sítio: a lista
   linha a linha, e o painel com o mesmo nó (refrescarMovimentos), para os
   seletores dependentes — a subcategoria depende da categoria — acompanharem
   sem fechar nada nem perder o ponto até onde se tinha rolado.
   Devolve: nada — redesenha a lista e, se estiver aberto, o painel. */
function txRerender(){refrescarMovimentos()}
/* Os tipos por que se filtra, pela ordem do painel e do chip: o valor do
   txFilter e o rótulo. 'debt' junta as dívidas recebidas e as pagas. */
const TX_FILTRO_TIPOS=[['','Todos'],['income','Receitas'],['expense','Despesas'],['loan','Pagamentos de crédito'],
  ['debt','Dívidas'],['owed','Dívidas recebidas'],['repay','Dívidas pagas'],['settle','Transferências']];
/* «1 movimento», «3 movimentos».
   Recebe: n — quantos.
   Devolve: o texto. */
const txNMov=n=>n+(n===1?' movimento':' movimentos');
/* As opções do filtro do imóvel: todos, sem imóvel, os do âmbito e os grupos.
   Devolve: array de {v, label} para o sel(). */
function txOpcoesImovel(){
  return [{v:'',label:'Todos os imóveis'},{v:'__none__',label:'Sem imóvel atribuído'}].concat(scope().map(p=>({v:p.id,label:p.name}))).concat(gdiv(gOpts('prop')));
}
/* As opções do filtro da categoria, na árvore do tipo filtrado (as dívidas
   usam a das despesas).
   Devolve: array de {v, label} para o sel(). */
function txOpcoesCategoria(){
  const tree=allCats(txFilter==='debt'?'expense':txFilter);
  return [{v:'',label:'Todas as categorias'},{v:'__none__',label:'Sem categoria'}].concat(Object.keys(tree).map(c=>({v:c,label:c})));
}
/* Os filtros comuns (Definições → Filtros comuns, definicoes.js) que se podem
   aplicar aqui.
   Devolve: array de filtros ({id, name, kind, prop, cat, sub, de, ate}; um «owner» de antes ignora-se). */
function txComuns(){return filtrosComuns()}
/* O filtro comum está aplicado? Os filtros dos movimentos são exatamente os
   dele — e ele fixa alguma coisa: um filtro em branco não está «ligado» numa
   lista sem filtros. Um filtro comum não guarda etiquetas: com etiquetas
   escolhidas os filtros já são mais do que os dele, e não está ligado.
   Recebe: f — o filtro comum.
   Devolve: true/false. */
function txComumLigado(f){
  const c=[['kind',txFilter],['prop',txProp],['cat',txCat],['sub',txSub],['de',txDe],['ate',txAte]];
  return !txEtiq.length&&c.some(([k])=>f[k])&&c.every(([k,v])=>(f[k]||'')===(v||''));
}
/* O chip de um filtro comum: aplica-o; ligado (com o visto), limpa os filtros.
   Recebe: f — o filtro comum.
   Devolve: o HTML do botão. */
function txChipDoComum(f){
  const on=txComumLigado(f);
  return `<button type="button" class="chip${on?' on':''}" aria-pressed="${on}" data-toca="vista" data-click="${on?'clearTxFilters()':`aplicarFiltroComum('${jsq(f.id)}')`}">${on?ic('check',16):''}${esc(f.name)}</button>`;
}
/* A linha «Etiquetas» do painel: cada etiqueta que existe (txEtiquetasDisponiveis)
   num chip que se liga e desliga (aria-pressed), com o visto quando ligado —
   a cor sozinha não chega. Escolhem-se várias; passa um movimento com pelo
   menos uma. Sem etiquetas na conta, a linha não aparece.
   Devolve: o HTML da linha (texto), ou ''. */
function txEtiquetasHtml(){
  const todas=txEtiquetasDisponiveis();
  if(!todas.length)return '';
  return `<div class="mov-campo"><span class="flabel" id="txEtiqL">Etiquetas</span>
      <div class="chips-fila mov-etiq" id="txEtiq" role="group" aria-labelledby="txEtiqL" aria-describedby="txEtiqD">${todas.map(g=>{const on=txEtiq.indexOf(g)>-1;
        return `<button type="button" class="chip${on?' on':''}" aria-pressed="${on}" data-etiq="${esc(g)}" data-toca="vista" data-click="txPorEtiqueta('${jsq(g)}')">${ic('check',16)}${esc(g)}</button>`}).join('')}</div>
      <span class="small mov-etiq-d" id="txEtiqD">Basta uma das escolhidas.</span></div>`;
}
/* Liga ou desliga uma etiqueta no filtro e repinta a lista e o painel. O
   painel é refeito por dentro (refrescarMovimentos), e o chip tocado com ele:
   se o foco estava num chip das etiquetas, volta ao chip novo da mesma
   etiqueta — quem anda pelo teclado não é atirado para o topo.
   Recebe: g — o nome da etiqueta.
   Devolve: nada — muda o filtro e redesenha. */
function txPorEtiqueta(g){
  g=String(g==null?'':g);if(!g)return;
  const a=document.activeElement,tinha=!!(a&&a.getAttribute&&a.getAttribute('data-etiq')!=null);
  txEtiq=txEtiq.indexOf(g)>-1?txEtiq.filter(x=>x!==g):txEtiq.concat([g]);
  txRerender();
  if(!tinha)return;
  const novo=[...document.querySelectorAll('#txEtiq [data-etiq]')].find(b=>b.getAttribute('data-etiq')===g);
  if(novo)try{novo.focus({preventScroll:true})}catch(e){}
}
/* O texto do chip rápido das etiquetas: a primeira escolhida e, havendo mais,
   quantas são além dela («Urgente +2») — a fila tem de caber no telemóvel.
   Devolve: o texto (por escapar), ou '' sem etiquetas escolhidas. */
function txRotuloEtiquetas(){
  if(!txEtiq.length)return '';
  return txEtiq[0]+(txEtiq.length>1?' +'+(txEtiq.length-1):'');
}
/* O texto do chip rápido abre o painel com o foco na primeira etiqueta
   escolhida (ou na primeira da linha), para se mudarem as escolhas lá.
   Devolve: nada — abre o painel e repinta. */
function txEtiqAbrir(){
  txFiltAberto=true;render();fpanelEntra(true);
  const b=document.querySelector('#txEtiq .chip.on')||document.querySelector('#txEtiq .chip');
  if(b)try{b.focus()}catch(e){}
}
/* O corpo do painel dos filtros (o M-Filtros do canvas): o título com o
   «Limpar» e o «Fechar», quantos movimentos passam, os filtros comuns, o tipo
   e as etiquetas em chips e, numa grelha, o imóvel, a categoria e a subcategoria, o
   proprietário, quem pagou ou recebeu, as datas e a ordenação; por fim o
   interruptor dos movimentos sem pessoa. Cada controlo aplica logo (os onTx*),
   sem «Aplicar». A pesquisa vive na própria vista (txBarraHtml).
   Devolve: string HTML do corpo do painel. */
function txFilterBody(){
  /* na grelha de duas colunas o campo já diz o que é (o rótulo por cima): a
     opção vazia diz só «Todos», «Todas» ou «Qualquer um», como no canvas —
     «Todos os imó…» e «Qualquer pro…» cortavam-se a 390px. Os chips usam as
     mesmas listas com os rótulos inteiros (txOpcoesImovel, txOpcoesCategoria),
     por isso a troca é só aqui. */
  const curto=(ops,rot)=>ops.map(o=>o.v===''?{v:'',label:rot}:o);
  const payers=[{v:'',label:'Qualquer um'}].concat(db.owners.map(o=>({v:o.id,label:o.name})));
  const tree=allCats(txFilter==='debt'?'expense':txFilter);
  const subsF=txCat&&txCat!=='__none__'?(tree[txCat]||[]):[];
  const subOpts=[{v:'',label:'Todas'},{v:'__none__',label:'Sem subcategoria'}].concat(subsF.map(x=>({v:x,label:x})));
  const donos=db.owners.length&&servicoLigado('owners'),comuns=txComuns();
  const n=linhasDaLista(db.transactions.filter(txMatch)).length;
  /* um campo com o filtro posto veste o cobalto, como os chips (o canvas) */
  const lig=v=>v?' class="mov-ligado"':'';
  return `<div class="mov-filtros">
    <div class="mov-filtros-cab"><h2 class="mov-filtros-tit" id="txFtit">Filtros</h2>
      ${txFilterCount()?`<button type="button" class="btn ghost" data-toca="vista" data-click="clearTxFilters()">Limpar</button>`:''}
      <button type="button" class="btn" data-toca="camada" data-click="txFilterFechar()">Fechar</button></div>
    <p class="small mov-filtros-n">Aplicam-se ao mexer · ${txNMov(n)}</p>
    ${comuns.length?`<div class="mov-campo"><span class="lbl">Filtros comuns</span><div class="chips-fila">${comuns.map(txChipDoComum).join('')}</div></div>`:''}
    <div class="mov-campo"><span class="flabel" id="txKindL">Tipo</span>
      <div class="chips-fila" id="txKind" role="radiogroup" aria-labelledby="txKindL">${TX_FILTRO_TIPOS.map(([k,l])=>{const on=txFilter===k;
        return `<button type="button" class="chip${on?' on':''}" role="radio" aria-checked="${on}" data-toca="vista" data-click="txPorTipo('${k}')">${l}</button>`}).join('')}</div></div>
    ${txEtiquetasHtml()}
    <div class="mov-grelha">
      ${servicoLigado('properties')?`<label${lig(txProp)}>Imóvel${sel('txPropF',txProp,curto(txOpcoesImovel(),'Todos'),'onTxProp','vista')}</label>`:''}
      <label${lig(txCat)}>Categoria${sel('txCatF',txCat,curto(txOpcoesCategoria(),'Todas'),'onTxCat','vista')}</label>
      ${txCat&&txCat!=='__none__'?`<label${lig(txSub)}>Subcategoria${sel('txSubF',txSub,subOpts,'onTxSub','vista')}</label>`:''}
      ${donos?`<label${lig(txPaid)}>Pago ou recebido por${sel('txPaidF',txPaid,payers,'onTxPaid','vista')}</label>`:''}
      <label>De<input id="txDeF" type="date" value="${txDe}" data-change="onTxDatas()"></label>
      <label>Até<input id="txAteF" type="date" value="${txAte}" data-change="onTxDatas()"></label>
      <label>Ordenar por${sel('txSortF',txSort,[{v:'date',label:'Data'},{v:'amount',label:'Valor'}],'onTxSort','vista')}</label>
      <label>Ordem${sel('txDirF',txDir,[{v:'desc',label:'Descendente'},{v:'asc',label:'Ascendente'}],'onTxDir','vista')}</label>
    </div>
    ${donos?`<label class="mov-interr"><span id="txNoPayerL">Incluir movimentos sem pessoa atribuída</span>
      <button type="button" class="interruptor" id="txNoPayer" role="switch" aria-checked="${txNoPayer?'true':'false'}" aria-labelledby="txNoPayerL" data-toca="vista" data-click="onTxNoPayer()"></button></label>`:''}
  </div>`;
}
/* Filtra por um tipo, a partir dos chips do painel. A categoria e a
   subcategoria caem, porque a árvore muda com o tipo.
   Recebe: k — o tipo ('', 'income', 'expense', 'loan', 'debt', 'owed', 'repay' ou 'settle').
   Devolve: nada — muda o filtro e redesenha a lista e o painel. */
function txPorTipo(k){txFilter=k||'';txCat='';txSub='';txRerender()}
// muda o campo de ordenação dos movimentos (data ou valor)
// Devolve: nada — redesenha a lista e o modal.
function onTxSort(){txSort=val('txSortF')||'date';txRerender()}
// muda o sentido da ordenação dos movimentos
// Devolve: nada — redesenha a lista e o modal.
function onTxDir(){txDir=val('txDirF')||'desc';txRerender()}
/* O painel de filtros dos movimentos — o mesmo .fwrap/.fpanel das outras
   listas, logo por baixo da pesquisa e do botão que o abre. O Limpar e o
   Fechar vivem no cabeçalho dele (txFilterBody).
   Devolve: o HTML do painel (fechado, só a moldura escondida). */
function txFilterPainel(){
  return `<div class="fwrap u-h-0 mov-fwrap"><div class="fpanel ${txFiltAberto?'on':''} u-t-0" id="txFpanel" role="region" aria-labelledby="txFtit">
    <div class="card mov-filtros-card">${txFilterBody()}</div></div></div>`;
}
// fecha o painel de filtros dos movimentos (os filtros aplicam-se logo ao mexer)
// Devolve: nada — fecha o painel e redesenha a vista.
function txFilterFechar(){txFiltAberto=false;closePops();render()}
// muda o filtro de imóvel/grupo dos movimentos
// Devolve: nada — redesenha a lista e o modal.
function onTxProp(){txProp=val('txPropF')||'';txRerender()}
// muda o filtro de quem pagou ou recebeu
// Devolve: nada — redesenha a lista e o modal.
function onTxPaid(){txPaid=val('txPaidF')||'';txRerender()}
// muda a categoria; a subcategoria cai porque pertencia à anterior
// Devolve: nada — redesenha a lista e o modal.
function onTxCat(){txCat=val('txCatF')||'';txSub='';txRerender()}
// muda o filtro de subcategoria
// Devolve: nada — redesenha a lista e o modal.
function onTxSub(){txSub=val('txSubF')||'';txRerender()}
// o interruptor dos movimentos sem pessoa atribuída: liga ou desliga a inclusão
// Devolve: nada — redesenha a lista e o painel.
function onTxNoPayer(){txNoPayer=!txNoPayer;txRerender()}
// lê o intervalo de datas do modal e aplica-o à lista
// Devolve: nada — redesenha a lista e o modal.
function onTxDatas(){
  txDe=val('txDeF')||'';txAte=val('txAteF')||'';
  if(txDe&&txAte&&txAte<txDe){const x=txDe;txDe=txAte;txAte=x}   // trocadas endireitam-se
  txRerender();
}
/* Repõe todos os filtros dos movimentos na origem, incluindo a pesquisa. O
   campo da pesquisa é o mesmo nó de pintura para pintura
   (refrescarMovimentos), e por isso esvazia-se aqui, à mão.
   Devolve: nada — redesenha a lista e o painel. */
function clearTxFilters(){
  txFilter='';txProp='';txPaid='';txCat='';txSub='';txNoPayer=true;txSearch='';txDe='';txAte='';txEtiq=[];
  clearTimeout(_qT);
  const q=document.getElementById('tx_q');if(q&&q.value){q.value='';txqMostrarLimpar(q)}
  closePops();txRerender();
}
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
   A lista é de linhas (linhasDaLista: um lote é uma só), e é pelas linhas
   que se ordena e se contam «N movimentos»; os indicadores somam as partes,
   uma vez cada — dá o mesmo total, sem depender de como se juntaram.
   Devolve: string com o HTML completo da vista. */
function vTransactions(){
  const adiciona=podeSemImovel()||casasComo('tx.add').length;   /* a condição do FAB e do vazio */
  /* o FAB está escondido em todos os ecrãs (a casca); fica pela condição, que é a do vazio */
  const fabHtml=adiciona?fab([{label:'Novo movimento',act:'newTxPick()'}]):'';
  txLinhasPintadas=0;txLista=[];   /* sem linhas, nenhuma: a lista de uma pintura anterior não fica a fingir que ainda se vê */
  if(!db.transactions.length)return txFilterPainel()+fabHtml+(esperaDoServidor()||`<div class="empty"><b>Sem movimentos</b>Regista a primeira renda recebida ou despesa paga.${adiciona?saida('Registar movimento','newTxPick()','camada'):''}</div>`);
  /* a pesquisa e o botão dos filtros, o painel logo por baixo, e os chips */
  const head=txBarraHtml()+txFilterPainel()+txChipsHtml()+fabHtml;
  const partes=db.transactions.filter(txMatch),list=linhasDaLista(partes),vv={};   /* o valor na vista uma vez por linha: o comparador pede-o vezes sem conta */
  if(txSort==='amount')list.forEach(t=>{vv[t.id]=valorNaVista(t)});   /* a linha de um lote vale a soma das partes */
  list.sort((a,b)=>{const d=txDir==='desc'?-1:1;
    if(txSort==='amount')return d*(vv[a.id]-vv[b.id])||String(a.date).localeCompare(String(b.date));
    return d*String(a.date).localeCompare(String(b.date))});
  if(!list.length)return head+vazioFiltro()
    +balancesCard(txProp||null);   /* pode não haver movimentos e haver contas por acertar */
  txLinhasPintadas=list.length;
  const tot={income:0,expense:0,loan:0,owed:0,repay:0,settle:0};partes.forEach(t=>{if(countsInTotals(t))tot[t.kind]=(tot[t.kind]||0)+valorNaVista(t)});
  const saldo=tot.income+tot.owed-tot.expense-tot.loan-tot.repay;
  const evoTx=k=>()=>{
    const L=db.transactions.filter(txMatch).filter(countsInTotals),f=t=>k==='saldo'?saldoNaVista(t):(t.kind===k?valorNaVista(t):0);
    const ys={};ys[YEAR]=1;L.forEach(t=>{const y=Number(String(t.date).slice(0,4));if(y)ys[y]=1});
    return {fmt:euro,monthly:[...Array(12)].map((_,i)=>sum(L.filter(t=>String(t.date).startsWith(`${YEAR}-${String(i+1).padStart(2,'0')}`)).map(f))),
      yearly:Object.keys(ys).map(Number).sort().map(y=>({label:y,value:sum(L.filter(t=>String(t.date).startsWith(String(y))).map(f))}))};
  };
  /* cada cartão leva a sua lista: abrir o indicador e ficar a ver só esse tipo é
     o caminho que se fazia à mão pelo modal de filtros. O Saldo é a volta atrás. */
  const ver=(k,rot)=>({label:rot,act:`txVerTipo('${k}')`});
  const jaSo=k=>txFilter===k;
  /* Os totais em cartões tocáveis (o canvas: Receitas, Despesas, Prestações,
     Saldo · N), cada um na cor do seu dinheiro — a prestação em roxo, as
     dívidas em cobalto. Sem rodapé, menos o Saldo, que diz quantos movimentos
     são. No telemóvel correm numa fila que se arrasta de lado. */
  const resumo=`<div class="grid mov-tot" role="group" aria-label="Totais no filtro atual">
    ${kpi('Receitas',euro(tot.income),'pos','','Soma das receitas dos movimentos que passam no filtro.',evoTx('income'),jaSo('income')?null:ver('income','Ver só as receitas'))}
    ${kpi('Despesas',euro(tot.expense),'neg','','Soma das despesas dos movimentos que passam no filtro.',evoTx('expense'),jaSo('expense')?null:ver('expense','Ver só as despesas'))}
    ${kpi('Prestações',euro(tot.loan),'prest','','Prestações do crédito dos movimentos que passam no filtro.',evoTx('loan'),jaSo('loan')?null:ver('loan','Ver só as prestações'))}
    ${tot.owed?kpi('Dívidas recebidas',euro(tot.owed),'mov-div','','Dinheiro recebido de terceiros.',evoTx('owed'),jaSo('owed')?null:ver('owed','Ver só as dívidas recebidas')):''}
    ${tot.repay?kpi('Dívidas pagas',euro(tot.repay),'mov-div','','Devoluções a terceiros.',evoTx('repay'),jaSo('repay')?null:ver('repay','Ver só as dívidas pagas')):''}
    ${kpi('Saldo',euro(saldo),saldo>=0?'':'neg',txNMov(list.length),'Entradas menos saídas dos movimentos que passam no filtro.',evoTx('saldo'),txFilter?ver('','Ver todos os tipos'):null)}</div>`;
  txLista=list;
  /* Os indicadores e os cartões das contas vão juntos numa peça com chave
     (continuidade.js): entrar na seleção põe a barra dela por cima de tudo,
     e as linhas e os títulos dos meses deslizavam para baixo enquanto isto
     saltava de uma vez — o título do mês, a caminho, passava por cima do
     fundo dos cartões. Um <div> sem nada: as margens de dentro atravessam-no. */
  return head+`<div data-fk="txresumo">`+resumo+balancesCard(txProp||null)+creditorsCard(txProp&&txProp!=='__none__'?txProp:null)+`</div>`
    +txCabTabela()+`<div id="txLista" class="mov-tabela"></div>`;
}
/* O cabeçalho das colunas, que só se vê no ecrã largo, onde a lista é uma
   tabela (D-Movimentos): a caixa de tudo, Data, Descrição, Imóvel,
   Categoria, Pago · recebido e Valor. Vive na moldura, logo antes do
   #txLista — dentro dele o reconciliar tirava-o, por não ter chave. A caixa
   de tudo é da camada da seleção (cloud/selecao.js), que enche o
   .mov-cab-caixa; sem ela fica a coluna vazia. As colunas que um serviço
   desligado não tem saem, como na linha.
   Devolve: o HTML do cabeçalho (texto). */
function txCabTabela(){
  return `<div class="mov-cab" data-fk="txcab"><span class="mov-cab-caixa"></span><span class="mov-c-data">Data</span><span class="mov-c-desc">Descrição</span>`+
    `${servicoLigado('properties')?'<span class="mov-c-imovel">Imóvel</span>':''}<span class="mov-c-cat">Categoria</span>`+
    `${servicoLigado('owners')?'<span class="mov-c-quem">Pago · recebido</span>':''}<span class="mov-c-valor">Valor</span></div>`;
}
/* A pesquisa (sempre à vista, o canvas) e o botão que abre o painel dos
   filtros, com quantos estão ligados. A pesquisa é um nó que a lista viva
   guarda de pintura para pintura (refrescarMovimentos): escrever não perde o
   foco nem o que o teclado estava a compor. A lupa é desenhada na folha
   (estilos.css:.mov-lupa).
   Devolve: o HTML da barra (texto). */
function txBarraHtml(){
  const n=txFilterCount(),res=filterSummary();
  return `<div class="mov-barra">
    <label class="mov-busca"><span class="mov-lupa" aria-hidden="true"></span>
      <input id="tx_q" type="search" value="${esc(txSearch)}" placeholder="Pesquisar…" aria-label="Pesquisar movimentos: palavras soltas ou uma frase entre aspas" autocomplete="off" enterkeyhint="search"
        data-input="onTxSearch(this.value);txqMostrarLimpar(this)"><button type="button" class="qclear${txSearch?'':' u-d-none'}" aria-label="Limpar a pesquisa" data-toca="vista" data-click="txqLimpar(this)">${ic('x',14)}</button></label>
    <button type="button" class="btn so-icone mov-filt${txFiltAberto?' on':''}" id="txFiltBtn" aria-expanded="${txFiltAberto?'true':'false'}" aria-controls="txFpanel"
      aria-label="${n?'Filtros: '+n+(n===1?' ativo':' ativos'):'Filtros'}"${res?` title="${res}"`:''} data-toca="vista" data-click="txFiltrosAlternar()">${ic('filter',18)}${n?`<span class="mov-filt-n" aria-hidden="true">${n}</span>`:''}</button>
  </div>`;
}
/* Os anos que têm movimentos, do mais recente para o mais antigo — as escolhas
   do chip do período.
   Devolve: array de anos (texto, 'AAAA'). */
function txAnos(){
  const ys={};(db.transactions||[]).forEach(t=>{const y=String(t.date||'').slice(0,4);if(/^\d{4}$/.test(y))ys[y]=1});
  return Object.keys(ys).sort().reverse();
}
/* O ano inteiro que as datas do filtro desenham, se o desenham.
   Devolve: 'AAAA', ou '' quando o intervalo não é um ano de 1 de janeiro a 31 de dezembro. */
function txAnoDoFiltro(){
  const y=String(txDe||'').slice(0,4);
  return /^\d{4}$/.test(y)&&txDe===y+'-01-01'&&txAte===y+'-12-31'?y:'';
}
/* O que o filtro das datas diz, para o rótulo do chip.
   Devolve: o texto (por escapar): o ano, o intervalo, «desde …», «até …», ou ''. */
function txRotuloPeriodo(){
  const y=txAnoDoFiltro();if(y)return y;
  if(txDe&&txAte)return dPT(txDe)+' – '+dPT(txAte);
  return txDe?'desde '+dPT(txDe):txAte?'até '+dPT(txAte):'';
}
/* Um chip de filtro que abre a escolha: o menu da casa (sel) vestido de chip.
   Desligado diz o nome do filtro e leva a seta; ligado diz o valor, com o
   fundo cobalto e um × ao lado para o limpar. O rótulo é o do filtro e não o
   da opção («Tipo», e não «Todos»), e o leitor de ecrã ouve os dois.
   Recebe: id — o id do sel; valor — o valor escolhido; opcoes — [{v, label}];
   onchange — o nome da função que aplica; nome — o nome do filtro; rotulo — o
   que o chip diz ligado; ligado — se o filtro está posto; limpar — a ação do ×;
   cls (opcional) — classes extra do chip.
   Devolve: o HTML do chip (texto). */
function txChipSel(id,valor,opcoes,onchange,nome,rotulo,ligado,limpar,cls){
  const diz=ligado?rotulo:nome;
  const s=sel(id,valor,opcoes,onchange,'vista')
    .replace('class="selbtn"','class="selbtn" aria-label="'+esc(nome+(ligado?': '+rotulo:''))+'"')
    .replace(/(<span id="lab_[^"]*">)[^<]*(<\/span>)/,'$1'+esc(diz)+'$2');
  return `<span class="mov-chip${ligado?' on':''}${cls?' '+cls:''}">${s}${ligado?`<button type="button" class="mov-chip-x" aria-label="Limpar ${esc(nome.toLowerCase())}" data-toca="vista" data-click="${limpar}">${ic('x',14)}</button>`:''}</span>`;
}
/* Os chips dos filtros que já existem (o canvas): o período, o tipo, o
   imóvel, a categoria e quem pagou ou recebeu — cada um abre a sua escolha e,
   ligado, mostra o valor com o × —, as etiquetas quando há escolhidas (o
   texto abre o painel, o × limpa-as), o «só com pessoa atribuída» quando está
   ligado, os filtros comuns (só no ecrã largo; no telemóvel vivem no painel) e
   o «Limpar». No telemóvel o «Pago por» desligado sai, para a fila caber: está
   no painel.
   Devolve: o HTML da fila de chips (texto). */
function txChipsHtml(){
  const L=[],anos=txAnos(),y=txAnoDoFiltro(),per=!!(txDe||txAte);
  const opsPer=[{v:'',label:'Todo o período'}].concat(anos.map(a=>({v:a,label:a})))
    .concat(per&&!y?[{v:'__atual__',label:txRotuloPeriodo()}]:[]).concat([{v:'__datas__',label:'Escolher datas…'}]);
  L.push(txChipSel('txcPer',y||(per?'__atual__':''),opsPer,'txChipPeriodo','Período',txRotuloPeriodo(),per,"txLimparFiltro('per')"));
  const tipo=TX_FILTRO_TIPOS.find(x=>x[0]===txFilter)||TX_FILTRO_TIPOS[0];
  L.push(txChipSel('txcTipo',txFilter,TX_FILTRO_TIPOS.map(([v,l])=>({v,label:v?l:'Todos os tipos'})),'txChipTipo','Tipo',tipo[1],!!txFilter,"txLimparFiltro('tipo')"));
  if(servicoLigado('properties')){
    const rp=txProp==='__none__'?'Sem imóvel':String(txProp||'').startsWith('g:')?'Grupo · '+((grp(txProp.slice(2))||{}).name||''):propName(txProp);
    L.push(txChipSel('txcProp',txProp,txOpcoesImovel(),'txChipImovel','Imóvel',rp,!!txProp,"txLimparFiltro('prop')"));
  }
  const rc=txCat==='__none__'?'Sem categoria':txCat+(txSub?' › '+(txSub==='__none__'?'sem subcategoria':txSub):'');
  L.push(txChipSel('txcCat',txCat,txOpcoesCategoria(),'txChipCategoria','Categoria',rc,!!(txCat||txSub),"txLimparFiltro('cat')"));
  /* as etiquetas são de escolha múltipla, que o menu da casa não tem: o chip
     só aparece com elas escolhidas, e o texto abre o painel, onde se mudam */
  if(txEtiq.length)L.push(`<span class="mov-chip on mov-chip-etiq"><button type="button" class="mov-chip-txt" aria-label="${esc((txEtiq.length===1?'Etiqueta: ':'Etiquetas: ')+txEtiq.join(' ou ')+'. Mudar nos filtros')}" data-toca="vista" data-click="txEtiqAbrir()"><span class="mov-chip-etiq-t">${esc(txRotuloEtiquetas())}</span></button><button type="button" class="mov-chip-x" aria-label="Limpar as etiquetas" data-toca="vista" data-click="txLimparFiltro('etiq')">${ic('x',14)}</button></span>`);
  if(db.owners.length&&servicoLigado('owners')){
    const payers=[{v:'',label:'Qualquer proprietário'}].concat(db.owners.map(o=>({v:o.id,label:o.name})));
    L.push(txChipSel('txcPago',txPaid,payers,'txChipPago','Pago ou recebido por',(owner(txPaid)||{}).name||'',!!txPaid,"txLimparFiltro('pago')",txPaid?'':'mov-so-largo'));
    if(!txNoPayer)L.push(`<span class="mov-chip on"><span class="mov-chip-txt">Só com pessoa atribuída</span><button type="button" class="mov-chip-x" aria-label="Incluir os movimentos sem pessoa atribuída" data-toca="vista" data-click="txLimparFiltro('pessoa')">${ic('x',14)}</button></span>`);
  }
  const comuns=txComuns();
  if(comuns.length)L.push(txChipSel('txcComum','',[{v:'',label:'Nenhum'}].concat(comuns.map(f=>({v:f.id,label:f.name}))),'txChipComum','Filtros comuns','',false,'','mov-comum mov-so-largo'));
  /* com um filtro só, no telemóvel, o × do chip já o limpa: o «Limpar» só se
     mostra lá com dois ou mais, para a fila não partir em duas */
  const nf=txFiltrosN();
  if(nf)L.push(`<button type="button" class="chip limpar${nf>1?'':' mov-so-largo'}" data-toca="vista" data-click="clearTxFilters()">Limpar</button>`);
  return `<div class="chips-fila mov-chips" role="group" aria-label="Filtros dos movimentos">${L.join('')}</div>`;
}
/* O chip do período: um ano escolhe-o de 1 de janeiro a 31 de dezembro, «Todo
   o período» limpa as datas e «Escolher datas…» abre o painel, onde estão o
   De e o Até.
   Devolve: nada — muda as datas (ou abre o painel) e redesenha. */
function txChipPeriodo(){
  const v=val('txcPer')||'';
  if(v==='__datas__'){txFiltAberto=true;render();fpanelEntra(true);const d=document.getElementById('txDeF');if(d)try{d.focus()}catch(e){}return}
  if(v==='__atual__')return;
  if(/^\d{4}$/.test(v)){txDe=v+'-01-01';txAte=v+'-12-31'}else{txDe='';txAte=''}
  txRerender();
}
// O chip do tipo: muda o filtro; a categoria e a subcategoria caem, porque eram da árvore do tipo anterior.
// Devolve: nada — redesenha a lista.
function txChipTipo(){txPorTipo(val('txcTipo')||'')}
// O chip do imóvel (ou grupo, 'g:…', ou '__none__'): muda o filtro.
// Devolve: nada — redesenha a lista.
function txChipImovel(){txProp=val('txcProp')||'';txRerender()}
// O chip da categoria: muda o filtro; a subcategoria cai, porque era da anterior.
// Devolve: nada — redesenha a lista.
function txChipCategoria(){txCat=val('txcCat')||'';txSub='';txRerender()}
// O chip de quem pagou ou recebeu: muda o filtro.
// Devolve: nada — redesenha a lista.
function txChipPago(){txPaid=val('txcPago')||'';txRerender()}
// O chip dos filtros comuns: aplica o escolhido (a opção vazia não faz nada).
// Devolve: nada — aplica o filtro comum (definicoes.js:aplicarFiltroComum).
function txChipComum(){const v=val('txcComum');if(v)aplicarFiltroComum(v)}
/* O × de um chip ligado: limpa só esse filtro.
   Recebe: qual — 'per' (as datas), 'tipo' (e a categoria, que era da árvore
   dele), 'prop', 'cat' (com a subcategoria), 'pago', 'pessoa' (volta a
   incluir os movimentos sem pessoa atribuída) ou 'etiq' (todas as etiquetas).
   Devolve: nada — muda o filtro e redesenha. */
function txLimparFiltro(qual){
  if(qual==='per'){txDe='';txAte=''}
  else if(qual==='etiq')txEtiq=[];
  else if(qual==='tipo'){txFilter='';txCat='';txSub=''}
  else if(qual==='prop')txProp='';
  else if(qual==='cat'){txCat='';txSub=''}
  else if(qual==='pago')txPaid='';
  else if(qual==='pessoa')txNoPayer=true;
  closePops();txRerender();
}
/* As linhas que a última pintura da vista escolheu (linhasDaLista: os
   movimentos e, por lote, a primeira parte com _partes), para a lista se
   poder repintar sozinha sem voltar a filtrar e a ordenar tudo. */
let txLista=[];
/* O tom de um tipo de movimento, para o quadrado do ícone e para o valor: a
   receita verde, a despesa laranja, a prestação roxa, a dívida e o acerto em
   cobalto (o canvas). Diz também o ícone e a classe do valor.
   Recebe: k — o tipo ('income', 'expense', 'loan', 'owed', 'repay' ou 'settle').
   Devolve: {ic, tom, valor} — o nome do ícone, a classe do quadrado (.linha
   .ic.in|out|loan, ou '' para o cobalto) e a classe da cor do valor. */
function txTomDoTipo(k){
  return ({income:{ic:'up',tom:'in',valor:'pos'},expense:{ic:'dn',tom:'out',valor:'neg'},loan:{ic:'bank',tom:'loan',valor:'prest'},
    owed:{ic:'users',tom:'',valor:'mov-div'},repay:{ic:'users',tom:'',valor:'mov-div'},settle:{ic:'swap',tom:'',valor:'mov-acerto'}})[k]
    ||{ic:'dn',tom:'out',valor:'neg'};
}
/* O primeiro nome de um proprietário, para a linha curta do telemóvel.
   Recebe: id — o id do proprietário.
   Devolve: o nome (texto, por escapar), ou '' sem ninguém. */
function txPrimeiroNome(id){const o=id&&owner(id);return o&&o.name?String(o.name).trim().split(/\s+/)[0]:''}
/* Quem pagou ou recebeu, por inteiro: a coluna «Pago · recebido» da tabela.
   Num acerto, quem paga → quem recebe.
   Recebe: t — o movimento.
   Devolve: o texto, já escapado ('' sem ninguém indicado). */
function txQuemNome(t){
  if(t.kind==='settle')return esc((owner(t.paidBy)||{}).name||'?')+' &rarr; '+esc((owner(t.toId)||{}).name||'?');
  return t.paidBy&&owner(t.paidBy)?esc(owner(t.paidBy).name):'';
}
/* O HTML de UMA linha de movimento. Esta a parte porque e a peca que a lista
   viva compara consigo propria: o texto que sai daqui e a assinatura da linha
   (lista.js), e e por ele que se sabe se ha alguma coisa a refazer. O valor
   e a frase da parte mudam com o filtro, por isso entram aqui e nao noutro
   sitio: e assim que a linha se refaz quando o filtro muda.
   A linha de um lote (linhasDaLista) leva o id da primeira parte — no data-lp,
   no txView e no data-tx da seleção —, no lugar do imóvel o grupo ou «Todos
   os imóveis» com «· N imóveis», e o valor e a frase das partes que passaram.

   Um HTML só para os dois desenhos do canvas, porque a assinatura é uma: no
   telemóvel (M-Movimentos) o quadrado do ícone na cor do tipo, o título, a
   linha curta «dd/mm · imóvel · quem» e o valor com sinal e cor; no ecrã
   largo (D-Movimentos) a mesma linha é uma fila da tabela — Data, Descrição
   (o título e, por baixo, o tipo com o que mais diz), Imóvel, Categoria,
   Pago · recebido e Valor. A folha mostra as peças de um e esconde as do
   outro (estilos.css:.mov-linha). A caixa da seleção e o que mais a nuvem
   quiser vêm do txLinhaExtra.
   Recebe: t — o movimento, ou a linha de um lote; mo — o mes 'AAAA-MM' do
   bloco onde a linha entra.
   Devolve: o HTML da linha (string). */
function txLinhaHtml(t,mo){
  const k=KIND[t.kind]||KIND.expense,tom=txTomDoTipo(t.kind),c=t.contractId?contract(t.contractId):null,parte=fraseDaParte(t);
  const x=txLinhaExtra(t,mo)||{},SEP=' · ';
  const onde=t._partes?ondeDoLoteNaLista(t):t.propertyId?esc(propName(t.propertyId)):'';
  const quem=t.kind==='settle'?esc(txPrimeiroNome(t.paidBy)||'?')+' → '+esc(txPrimeiroNome(t.toId)||'?'):esc(txPrimeiroNome(t.paidBy));
  const cat=t.category?esc(t.category)+(t.sub?' › '+esc(t.sub):''):'';
  /* a linha curta: a data sem o ano (o título do mês já o diz), onde e quem;
     sem os dois, a categoria ou o tipo, para a linha nunca ficar só com a data */
  const curta=[dPT(t.date).slice(0,5),onde,quem,t.creditor?esc(t.creditor):''].filter(Boolean);
  if(curta.length===1)curta.push(cat||esc(k.short));
  /* o tipo e o que mais diz deste movimento, por baixo da descrição na tabela */
  const capital=t.kind==='loan'&&(t.principal||t.interest||t.fee)?(t.payType==='amortizacao'?'amortização · capital ':'capital ')+euro2(t.principal||0):'';
  /* as etiquetas dizem-se na mesma linha, como no canvas («Despesa · Dedutível») */
  const tipo=[esc(k.short),c?esc(ctName(c)):'',t.creditor?esc(t.creditor):'',capital,ehRenda(t)&&t.recibo?'recibo emitido':''].concat((t.tags||[]).map(esc)).filter(Boolean).join(SEP);
  const marcas=!countsInTotals(t)?'<span class="badge grey">fora dos totais</span>':'';
  return `<div class="linha txrow mov-linha${x.cls?' '+x.cls:''}" data-lp="tx:${esc(t.id)}" data-fk="tx:${esc(t.id)}" ${x.attrs||''} data-toca="camada" data-click="${x.onclick||`txView('${jsq(t.id)}')`}">
    ${x.caixa||''}<span class="ic${tom.tom?' '+tom.tom:''}" aria-hidden="true">${ic(tom.ic,18)}</span><span class="mov-c-data">${dPT(t.date)}</span>
    <div class="u-minw-0 txcorpo"><div class="title">${esc(t.label)}</div>
      <div class="small mov-curta">${curta.join(SEP)}</div>
      <div class="small mov-tipo">${tipo}</div>
      ${parte?`<div class="small mov-parte">${parte}</div>`:''}
      ${marcas?`<div class="mov-marcas">${marcas}</div>`:''}</div>
    ${servicoLigado('properties')?`<span class="mov-c-imovel">${onde||'<span class="mov-vazio">&mdash;</span>'}</span>`:''}<span class="mov-c-cat">${cat||'<span class="mov-vazio">&mdash;</span>'}</span>${servicoLigado('owners')?`<span class="mov-c-quem">${txQuemNome(t)||'<span class="mov-vazio">&mdash;</span>'}</span>`:''}
    <div class="mov-c-valor"><b class="${tom.valor}">${k.sign}${euro2(valorNaVista(t))}</b>${t.notes?`<span class="mov-nota" role="img" aria-label="Tem coment\u00e1rios">${ic('pen',13)}</span>`:''}${x.acoes||''}</div>
  </div>`;
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

   O nome do mês leva o mês num data-mes-nome, e o corpo de cada linha a
   classe txcorpo: são as duas peças que a caixa da seleção empurra, e é por
   elas que cloud/selecao.js:selMedirDeslize as reencontra depois do render
   para as fazer deslizar em vez de saltar.
   Recebe: mo — o mes 'AAAA-MM'.
   Devolve: o HTML do bloco (string). */
function txMesHtml(mo){
  const xm=txMesExtra(mo)||{};
  return `<div class="txmes"><div class="section-title mov-mes${xm.cls?' '+xm.cls:''}" ${xm.attrs||''}>
    ${xm.caixa||''}<span class="txmes-nome" data-mes-nome="${esc(mo)}">${esc(mesPt(mo))}</span><span class="txnet"></span></div>
    <div class="list mov-lista"></div></div>`;
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
    const net=sum(by[mo].map(saldoNaVista));
    const sp=bl.querySelector('.txnet');
    /* «saldo +306,20 €», com o número na cor do dinheiro (o canvas) */
    if(sp)sp.innerHTML='saldo <b'+(Math.abs(net)<0.005?'':net>0?' class="pos"':' class="neg"')+'>'+(net>=0.005?'+':'')+euro2(net)+'</b>';
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
  /* a moldura é o que o render poria por cima da lista: também a casca — os
     separadores da área, que o render põe à frente de cada vista
     (vistas.js:render). Sem eles, a
     primeira tecla da pesquisa levava os separadores do telemóvel. */
  const molde=document.createElement('div');
  molde.innerHTML=abasDaArea()+vTransactions();
  const novaLista=molde.querySelector('#txLista');
  if(!novaLista){render();return null}
  /* A pesquisa fica o MESMO nó, com o foco e o que o teclado estava a compor;
     o painel dos filtros também, para não voltar ao topo a cada escolha — e
     repinta-se por dentro. */
  txGuardarNo(v,molde,'.mov-busca');
  const painel=txGuardarNo(v,molde,'.mov-fwrap');
  if(painel){const fp=painel.querySelector('.fpanel'),c=painel.querySelector('.mov-filtros-card');
    if(fp)fp.classList.toggle('on',!!txFiltAberto);
    if(c&&txFiltAberto)c.innerHTML=txFilterBody()}
  /* a moldura e tudo o que vem antes da lista: troca-se de uma vez, que e
     barato, e a lista fica de fora para ser comparada peca a peca */
  for(let n=antigaLista.previousElementSibling;n;){const p=n.previousElementSibling;n.remove();n=p}
  const nova=[];
  for(let n=novaLista.previousElementSibling;n;n=n.previousElementSibling)nova.unshift(n);
  nova.forEach(n=>v.insertBefore(n,antigaLista));
  const r=pintarListaTx();
  tornarFocavel(v);
  marcarDatasVazias(v);
  pintarBotaoFiltros();
  /* o botão do cabeçalho é da seleção nos movimentos (cloud/selecao.js), e o
     pintarBotaoFiltros acabou de o repor como funil */
  try{if(window.CW&&CW.selCabecalho)CW.selCabecalho()}catch(e){}
  return r;
}
/* Guarda um nó vivo da moldura de uma pintura para a seguinte: o novo, ainda
   no molde, dá o lugar ao que já está no ecrã.
   Recebe: v — o #view; molde — o elemento com a moldura nova; seletor — o do nó.
   Devolve: o nó guardado (já no molde), ou null quando falta um dos dois. */
function txGuardarNo(v,molde,seletor){
  const vivo=v.querySelector(seletor),novo=molde.querySelector(seletor);
  if(!vivo||!novo||!novo.parentNode)return null;
  novo.parentNode.replaceChild(vivo,novo);
  return vivo;
}
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
function txFiltrosLimpar(){txFilter='';txProp='';txPaid='';txCat='';txSub='';txNoPayer=true;txSearch='';txDe='';txAte='';txEtiq=[]}
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
