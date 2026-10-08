/* ================= DADOS ================= */
/* O que o «Guardar» (e o Enter) da janela aberta pelo promptModal faz: lê o
   campo, fecha a janela e entrega o texto ao cb dela. Cada promptModal
   troca-o, e o botão chama _pm(). É um var de topo para estar na lista dos
   nomes da app (eventos.js), que fecha no arranque: um window._pm posto
   dentro da função era recusado pelas ações. */
var _pm=null;
/* O «Escolher ficheiro» abre o seletor de ficheiros escondido (#swFile). Era
   um onclick com document.getElementById('swFile').click(), e o document não
   é um nome da app: fica fora da gramática das ações (eventos.js). Faz o
   mesmo, com o mesmo id fixo — sem o elemento, rebenta como rebentava.
   Recebe: nada.
   Devolve: nada — abre o seletor de ficheiros do sistema. */
function swEscolherFicheiro(){document.getElementById('swFile').click()}
// Devolve: o HTML (texto) da subpágina "Dados": importação do Splitwise,
// cópias de segurança e o botão de recomeçar.
function vImport(){
  return `${card('Importar do Splitwise','Despesas partilhadas de uma casa',`
    <div class="hint">No Splitwise: abre o grupo → <b>Export as spreadsheet</b> → guarda o CSV.</div>
    <div class="toolbar u-m-14px-0-0">
      <input type="file" id="swFile" class="u-d-none" data-change="swPick(this)">
      <button class="btn primary" data-toca="camada" data-click="swPasteBox()">Colar o texto do CSV</button>
      <button class="btn" data-toca="camada" data-click="swEscolherFicheiro()">Escolher ficheiro</button></div>
    <div class="hint u-mt-11px">Se o botão de escolher ficheiro não abrir nada, estás a ver a app fora do telemóvel — usa a opção de colar o texto.</div>
    ${db.transactions.some(t=>t.batch)?`<div class="divider"></div><button class="btn sm danger" data-toca="dados" data-risco="destroi" data-click="undoImport()">Anular a última importação</button>`:''}`)}
  <div class="u-h-14px"></div>
  ${card('Guardar ficheiros','',`
    <div class="toolbar u-m-0">
      <button class="btn" data-toca="nada" data-click="exportarSoMeu(driveSave)">Guardar cópia</button>
      <button class="btn" data-toca="camada" data-click="driveOpen()">Abrir cópia</button>
      <button class="btn" data-toca="nada" data-click="exportarSoMeu(downloadCsv)">Exportar CSV</button>
      <button class="btn" data-toca="camada" data-click="bkPasteBox()">Colar cópia</button></div>
    ${casasDeColaboracao().length?'<div class="hint u-mt-11px">As cópias levam só o que é teu — os imóveis onde colaboras ficam de fora.</div>':''}`)}
  <div class="u-h-14px"></div>
  ${card('Recomeçar','Apaga tudo o que está guardado neste dispositivo',`<button class="btn danger" data-toca="dados" data-risco="destroi" data-click="wipe()">Apagar todos os dados</button>`)}
  <div class="hint u-ta-center u-mt-18px">Fotos e documentos ficam no dispositivo e não entram na cópia em JSON.</div>`;
}

/* Corre uma exportação (cópia de segurança, CSV) sobre a base só com o que é
   meu: os imóveis onde colaboro e os registos deles ficam de fora. As funções
   de copias.js leem a db global no momento da chamada, por isso troca-se a
   base durante a chamada e repõe-se logo a seguir — sem imóveis de
   colaboração, corre tal e qual.
   Recebe: fn — a função de exportar (sem argumentos), ex.: driveSave ou downloadCsv.
   Devolve: nada — o que fn devolver é ignorado. */
function exportarSoMeu(fn){
  if(!casasDeColaboracao().length)return void fn();
  const real=db;db=dbSoMeu();
  try{fn()}finally{db=real}
}

/* ================= DEFINIÇÕES ================= */
// Recebe: title — o título da linha; sub — a linha pequena por baixo; icon — o
// nome do ícone (para ic); page — a chave da subpágina a abrir com goSet
// ('defaults', ou uma de SUBPAGE — as da base e as que a nuvem lhe junta).
// Devolve: o HTML (texto) de uma linha de navegação das Definições.
const navRow=(title,sub,icon,page)=>`<div class="card tap u-d-flex u-ai-center u-g-13px" data-toca="ecra" data-click="goSet('${jsq(page)}')">
  <span class="avatar">${ic(icon,18)}</span>
  <span class="u-fx-1 u-minw-0"><b class="u-d-block">${esc(title)}</b><span class="small">${esc(sub)}</span></span>
  <span class="u-c-v-muted u-tf-rotate-180deg">${ic('chev',18)}</span></div>`;
/* Voltar, colado ao topo: nos documentos longos (termos, política) o botão
   dizia "Definições" e desaparecia com o scroll — a meio de 300 linhas não
   havia porta de saída à vista. O do fundo já dizia Voltar; agora dizem o
   mesmo e um deles está sempre presente. */
const backRow=`<div class="toolbar u-pos-sticky u-t-calc-57px-v-inset-top u-z-20 u-bg-v-bg u-p-8px-0 u-m-n6px-0-6px">
  <button class="btn" data-toca="ecra" data-click="goSet('')">${ic('chev',15)} Voltar</button></div>`;

/* Subpágina "Valores por omissão": crescimento das rendas, inflação, horizonte,
   yield de avaliação e imposto do selo. Cada campo grava logo ao sair (setSet)
   e nenhum recusa o vazio — por isso dizem «Opcional» (a regra dos
   formulários), e a nota de cada cartão diz o que vale em branco: o aumento,
   a inflação e o selo contam 0 %, o horizonte 1 ano, o yield volta aos 5 %.
   Devolve: o HTML (texto) da subpágina. */
function vDefaults(){
  const s=db.settings;
  return `${card('Projeções','Como rendas e despesas evoluem nos gráficos de futuro',`
    <div class="row3">
      <label>Aumento anual das rendas (%)<input id="def_growth" type="text" inputmode="decimal" value="${dec(s.growth)}" placeholder="Opcional" data-change="setSet('growth',numTaxa(this.value))"></label>
      <label>Inflação das despesas (%)<input id="def_inflation" type="text" inputmode="decimal" value="${dec(s.inflation)}" placeholder="Opcional" data-change="setSet('inflation',numTaxa(this.value))"></label>
      <label>Horizonte (anos)<input id="def_years" type="text" inputmode="numeric" value="${s.years}" placeholder="Opcional" data-change="setSet('years',Math.min(30,Math.max(1,num(this.value))))"></label></div>
    <div class="hint">Em branco, o aumento e a inflação contam 0 % e o horizonte 1 ano (no máximo 30).</div>`)}
  ${servicoLigado('reports')?`<div class="u-h-14px"></div>
  ${card('Avaliação','Usado ao avaliar os imóveis pelo rendimento',`
    <label>Yield exigido na avaliação (%)<input id="def_capTarget" type="text" inputmode="decimal" value="${dec(s.capTarget)}" placeholder="Opcional" data-change="capTargetSet(this.value)"></label>
    <div class="hint">O resultado anual de cada imóvel dividido por este yield dá o valor por rendimento. Tem de ser maior que zero; em branco volta aos 5 %.</div>`)}`:''}
  <div class="u-h-14px"></div>
  ${card('Crédito à habitação','Usado nas prestações e nos planos das hipotecas',`
    <label>Imposto do selo sobre juros (%)<input id="def_stamp" type="text" inputmode="decimal" value="${dec(s.stampPct??4)}" placeholder="Opcional" data-change="setSet('stampPct',Math.max(0,numTaxa(this.value)))"></label>
    <div class="hint">Percentagem cobrada sobre os juros de cada prestação. Em Portugal é 4 %; em branco conta 0 %. As hipotecas com o imposto do selo desligado não são afetadas.</div>`)}`;
}
/* A raiz das Definições, como dados. É uma só: a base declara as secções e as
   linhas dela, e a nuvem acrescenta as suas (linhaDefinicoes) — o perfil e a
   conta, a ajuda, as perguntas frequentes, as novidades, o aviso legal e a app
   no telemóvel. Chegou a haver duas: a da base e uma que a nuvem escrevia por
   cima dela; a da nuvem esqueceu «IRS e dedução» e «Filtros comuns», e a
   página dos filtros comuns ficou sem porta nenhuma na app a sério.
   Uma linha é {sec, ordem, page, label, icon, sub} — abre a subpágina page, e
   sub pode ser uma função, lida a cada pintura — ou {sec, ordem, html}, um
   cartão inteiro (html é uma função que pode devolver ''). A versão do cartão
   Sobre é a VERSAO do avisos.js (a primeira entrada, que nunca se escreve à
   mão); ele só carrega depois da primeira pintura do arranque (index.html), e
   até lá fica um traço. Os Grupos já viveram aqui, em Dados; passaram a
   separador próprio (vGrupos), ao lado dos Imóveis, quando se passou a poder
   partilhar um grupo — numa subpágina das Definições ninguém o encontrava. */
