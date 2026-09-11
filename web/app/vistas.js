/* ================= VISTAS ================= */
/* botão de filtros no cabeçalho: análise, registos e movimentos */
let anaOpen={};
/* Os filtros dos movimentos abrem um painel, como todos os outros. Abriam uma
   janela por cima de tudo — eram os únicos —, e uma janela esconde a lista
   que se está a filtrar, que é precisamente o que se quer ver a mudar
   enquanto se mexe nos filtros. */
let txFiltAberto=false;
const LFK={properties:'lprops',contracts:'lcts',tenants:'lten',owners:'lown',recurring:'lrec',credits:'lcred',visits:'lvis'};
/* toque no botão de filtros do cabeçalho: abre o painel certo consoante o
   separador — dropdown nas listas de registos, modal nos movimentos, painel
   de análise nos restantes.
   Devolve: nada — abre/fecha o painel respetivo e redesenha a vista. */
function hdrFiltToggle(){
  if(LFK[tab])return lfToggle(LFK[tab]);
  if(tab==='transactions'){txFiltAberto=!txFiltAberto;render();fpanelEntra(txFiltAberto);return}
  anaOpen[tab]=!anaOpen[tab];render();fpanelEntra(anaOpen[tab]);
}
/* Marca o painel de filtros acabado de abrir para a entrada
   (index.html:.fpanel.on.entra). Corre DEPOIS do render que o pôs no
   documento; a marca morre com o nó no render seguinte, e é isso que
   impede o painel já aberto de voltar a entrar — o desenho do toggleFold.
   Recebe: aberto — o estado novo do painel; com false não faz nada.
   Devolve: nada — põe a classe .entra no painel aberto, no próprio DOM. */
function fpanelEntra(aberto){
  if(!aberto)return;
  const p=document.querySelector('.fpanel.on');
  if(p)p.classList.add('entra');
}
/* Fecha os painéis de filtros todos — os das listas, o dos movimentos e os de
   análise.

   Quem chama é o go(), ao mudar de separador. O painel é uma superfície
   passageira, ancorada ao botão do cabeçalho, e o go() já fazia isto à gaveta
   (closeDrawer) — aos filtros é que faltava. Sem isto, filtrar os imóveis,
   sair para os movimentos e voltar devolvia o painel aberto por cima da lista
   que se ia ler, sem ninguém o ter pedido.

   Os VALORES dos filtros não se tocam, e é a diferença que importa: esses são
   para durar de uma visita à outra, e o que se fecha aqui é só a porta.
   Devolve: nada — fecha os painéis no estado; o render seguinte pinta-os fechados. */