const DEF_SECCOES=[['conta','Conta'],['aplicacao','Aplicação'],['dados','Dados'],['ajuda','Ajuda'],['sobre','Sobre']];
const DEF_LINHAS=[
  {sec:'aplicacao',ordem:10,page:'tema',label:'Tema',icon:'sun',sub:()=>({auto:'Automático',light:'Claro',dark:'Escuro'})[db.settings.theme]||'Automático'},
  {sec:'aplicacao',ordem:20,page:'defaults',label:'Valores por omissão',icon:'trend',sub:'Aumentos, inflação e imposto do selo'},
  {sec:'dados',ordem:10,page:'cats',label:'Tipos de movimento',icon:'swap',sub:()=>{const cs=cats(),ci=catsIn();
    return (Object.keys(cs).length+Object.keys(ci).length)+' categorias · '+sum(Object.keys(cs).map(k=>cs[k].length).concat(Object.keys(ci).map(k=>ci[k].length)))+' subtipos'}},
  {sec:'dados',ordem:20,page:'irs',label:'IRS e dedução',icon:'recibo',sub:'Que despesas entram em cada coluna do Anexo F'},
  {sec:'dados',ordem:30,page:'tags',label:'Etiquetas',icon:'tag',sub:()=>(db.settings.tags||[]).length+' etiquetas'},
  {sec:'dados',ordem:50,page:'filtros',label:'Filtros comuns',icon:'filter',sub:()=>(db.settings.filters||[]).length+' filtros'},
  {sec:'dados',ordem:60,page:'dados',label:'Importar e cópias',icon:'down',sub:'Splitwise, cópias de segurança e recomeçar'},
  {sec:'sobre',ordem:50,html:()=>card('Rendorium','',`<div class="stat"><span>Versão</span><b>${typeof VERSAO!=='undefined'?esc(VERSAO):'—'}</b></div>
    <div class="stat"><span>Imóveis · contratos</span><b>${db.properties.length} · ${db.contracts.length}</b></div>
    <div class="stat"><span>Inquilinos · proprietários</span><b>${db.tenants.length} · ${db.owners.length}</b></div>
    <div class="stat u-b-0"><span>Movimentos</span><b>${db.transactions.length}</b></div>`)},
];
/* Acrescenta uma linha à raiz das Definições. É a porta da nuvem (e de quem
   vier depois): a linha entra na secção dela, pela ordem, sem reescrever a
   página de ninguém.
   Recebe: l — {sec, ordem, page, label, icon, sub} ou {sec, ordem, html}.
   Devolve: nada. */
function linhaDefinicoes(l){DEF_LINHAS.push(l)}
/* A raiz das Definições: as secções pela ordem de DEF_SECCOES, cada uma com o
   título e as linhas pela ordem delas; uma secção sem nada para mostrar não
   aparece (sem a nuvem, a Conta e a Ajuda).
   Devolve: o HTML (texto). */
function raizDasDefinicoes(){
  const gap='<div class="u-h-10px"></div>';
  return DEF_SECCOES.map(([id,titulo])=>{
    const ls=DEF_LINHAS.filter(l=>l.sec===id).sort((a,b)=>a.ordem-b.ordem)
      .map(l=>l.html?l.html():navRow(l.label,typeof l.sub==='function'?l.sub():l.sub,l.icon,l.page)).filter(Boolean);
    return ls.length?`<div class="section-title">${esc(titulo)}</div>`+ls.join(gap):'';
  }).join('');
}
/* A subpágina do Tema: claro, escuro ou o do telemóvel. O subtítulo do
   automático diz o que ele está a resolver agora — sem isso, um browser que
   não passa a preferência do sistema parece um erro da app —, e quando o
   browser diz «claro» explica onde se muda no da Samsung. Vale só neste
   aparelho. Viveu na nuvem, e é da base: o tema não precisa de conta.
   Devolve: o HTML (texto) da subpágina, sem o Voltar. */
function vTema() {
  var t = db.settings.theme;
  return card('Tema', 'Como a app se apresenta',
    '<div class="seg c3">' +
    // o subtítulo do automático diz o que ele está a resolver agora: sem
    // isso, um browser que não passa a preferência do sistema parece um
    // erro da app
    [['auto', 'auto', 'Automático', 'agora: ' + (mq().matches ? 'escuro' : 'claro')],
      ['light', 'sun', 'Claro', ''], ['dark', 'moon', 'Escuro', '']]
      .map(function (o) {
        return '<button type="button" class="opt ' + (t === o[0] ? 'on' : '') + '" data-toca="dados" data-click="setTheme(\'' + o[0] + '\')">' +
          '<span class="ic">' + ic(o[1], 18) + '</span><b>' + o[2] + '</b>' +
          (o[3] ? '<small>' + o[3] + '</small>' : '') + '</button>';
      }).join('') + '</div>' +
    '<div class="hint u-mt-11px">Vale só neste aparelho.</div>' +
    (t === 'auto' && !mq().matches
      ? '<div class="hint u-mt-9px">O automático segue o que o browser diz preferir, e este está a dizer <b>claro</b>. ' +
        'Se tens o aparelho em escuro, é o browser que não está a passar a preferência. No browser da Samsung há duas opções, ' +
        'e o modo escuro sozinho pode não chegar: <b>Definições → Visualização e deslocamento de página → Modo escuro</b>, e ' +
        '<b>Definições → Labs → Usar tema escuro do site</b>. Se mesmo assim ficar em claro, escolhe <b>Escuro</b> aqui — ' +
        'essa opção não depende do browser e funciona sempre.</div>'
      : ''));
}
/* Vista principal das Definições: com setPage preenchido devolve a subpágina
   respetiva (com o Voltar colado ao topo); sem ele, a raiz
   (raizDasDefinicoes). A nuvem embrulha esta função só para as subpáginas
   dela (cloud/partilha.js, cloud/novidades.js). A subpágina antiga dos
   Grupos já não tem porta (são um separador): quem lá chegar por um caminho
   velho sem a nuvem — que o leva ao separador (cloud/nucleo.js:goSet,
   restorePage) — vê na mesma os grupos, em vez da raiz sem explicação.
   Devolve: o HTML (texto) da raiz ou da subpágina ativa. */
function vSettings(){
  if(setPage==='tema')return backRow+vTema();
  if(setPage==='defaults')return backRow+vDefaults();
  if(setPage==='cats')return backRow+vCats();
  if(setPage==='tags')return backRow+vTags();
  if(setPage==='groups')return backRow+vGrupos();
  if(setPage==='filtros')return backRow+vFiltrosComuns();
  if(setPage==='irs')return backRow+vIrsMapa();
  if(setPage==='dados')return backRow+vImport();
  return raizDasDefinicoes();
}
/* cada árvore serve um grupo de tipos: receitas (rendas, dívidas recebidas) ou pagamentos (despesas, prestações, dívidas pagas)
   Recebe: tk — a árvore ('cats' ou 'catsIn').
   Devolve: os movimentos cujo tipo usa essa árvore (array). */