function fecharFiltros(){
  anaOpen={};
  txFiltAberto=false;
  Object.keys(listF).forEach(k=>{listF[k]._open=false});
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
    <button class="btn" data-toca="vista" onclick="anaClear()">${ic('x',15)} Limpar</button>
    <button class="btn primary" data-toca="camada" onclick="anaApply()">${ic('check',15)} Fechar</button>
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
/* Ligado por quem NAVEGA (navegacao.js:go, navegacao.js:goSet) e gasto pelo
   render logo a seguir. Arranca ligado: a primeira pintura da app é uma
   chegada como as outras. */
let _entrar=1;
/* o ecrã que a última pintura mostrou, para não se acompanhar peças entre
   ecrãs diferentes: mudar de separador troca tudo o que lá está, e animar
   isso seria uma revoada de linhas a atravessar a página */
let _ecraPintado='';
/* O botão de filtros do cabeçalho: se aparece, se tem o ponto de «há filtros
   postos», e se está aceso. Sai do render porque o caminho curto — mudar um
   filtro sem repintar a página — também tem de o acertar, e o ponto conta a
   pesquisa (hdrFiltN).
   Devolve: nada — escreve no #hdrFilt, que vive fora do #view. */
function pintarBotaoFiltros(){
  const hb=document.getElementById('hdrFilt');if(!hb)return;
  const isAna=['dashboard','projections','reports'].indexOf(tab)>-1,
    hasFilt=isAna||LFK[tab]||tab==='transactions';
  hb.style.display=hasFilt?'':'none';
  if(!hasFilt)return;
  hb.innerHTML=ic('filter',16)+(hdrFiltN()?'<span class="dot"></span>':'');
  hb.classList.toggle('primary',isAna?!!anaOpen[tab]:(LFK[tab]?!!lf(LFK[tab])._open:false));
}
/* ================= LISTAS VIVAS =================
   Uma lista que se acerta em vez de se refazer.

   O motor com chave (lista.js) chegou com os movimentos e ficou só neles: as
   outras listas eram deitadas fora e refeitas por inteiro a cada repintura —
   a cada tecla da pesquisa, a cada filtro, a cada sincronização de fundo. É
   também por isso que não deslizam entre estados: não há nós para animar,
   porque são todos novos.

   Escreve-se como quem escreve HTML; o que sai é a moldura vazia, e os itens
   ficam registados para o pintarListasVivas os reconciliar depois de o ecrã
   estar posto — que é quando o contentor existe mesmo. */
let _listasVivas=[];
/* Uma lista com chave, para a vista escrever no meio do seu HTML.

   A chave de cada item tem de ser ÚNICA e ESTÁVEL: é o id do registo, e não a
   posição. E o html do item não pode trazer na assinatura nada que mude sem o
   registo ter mudado — um total, uma contagem, o estado de um filtro —, senão
   o motor refaz tudo à mesma e não serviu de nada. Foi a lição do saldo do
   mês nos movimentos, que saiu da assinatura do bloco para um span preenchido
   depois de reconciliar.
   Recebe: id — nome único desta lista no ecrã; itens — [{chave, html}]; cls
   (opcional) — classes a juntar ao contentor; estilo (opcional) — style.
   Devolve: o HTML do contentor vazio, pronto a colar. */
function listaViva(id,itens,cls,estilo){
  itens=(itens||[]).filter(x=>x&&x.chave);
  _listasVivas.push({id:id,itens:itens});
  /* nasce CHEIA: uma vista tem de devolver o ecrã inteiro, e quem a lê — um
     teste, o indexOf do fab, o próximo render — tem de lá encontrar tudo */
  const dentro=itens.map(it=>comChave(it.html,it.chave)).join('');
  return `<div class="list${cls?' '+cls:''}" data-listaviva="${esc(id)}"${estilo?` style="${estilo}"`:''}>${dentro}</div>`;
}
/* Põe a chave no elemento de topo de um pedaço de HTML, sem passar pelo DOM.

   O pecaDe (lista.js) faz o mesmo com um elemento já construído; aqui é ainda
   texto, e construir um nó por item só para lhe pôr um atributo custava uma
   árvore inteira a cada pintura.
   Recebe: html — o HTML do item; chave — a chave a marcar.
   Devolve: o mesmo HTML com data-chave no primeiro elemento. */
function comChave(html,chave){
  return String(html).replace(/^(\s*<[a-zA-Z][\w-]*)/,`$1 data-chave="${esc(chave)}"`);
}
/* Enche as listas vivas que o ecrã acabou de escrever.

   Corre depois do innerHTML, como o pintarListaTx: antes disso o contentor
   ainda não existe. Esvazia o registo no fim, para uma vista construída e não
   usada (um teste que chama vProperties() à mão) não deixar lixo para a
   pintura seguinte.
   Devolve: nada — reconcilia cada contentor com os seus itens. */
function pintarListasVivas(){
  const raiz=view();
  /* de fora para dentro: as listas registam-se de DENTRO para fora, porque o
     html do interior tem de estar pronto antes de o exterior o receber — e
     nessa ordem o contentor interior ainda não existe no DOM quando lhe
     chega a vez. Invertida, o exterior é pintado primeiro e o interior já lá
     está para ser encontrado. */
  if(raiz)_listasVivas.slice().reverse().forEach(function(l){
    const el=raiz.querySelector('[data-listaviva="'+String(l.id).replace(/"/g,'')+'"]');
    if(!el)return;
    /* contentor acabado de nascer: os itens já vieram no HTML, e só falta
       dizer ao motor o que lá está. Um que já tem cache veio da via parcial,
       e esse compara-se peça a peça. */
    if(el[CHAVE_CACHE])reconciliar(el,l.itens);else semear(el,l.itens);
  });
  _listasVivas=[];
}
/* Esta repintura só tira e reordena, ou também faz nascer?

   A via parcial só é segura quando nada nasce: as decorações da nuvem — o
   selo de partilhado, o bloco «N por confirmar», as caixas de marcar — são
   todas embrulhos do render e funcões locais dos módulos, e dali não há como
   as chamar. Um nó mantido fica com as suas; um nó criado nascia sem elas e
   assim ficava até à pintura inteira seguinte.
   Recebe: alvo — o contentor vivo; itens — [{chave, html}].
   Devolve: true se tudo o que se pede já está lá, igual. */
function soTiraOuReordena(alvo,itens){
  if(!alvo)return false;
  const cache=alvo[CHAVE_CACHE];
  if(!cache)return false;
  return (itens||[]).every(function(it){
    return it&&it.chave&&cache[it.chave]===(it.sig!=null?it.sig:it.html);
  });
}
/* Repinta as listas do ecrã sem refazer o ecrã.

   É aqui que o motor com chave paga. A pesquisa e os filtros chamavam o
   render, e o render deita fora tudo e volta a construir: com 500 movimentos
   media 48ms e 6110 nós recriados a cada tecla. A via parcial troca a moldura
   — que é barata — e deixa as listas serem comparadas peça a peça.

   Anda pelos filhos do ecrã e pelos do molde ao mesmo tempo: onde os dois são
   a mesma lista viva, reconcilia; onde não são, troca o nó. Se as duas
   árvores não baterem certo, não inventa — devolve false e quem chamou faz
   um render normal.
   Devolve: true se repintou por esta via; false se não deu. */
function refrescarListasVivas(){
  const v=view();if(!v)return false;
  const fn=({dashboard:vDashboard,visits:vVisits,calendar:vCalendar,properties:vProperties,contracts:vContracts,
    tenants:vTenants,owners:vOwners,colaboradores:vColabTab,transactions:vTransactions,recurring:vRecurring,
    credits:vCredits,projections:vProjections,reports:vReports,settings:vSettings})[tab];
  if(!fn)return false;
  _listasVivas=[];
  let html;try{html=fn()}catch(e){_listasVivas=[];return false}
  if(!_listasVivas.length){_listasVivas=[];return false}
  /* o molde tem de ficar igual ao que o render produziria, senão as duas
     árvores não batem certo e cai-se fora por nada — foi o que o fabpad fez */
  if(html.indexOf('class="fab"')>-1)html+='<div class="fabpad"></div>';
  const registo={};_listasVivas.forEach(l=>{registo[l.id]=l.itens});
  _listasVivas=[];
  const molde=document.createElement('div');molde.innerHTML=html;
  const id=e=>(e.getAttribute&&e.getAttribute('data-listaviva'))||'';
  /* As listas VIVAS ficam; a moldura à volta é refeita. Não se compara filho
     a filho pela posição: a moldura muda de forma sozinha — a linha dos «N
     resultados» nasce quando um filtro fica ativo —, e uma comparação por
     posição desistia exatamente no caso mais comum. */
  const vivas={};
  [].slice.call(v.querySelectorAll('[data-listaviva]')).forEach(function(e){vivas[id(e)]=e});
  const querem=[].slice.call(molde.querySelectorAll('[data-listaviva]')).map(id);
  if(!querem.length||querem.some(k=>!vivas[k])){return false}
  /* se alguma lista precisa de fazer nascer um cartão, não é por aqui */
  if(querem.some(k=>!soTiraOuReordena(vivas[k],registo[k]||[])))return false;
  const contas={mantidas:0,refeitas:0,criadas:0,movidas:0,removidas:0};
  querem.forEach(function(k){
    const c=reconciliar(vivas[k],registo[k]||[]);
    Object.keys(contas).forEach(x=>{contas[x]+=c[x]||0});
    /* o contentor vivo toma o lugar do novo dentro do molde, e a árvore
       inteira do molde entra de uma vez — as listas viajam com os seus nós */
    const novo=molde.querySelector('[data-listaviva="'+k.replace(/"/g,'')+'"]');
    if(novo&&novo.parentNode)novo.parentNode.replaceChild(vivas[k],novo);
  });
  v.replaceChildren.apply(v,[].slice.call(molde.children));
  tornarFocavel(v);
  pintarBotaoFiltros();
  /* o que o render repõe depois de pintar, esta via tem de repor também:
     senão um grupo mantido fica com o total de antes */
  if(tab==='contracts')pintarRendasDosGrupos();
  _ultimaRepintura=contas;         // para se poder medir o que foi reaproveitado
  return true;
}
let _ultimaRepintura=null;
/* Redesenha a página inteira: título e subtítulo, botão de filtros do
   cabeçalho, e o HTML da vista do separador atual (vDashboard, vProperties…).
   Substitui o innerHTML de #view, por isso o estado do DOM anterior perde-se;
   no fim torna os cartões focáveis e repinta as miniaturas dos imóveis.
   Devolve: nada — redesenha a vista no DOM. */
function render(){
  /* Acompanhar as peças é a REGRA, e não um pedido de cada sítio: era assim
     que os inquilinos, os movimentos e tudo o resto continuavam a trocar de
     golpe enquanto só três chamadas se lembravam de pedir. Só no mesmo ecrã —
     ver continuidade.js. */
  const ecra=tab+'|'+(setPage||'');
  const antes=(ecra===_ecraPintado&&!contSuspensa)?medirContinuidade(view()):null;
  _ecraPintado=ecra;
  const meta=(tab==='settings'&&setPage&&SUBPAGE[setPage])?SUBPAGE[setPage]:TABS.find(x=>x.id===tab);
  document.getElementById('pageTitle').textContent=meta.label;
  document.getElementById('pageSub').textContent=meta.sub;
  if(typeof notifSino==='function')notifSino();
  pintarBotaoFiltros();
  _listasVivas=[];                 // o que sobrou de uma vista construída e não usada não conta
  let html=({dashboard:vDashboard,visits:vVisits,calendar:vCalendar,properties:vProperties,contracts:vContracts,tenants:vTenants,owners:vOwners,
    colaboradores:vColabTab,transactions:vTransactions,recurring:vRecurring,credits:vCredits,projections:vProjections,reports:vReports,settings:vSettings})[tab]();
  if(html.indexOf('class="fab"')>-1)html+='<div class="fabpad"></div>';
  /* A entrada dos gráficos é de quem chega ao ecrã, não de cada repintura: o
     render corre também quando a sincronização adota o estado do servidor de 3
     em 3 minutos (cloud/nucleo.js:applyState) e a cada gesto que só mexe num
     cartão. A marca fica até à próxima pintura, e as repinturas locais que
     acontecem lá dentro (o donutDrill) são de quem tocou no gráfico. */
  view().classList.toggle('entra',!!_entrar);_entrar=0;
  view().innerHTML=html;
  /* A lista dos movimentos e a primeira vista com motor proprio: o innerHTML
     traz a moldura e o #txLista vazio, e quem o enche e o pintarListaTx, que
     e o mesmo que depois o acerta linha a linha sem passar por aqui. */
  if(tab==='transactions')pintarListaTx();
  pintarListasVivas();             // e as outras listas, pela mesma via
  if(tab==='contracts')pintarRendasDosGrupos();
  /* A visão geral era o único ecrã sem criação rápida: registar uma renda
     avulsa custava quatro toques de viagem. Entra aqui, depois do painel
     rearranjar os cartões, para não virar um cartão arrastável. */
  if(tab==='dashboard'&&!view().querySelector('.fab')&&(podeSemImovel()||casasComo('tx.add').length)){
    view().insertAdjacentHTML('beforeend',
      '<div style="text-align:center;margin:2px 0 0"><button type="button" class="btn sm" data-toca="modo" onclick="window.CW&&CW.enterEdit&&CW.enterEdit()">'+ic('grip',13)+' Personalizar painel</button></div>'+
      fab([{act:'newTxPick()',label:'Novo movimento'}])+'<div class="fabpad"></div>');
  }
  tornarFocavel(view());
  if(tab==='properties')db.properties.forEach(p=>paintThumbs(p.photos,view()));
  /* Numa microtarefa, e não já: o render é embrulhado quatro vezes pela camada
     da nuvem, e são esses embrulhos que acrescentam as caixas de seleção, os
     kebabs e as barras — tudo coisas que mexem no sítio das linhas. Medir aqui
     era medir posições que ainda iam mudar. A microtarefa corre depois da
     cadeia toda e ainda antes de o browser pintar, que é a janela de que esta
     técnica precisa. */
  if(antes)Promise.resolve().then(()=>aplicarContinuidade(antes,view()));
  /* fora do caminho da pintura: a caixa já tem a altura certa e vazia, por isso
     enchê-la mais tarde não faz nada saltar */
  /* No quadro seguinte, e não à espera de tempo morto: com um
     requestIdleCallback de 400ms de tecto, um arranque cheio deixava a caixa
     da variação vazia quase um segundo. Assim não bloqueia a primeira pintura
     e ninguém vê a espera. O setTimeout é para o separador escondido, onde o
     requestAnimationFrame não corre — e onde também ninguém está a ver. */
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(pintarSeriesKpi);
  else setTimeout(pintarSeriesKpi,0);
  /* Num separador escondido o quadro NUNCA corre — e sem esta rede a caixa
     ficava vazia até alguém voltar ao separador. Aí não custa nada fazê-lo
     já: ninguém está a ver, e não há pintura nenhuma para atrasar. */
  setTimeout(function(){if(document.hidden)pintarSeriesKpi()},0);
  contarValores();
  refrescarFichas();               // uma ficha aberta por baixo de um formulário não fica a mentir
}
let kpiN=0;const KPI_REG={};
/* Há movimentos do ano passado?

   Decide se os cartões abrem espaço para a série. Uma faixa vazia em todos os
   cartões de quem começou a usar a app este mês seria pior do que não ter
   nada — e a pergunta responde-se com uma passagem pelos dados, uma vez por
   pintura, em vez de uma por indicador.
   Devolve: verdadeiro se há pelo menos um movimento do ano anterior. */
function haAnoAnterior(){
  const ant=String(YEAR-1);
  return (db.transactions||[]).some(t=>String(t.date||'').startsWith(ant));
}
/* Desenha a linha dos doze meses, pequena, para se ler a forma e não os
   valores: é uma silhueta, não um gráfico.
   Recebe: vals — os doze valores do ano (números).
   Devolve: o HTML do SVG, ou '' se não há nada que se veja. */
function silhuetaKpi(vals){
  const v=(vals||[]).map(x=>+x||0);
  if(v.length<2)return '';
  const min=Math.min(...v),max=Math.max(...v);
  if(max===min)return '';
  const W=100,H=16;
  const pts=v.map((x,i)=>`${(i/(v.length-1)*W).toFixed(1)},${(H-((x-min)/(max-min))*H).toFixed(1)}`).join(' ');
  return `<svg class="ksilhueta" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
/* O número que o cartão mostra é o mesmo que a série diz deste ano?

   É a pergunta que faltava, e sem ela a app dizia uma coisa falsa. Na visão
   geral o número do cartão é o do ano corrente e a comparação entre anos bate
   certo; nos Movimentos, o Saldo soma o FILTRO INTEIRO — todos os anos — e
   mostrava −17 000 € com uma comparação a falar de −3 400 €. Uma variação
   pendurada num número que não é de um ano não quer dizer nada.

   Compara-se pelo texto já formatado, com o formatador da própria série: se os
   dois não derem exatamente a mesma string, não estão a falar da mesma coisa e
   a faixa cala-se.
   Recebe: cx — a caixa da série, que vive dentro do cartão; s — a série; ano —
   a entrada do ano corrente ({label,value}).
   Devolve: verdadeiro se o cartão mostra o valor deste ano. */
function falaDoMesmo(cx,s,ano){
  const cartao=cx.closest?cx.closest('.card.kpi'):null;
  const alvo=cartao&&cartao.querySelector('.value');
  if(!alvo||!s.fmt)return false;
  const limpa=t=>String(t==null?'':t).replace(/\s+/g,' ').trim();
  return limpa(alvo.textContent)===limpa(s.fmt(ano.value));
}
/* Um número que chega a contar.

   Só a CHEGAR a um ecrã: o render corre também na sincronização de fundo e a
   cada gesto que repinta, e um número a contar de dois em dois minutos não é
   vida, é ruído. A marca é a mesma que os gráficos usam (#view.entra).

   Não inventa o formato. O texto final é o que a app já formatou — com o
   espaço a separar milhares, o sinal de menos próprio e o símbolo da moeda —
   e a contagem lê a forma do original e troca só os dígitos. No fim escreve de
   volta o texto original, tal e qual: assim não há maneira de a animação
   deixar o número diferente do que devia ser.

   E nada salta: a largura é fixada antes de começar, porque um número que
   ganha dígitos ganha largura e empurra o que está ao lado.
   Devolve: nada — anima os valores dos cartões que estão no ecrã. */
function contarValores(){
  const raiz=view();
  if(!raiz||!raiz.classList.contains('entra')||semMovimento())return;
  const dur=msDoToken('--desenho',500),curva=tokenTexto('--curva-entra','cubic-bezier(0,0,.2,1)');
  [].slice.call(raiz.querySelectorAll('.card.kpi .value')).forEach(function(el){
    if(el.dataset.contou)return;
    el.dataset.contou='1';
    const texto=el.textContent;
    const m=texto.match(/-?\u2212?[\d\s\u00a0.,]*\d/);       // o número dentro do texto
    if(!m)return;
    const cru=m[0];
    const alvo=Number(cru.replace(/[\s\u00a0]/g,'').replace(/\u2212/g,'-').replace(',','.'));
    if(!isFinite(alvo)||!alvo)return;
    /* a largura fica presa no valor final: sem isto, os dígitos a entrarem um
       a um empurravam o cartão e os vizinhos */
    try{el.style.minWidth=Math.ceil(el.getBoundingClientRect().width)+'px'}catch(e){}
    const casas=(cru.split(/[.,]/)[1]||'').length;
    /* Rede: num separador escondido o requestAnimationFrame nao corre, e a
       contagem nunca comeca. O numero fica certo — o texto de partida ja e o
       final —, mas a largura presa ficaria presa para sempre. */
    const acabar=function(){el.textContent=texto;el.style.minWidth=''};
    setTimeout(acabar,dur+400);
    const t0=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
    const passo=function(){
      const agora=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
      const p=Math.min(1,(agora-t0)/dur);
      if(p>=1){acabar();return}
      /* a mesma curva de quem entra em cena, para o número acompanhar o resto */
      const e=1-Math.pow(1-p,3);
      el.textContent=texto.replace(cru,comAFormaDe(cru,alvo*e,casas));
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}
/* Escreve um número com a MESMA forma de outro: os mesmos separadores, as
   mesmas casas, o mesmo sinal de menos. Não é um formatador — é um decalque,
   para a contagem nunca inventar um formato que a app não usa.
   Recebe: modelo — o texto do número final; v — o valor a escrever; casas — as
   casas decimais do modelo.
   Devolve: o número escrito à maneira do modelo. */
function comAFormaDe(modelo,v,casas){
  const sep=/\u00a0/.test(modelo)?'\u00a0':' ';
  const menos=/\u2212/.test(modelo)?'\u2212':'-';
  const dec=modelo.indexOf(',')>-1?',':'.';
  const neg=v<0;v=Math.abs(v);
  let txt=casas?v.toFixed(casas):String(Math.round(v));
  let inteiro=casas?txt.slice(0,txt.length-casas-1):txt;
  const resto=casas?dec+txt.slice(-casas):'';
  if(/[\s\u00a0]/.test(modelo))inteiro=inteiro.replace(/\B(?=(\d{3})+(?!\d))/g,sep);
  return (neg?menos:'')+inteiro+resto;
}
/* Enche as caixas de série dos indicadores que estão no ecrã.

   Corre DEPOIS da pintura e fora do caminho dela: medido com 500 movimentos,
   correr as séries de todos os indicadores custa 24ms, que é metade de uma
   pintura inteira. E só os que estão à vista — os registos antigos do KPI_REG
   ficam lá para trás e não interessam a ninguém.
   Devolve: nada — escreve dentro das caixas que já lá estavam. */
function pintarSeriesKpi(){
  const caixas=[].slice.call((view()||document).querySelectorAll('.kserie[data-kpi]'));
  caixas.forEach(function(cx){
    if(cx.dataset.feito)return;
    cx.dataset.feito='1';
    const reg=KPI_REG[cx.getAttribute('data-kpi')];if(!reg||!reg.evo)return;
    let s;try{s=reg.evo()}catch(e){return}
    if(!s)return;
    const anos=(s.yearly||[]).slice().sort((a,b)=>Number(a.label)-Number(b.label));
    const hoje=anos[anos.length-1],antes=anos[anos.length-2];
    let txt='';
    if(hoje&&antes&&Number(hoje.label)===YEAR&&Number(antes.label)===YEAR-1&&falaDoMesmo(cx,s,hoje)){
      const a=Number(antes.value)||0,h=Number(hoje.value)||0,d=h-a;
      /* dois zeros nao se comparam: «igual» entre nada e nada e ruido */
      if(!a&&!h){cx.innerHTML='';return}
      /* sem ano anterior com valor não há percentagem que signifique alguma
         coisa: diz-se o que se sabe, que é que antes não havia nada */
      const pct=a?Math.round(Math.abs(d)/Math.abs(a)*100):null;
      const sinal=d>0?'pos':d<0?'neg':'';
      /* diz-se o termo de comparação, e não só a mudança: «face a 2025» nomeia
         o ano mas não o número, e sem o número não se percebe do que se fala */
      txt=`<span class="kvar ${sinal}">${d>0?'▲':d<0?'▼':'='} ${pct===null?(h?'novo':'igual'):pct+'%'}</span>
        <span class="kvsub">${antes.label}: ${s.fmt?s.fmt(a):a}</span>`;
    }
    cx.innerHTML=silhuetaKpi(s.monthly)+txt;
  });
}
/* evo: função que devolve a série do indicador ao longo do tempo; ao tocar abre-se uma janela com a evolução
   Recebe: l — o rótulo do cartão; v — o valor já formatado (string); c (opcional) — classe de cor ('pos', 'neg',
   'amber' ou vazio); f (opcional) — texto do rodapé; why (opcional) — explicação que abre ao toque;
   evo (opcional) — função sem argumentos que devolve a série ({monthly, yearly, fmt, …}) para a janela de evolução;
   com evo.anual verdadeiro, o cartão abre espaço para a faixa da série, o que
   só é honesto quando o valor mostrado É o do ano corrente — nos Movimentos o
   valor é a soma do filtro inteiro e a faixa não tem do que falar;
   acao (opcional) — {label, act} de um botão que a janela oferece no rodapé (ex.: filtrar por este tipo).
   Devolve: string HTML do cartão KPI. */
const kpi=(l,v,c,f,why,evo,acao)=>{
  const id='k'+(++kpiN);
  if(evo){KPI_REG[id]={title:l,why:why||'',evo,acao:acao||null};
    /* A caixa da série nasce VAZIA e com a altura certa. Quem a enche é o
       pintarSeriesKpi, depois de a página estar pintada — encher uma caixa que
       ainda não tem altura faria saltar tudo o que está por baixo, que foi
       precisamente a queixa dos «quadrados que aparecem desalinhados». */
    return `<div class="card kpi evo" id="${id}" data-toca="camada" onclick="kpiModal('${id}')"><span class="kic">${ic('trend',11)}</span>
      <div class="label">${l}</div><div class="value ${c||''}">${v}</div>${(evo.anual&&haAnoAnterior())?`<div class="kserie" data-kpi="${id}"></div>`:''}${f?`<div class="foot">${f}</div>`:''}</div>`}
  return `<div class="card kpi ${why?'why':''}" id="${id}" ${why?`data-toca="nada" onclick="document.getElementById('${id}').classList.toggle('open')"`:''}>
    <div class="label">${l}</div><div class="value ${c||''}">${v}</div>${f?`<div class="foot">${f}</div>`:''}
    ${why?`<div class="expl">${why}</div>`:''}</div>`;
};
/* A tabela da janela de um indicador — só quando diz o que o gráfico não diz.

   Na visão geral, os quatro cartões abriam com dois gráficos e uma tabela, e
   a tabela era o segundo gráfico escrito por extenso: os mesmos anos, os
   mesmos valores, mais nada. Ler duas vezes a mesma coisa não é ler melhor.

   Fica quando há uma SEGUNDA coluna, que o gráfico não pode mostrar — e que
   quase sempre está noutra unidade: o Yield bruto traz a renda anual em
   euros, o LTV e o Equity trazem a dívida, a avaliação traz o NOI. E fica
   quando não há gráfico nenhum para repetir: com um ano só não se desenha
   uma linha, e sem a tabela o bloco desaparecia.
   Recebe: k — o registo do cartão ({title,…}); d — o que o evo() devolveu;
   fmt — como formatar cada valor.
   Devolve: o HTML da tabela, ou vazio quando ela só repetiria o gráfico. */
function tabelaDoKpi(k,d,fmt){
  const anos=d.yearly||[];
  if(!anos.length)return '';
  const extra=anos[0].extra!==undefined;
  if(!extra&&anos.length>1)return '';
  return `<div class="tablewrap"><table class="table"><thead><tr><th>${d.yearlyTitle?'Período':'Ano'}</th><th>${esc(k.title)}</th>${extra?'<th>'+esc(d.extraTitle||'')+'</th>':''}</tr></thead><tbody>
    ${anos.map(y=>`<tr><td><b>${esc(String(y.label))}</b></td><td>${fmt(y.value)}</td>${y.extra!==undefined?`<td>${y.extra}</td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
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
    ${tabelaDoKpi(k,d,fmt)}
    ${d.note?`<div class="hint">${d.note}</div>`:''}</div>`;
  openModal(k.title,body,`<button class="btn" data-toca="camada" onclick="closeModal()">Fechar</button>`+
    (k.acao?`<button class="btn primary" data-toca="vista" onclick="closeModal();${k.acao.act}">${esc(k.acao.label)}</button>`:''));
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
/* A porta das opções de um registo, e é a MESMA em toda a app.

   Eram três: um .iconbtn de 44px nos Movimentos, este, que era um .btn.sm de
   37x40 e sem rótulo nenhum, e um terceiro nas Visitas com o nome «Mais».
   Três formas, três tamanhos e três nomes para a mesma ideia — quem aprende a
   reconhecer a porta numa lista não a reconhece na seguinte, e é por isso que
   o toque longo continua a parecer a única maneira de lá chegar.
   Recebe: v — a chave do registo, a mesma do toque longo ('prop:ID', 'ct:ID'…).
   Devolve: o HTML do botão de opções. */
const kebab=v=>`<button type="button" class="iconbtn opcoes" aria-label="Opções" data-toca="camada" onclick="${stop}lpMenu('${v}')">${ic('dots',18)}</button>`;
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
  return `<div class="toolbar"><div style="min-width:230px;max-width:320px">${sel('ownerSel',ownerFilter,opts,'onOwnerFilter','vista')}</div></div>`;
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
    ${db.owners.length?`<div style="width:100%">${sel('ownerSel',ownerFilter,oo,'onOwnerFilter','vista')}</div>`:''}
    <div style="width:100%">${sel('dashPropSel',dashProp,po,'onDashProp','vista')}</div></div>`);
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
    return esperaDoServidor()||`<div class="empty"><b>Ainda não há nada registado</b>Começa por adicionar um imóvel${podeExemplo()?', ou carrega dados de exemplo':''}.
      <div class="toolbar" style="justify-content:center;margin-top:16px">
      <button class="btn primary" data-toca="camada" onclick="propModal()">Adicionar imóvel</button>
      ${podeExemplo()?`<button class="btn" data-toca="dados" onclick="seed()">Carregar exemplo</button>`:''}</div></div>`;
  /* quem só colabora e cujo cargo não abre as finanças não tem nada para somar aqui */
  if(souSoColaborador()&&!scope().length)
    return `<div class="empty"><b>${fraseColaborador()}</b>O teu cargo não abre as finanças destes imóveis — a vista geral não tem nada para somar.
      <div class="toolbar" style="justify-content:center;margin-top:16px">
      <button class="btn primary" data-toca="ecra" onclick="go('properties')">Ver os imóveis</button></div></div>`;
  const nColab=scope().filter(p=>!souDono(p.id)).length;
  const colabHint=nColab?`<div class="hint" style="margin:-4px 0 12px">Inclui ${nColab} ${nColab===1?'imóvel':'imóveis'} onde és colaborador (valores por inteiro).</div>`:'';
  const inc=monthly(YEAR,pid,'income',true),exp=monthly(YEAR,pid,'expense',true),ln=monthly(YEAR,pid,'loan',true),am=monthly(YEAR,pid,'amort',true);
  let acc=0;const cum=inc.map((v,i)=>acc+=v-exp[i]-ln[i]-am[i]);
  const groups=inc.map((v,i)=>[{label:'Receita',value:v,color:PAL[0]},{label:'Despesas',value:-exp[i],color:'#c56b68'},{label:'Prestações',value:-ln[i],color:'#d6a34a'}]);
  const perProp=m.props.map(p=>({label:p.name+(ownerFilter&&sh(p)<1?' ('+shareText(p)+')':''),value:metrics(YEAR,p.id,{share:true}).cf})).sort((a,b)=>b.value-a.value);
  const act=db.contracts.filter(c=>isActive(c)&&inScope(c.propertyId)&&(!pid||pidProps(pid).some(p=>p.id===c.propertyId)));
  const cs=c=>sh(prop(c.propertyId));
  const quota=ownerFilter?(ownerIsGrp()?`<div class="hint" style="margin:-4px 0 12px">A ver os imóveis do grupo <b>${esc(ownerFilterName())}</b>.</div>`:`<div class="hint" style="margin:-4px 0 12px">Valores na quota-parte de <b>${esc(ownerFilterName())}</b>: receitas, despesas e prestações entram pela divisão de cada movimento; valor, aquisição e dívida pela quota do imóvel.</div>`):'';
  /* a marca diz que o numero destes cartoes E o do ano corrente — e por isso
     que a variacao face ao ano anterior pode falar deles (vistas.js:kpi) */
  const E=(field,fmt)=>{const f=()=>evoMoney(field,pid,fmt);f.anual=true;return f};
  return dashBar()+quota+colabHint+pendingCard()+prazosCard()+`<div class="grid">
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
      <div style="min-width:0"><div class="title">${donutCat?esc(donutCat):'Despesas por categoria'}</div>
        <div class="small">${donutCat?'Subcategorias em '+YEAR:'Onde foi parar o dinheiro em '+YEAR}</div></div>
      ${donutCat?`<button class="btn sm" style="flex:0 0 auto" data-toca="vista" onclick="donutDrill('')">${ic('chev',14)} Voltar</button>`:''}</div>
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
  /* A roda redesenha-se, e o cartão fica quieto. Chegou a levar a fita de
     virar a página, e era a metáfora errada: entrar numa categoria não é ir
     para outra página — é a MESMA roda a repartir-se de outra maneira, e o que
     se quer ver é os arcos a serem traçados. A marca liga a animação que os
     arcos já sabem fazer, sem depender de a vista ter acabado de chegar
     (index.html:.redesenha). */
  const novo=document.getElementById('donutCard');
  if(novo)novo.classList.add('redesenha');
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
    <div class="toolbar" style="margin:13px 0 0"><button class="btn" data-toca="ecra" onclick="go('transactions');setTimeout(()=>{txProp='__none__';render()},0)">Ver esses movimentos</button></div>
  </div></div>`;
}

/* cartão reutilizável: saldos entre proprietários (de um imóvel ou de todos)
   Recebe: pid — id do imóvel a que limitar, ou null/vazio para todos os do âmbito.
   Devolve: string HTML do cartão, ou vazia se não há saldos a mostrar. */
function balancesCard(pid){
  /* as contas entre proprietários são dos proprietários: num imóvel onde só colaboro não há cartão */
  if(pid&&!String(pid).startsWith('g:')&&!souDono(pid))return '';
  const bal=ownerBalances(pid),ks=Object.keys(bal);
  if(!ks.length)return '';
  const tot=debtTotal(bal),plan=settlePlan(bal);
  const rows=ks.map(k=>({id:k,name:(owner(k)||{}).name||'?',v:bal[k]})).sort((a,b)=>b.v-a.v);
  return `<div class="cols"><div class="card">
    <div class="row-between"><div><div class="title">Contas entre proprietários</div>
      <div class="small">${pid?'Neste imóvel':'Todos os imóveis'} · receitas, despesas e prestações com pessoa indicada; dívidas a terceiros não contam</div></div>
      <button class="btn sm" style="flex:0 0 auto;padding:7px" title="Como se chega aos saldos" data-toca="camada" onclick="${stop}balancesDetail(${pid?`'${pid}'`:'null'})">${ic('info',16)}</button></div>
    <div style="margin-top:13px">
      ${rows.map(r=>`<div class="stat"><span style="display:flex;align-items:center;gap:9px">
        <span class="avatar" style="width:28px;height:28px;font-size:11px;flex:0 0 28px">${esc(initials(r.name))}</span>${esc(r.name)}</span>
        <b class="${Math.abs(r.v)<0.01?'':(r.v>0?'pos':'neg')}">${Math.abs(r.v)<0.01?'em dia':(r.v>0?'a receber '+euro2(r.v):'a pagar '+euro2(-r.v))}</b></div>`).join('')}
      ${tot>0.005?`<div class="divider"></div>
        <div class="hint">${plan.map(x=>`<b>${esc((owner(x.from)||{}).name)}</b> paga <b>${euro2(x.amount)}</b> a <b>${esc((owner(x.to)||{}).name)}</b>`).join('<br>')}</div>
        <div class="toolbar" style="margin:13px 0 0"><button class="btn primary" data-toca="camada" onclick="settleModal(${pid?`'${pid}'`:'null'})">
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
  const props=pidProps(pid).filter(p=>souDono(p.id));
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
  if(pid&&!String(pid).startsWith('g:')&&!souDono(pid))return toast('As contas entre proprietários são dos proprietários — só o dono as acerta.');
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
      ${hist.map(h=>`<div class="stat"><span class="small">${dPT(h.date)} · ${esc(h.propertyId?propName(h.propertyId):'Todos os imóveis')} · ${esc((owner(h.paidBy)||{}).name)} → ${esc((owner(h.toId)||{}).name)}</span><b>${euro2(h.amount)}</b></div>`).join('')}
      <div class="hint">Os acertos ficam nos movimentos, onde podem ser editados.</div>`:''}
    </div>`,
    `<button class="btn" data-toca="camada" onclick="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" onclick="doSettle(${pid?`'${pid}'`:'null'})">Registar pagamentos</button>`);
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
  let list=visiveis();
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
    +(db.properties.length||!podeExemplo()?'':`<div class="toolbar"><button class="btn" data-toca="dados" onclick="seed()">Carregar exemplo</button></div>`)
    +fab([{label:'Adicionar imóvel',act:'propModal()'}]);
  list=lfSort(K,list,{nome:p=>p.name,valor:p=>p.value,renda:p=>rentOf(p),divida:p=>debtOf(p),yield:p=>{const r=rentOf(p);return r&&p.value?r*12/p.value:0}});
  if(!list.length)return head+(esperaDoServidor()||`<div class="empty"><b>${lfCount(K)?'Nada neste filtro':'Sem imóveis'}</b>${lfCount(K)?'':(db.properties.length?'Nenhum imóvel deste proprietário.':'Adiciona o primeiro para começares a acompanhar o investimento.')}</div>`);
  return head+listaViva('imoveis',list.map(p=>({chave:'prop:'+p.id,html:(p=>{
    const st=propStatus(p),ls=liveLoans(p),ac=activeContracts(p.id),rent=rentOf(p);
    /* um imóvel já prometido tem de o dizer: sem isto o cartão mostra «Vago»,
       sem renda e sem inquilino, e quem olha para a lista pode anunciá-lo ou
       arrendá-lo outra vez */
    const futuros=contractsOf(p.id).filter(c2=>ctEstado(c2)==='futuro');
    const y=rent&&p.value?rent*12/p.value:NaN,own=ownerNames(p);
    /* num imóvel onde só colaboro, cada chip pede a sua permissão; o que o servidor não mandou não se inventa */
    const vCt=pode(p.id,'contract.view'),vRep=pode(p.id,'report.view'),vLoan=pode(p.id,'loan.view'),vFile=pode(p.id,'file.view');
    return `<div class="card tap" data-lp="prop:${esc(p.id)}" data-fk="prop:${esc(p.id)}" data-toca="camada" onclick="propView('${jsq(p.id)}')">
      <div class="row-between">
        <div style="min-width:0"><div class="title">${esc(p.name)}${seloCargo(p)}</div>
          <div class="small">${esc(p.address||'Sem morada')}${own?' · '+esc(own):''}${ownerFilter&&sh(p)<1?' · <b>'+shareText(p)+'</b>':''}</div></div>
        <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
        ${(p.photos||[]).length&&vFile?`<div style="flex:0 0 54px"><div class="pcover" id="th_${p.photos[0].id}" style="width:54px;height:44px;border-radius:10px;background:var(--chip);overflow:hidden"></div></div>`:''}
        ${kebab('prop:'+p.id)}</div>
      </div>
      <div class="chips">
        ${vCt?`<span class="badge ${st.badge}">${st.label}</span>`:''}
        ${p.use==='investimento'?`<span class="badge grey">${p.rentalMode==='quartos'?'Por quartos':'Imóvel inteiro'}</span>`:''}
        ${rent&&vCt?`<span class="badge">${euroS(rent)}/mês</span>`:''}
        ${isFinite(y)&&vCt&&vRep?`<span class="badge">Yield ${pct(y)}</span>`:''}
        ${vRep?`<span class="badge grey">Valor ${euro(p.value)}</span>`:''}
        ${ls.length&&vLoan?`<span class="badge amber">Dívida ${euro(debtOf(p))}${ls.length>1?' · '+ls.length+' hipotecas':''}</span>`:''}
        ${souDono(p.id)&&propDebt(p.id)>0.005?`<span class="badge red">${ic('users',12)} ${euro(propDebt(p.id))} entre proprietários</span>`:''}
        ${(p.photos||[]).length&&vFile?`<span class="badge grey">${ic('photo',12)} ${p.photos.length}</span>`:''}
        ${futuros.length&&vCt?`<span class="badge amber">${futuros.length===1?'1 contrato por começar':futuros.length+' contratos por começar'}</span>`:''}
        ${seloColaboradores(p)}</div>
      ${(ac.length||futuros.length)&&vCt?`<div class="small" style="margin-top:10px">${ac.concat(futuros).map(c2=>`${c2.roomId?esc(roomName(p,c2.roomId))+': ':''}${esc(ctNames(c2))} · ${euro(c2.rent)}${ctEstado(c2)==='futuro'&&c2.start?' · a partir de '+dPT(c2.start):''}`).join('<br>')}</div>`:''}
      ${ls.length&&vLoan?`<div class="small" style="margin-top:9px">${ls.map(l=>`${esc(loanName(l))} · ${RATE[l.type]} · ${euro2(loanCalc(l).total)}/mês${(l.files||[]).length?' · '+l.files.length+' doc.':''}`).join('<br>')}
        ${ls.length>1?`<br><b>Total ${euro2(payOf(p))}/mês</b>`:''}</div>`:''}
      </div>`})(p)})));
}

let ctGroupF='';
// handler do antigo seletor de grupo ('ctGroupSel'); a vista atual filtra grupos via lfSel, por isso só dispara se esse seletor existir no DOM
// Devolve: nada — redesenha a vista.
function onCtGroupF(){ctGroupF=val('ctGroupSel')||'';render()}
/* O total de cada imóvel, escrito depois de a lista estar reconciliada.

   Fica fora da assinatura do grupo de propósito: o rentOf(p) muda sempre que
   um contrato daquele imóvel muda de renda ou de datas, e dentro dela isso
   refazia o grupo inteiro — e com ele todos os cartões, que é o contrário do
   que este motor existe para fazer. É a mesma solução do saldo do mês nos
   movimentos.
   Devolve: nada — enche os spans dos títulos dos grupos. */
function pintarRendasDosGrupos(){
  const raiz=view();if(!raiz)return;
  [].slice.call(raiz.querySelectorAll('[data-chave^="imovel:"]')).forEach(function(g){
    const p=prop(String(g.getAttribute('data-chave')).slice(7));
    const sp=g.querySelector('.ctrenda');
    if(p&&sp)sp.textContent=euroS(rentOf(p))+'/mês';
  });
}
/* Contratos agrupados por imóvel, com a renda mensal de cada um no cabeçalho
   da secção. Filtros: imóvel, ativos/terminados, grupo e pesquisa; ordenação
   por nome, renda ou data de início.
   Devolve: string com o HTML completo da vista. */
function vContracts(){
  const K='lcts',s=lf(K),cgs=grpsOf('contract');
  const head=lfBar(K,[
      lfSel(K,'p',lfPropOpts()),
      lfSel(K,'st',[{v:'',label:'Todos os estados'},{v:'on',label:'Em vigor'},{v:'fut',label:'Por começar'},{v:'off',label:'Terminados'}])]
      .concat(cgs.length?[lfSel(K,'g',[{v:'',label:'Todos os grupos'}].concat(cgs.map(g=>({v:g.id,label:'Grupo · '+g.name}))))]:[]),
      db.contracts.filter(c=>ctFMatch(c,s)).length,
      {opts:[{v:'nome',label:'Ordenar por nome'},{v:'renda',label:'Ordenar por renda'},{v:'inicio',label:'Ordenar por início'}]})
    +(casasComo('contract.add').length?fab([{label:'Novo contrato',act:'ctModal()'}]):'');
  if(!db.properties.length)return head+(esperaDoServidor()||`<div class="empty"><b>Cria primeiro um imóvel</b>Um contrato liga um imóvel a um ou mais inquilinos.
    ${saida('Adicionar imóvel',"go('properties')",'ecra')}</div>`);
  if(!db.contracts.length)return head+`<div class="empty"><b>Sem contratos</b>O contrato é onde vive a renda: podes arrendar o imóvel inteiro, ou um contrato por quarto.</div>`;
  let any=false;
  const grupos=[];
  visiveis().forEach(p=>{
    if(s.p&&p.id!==s.p)return;
    const cs=lfSort(K,contractsOf(p.id).filter(c=>ctFMatch(c,s)),{nome:c=>ctName(c),renda:c=>c.rent,inicio:c=>c.start||''});if(!cs.length)return;
    any=true;
    /* Um grupo é UM elemento: o pecaDe fica com o primeiro filho do html de
       cada item, e dois irmãos — o título e a lista — perdiam o segundo em
       silêncio. E o total do imóvel sai da assinatura para um span vazio,
       preenchido depois de reconciliar: dentro dela, mudar uma renda refazia
       o grupo inteiro e com ele todos os cartões, que é o contrário do que
       este motor existe para fazer. */
    grupos.push({chave:'imovel:'+p.id,sig:'imovel|'+p.id+'|'+p.name,html:`<div class="ctgrupo">
      <div class="section-title" style="display:flex;justify-content:space-between;text-transform:none">
      <span>${esc(p.name)}</span><span class="ctrenda"></span></div>
      `+listaViva('cts:'+p.id,cs.map(c=>({chave:'ct:'+c.id,html:((c)=>{
        const on=ctEstado(c),ts=ctTenants(c);
        return `<div class="card tap" data-lp="ct:${esc(c.id)}" data-fk="ct:${esc(c.id)}" data-toca="camada" onclick="ctView('${jsq(c.id)}')">
        <div class="row-between">
          <div style="min-width:0">
            <div class="title">${esc(ctName(c))} ${on==='ativo'?'':`<span class="badge ${on==='futuro'?'amber':'grey'}">${on==='futuro'?'por começar':'terminado'}</span>`}</div>
            <div class="small">${c.roomId?esc(roomName(p,c.roomId)):'Imóvel inteiro'} · ${c.start?'De '+dPT(c.start):'Sem data de início'}${c.end?' a '+dPT(c.end):''}</div>
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
</div>`})(c)})))+`</div>`});
  });
  return head+(any?listaViva('contratos',grupos):`<div class="empty"><b>Nada neste filtro</b><div style="margin-top:10px"><button type="button" class="btn sm" data-toca="vista" onclick="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`);
}
// um contrato passa nos filtros da lista? imóvel, estado, grupo e pesquisa por texto (nome, inquilinos, IBAN, notas…)
// Recebe: c — o contrato (objeto); s — o estado dos filtros da lista (lf('lcts'): campos p, st, g e a pesquisa).
// Devolve: true se o contrato passa em todos os filtros, false caso contrário.
function ctFMatch(c,s){
  if(s.p&&c.propertyId!==s.p)return false;
  /* três ramos e não a negação de um booleano: com dois, um contrato que
     ainda não começou caía em «Terminados», que é o separador errado com o
     rótulo errado */
  if(s.st==='on'&&ctEstado(c)!=='ativo')return false;
  if(s.st==='fut'&&ctEstado(c)!=='futuro')return false;
  if(s.st==='off'&&ctEstado(c)!=='terminado')return false;
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
  const cs=kind==='tenant'?contractsOfTenant(pp.id).filter(ctVivo):propsOf(pp.id);
  return `<div class="card tap" data-lp="per:${esc(kind)}:${esc(pp.id)}" data-fk="per:${esc(kind)}:${esc(pp.id)}" data-toca="camada" onclick="personView('${jsq(kind)}','${jsq(pp.id)}')"><div class="row-between">
    <div style="display:flex;gap:12px;min-width:0">
      <div class="avatar">${esc(initials(pp.name))}</div>
      <div style="min-width:0"><div class="title">${esc(pp.name)}</div>
        <div class="small">${[pp.phone?fmtPhone(pp.phone):'',pp.email].filter(Boolean).map(esc).join(' · ')||'Sem contacto'}${pp.nif?' · NIF '+esc(fmtNIF(pp.nif)):''}</div>
        <div class="small">${kind==='tenant'
          ?(cs.length?cs.map(c=>esc(ctName(c))+' · '+euro(c.rent)+(ctEstado(c)==='futuro'&&c.start?' · a partir de '+dPT(c.start):'')).join('<br>'):'Sem contrato ativo')
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
    const fut=contractsOfTenant(t.id).filter(c=>ctEstado(c)==='futuro');
    /* três ramos: com dois, quem assinou para 2028 caía em «Sem contrato
       ativo» ao lado de um cartão que mostra o contrato e a data em que
       começa — o ecrã contradizia-se */
    if(s.ct==='com'&&!cs.length)return false;
    if(s.ct==='fut'&&!fut.length)return false;
    if(s.ct==='sem'&&(cs.length||fut.length))return false;
    return lfHit(K,[t.name,t.phone,t.email,t.nif,t.notes,t.nationality,
      contractsOfTenant(t.id).map(c=>ctName(c)+' '+propName(c.propertyId)).join(' ')].join(' '));
  });
  list=lfSort(K,list,{nome:t=>t.name,contratos:t=>contractsOfTenant(t.id).filter(isActive).length,
    renda:t=>sum(contractsOfTenant(t.id).filter(isActive).map(c=>c.rent))});
  const head=lfBar(K,[lfSel(K,'ct',[{v:'',label:'Todos os inquilinos'},{v:'com',label:'Com contrato ativo'},{v:'fut',label:'Com contrato por começar'},{v:'sem',label:'Sem contrato'}])],list.length,
      {opts:[{v:'nome',label:'Ordenar por nome'},{v:'contratos',label:'Ordenar por nº de contratos'},{v:'renda',label:'Ordenar por renda'}]})
    +((!souSoColaborador()||casasComo('tenant.add').length)?fab([{label:'Adicionar inquilino',act:"personModal('tenant')"}]):'');
  if(!db.tenants.length)return head+(esperaDoServidor()||`<div class="empty"><b>Sem inquilinos</b>A ficha guarda só os dados da pessoa. A renda fica no contrato.</div>`);
  if(!list.length)return head+`<div class="empty"><b>Nada neste filtro</b><div style="margin-top:10px"><button type="button" class="btn sm" data-toca="vista" onclick="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`;
  return head+listaViva('inquilinos',list.map(t=>({chave:'ten:'+t.id,html:personCard(t,'tenant')})));
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
  if(!db.owners.length)return head+(esperaDoServidor()||`<div class="empty"><b>Sem proprietários</b>Um imóvel pode ter vários. Depois podes filtrar a visão geral por proprietário.</div>`);
  if(!list.length)return head+`<div class="empty"><b>Nada neste filtro</b><div style="margin-top:10px"><button type="button" class="btn sm" data-toca="vista" onclick="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`;
  return head+listaViva('proprietarios',list.map(o=>({chave:'own:'+o.id,html:personCard(o,'owner')})));
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
/* O nome de um tipo de movimento para os resumos de filtro. O 'debt' não é um
   tipo de movimento — é o pseudo-tipo do filtro que junta as duas dívidas —,
   por isso não está no KIND, e sem isto aparecia o código cru ao utilizador.
   Recebe: k — o tipo do filtro ('income', 'owed', 'debt'…).
   Devolve: o nome a mostrar (texto); o próprio código, se for um desconhecido. */
function nomeDoTipo(k){return (KIND[k]||{}).short||({debt:'Dívidas'})[k]||k}

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
  txModal(null,kind||'income',pid,null,null,{paidBy:txPaid||null,category:treeKey(kind)===(cat in catsIn()&&!(cat in cats())?'catsIn':'cats')?cat:'',sub:treeKey(kind)===(cat in catsIn()&&!(cat in cats())?'catsIn':'cats')?sub:''});
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
    `<button type="button" class="btn" style="width:100%;justify-content:center" data-toca="camada" onclick="newTplForTx()">${ic('plus',15)} Criar modelo novo</button>
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
  refrescarMovimentos();
  /* o painel repinta-se no sítio, para os seletores dependentes (a
     subcategoria depende da categoria) acompanharem sem fechar nada */
  const p=document.getElementById('txFpanel');
  if(p&&txFiltAberto){const c=p.querySelector('.card');
    if(c)c.innerHTML=txFilterBody()+`<div class="toolbar" style="margin:12px 0 0">${txFilterFoot()}</div>`}
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
    ${typeof fcSelector==='function'?fcSelector():''}
    <div class="qwrap"><input id="tx_q" class="txq" type="search" value="${esc(txSearch)}" placeholder="Pesquisar…" autocomplete="off"
      oninput="onTxSearch(this.value);this.nextElementSibling.style.display=this.value?'':'none'">
      <button class="qclear" style="display:${txSearch?'':'none'}" data-toca="vista" onclick="const i=this.previousElementSibling;i.value='';onTxSearch('');this.style.display='none';i.focus()">✕</button></div>
    <label>Tipo${sel('txKind',txFilter,kinds.map(k=>({v:k[0],label:k[1]})),'onTxFilter','vista')}</label>
    <label>Imóvel${sel('txPropF',txProp,props,'onTxProp','vista')}</label>
    <div class="row"><label>Categoria${sel('txCatF',txCat,catOpts,'onTxCat','vista')}</label>
      ${txCat&&txCat!=='__none__'?`<label>Subcategoria${sel('txSubF',txSub,subOpts,'onTxSub','vista')}</label>`:''}</div>
    ${db.owners.length?`<label>Proprietário${sel('txOwnerF',ownerFilter,owners,'onTxOwner','vista')}</label>
    <label>Pago / recebido por${sel('txPaidF',txPaid,payers,'onTxPaid','vista')}</label>
    <label class="check"><input type="checkbox" id="txNoPayer" ${txNoPayer?'checked':''} onchange="onTxNoPayer()"> Incluir movimentos sem pessoa atribuída</label>`:''}
    <div class="row lado-a-lado"><label>De<input id="txDeF" type="date" value="${txDe}" onchange="onTxDatas()"></label>
      <label>Até<input id="txAteF" type="date" value="${txAte}" onchange="onTxDatas()"></label></div>
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
function txFilterFoot(){return `${txFilterCount()?`<button class="btn" data-toca="vista" onclick="clearTxFilters()">${ic('x',15)} Limpar</button>`:''}<button class="btn primary" data-toca="camada" onclick="txFilterFechar()">${ic('check',15)} Fechar</button>`}
// abre o modal de filtros dos movimentos
// Devolve: nada — abre o modal.
/* O painel de filtros dos movimentos, ancorado ao botão do cabeçalho — o
   mesmo .fwrap/.fpanel das outras listas.
   Devolve: o HTML do painel, ou vazio quando está fechado. */
function txFilterPainel(){
  return `<div class="fwrap" style="height:0"><div class="fpanel ${txFiltAberto?'on':''}" style="top:0" id="txFpanel">
    <div class="card" style="padding:12px">${txFilterBody()}
      <div class="toolbar" style="margin:12px 0 0">${txFilterFoot()}</div></div></div></div>`;
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
  _lqT=setTimeout(()=>{lf(k).q=v;
    /* a via parcial primeiro: escrever na pesquisa não tem de refazer o ecrã */
    if(!refrescarListasVivas())render();
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
  return `<div style="width:100%">${sel(id,lf(k)[key]||'',opts,fn,'vista')}</div>`;
}
// abre/fecha o painel de filtros da lista k
// Recebe: k — a chave da lista.
// Devolve: nada — redesenha a vista.
function lfToggle(k){
  const s=lf(k);s._open=!s._open;render();fpanelEntra(s._open);
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
      <button class="qclear" style="display:${(lf(k).q||'')?'':'none'}" data-toca="vista" onclick="const i=this.previousElementSibling;i.value='';lfSearch('${k}','');this.style.display='none';i.focus()">✕</button></div>
    <div style="display:flex;flex-direction:column;gap:9px;margin-top:9px">${sels.join('')}</div>
    ${sortRow}
    <div class="toolbar" style="margin:12px 0 0">
      <button class="btn" data-toca="vista" onclick="lfClear('${k}')">${ic('x',15)} Limpar</button>
      <button class="btn primary" data-toca="camada" onclick="lfApply('${k}')">${ic('check',15)} Fechar</button>
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
  /* com nome: o + é um desenho, e um leitor de ecrã não lê desenhos. Tinha
     `title`, que o rato mostra e o teclado não, e quando havia várias ações
     nem isso — o botão que abre o leque anunciava-se «botão» e mais nada. */
  if(actions.length===1)return `<button class="fab" data-toca="camada" onclick="${actions[0].act}" aria-label="${esc(actions[0].label||'')}" title="${esc(actions[0].label||'')}">${ic('plus',26)}</button>`;
  return `<div class="fabmenu" id="fabMenu">${actions.map(a=>`<button class="btn primary" data-toca="camada" onclick="document.getElementById('fabMenu').classList.remove('on');${a.act}">${ic(a.icon||'plus',15)} ${esc(a.label)}</button>`).join('')}</div>
  <button class="fab" data-toca="nada" aria-label="Adicionar" title="Adicionar" onclick="document.getElementById('fabMenu').classList.toggle('on')">${ic('plus',26)}</button>`;
}
/* A saída de um ecrã vazio: um botão, no meio, dentro da própria caixa.

   Um ecrã que diz «não há nada» e não diz por onde se começa é um beco. Onde
   há FAB, o FAB é o caminho — isto é para os quatro sítios onde não havia
   caminho nenhum: avaliação sem imóveis, contratos sem imóveis, hipotecas sem
   imóveis e projeções sem contratos. O molde é o que as visitas já usavam,
   para não nascer aqui um quinto desenho de botão.
   Recebe: label — o que o botão faz, escrito como verbo; act — o JavaScript do
   toque; toca — a família do ponto (ecra se muda de ecrã, camada se abre um
   modal).
   Devolve: o HTML do botão dentro da sua barra, para colar dentro do .empty. */
function saida(label,act,toca){
  return `<div class="toolbar" style="justify-content:center;margin-top:16px">
    <button type="button" class="btn primary" data-toca="${toca}" onclick="${act}">${esc(label)}</button></div>`;
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
          ${r.due>0.005?`<button class="btn sm" data-toca="camada" onclick="${stop}txModal(null,'repay',${r.propertyId?`'${r.propertyId}'`:'null'},null,null,{creditor:'${jsq(r.creditor==='—'?'':r.creditor)}',amount:${r.due}})">Pagar</button>`:''}</span></div>`).join('')}
    </div></div></div>`;
}
/* O separador dos Colaboradores: a vista vive na camada da nuvem
   (vColaboradores, em cloud/partilha.js), porque cargos e convites são do
   servidor. Sem conta — e o separador só aparece com uma — fica o convite a
   criar conta, em vez de um ecrã vazio sem explicação.
   Devolve: o HTML da página (texto). */
function vColabTab(){
  if(typeof vColaboradores==='function')return vColaboradores();
  return `<div class="empty"><b>Precisas de uma conta</b>Os colaboradores são pessoas que entram nos teus imóveis com um cargo — isso vive na tua conta, não só neste aparelho.
    <div class="toolbar" style="justify-content:center;margin-top:16px">
    <button class="btn primary" data-toca="ecra" onclick="goSet('cloud')">Criar conta ou entrar</button></div></div>`;
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

   ATENÇÃO ao attrs: não pode trazer um style. O template já escreve o seu, e
   com dois atributos iguais o parser fica com o PRIMEIRO — por isso o attrs
   entra depois, para que um style que venha por engano seja ignorado em vez
   de apagar o do template. Quem precisar mesmo de estilo, use uma classe.

   Recebe: t — o movimento desta linha; mes — o 'AAAA-MM' do bloco onde entra.
   Devolve: {attrs,cls,onclick,caixa,acoes} — attrs são atributos extra da
   linha, cls classes extra, onclick substitui o da linha se não for vazio,
   caixa é HTML colado no início da linha e acoes HTML colado no fim da coluna
   direita. Tudo opcional; o vazio devolve um objeto sem nada. */
function txLinhaExtra(t,mes){return {}}
/* O mesmo para o título de um mês, que em modo de seleção ganha caixa própria.
   Vale aqui o mesmo aviso do attrs sem style — e aqui doía mais, porque o
   style do título é o display:flex que põe o saldo do mês à direita.
   Recebe: mes — o mês em 'AAAA-MM'.
   Devolve: {attrs,cls,caixa} — atributos e classes extra do título, e HTML a
   colar antes do nome do mês. Tudo opcional. */
function txMesExtra(mes){return {}}
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
  const head=txFilterPainel()
  +`${nF||txSearch.trim()?`<div class="small" style="margin:2px 0 10px">${filterSummary()}${txSearch.trim()?(nF?' · ':'')+'pesquisa: “'+esc(txSearch.trim())+'”':''}</div>`:''}`
  +((podeSemImovel()||casasComo('tx.add').length)?fab([{label:'Novo movimento',act:'newTxPick()'}]):'');
  txLinhasPintadas=0;
  if(!db.transactions.length)return head+(esperaDoServidor()||`<div class="empty"><b>Sem movimentos</b>Regista a primeira renda recebida ou despesa paga.</div>`);
  const list=db.transactions.filter(txMatch).sort((a,b)=>{const d=txDir==='desc'?-1:1;
    if(txSort==='amount')return d*((a.amount||0)-(b.amount||0))||String(a.date).localeCompare(String(b.date));
    return d*String(a.date).localeCompare(String(b.date))});
  if(!list.length)return head+`<div class="empty"><b>Nada neste filtro</b><div style="margin-top:10px"><button type="button" class="btn sm" data-toca="vista" onclick="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`
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
  const resumo=`<div class="grid" style="margin-bottom:4px">
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
  return `<div class="card tap txrow${x.cls?' '+x.cls:''}" data-lp="tx:${esc(t.id)}" data-fk="tx:${esc(t.id)}" style="padding:13px 15px" ${x.attrs||''} data-toca="camada" onclick="${x.onclick||`txView('${jsq(t.id)}')`}"><div class="row-between">
    ${x.caixa||''}<div style="min-width:0"><div class="title" style="font-size:14.5px">${esc(t.label)}</div>
      <div class="small">${dPT(t.date)} \u00b7 ${k.short}${t.category?' \u00b7 '+esc(t.category)+(t.sub?' / '+esc(t.sub):''):''}${t.propertyId?' \u00b7 '+esc(propName(t.propertyId)):''}${t.creditor?' \u00b7 '+esc(t.creditor):''}</div>
      ${c?`<div class="small">${ic('contract',12)} ${esc(ctName(c))}</div>`:''}
      ${txQuem(t)}
      ${t.kind==='loan'&&(t.principal||t.interest||t.fee)?`<div class="small">${t.payType==='amortizacao'?`Amortiza\u00e7\u00e3o \u00b7 capital ${euro2(t.principal||0)} \u00b7 comiss\u00e3o ${euro2(t.fee||0)}`:`Capital ${euro2(t.principal||0)} \u00b7 juros ${euro2(t.interest||0)} \u00b7 selo ${euro2(t.stamp||0)}`}</div>`:''}
      ${(!countsInTotals(t)||(t.tags||[]).length)?`<div class="chips">${countsInTotals(t)?'':'<span class="badge grey">fora dos totais</span>'}${(t.tags||[]).map(g=>`<span class="badge grey">${esc(g)}</span>`).join('')}</div>`:''}</div>
    <div style="text-align:right;flex:0 0 auto"><div class="${k.color}" style="font-weight:750${t.kind==='settle'?';color:var(--muted)':''}">${k.sign}${euro2(t.amount)}</div>
      ${t.notes?`<div class="small" style="margin-top:3px" title="Tem coment\u00e1rios">${ic('pen',12)}</div>`:''}${x.acoes||''}</div>
  </div></div>`;
}
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
  return `<div class="txmes"><div class="section-title${xm.cls?' '+xm.cls:''}" style="display:flex;justify-content:space-between;text-transform:none" ${xm.attrs||''}>
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
  const head=anaPanel(`<div style="display:flex;flex-direction:column;gap:9px">
    ${db.owners.length?`<div style="width:100%">${sel('ownerSel',ownerFilter,[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))).concat(gdiv(gOpts('owner'))),'onOwnerFilter','vista')}</div>`:''}
    <div style="width:100%">${sel('projSel',projProp,[{v:'',label:'Todos os imóveis'}].concat(scope().map(p=>({v:p.id,label:p.name}))).concat(gdiv(gOpts('prop'))),'onProjProp','vista')}</div></div>
    <div class="row3" style="margin-top:10px">
    <label>Horizonte (anos)<input type="text" inputmode="numeric" value="${s.years}" onchange="setSet('years',Math.min(30,Math.max(1,num(this.value))))"></label>
    <label>Aumento anual (%)<input type="text" inputmode="decimal" value="${dec(s.growth)}" onchange="setSet('growth',num(this.value))"></label>
    <label>Inflação das despesas (%)<input type="text" inputmode="decimal" value="${dec(s.inflation)}" onchange="setSet('inflation',num(this.value))"></label></div>
    <div class="hint" style="margin-top:9px">Cada contrato tem o seu aumento. Em Portugal há um coeficiente máximo publicado todos os anos.</div>
    <div class="hint" style="margin-top:6px">Despesas: <b>${euro(base.op)}/ano</b> — ${base.anualizado?'o ano corrente anualizado, porque ainda não há um ano completo com despesas':'as de '+base.year+', o último ano completo com despesas'}; crescem com a inflação.</div>`);
  if(!act.length)return head+`<div class="empty" style="margin-top:14px"><b>Nenhum contrato ativo</b>As projeções partem das rendas contratadas.
    ${db.properties.length?saida('Ver contratos',"go('contracts')",'ecra'):saida('Adicionar imóvel',"go('properties')",'ecra')}</div>`;
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