const treeTx=tk=>db.transactions.filter(t=>treeKey(t.kind)===tk);
/* Cartão editável de uma árvore de categorias (tk: 'cats' ou 'catsIn'):
   renomear escrevendo no próprio nome, apagar, tirar dos totais (botão €)
   e gerir subcategorias em chips. O crachá diz quantos movimentos a usam.
   O nome é obrigatório (renameCat recusa o vazio e volta ao que era), mas
   não tem rótulo onde pôr o asterisco: diz o que é ao leitor de ecrã
   (aria-label) e, apagado, mostra um exemplo.
   Recebe: tk — a árvore: 'cats' (pagamentos) ou 'catsIn' (receitas); title — o
   título do cartão (pode ir vazio, dentro das dobras); sub — o subtítulo.
   Devolve: o HTML (texto) do cartão. */
function catTree(tk,title,sub){
  const cs=db.settings[tk]||{},txs=treeTx(tk);
  return card(title,sub,`
    <div class="list u-g-9px">${Object.keys(cs).map((k,i)=>`
      <div class="card u-p-12px-13px">
        <div class="row-between u-ai-center">
          <input id="catn_${esc(tk)}_${i}" value="${esc(k)}" aria-label="Nome da categoria" placeholder="Ex: ${tk==='catsIn'?'Alojamento local':'Jardim e piscina'}" autocomplete="off" class="u-fw-650 u-b-0 u-p-4px-0 u-bg-transparent" data-change="renameCat('${jsq(tk)}','${jsq(k)}',this.value)">
          <div class="u-d-flex u-g-5px u-fx-0-0-auto">
            <span class="badge grey">${txs.filter(t=>t.category===k).length}</span>
            <button class="btn sm ${db.settings.exclude[excKey(tk,k)]?'danger':''}" title="Contar (ou não) nos totais" data-toca="dados" data-click="toggleExc('${jsq(tk)}','${jsq(k)}')">€</button>
            <button class="btn sm danger" data-toca="dados" data-risco="destroi" data-click="delCat('${jsq(tk)}','${jsq(k)}')">${ic('trash',14)}</button></div></div>
        ${db.settings.exclude[excKey(tk,k)]?'<div class="small u-mt-2px"><b class="neg">Fora dos totais</b> — os movimentos ficam na lista mas não somam.</div>':''}
        <div class="chips">${(cs[k]||[]).map(sb=>{const off=db.settings.exclude[excKey(tk,k,sb)]||db.settings.exclude[excKey(tk,k)];return `<span class="tag grey ${off?'u-op-055':''}">
          <span class="u-cur-pointer ${off?'u-td-line-through':''}" data-toca="camada" data-click="renameSub('${jsq(tk)}','${jsq(k)}','${jsq(sb)}')" title="Mudar o nome">${esc(sb)}</span>
          <button type="button" class="u-fw-800 u-fs-11px" data-toca="dados" data-click="toggleExc('${jsq(tk)}','${jsq(k)}','${jsq(sb)}')" title="Contar (ou não) nos totais">€</button>
          <button type="button" data-toca="dados" data-risco="destroi" data-click="delSub('${jsq(tk)}','${jsq(k)}','${jsq(sb)}')">${ic('x',13)}</button></span>`}).join('')}
          <button type="button" class="tagadd" data-toca="camada" data-click="addSub('${jsq(tk)}','${jsq(k)}')">+ subcategoria</button></div>
      </div>`).join('')}</div>
    <div class="toolbar u-m-13px-0-0"><button class="btn primary" data-toca="camada" data-click="addCat('${jsq(tk)}')">${ic('plus',15)} Nova categoria</button></div>`);
}
// Subpágina "Tipos de movimento": as duas árvores (receitas e pagamentos) em
// dobras, mais o botão de repor as listas de origem.
// Devolve: o HTML (texto) da subpágina.
function vCats(){
  const n=tk=>Object.keys(db.settings[tk]||{}).length+' categorias';
  return `<div class="form">
    ${fold('catsIn','Receitas',catTree('catsIn','','Rendas, reembolsos e dinheiro recebido de terceiros'),{icon:'up',open:true,summary:n('catsIn')})}
    ${fold('cats','Pagamentos',catTree('cats','','Despesas, prestações e dívidas pagas a terceiros'),{icon:'dn',summary:n('cats')})}</div>`
    +`<div class="toolbar u-m-13px-0-0"><button class="btn" data-toca="dados" data-risco="destroi" data-click="resetCats()">Repor as de origem</button></div>
  <div class="hint u-mt-14px">O número é quantos movimentos usam a categoria. Apagá-la não apaga movimentos — ficam sem categoria. O botão € tira-a dos totais, sem sair da lista.</div>`;
}
// Subpágina "Etiquetas": cada uma com o número de movimentos que a usam,
// botão de apagar e botão de criar nova.
// Devolve: o HTML (texto) da subpágina.
function vTags(){
  const tg=db.settings.tags||[];
  const usage=g=>db.transactions.filter(t=>(t.tags||[]).indexOf(g)>-1).length;
  return `${card('Etiquetas','Marcas livres para cruzares com qualquer categoria',
    tg.length?`<div class="list u-g-8px">${tg.map(g=>`
      <div class="card u-p-11px-13px u-d-flex u-ai-center u-g-11px">
        <span class="tag grey u-p-5px-11px">${esc(g)}</span>
        <span class="spacer"></span>
        <span class="small">${usage(g)} movimento${usage(g)===1?'':'s'}</span>
        <button class="btn sm danger" data-toca="dados" data-risco="destroi" data-click="delTag('${jsq(g)}')">${ic('trash',14)}</button></div>`).join('')}</div>`
    :`<div class="hint"></div>`)}
  <div class="toolbar u-m-13px-0-0"><button class="btn primary" data-toca="camada" data-click="addTag()">${ic('plus',15)} Nova etiqueta</button></div>`;
}
/* ===== grupos ===== */
const GKIND={prop:{label:'Imóveis',icon:'building',one:'imóvel'},owner:{label:'Proprietários',icon:'crown',one:'proprietário'},contract:{label:'Contratos',icon:'contract',one:'contrato'}};
// Nome legível de um membro de grupo a partir do tipo e do id; '' se já não existir.
// Recebe: kind — o tipo do grupo: 'prop', 'owner' ou 'contract'; id — o id do membro.
// Devolve: o nome (texto); '' se o membro já não existir.
function gMemberName(kind,id){
  if(kind==='prop')return propName(id);
  if(kind==='owner')return (owner(id)||{}).name||'';
  const c=contract(id);return c?ctName(c):'';
}
/* A nuvem dos grupos partilhados está carregada? A base não conhece a nuvem
   por garantia (cloud/grupos.js carrega depois, e os testes da base correm
   sem ela): um grupo _partilhado só existe com ela, e as portas para as
   janelas dela (CW.grupoModal, CW.grupoPartilhar, CW.grupoNovo) só se
   escrevem quando ela está.
   Devolve: true com cloud/grupos.js carregado. */
function nuvemDosGrupos(){return typeof window!=='undefined'&&!!window.CW&&typeof CW.grupoModal==='function'}
/* Posso partilhar grupos de imóveis agora: com a nuvem dos grupos, com
   sessão e com o serviço Colaboradores ligado nesta conta — as três
   condições do servidor (worker/src/rotas/grupos.js). Decide só o cartão
   «Grupos partilhados» em cima (vGrupos), que lista o que vive no servidor.
   O «Partilhar» de cada grupo não depende disto: está sempre que a nuvem dos
   grupos está, e o toque diz o que falta (cloud/grupos.js:CW.grupoPartilhar).
   Devolve: true se posso. */
function podePartilharGrupos(){return nuvemDosGrupos()&&!!CW.user&&servicoLigado('colaboradores')}
/* O selo de um grupo partilhado na lista: «Partilhado · N pessoas», e «de
   <dono>» quando não é meu.
   Recebe: g — o grupo.
   Devolve: HTML do selo (texto), ou '' num grupo privado. */
function seloDoGrupo(g){
  if(!g||!g._partilhado)return '';
  const n=(g._membros||[]).length;
  return `<span class="badge grey u-ml-7px">Partilhado · ${n} ${n===1?'pessoa':'pessoas'}${g._meu?'':' · de '+esc(g._donoNome||'')}</span>`;
}
/* Os grupos por tipo (imóveis, proprietários, contratos) — a parte de baixo
   do separador Grupos (vGrupos). Cada grupo com os membros em resumo; tocar
   num abre o modal de edição, ou a janela da nuvem num grupo partilhado
   (seloDoGrupo). TODO o grupo de imóveis que não é partilhado tem
   «Partilhar» à vista no próprio cartão, sempre que a nuvem dos grupos está
   carregada — com sessão ou sem ela, com imóveis meus ou sem eles. Chegou a
   esconder-se sem sessão, sem o serviço e num grupo sem imóveis criados por
   mim (cwMinha), e quem só tinha grupos assim via «Novo grupo partilhado» e
   nenhum «Partilhar», sem saber porquê; agora o toque
   (cloud/grupos.js:CW.grupoPartilhar) diz o que falta em cada caso. O botão trava o toque
   (event.stopPropagation), senão abria também a janela de edição por baixo.
   «Novo grupo partilhado» não vive aqui: está no cartão dos partilhados, em
   cima. Sem a nuvem (a base sozinha) não há botão: não haveria quem o
   atendesse.
   Recebe: semPartilhados (opcional) — true para deixar de fora os grupos
   partilhados, quando o separador já os mostra em cima.
   Devolve: o HTML (texto). */
function vGroups(semPartilhados){
  const nuvem=nuvemDosGrupos();
  const botao=g=>nuvemDosGrupos()&&g.kind==='prop'&&!g._partilhado?`<button type="button" class="btn sm u-fx-0-0-auto" data-toca="camada" data-click="event.stopPropagation();CW.grupoPartilhar('${jsq(g.id)}')">${ic('users',14)} Partilhar</button>`:'';
  const secs=['prop','owner','contract'].map(kind=>{
    const gs=grpsOf(kind).filter(g=>!(semPartilhados&&g._partilhado));
    const abrir=g=>g._partilhado&&nuvemDosGrupos()?`CW.grupoModal('${jsq(g.id)}')`:`groupModal('${jsq(kind)}','${jsq(g.id)}')`;
    return `<div class="section-title">${GKIND[kind].label}</div>
      ${gs.length?`<div class="list">${gs.map(g=>`<div class="card tap" data-toca="camada" data-click="${abrir(g)}">
        <div class="row-between u-ai-center">
          <div class="u-d-flex u-g-11px u-ai-center u-minw-0"><span class="avatar">${ic(g._partilhado?'users':GKIND[kind].icon,17)}</span>
            <div class="u-minw-0"><div class="title">${esc(g.name)}${seloDoGrupo(g)}</div>
            <div class="small u-ov-hidden u-to-ellipsis u-ws-nowrap">${g.ids.length} ${g.ids.length===1?GKIND[kind].one:GKIND[kind].label.toLowerCase()} · ${esc(g.ids.map(id=>gMemberName(kind,id)).filter(Boolean).join(', '))||'sem membros'}</div></div></div>
          <div class="u-d-flex u-ai-center u-g-8px u-fx-0-0-auto">${botao(g)}<span class="u-c-v-muted u-tf-rotate-180deg u-fx-0-0-auto">${ic('chev',17)}</span></div></div></div>`).join('')}</div>`
      :`<div class="hint">Ainda não há grupos de ${GKIND[kind].label.toLowerCase()}.</div>`}
      <div class="toolbar u-m-11px-0-0"><button class="btn sm" data-toca="camada" data-click="groupModal('${jsq(kind)}')">${ic('plus',14)} Novo grupo de ${GKIND[kind].label.toLowerCase()}</button></div>`;
  }).join('');
  return secs+`<div class="hint u-mt-16px">Servem de filtro em toda a app. Um movimento atribuído a um grupo de imóveis divide-se por eles.${nuvem?' «Partilhar» passa um grupo de imóveis a partilhado: quem entrar, e tu aceitares, fica comproprietário dos imóveis dele. Só entram os imóveis teus.':''}</div>`;
}
/* O separador «Grupos» (navegacao.js:TABS), da base como as Definições: os
   grupos são filtros de toda a app, e só a parte partilhada é do serviço
   Colaboradores. Em cima, quando posso partilhar (podePartilharGrupos: a
   nuvem dos grupos, a sessão e o serviço), o cartão «Grupos partilhados» da
   nuvem (cloud/grupos.js:gruposCard — os meus e os dos outros, os pedidos
   que fiz, «Novo grupo partilhado» e «Partilhar um grupo que já tens»); por
   baixo, os grupos por tipo, sem os partilhados, que já estão em cima. Sem
   poder partilhar não há cartão (não há o que listar do servidor), mas cada
   grupo de imóveis continua com o «Partilhar» (vGroups), e o toque diz o que
   falta — entrar, ligar o serviço — em vez de o botão desaparecer.
   Devolve: o HTML (texto) da vista. */
function vGrupos(){
  const topo=podePartilharGrupos()&&typeof gruposCard==='function'?gruposCard():'';
  return (topo?topo+'<div class="u-h-14px"></div>':'')+vGroups(!!topo);
}
let gForm=null;
/* Abre o modal de criar (só kind) ou editar (com id) um grupo. Trabalha numa
   cópia (gForm) — nada é gravado até Guardar, que exige nome e pelo menos um
   membro antes de escrever em db.groups. Um grupo partilhado não se edita
   aqui: a janela é a da nuvem (CW.grupoModal). Num grupo de imóveis privado
   já guardado, com a nuvem dos grupos, o menu tem sempre «Partilhar este
   grupo…» — e o corpo o mesmo como botão à vista (groupBody): no ⋯ ninguém
   o achava. Sem sessão, com o serviço desligado, num grupo vazio ou só com
   imóveis dos outros, o toque explica (cloud/grupos.js:CW.grupoPartilhar).
   O guardar recusa o nome vazio e o grupo sem membros: os dois levam o
   asterisco (groupBody).
   Recebe: kind — o tipo do grupo: 'prop', 'owner' ou 'contract'; id (opcional)
   — o id do grupo a editar; sem ele cria um novo.
   Devolve: nada — abre o modal. */
function groupModal(kind,id){
  const g0=id?grp(id):null;
  if(g0&&g0._partilhado&&nuvemDosGrupos())return CW.grupoModal(id);
  gForm=normGroup(id?JSON.parse(JSON.stringify(grp(id))):{kind});
  const itens=[];
  if(g0&&g0.kind==='prop'&&!g0._partilhado&&nuvemDosGrupos())itens.push({label:'Partilhar este grupo…',icon:'users',toca:'camada',act:`CW.grupoPartilhar('${jsq(id)}')`});
  if(id)itens.push({label:'Apagar grupo',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delGroup('${jsq(id)}')`});
  const m=id?menu('grp',itens):'';
  openModal(id?'Editar grupo':'Novo grupo de '+GKIND[kind].label.toLowerCase(),groupBody(),null,m);
  onSave=()=>{
    gForm.name=val('g_name').trim();
    if(!gForm.name)return toast('Dá um nome ao grupo.');
    if(gForm.ids.length<1)return toast('Escolhe pelo menos um membro.');
    db.groups=db.groups||[];
    const i=db.groups.findIndex(x=>x.id===gForm.id);
    if(i<0)db.groups.push(gForm);else db.groups[i]=gForm;
    save();closeModal();render();toast('Grupo guardado.');
  };
}
/* Corpo do modal do grupo, gerado a partir de gForm: nome e membros em chips,
   os dois com o asterisco vermelho — o guardar recusa um nome vazio e um
   grupo sem membros (groupModal) — e o nome com um exemplo do tipo dele. Num
   grupo de imóveis privado já guardado, com a nuvem dos grupos, «Partilhar
   este grupo» à vista no fim, sempre, com o que isso quer dizer; quando não
   dá (sem sessão, sem o serviço, sem imóveis meus), o toque explica
   (CW.grupoPartilhar). Partilha-se o grupo como está guardado: a
   confirmação fecha esta janela, e o que se mudou aqui sem guardar fica
   para trás — a nota di-lo. Um grupo novo ainda não está em db.groups e não
   tem o botão.
   Devolve: o HTML (texto) do corpo do modal. */
function groupBody(){
  const g=gForm,tags=g.ids.map(id=>({id,label:gMemberName(g.kind,id)||'?'}));
  const partilhar=g.kind==='prop'&&!g._partilhado&&!!grp(g.id)&&nuvemDosGrupos();
  return `<div class="form">
    <label>Nome do grupo <span class="req">*</span><input id="g_name" value="${esc(g.name)}" placeholder="Ex: ${g.kind==='prop'?'Casas de Lisboa':g.kind==='owner'?'Família':'Contratos T2'}" autocomplete="off"></label>
    <div><div class="flabel">${GKIND[g.kind].label} no grupo <span class="req">*</span></div>${tagField(tags,'Adicionar','addGroupMember()','delGroupMember')}</div>
    ${g.kind==='prop'?`<div class="hint">Um movimento atribuído a este grupo divide-se pelos imóveis (em partes iguais, pelo valor, por percentagens…).</div>`:''}
    ${partilhar?`<div><div class="flabel">Partilhar</div>
      <button type="button" class="btn sm" data-toca="camada" data-click="CW.grupoPartilhar('${jsq(g.id)}')">${ic('users',14)} Partilhar este grupo</button>
      <div class="hint u-mt-6px">Quem entrar pela ligação, e tu aceitares, fica comproprietário dos imóveis do grupo; só entram os imóveis teus — os de outras pessoas ficam de fora. Partilha-se o grupo como está guardado.</div></div>`:''}</div>`;
}
// Redesenha o corpo do modal do grupo depois de mexer nos membros, sem o fechar.
// Devolve: nada — redesenha o corpo do modal.
function repaintGroup(){const b=modalBodyEl();if(b)b.innerHTML=groupBody()}
/* Seletor com os candidatos que ainda não estão no grupo (imóveis,
   proprietários ou contratos, conforme o tipo). Recolhe primeiro o nome já
   escrito para gForm, para o repinte não o perder.
   Devolve: nada — ao escolher, junta o membro a gForm e repinta o modal. */
function addGroupMember(){
  gForm.name=val('g_name');
  const g=gForm;
  let cands=[];
  if(g.kind==='prop')cands=db.properties.filter(p=>g.ids.indexOf(p.id)<0).map(p=>({v:p.id,label:p.name,icon:'building'}));
  else if(g.kind==='owner')cands=db.owners.filter(o=>g.ids.indexOf(o.id)<0).map(o=>({v:o.id,label:o.name,avatar:true}));
  else cands=db.contracts.filter(c=>g.ids.indexOf(c.id)<0).map(c=>({v:c.id,label:ctName(c),sub:propName(c.propertyId),icon:'contract'}));
  pickModal('Adicionar ao grupo',cands,o=>{g.ids.push(o.v);closeModal();repaintGroup()});
}
// Tira um membro do grupo em edição (só em gForm) e repinta; recolhe antes o nome escrito.
// Recebe: id — o id do membro a tirar.
// Devolve: nada — atualiza gForm e repinta o corpo do modal.
function delGroupMember(id){gForm.name=val('g_name');gForm.ids=gForm.ids.filter(x=>x!==id);repaintGroup()}
/* Apaga o grupo depois de confirmar com o impacto. Os movimentos registados no
   grupo já estão partidos por imóvel (movimento.js:partirMovimento) e ficam
   como estão, cada parte no seu imóvel; só os do formato antigo, ainda por
   partir (um registo só, com o grupo), ficam sem grupo — «Sem imóvel», a
   contar só nos totais — e a frase di-lo antes. Os filtros ativos que
   apontavam para ele são limpos. Grava e repinta. Um grupo partilhado é do
   servidor: o dono apaga-o lá (CW.grupoApagar), quem não é dono sai dele
   (CW.grupoSair).
   Recebe: id — o id do grupo a apagar.
   Devolve: nada — abre a confirmação; só ao confirmar apaga e grava. */
function delGroup(id){
  const g=grp(id),used=db.transactions.filter(t=>t.groupId===id).length;
  const partidos=new Set(db.transactions.filter(t=>t.lote&&t.lote.alvo==='g:'+id).map(t=>t.lote.id)).size;
  if(g&&g._partilhado&&nuvemDosGrupos())return g._meu?CW.grupoApagar(id):CW.grupoSair(id);
  confirmModal('Apagar grupo',`Apagar o grupo “${esc((g||{}).name||'')}”?`+
    (partidos?` ${partidos===1?'O movimento já registado':'Os '+partidos+' movimentos já registados'} neste grupo ${partidos===1?'fica em cada imóvel, como está':'ficam em cada imóvel, como estão'}.`:'')+
    (used?` ${used===1?'Um movimento antigo, ainda por dividir pelos imóveis, fica':used+' movimentos antigos, ainda por dividir pelos imóveis, ficam'} sem grupo: passa${used===1?'':'m'} a «Sem imóvel» e conta${used===1?'':'m'} só nos totais.`:''),()=>{
    db.transactions.forEach(t=>{if(t.groupId===id){t.groupId=null;t.psplit=null}});
    if(String(txProp).slice(2)===id)txProp='';
    if(String(ownerFilter).slice(2)===id)ownerFilter='';
    db.groups=(db.groups||[]).filter(x=>x.id!==id);
    save();closeAllModals();render();toast('Grupo apagado.');
  });
}
/* O Enter no campo do promptModal vale por Guardar. Era um onkeydown com um
   if, que fica fora da gramática das ações (eventos.js); a ação passa-lhe o
   event e ela faz o mesmo, pela mesma ordem.
   Recebe: ev — o evento de teclado.
   Devolve: nada — no Enter, trava o comportamento do browser e guarda. */
function pmTecla(ev){if(ev.key==='Enter'){ev.preventDefault();_pm()}}
/* Modal genérico de um só campo de texto. Enter equivale a Guardar; o cb só é
   chamado se sobrar texto depois do trim — o campo é sempre obrigatório, e
   por isso leva sempre o asterisco vermelho, como os outros formulários. O
   exemplo, quando o há, começa por «Ex: » (a regra dos placeholders).
   Foca o campo ao abrir.
   Recebe: title — o título do modal; label — o rótulo do campo; value — o
   texto inicial (pode vir null); cb — a função chamada com o texto (já com
   trim) quando se guarda com algo escrito; exemplo (opcional) — o texto do
   exemplo, sem o «Ex: » (ex.: 'Obras'), para o placeholder.
   Devolve: nada — abre o modal. */
function promptModal(title,label,value,cb,exemplo){
  const ph=exemplo?` placeholder="Ex: ${esc(exemplo)}"`:'';
  openModal(title,`<div class="form"><label>${esc(label)} <span class="req">*</span><input id="pm_v" value="${esc(value||'')}"${ph} autocomplete="off" data-keydown="pmTecla(event)"></label></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="_pm()">Guardar</button>`);
  _pm=()=>{const v=val('pm_v').trim();closeModal();if(v)cb(v)};
  setTimeout(()=>{const e=document.getElementById('pm_v');if(e)e.focus()},50);
}
// Pede o nome (com um exemplo da árvore) e cria uma categoria vazia na árvore tk; grava e repinta.
// Recebe: tk — a árvore: 'cats' (pagamentos) ou 'catsIn' (receitas).
// Devolve: nada — abre o prompt; só ao guardar cria e grava.
function addCat(tk){promptModal('Nova categoria','Nome da categoria',null,v=>{const cs=db.settings[tk]||(db.settings[tk]={});if(!cs[v])cs[v]=[];save();render();toast('Categoria criada.')},tk==='catsIn'?'Alojamento local':'Jardim e piscina')}
/* Leva as escolhas guardadas por categoria (as exclusões dos totais, as colunas do
   Anexo F) das chaves antigas para as novas, ou tira-as. Vai chave a chave, e não
   por prefixo: «Obras/» apanhava também uma categoria chamada «Obras/Casa», que é
   outra.
   Recebe: o — o objeto das escolhas (pode faltar); pares — array de [antiga, nova],
   com nova null para tirar.
   Devolve: nada — muda o objeto. */
function moverChaves(o,pares){
  if(!o)return;
  pares.forEach(([a,n])=>{if(!Object.prototype.hasOwnProperty.call(o,a))return;if(n!=null)o[n]=o[a];delete o[a]});
}
/* Leva as escolhas de categorias e subcategorias para os nomes novos, ou tira-as, em
   cada objeto de escolhas pela chave dele. O Anexo F só existe na árvore dos
   pagamentos.
   Recebe: tk — a árvore ('cats' ou 'catsIn'); pares — array de [de, para], cada um
   [categoria] ou [categoria, sub], com para null para tirar.
   Devolve: nada — muda db.settings.exclude e .irsMapa. */
function moverEscolhas(tk,pares){
  const st=db.settings,com=f=>pares.map(([a,n])=>[f(a[0],a[1]),n?f(n[0],n[1]):null]);
  moverChaves(st.exclude,com((c,sb)=>excKey(tk,c,sb)));
  if(tk!=='cats')return;
  moverChaves(st.irsMapa,com((c,sb)=>c+(sb?' / '+sb:'')));
}
/* Os pares de moverEscolhas para uma categoria inteira: ela e cada subcategoria dela.
   Recebe: tk — a árvore; cat — a categoria; nova — o nome novo, ou null para tirar.
   Devolve: array de [de, para]. */
const paresDaCategoria=(tk,cat,nova)=>[[[cat],nova==null?null:[nova]]]
  .concat(((db.settings[tk]||{})[cat]||[]).map(sb=>[[cat,sb],nova==null?null:[nova,sb]]));
/* Renomeia uma categoria mantendo a ordem (reconstrói o objeto) e atualiza os
   movimentos dessa árvore que a usavam e as escolhas guardadas por nome (fora dos
   totais, coluna do Anexo F). Nome vazio ou igual só repinta; o nome de
   outra categoria que já existe não se aceita — fundia as duas e perdia as subcategorias.
   Recebe: tk — a árvore: 'cats' ou 'catsIn'; oldName — o nome atual;
   newName — o nome novo, tal como vem do campo (é-lhe feito trim).
   Devolve: nada — grava e repinta. */
function renameCat(tk,oldName,newName){
  newName=String(newName||'').trim();
  if(!newName||newName===oldName)return render();
  const cs=db.settings[tk]||{},out={};
  if(Object.prototype.hasOwnProperty.call(cs,newName)){render();return toast('Já há uma categoria com esse nome.')}
  moverEscolhas(tk,paresDaCategoria(tk,oldName,newName));
  Object.keys(cs).forEach(k=>{out[k===oldName?newName:k]=cs[k]});
  db.settings[tk]=out;
  treeTx(tk).forEach(t=>{if(t.category===oldName)t.category=newName});
  save();render();toast('Categoria renomeada.');
}
// Apaga a categoria depois de confirmar com o impacto: os movimentos que a
// usavam ficam sem categoria nem subcategoria (não se apagam), e as escolhas
// dela (fora dos totais, coluna do Anexo F) saem com ela.
// Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria.
// Devolve: nada — abre a confirmação; só ao confirmar apaga e grava.
function delCat(tk,k){
  const used=treeTx(tk).filter(t=>t.category===k).length;
  confirmModal('Apagar categoria',`Apagar “${esc(k)}”?${used?` ${used} movimento(s) ficam sem categoria.`:''}`,()=>{
    moverEscolhas(tk,paresDaCategoria(tk,k,null));
    delete db.settings[tk][k];
    treeTx(tk).forEach(t=>{if(t.category===k){t.category='';t.sub=''}});
    save();render();toast('Categoria apagada.');
  });
}
// Pede o nome e junta uma subcategoria à categoria k (ignora repetidas); grava e repinta.
// Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria.
// Devolve: nada — abre o prompt; só ao guardar cria e grava.
function addSub(tk,k){promptModal('Nova subcategoria','Nome da subcategoria',null,v=>{
  const cs=db.settings[tk]||(db.settings[tk]={}),l=cs[k]||(cs[k]=[]);
  if(l.indexOf(v)<0)l.push(v);save();render();toast('Subcategoria criada.')},'Canalização')}
/* Muda o nome de uma subcategoria via prompt: atualiza a lista, os movimentos
   que a usavam e leva as escolhas dela (fora dos totais, coluna do Anexo F)
   para o nome novo. O nome de outra subcategoria da mesma categoria
   não se aceita: ficavam duas iguais.
   Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria;
   old — o nome atual da subcategoria.
   Devolve: nada — abre o prompt; só ao guardar renomeia e grava. */
function renameSub(tk,k,old){
  promptModal('Mudar o nome da subcategoria','Nome da subcategoria',old,nn=>{
    nn=String(nn||'').trim();if(!nn||nn===old)return;
    const cs2=db.settings[tk]||{},l=cs2[k]||[];
    if(l.indexOf(nn)>-1)return toast('Já há uma subcategoria com esse nome.');
    const i=l.indexOf(old);if(i>-1)l[i]=nn;
    treeTx(tk).forEach(t=>{if(t.category===k&&t.sub===old)t.sub=nn});
    moverEscolhas(tk,[[[k,old],[k,nn]]]);
    save();render();toast('Subcategoria renomeada.');
  },'Canalização');
}
// Apaga a subcategoria depois de confirmar com o impacto: sai da lista, dos
// movimentos que a usavam (ficam só sem subcategoria) e das escolhas guardadas.
// Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria;
// sb — o nome da subcategoria.
// Devolve: nada — abre a confirmação; só ao confirmar apaga e grava.
function delSub(tk,k,sb){
  /* apagar categoria e etiqueta confirmam com o impacto; a subcategoria
     executava logo — a mesma ação, na mesma página, ora protegia ora não */
  const usados=treeTx(tk).filter(t=>t.category===k&&t.sub===sb).length;
  confirmModal('Apagar subcategoria',`“${esc(sb)}” sai de ${k}${usados?` e de ${usados} movimento(s) que a usam`:''}.`,()=>{
    moverEscolhas(tk,[[[k,sb],null]]);
    const cs=db.settings[tk]||{};cs[k]=(cs[k]||[]).filter(x=>x!==sb);
    treeTx(tk).forEach(t=>{if(t.category===k&&t.sub===sb)t.sub=''});
    save();render();toast('Subcategoria apagada.');
  });
}
// Repõe as duas árvores nas listas de origem, após confirmação; os movimentos
// mantêm o texto de categoria que já tinham.
// Devolve: nada — abre a confirmação; só ao confirmar repõe e grava.
function resetCats(){
  confirmModal('Repor categorias','Volta às listas de origem (receitas e pagamentos). As categorias que criaste desaparecem; os movimentos mantêm o texto.',()=>{
    db.settings.cats=JSON.parse(JSON.stringify(CATS0));db.settings.catsIn=JSON.parse(JSON.stringify(CATS_IN0));save();render();toast('Categorias repostas.');
  });
}
/* ===== IRS e dedução ===== */
/* As chaves do mapa categoria → coluna, pela ordem em que a subpágina as
   desenha: a categoria, e logo a seguir cada «Categoria / Sub». É a mesma
   lista dos dois lados (vIrsMapa desenha um menu por chave, setIrsMapa lê-os
   pela posição), porque o sel chama o onchange pelo nome e sem dizer qual foi.
   Devolve: a lista de chaves (array de strings), pela ordem das categorias de pagamentos. */
const irsMapaChaves=()=>{const cs=cats(),l=[];Object.keys(cs).forEach(k=>{l.push(k);(cs[k]||[]).forEach(sb=>l.push(k+' / '+sb))});return l};
/* Subpágina «IRS e dedução»: o que o artigo 41.º do CIRS deixa deduzir, e um
   menu por categoria e por subcategoria de pagamentos a dizer em que coluna
   do Anexo F cai. É a regra por omissão: a coluna escolhida na ficha de uma
   despesa manda sobre isto (irs.js:irsColunaDe).
   Devolve: o HTML (texto) da subpágina. */
function vIrsMapa(){
  const m=irsMapa(),cs=cats(),chaves=irsMapaChaves();
  const cols=IRS_COLUNAS.map(([v,label])=>({v,label}));
  const optCat=[{v:'',label:'Outros gastos (por omissão)'}].concat(cols);
  const optSub=[{v:'',label:'Como a categoria'}].concat(cols);
  const menu=(rotulo,chave,opts)=>`<label>${esc(rotulo)}${sel('irsm_'+chaves.indexOf(chave),m[chave]||'',opts,'setIrsMapa','dados')}</label>`;
  const cartoes=Object.keys(cs).map(k=>card(esc(k),'',`<div class="form">
      ${menu('Coluna do Anexo F',k,optCat)}
      ${(cs[k]||[]).length?`<div class="flabel u-mt-4px">Subcategorias</div>${cs[k].map(sb=>menu(sb,k+' / '+sb,optSub)).join('')}`:''}</div>`))
    .join('<div class="u-h-14px"></div>');
  return `${card('O que o Anexo F deixa deduzir','Artigo 41.º do CIRS, em poucas linhas',`
    <div class="hint">Entra o que pagaste para obter a renda: conservação e manutenção, condomínio, taxas autárquicas, seguros, gestão, água e luz quando são tuas. O IMI e o imposto do selo têm coluna própria.</div>
    <div class="hint u-mt-8px">Ficam de fora, por lei: os juros e os gastos financeiros do crédito, as depreciações, o mobiliário, os eletrodomésticos e a decoração. Conservar é dedutível; beneficiar — uma cozinha nova, uma remodelação que acrescenta valor — não é.</div>
    <div class="hint u-mt-8px">Aqui dizes em que coluna cai cada categoria. A subcategoria pode ter regra própria; sem ela, segue a categoria.</div>`)}
  <div class="u-h-14px"></div>
  ${cartoes}
  <div class="toolbar u-m-13px-0-0"><button class="btn" data-toca="dados" data-risco="destroi" data-click="resetIrsMapa()">Repor as de origem</button></div>
  <div class="hint u-mt-14px">A coluna escolhida na ficha de uma despesa manda sobre estas regras — muda-a lá quando um gasto é a exceção. A página Declaração diz quais caíram em «Outros gastos» só por omissão.</div>`;
}
/* Grava a coluna do Anexo F de uma categoria ou subcategoria no mapa das
   definições. Vazio apaga a regra: a categoria volta a «Outros gastos», a
   subcategoria volta a seguir a categoria. Sem argumentos — é assim que os
   menus da subpágina chamam, porque o sel chama o onchange pelo nome e sem
   dizer qual foi (componentes.js:selPick) — lê todos os menus pela posição
   (irsMapaChaves) e grava o que mudou, como imovel.js:liveLoanAll faz com as
   hipotecas. Só toca nos menus que existem no ecrã: fora da subpágina não
   apaga nada.
   Recebe: chave (opcional) — 'Categoria' ou 'Categoria / Sub'; col (opcional)
   — o id da coluna (de IRS_COLUNAS), ou '' para apagar a regra.
   Devolve: nada — grava em db.settings.irsMapa e redesenha. */
function setIrsMapa(chave,col){
  db.settings.irsMapa=db.settings.irsMapa||JSON.parse(JSON.stringify(IRS_MAPA0));
  const m=db.settings.irsMapa,valida=v=>!v||IRS_COLUNAS.some(c=>c[0]===v);
  const poe=(k,v)=>{if(v)m[k]=v;else delete m[k]};
  if(chave!==undefined){if(!valida(col))return;poe(chave,col||'')}
  else irsMapaChaves().forEach((k,i)=>{
    const e=document.getElementById('irsm_'+i);if(!e)return;
    const v=e.value||'';if(valida(v)&&(m[k]||'')!==v)poe(k,v);
  });
  save();render();
}
/* Repõe o mapa de origem (IRS_MAPA0) depois de confirmar: as regras que
   mudaste aqui desaparecem; as colunas escolhidas na ficha de cada despesa
   ficam, porque são do movimento e não do mapa.
   Devolve: nada — abre a confirmação; só ao confirmar repõe e grava. */
function resetIrsMapa(){
  confirmModal('Repor colunas','Volta às regras de origem do Anexo F. As colunas que mudaste aqui desaparecem; as escolhidas na ficha de cada despesa ficam.',()=>{
    db.settings.irsMapa=JSON.parse(JSON.stringify(IRS_MAPA0));save();render();toast('Colunas repostas.');
  });
}
// Pede o nome e cria uma etiqueta (ignora repetidas); grava e repinta.
// Devolve: nada — abre o prompt; só ao guardar cria e grava.
function addTag(){promptModal('Nova etiqueta','Nome da etiqueta',null,v=>{
  const l=db.settings.tags||(db.settings.tags=[]);
  if(l.indexOf(v)<0)l.push(v);save();render();toast('Etiqueta criada.')},'Obras de 2026')}
// Apaga a etiqueta depois de confirmar com o impacto: sai das definições e de
// todos os movimentos que a tinham.
// Recebe: g — o nome da etiqueta.
// Devolve: nada — abre a confirmação; só ao confirmar apaga e grava.
function delTag(g){
  const used=db.transactions.filter(t=>(t.tags||[]).indexOf(g)>-1).length;
  confirmModal('Apagar etiqueta',`Apagar “${esc(g)}”?${used?` Sai de ${used} movimento(s).`:''}`,()=>{
    db.settings.tags=(db.settings.tags||[]).filter(x=>x!==g);
    db.transactions.forEach(t=>{t.tags=(t.tags||[]).filter(x=>x!==g)});
    save();render();toast('Etiqueta apagada.');
  });
}


/* ======================= FILTROS COMUNS =======================
   Um conjunto de escolhas com nome — "T2 Lisboa · rendas", "Só despesas do
   Manel" — definido uma vez e aplicado em qualquer vista que filtre. Cada
   vista aplica só o que lhe diz respeito: a visão geral usa o imóvel e o
   proprietário, os movimentos usam tudo. */

// A lista de filtros comuns guardada nas definições ([] enquanto não houver).
// Devolve: o array de filtros de db.settings.filters ([] novo se ainda não houver).
function filtrosComuns(){return db.settings.filters||[]}

// Subpágina "Filtros comuns": cada filtro com o resumo das escolhas (tocar
// abre o modal de edição), botão de apagar e botão de criar novo.
// Devolve: o HTML (texto) da subpágina.
function vFiltrosComuns(){
  const list=filtrosComuns();
  return card('Filtros comuns','Aplicam-se no funil de cada vista',`
    ${list.length?`<div class="list u-g-8px">${list.map(f=>`
      <div class="card u-p-11px-13px"><div class="row-between u-ai-center">
        <div class="u-minw-0 u-cur-pointer" data-toca="camada" data-click="fcModal('${jsq(f.id)}')">
          <b class="u-fs-14px">${esc(f.name)}</b>
          <div class="small">${esc(fcResumo(f)||'sem escolhas — aplica-lo limpa os filtros')}</div></div>
        <button type="button" class="btn sm danger u-minw-40px u-minh-40px" aria-label="Apagar" data-toca="dados" data-risco="destroi" data-click="delFiltroComum('${jsq(f.id)}')">${ic('trash',14)}</button>
      </div></div>`).join('')}</div>`
      :'<div class="hint">Ainda não tens nenhum. Um filtro comum guarda um conjunto de escolhas — imóvel, proprietário, tipo, categoria, datas — para aplicares num toque.</div>'}
    <div class="toolbar u-m-13px-0-0"><button class="btn primary" data-toca="camada" data-click="fcModal()">${ic('plus',15)} Novo filtro comum</button></div>`);
}

// Resumo das escolhas de um filtro numa linha, separadas por «·»;
// devolve '' quando o filtro não fixa nada.
// Recebe: f — o filtro comum (objeto {kind,prop,owner,cat,sub,de,ate,…}).
// Devolve: o resumo em texto; '' se o filtro não fixar nada.
function fcResumo(f){
  const p=[];
  if(f.kind)p.push(nomeDoTipo(f.kind));
  if(f.prop){const pr=prop(f.prop);p.push(pr?pr.name:f.prop)}
  if(f.owner){const o=db.owners.find(x=>x.id===f.owner);p.push(o?o.name:f.owner)}
  if(f.cat)p.push(f.cat);
  if(f.sub)p.push(f.sub);
  if(f.de||f.ate)p.push(f.de&&f.ate?dPT(f.de)+' → '+dPT(f.ate):f.de?'desde '+dPT(f.de):'até '+dPT(f.ate));
  return p.join(' · ');
}

let fcForm=null;
// Abre o modal de criar (sem id) ou editar um filtro comum; trabalha numa
// cópia (fcForm) — nada é gravado até fcGuardar.
// Recebe: id (opcional) — o id do filtro a editar; sem ele cria um novo.
// Devolve: nada — abre o modal.
function fcModal(id){
  const f=filtrosComuns().find(x=>x.id===id);
  fcForm=f?JSON.parse(JSON.stringify(f)):{id:uid(),name:'',kind:'',prop:'',owner:'',cat:'',sub:'',de:'',ate:''};
  openModal(f?'Editar filtro comum':'Novo filtro comum',fcCorpo(),
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="fcGuardar()">Guardar</button>`);
}
/* Corpo do modal do filtro: nome, tipo, imóvel, proprietário, categoria,
   subcategoria e datas. As categorias dependem do tipo escolhido (as dívidas
   usam a árvore das despesas), daí mudar o tipo repintar o formulário.
   Devolve: o HTML (texto) do corpo do modal, gerado a partir de fcForm. */
function fcCorpo(){
  const kinds=[{v:'',label:'Todos os tipos'},{v:'income',label:'Receitas'},{v:'expense',label:'Despesas'},{v:'loan',label:'Pagamentos de crédito'},{v:'debt',label:'Dívidas'}];
  const props=[{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p=>({v:p.id,label:p.name})));
  const owners=[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name})));
  const tree=allCats(fcForm.kind==='debt'?'expense':fcForm.kind);
  const catOpts=[{v:'',label:'Todas as categorias'}].concat(Object.keys(tree).map(c=>({v:c,label:c})));
  const subs=fcForm.cat?(tree[fcForm.cat]||[]):[];
  return `<div class="form">
    <label>Nome <span class="req">*</span><input id="fc_name" value="${esc(fcForm.name)}" placeholder="Ex: T2 Lisboa · rendas" autocomplete="off" data-input="fcColher(1)"></label>
    <div class="row"><label>Tipo${sel('fc_kind',fcForm.kind,kinds,'fcColher','rascunho')}</label>
      <label>Imóvel${sel('fc_prop',fcForm.prop,props,'fcColher','rascunho')}</label></div>
    <div class="row"><label>Proprietário${sel('fc_owner',fcForm.owner,owners,'fcColher','rascunho')}</label>
      <label>Categoria${sel('fc_cat',fcForm.cat,catOpts,'fcColher','rascunho')}</label></div>
    ${subs.length?`<label>Subcategoria${sel('fc_sub',fcForm.sub,[{v:'',label:'Todas'}].concat(subs.map(x=>({v:x,label:x}))),'fcColher','rascunho')}</label>`:''}
    <div class="row lado-a-lado"><label>De<input id="fc_de" type="date" value="${fcForm.de||''}" data-change="fcColher()"></label>
      <label>Até<input id="fc_ate" type="date" value="${fcForm.ate||''}" data-change="fcColher()"></label></div>
    <div class="hint">Deixa em branco o que não quiseres fixar. Cada vista aplica só o que lhe diz respeito.</div>
  </div>`;
}
/* soFormulario: escrever no nome não repinta (perdia o foco a cada tecla);
   mudar tipo ou categoria repinta, porque as opções seguintes dependem
   Recebe: soFormulario (opcional) — verdadeiro quando a chamada vem de
   escrever no nome: colhe sem repintar.
   Devolve: nada — copia os campos do modal para fcForm (e repinta o corpo
   se o tipo ou a categoria mudarem). */
function fcColher(soFormulario){
  fcForm.name=val('fc_name');
  const kindNovo=val('fc_kind')||'',catNova=val('fc_cat')||'';
  const repinta=!soFormulario&&(kindNovo!==fcForm.kind||catNova!==fcForm.cat);
  if(catNova!==fcForm.cat)fcForm.sub='';
  fcForm.kind=kindNovo;fcForm.cat=catNova;
  fcForm.prop=val('fc_prop')||'';fcForm.owner=val('fc_owner')||'';
  fcForm.sub=val('fc_sub')||fcForm.sub||'';fcForm.de=val('fc_de')||'';fcForm.ate=val('fc_ate')||'';
  if(repinta){const t=modalTop();if(t){const b=modalBodyEl();if(b){b.innerHTML=fcCorpo();marcarDatasVazias(b)}}}
}
// Guarda o filtro do modal: colhe o formulário, exige nome, substitui (ou
// acrescenta) em db.settings.filters e fecha com um toast.
// Devolve: nada — grava nas definições e fecha o modal (ou avisa se faltar o nome).
function fcGuardar(){
  fcColher();
  if(!String(fcForm.name||'').trim())return falhaCampo('fc_name','Dá um nome ao filtro.');
  db.settings.filters=filtrosComuns().filter(x=>x.id!==fcForm.id).concat([fcForm]);
  save();closeModal();render();toast('Filtro comum guardado.');
}
// Apaga um filtro comum sem pedir confirmação — o toast traz Desfazer,
// que repõe a cópia guardada.
// Recebe: id — o id do filtro a apagar.
// Devolve: nada — apaga, grava e mostra o toast com Desfazer.
function delFiltroComum(id){
  const f=filtrosComuns().find(x=>x.id===id);if(!f)return;
  const copia=JSON.parse(JSON.stringify(f));
  db.settings.filters=filtrosComuns().filter(x=>x.id!==id);
  save();render();
  comDesfazer('Filtro comum apagado.',()=>{db.settings.filters=(db.settings.filters||[]).concat([copia])});
}

/* O aplicador: cada vista pega no que lhe diz respeito.
   Recebe: id — o id do filtro comum a aplicar.
   Devolve: nada — muda os filtros da vista ativa e repinta. */
function aplicarFiltroComum(id){
  const f=filtrosComuns().find(x=>x.id===id);if(!f)return;
  if(tab==='transactions'){
    txFilter=f.kind||'';txProp=f.prop||'';ownerFilter=f.owner||'';
    txCat=f.cat||'';txSub=f.sub||'';txDe=f.de||'';txAte=f.ate||'';
    if(typeof txRerender==='function')txRerender();else render();   // a repintura curta é dos Movimentos
    toast('Filtro «'+f.name+'» aplicado.');return;
  }
  // vistas de análise e listas: aplica-se o imóvel e o proprietário
  if(tab==='dashboard')dashProp=f.prop||'';
  if(tab==='projections')projProp=f.prop||'';
  if(tab==='reports')repProp=f.prop||'';
  ownerFilter=f.owner||'';
  if(typeof LFK!=='undefined'&&LFK[tab]&&f.owner!==undefined){lf(LFK[tab]).own=f.owner||''}
  render();toast('Filtro «'+f.name+'» aplicado — '+(f.cat||f.kind||f.de?'esta vista usa só o imóvel e o proprietário.':'feito.'));
}
// Selector "aplicar um filtro comum" para meter num funil de filtros; devolve
// '' enquanto não houver filtros. fn é o onchange (por omissão onFcAplicar).
// Recebe: fn (opcional) — o nome (texto) da função global a chamar no onchange;
// por omissão 'onFcAplicar'.
// Devolve: o HTML (texto) do seletor; '' enquanto não houver filtros.
function fcSelector(fn){
  const list=filtrosComuns();
  if(!list.length)return '';
  return `<label>Filtro comum${sel('fcAplicar','',[{v:'',label:'— aplicar um filtro comum —'}].concat(list.map(f=>({v:f.id,label:f.name}))),fn||'onFcAplicar','vista')}</label>`;
}
// onchange do selector: aplica o filtro escolhido (a opção vazia não faz nada).
// Devolve: nada — aplica o filtro escolhido na vista ativa.
function onFcAplicar(){const v=val('fcAplicar');if(v)aplicarFiltroComum(v)}
