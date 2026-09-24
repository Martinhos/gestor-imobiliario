/* ================= VISTAS ================= */
/* botão de filtros no cabeçalho: análise, registos e movimentos */
let anaOpen={};
const LFK={properties:'lprops',contracts:'lcts',tenants:'lten',owners:'lown',recurring:'lrec',credits:'lcred',visits:'lvis'};
/* toque no botão de filtros do cabeçalho: abre o painel certo consoante o
   separador — dropdown nas listas de registos, modal nos movimentos, painel
   de análise nos restantes.
   Devolve: nada — abre/fecha o painel respetivo e redesenha a vista. */
function hdrFiltToggle(){
  if(LFK[tab])return lfToggle(LFK[tab]);
  /* um serviço com painel próprio (os movimentos) regista o seu «alternar»;
     os de análise usam o painel da base */
  const a=analiseDe(tab);
  if(a&&a.alternar)return a.alternar();
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
  fecharFiltrosDosServicos();      // o painel dos movimentos, e o que mais se registar
  Object.keys(listF).forEach(k=>{listF[k]._open=false});
}
// nº de filtros ativos no separador atual — decide o ponto no botão do cabeçalho
// Devolve: número de filtros ativos no separador atual.
function hdrFiltN(){
  if(LFK[tab])return lfCount(LFK[tab]);
  return ANA_N();
}
// fecha o painel de análise do separador atual (os filtros aplicam-se logo ao mexer)
// Devolve: nada — fecha o painel e redesenha a vista.
function anaApply(){anaOpen[tab]=false;render()}
// limpa o proprietário global e o imóvel em foco do separador de análise onde estamos
// Devolve: nada — limpa os filtros e redesenha a vista.
function anaClear(){
  ownerFilter='';
  /* o imóvel em foco é de cada serviço de análise: cada um regista o seu
     «limpar» (servicos.js:registarServico, chave analise) */
  const a=analiseDe(tab);
  if(a&&a.limpar)a.limpar();
  closePops();render();
}
// nº de filtros ativos no separador atual, contados pelo serviço que o tem
// (a visão geral e as projeções contam o proprietário e o imóvel em foco; a
// Declaração só o proprietário; os movimentos os seus filtros e a pesquisa)
// Devolve: número de filtros ativos (0 quando o separador não regista análise).
const ANA_N=()=>{const a=analiseDe(tab);return a&&a.n?a.n():0};
/* O vazio de uma lista quando os filtros não deixam nada: diz-o e oferece o
   caminho de volta (limparFiltroAtual). Um desenho só para todas as listas;
   estava copiado à letra em cinco.
   Devolve: o HTML do .empty (texto). */
function vazioFiltro(){return `<div class="empty"><b>Nada neste filtro</b><div class="u-mt-10px"><button type="button" class="btn sm" data-toca="vista" data-click="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`}
/* O seletor de proprietário dos painéis de análise (o ownerSel, que muda o
   filtro de proprietário da app inteira). Sem proprietários não se escreve.
   Recebe: valor — o que está escolhido; comGrupos (opcional) — false tira os
   grupos de proprietários (a Declaração é por titular, e um grupo não o é).
   Devolve: o HTML do seletor (texto), ou ''. */
function anaSelDono(valor,comGrupos){
  if(!db.owners.length)return '';
  const oo=[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name})));
  return `<div class="u-w-100pc">${sel('ownerSel',valor,comGrupos===false?oo:oo.concat(gdiv(gOpts('owner'))),'onOwnerFilter','vista')}</div>`;
}
/* O painel de análise de uma vista: o seletor de proprietário, o de imóvel (ou
   grupo) do âmbito e, por baixo, o que a vista acrescenta (os campos das
   Projeções, o yield da Avaliação). A visão geral, as Projeções e a Avaliação
   montavam as mesmas três linhas cada uma.
   Recebe: selId — o id do seletor de imóvel; valor — o imóvel (ou 'g:ID')
   escolhido; onchange — o nome da função a chamar ao mudar; extra (opcional) —
   o HTML a pôr por baixo dos seletores.
   Devolve: o HTML do painel, já embrulhado pelo anaPanel. */
function anaPanelPadrao(selId,valor,onchange,extra){
  const po=[{v:'',label:'Todos os imóveis'}].concat(scope().map(p=>({v:p.id,label:p.name}))).concat(gdiv(gOpts('prop')));
  return anaPanel(`<div class="u-d-flex u-fxd-column u-g-9px">
    ${anaSelDono(ownerFilter)}
    <div class="u-w-100pc">${sel(selId,valor,po,onchange,'vista')}</div></div>${extra||''}`);
}
/* embrulha os controlos de análise (inner, já em HTML) no painel dropdown do
   cabeçalho, com os botões Limpar/Fechar; o wrapper tem altura 0 para o
   painel flutuar por cima da página em vez de a empurrar.
   Recebe: inner — os controlos do painel, já em HTML (string).
   Devolve: string HTML do painel pronto a inserir na vista. */
function anaPanel(inner){return `<div class="fwrap u-h-0"><div class="fpanel ${anaOpen[tab]?'on':''} u-t-0"><div class="card u-p-12px">
  ${typeof fcSelector==='function'?fcSelector():''}${inner}
  <div class="toolbar u-m-12px-0-0">
    <button class="btn" data-toca="vista" data-click="anaClear()">${ic('x',15)} Limpar</button>
    <button class="btn primary" data-toca="camada" data-click="anaApply()">${ic('check',15)} Fechar</button>
  </div></div></div></div>`}
/* Cartões e afins são divs com data-click: sem isto, o teclado não chega a
   nenhuma lista — nem um leitor de ecrã os anuncia como acionáveis. Corre
   depois de cada render e de cada fillModal.
   Recebe: raiz — o elemento do DOM onde procurar os [data-click]; com null não faz nada.
   Devolve: nada — acrescenta tabindex e role aos elementos, no próprio DOM. */
function tornarFocavel(raiz){
  if(!raiz)return;
  [].slice.call(raiz.querySelectorAll('[data-click]')).forEach(e=>{
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
  /* quem tem filtros: as listas de registos (LFK) e os serviços que registam
     análise (servicos.js:analiseDe) — a visão geral, as projeções, a
     avaliação, a declaração e os movimentos */
  const a=analiseDe(tab),hasFilt=!!a||!!LFK[tab];
  hb.style.display=hasFilt?'':'none';
  if(!hasFilt)return;
  hb.innerHTML=ic('filter',16)+(hdrFiltN()?'<span class="dot"></span>':'');
  /* aceso com o painel aberto: o da base (anaOpen) ou o que o serviço diz
     (aberto); os movimentos não registam «aberto» e nunca acendem, como dantes */
  hb.classList.toggle('primary',a?(a.aberto?!!a.aberto():!!anaOpen[tab]):(LFK[tab]?!!lf(LFK[tab])._open:false));
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
   (opcional) — classes a juntar ao contentor; classesDoEstilo (opcional) —
   mais classes, as que tomaram o lugar do antigo style= de quem chama (ficou
   um parâmetro à parte, e não juntado ao cls, para quem já o passava não ter
   de trocar de posição).
   Devolve: o HTML do contentor vazio, pronto a colar. */
function listaViva(id,itens,cls,classesDoEstilo){
  itens=(itens||[]).filter(x=>x&&x.chave);
  _listasVivas.push({id:id,itens:itens});
  /* nasce CHEIA: uma vista tem de devolver o ecrã inteiro, e quem a lê — um
     teste, o indexOf do fab, o próximo render — tem de lá encontrar tudo */
  const dentro=itens.map(it=>comChave(it.html,it.chave)).join('');
  return `<div class="list${cls?' '+cls:''}${classesDoEstilo?' '+classesDoEstilo:''}" data-listaviva="${esc(id)}">${dentro}</div>`;
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
  const fn=vistaDoSeparador(tab);   // a vista que o serviço registou (servicos.js)
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
     senão um grupo mantido fica com o total de antes (as rendas dos grupos
     dos contratos, por exemplo — cada serviço regista o seu «depois») */
  const depois=depoisDoSeparador(tab);if(depois)depois();
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
  /* A vista é a que o serviço do separador registou (servicos.js): a base
     não nomeia serviços. Sem vista são duas coisas diferentes, e cada uma tem
     o seu ecrã em vez de rebentar: o serviço está desligado nesta conta (diz
     quem o liga), ou está ligado e a vista não resolve — um defeito, que se
     diz e se relata (servicos.js:vistaNaoCarregouHtml). */
  const vista=vistaDoSeparador(tab);
  let html=vista?vista():separadorLigado(tab)?vistaNaoCarregouHtml(tab):servicoDesligadoHtml(tab);
  if(html.indexOf('class="fab"')>-1)html+='<div class="fabpad"></div>';
  /* A entrada dos gráficos é de quem chega ao ecrã, não de cada repintura: o
     render corre também quando a sincronização adota o estado do servidor de 3
     em 3 minutos (cloud/nucleo.js:applyState) e a cada gesto que só mexe num
     cartão. A marca fica até à próxima pintura, e as repinturas locais que
     acontecem lá dentro (o donutDrill) são de quem tocou no gráfico. */
  view().classList.toggle('entra',!!_entrar);_entrar=0;
  view().innerHTML=html;
  pintarListasVivas();             // as listas vivas, pela mesma via
  /* O que cada serviço pinta DEPOIS de o HTML estar posto — registado com
     depois:{separador:'nome'} (servicos.js:depoisDoSeparador): a lista dos
     movimentos com motor próprio (o innerHTML traz a moldura e o #txLista
     vazio, e quem o enche é o pintarListaTx, que é o mesmo que depois o
     acerta linha a linha sem passar por aqui), as rendas dos grupos dos
     contratos, a criação rápida da visão geral, as miniaturas dos imóveis. */
  const depois=depoisDoSeparador(tab);if(depois)depois();
  tornarFocavel(view());
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
  const dur=msDoToken('--desenho',500);
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
/* Abre e fecha a explicação de um cartão de indicador sem janela (o .expl do
   kpi com «why»). Era um document.getElementById(…).classList.toggle('open')
   escrito no atributo, e a gramática das ações não tem nem o document nem o
   classList. O cartão é o próprio elemento tocado, e existe sempre — é ele que
   traz a ação.
   Recebe: id — o id do cartão ('k1', 'k2'…).
   Devolve: nada — alterna a classe .open do cartão. */
function kpiPorque(id){document.getElementById(id).classList.toggle('open')}
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
    return `<div class="card kpi evo" id="${id}" data-toca="camada" data-click="kpiModal('${jsq(id)}')"><span class="kic">${ic('trend',11)}</span>
      <div class="label">${l}</div><div class="value ${c||''}">${v}</div>${(evo.anual&&haAnoAnterior())?`<div class="kserie" data-kpi="${id}"></div>`:''}${f?`<div class="foot">${f}</div>`:''}</div>`}
  return `<div class="card kpi ${why?'why':''}" id="${id}" ${why?`data-toca="nada" data-click="kpiPorque('${jsq(id)}')"`:''}>
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
  openModal(k.title,body,`<button class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>`+
    (k.acao?`<button class="btn primary" data-toca="vista" data-click="closeModal();${k.acao.act}">${esc(k.acao.label)}</button>`:''));
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
const card=(t,s,b)=>`<div class="card"><div><div class="title">${t}</div>${s?`<div class="small">${s}</div>`:''}</div><div class="u-mt-13px">${b}</div></div>`;
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
const kebab=v=>`<button type="button" class="iconbtn opcoes" aria-label="Opções" data-toca="camada" data-click="${stop}lpMenu('${jsq(v)}')">${ic('dots',18)}</button>`;
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
  return `<div class="toolbar"><div class="u-minw-230px u-maxw-320px">${sel('ownerSel',ownerFilter,opts,'onOwnerFilter','vista')}</div></div>`;
}
// muda o filtro global de proprietário; se o imóvel em foco sair do âmbito, larga-o
// Devolve: nada — redesenha a vista.
function onOwnerFilter(){ownerFilter=val('ownerSel')||'';if(dashProp&&!inScope(dashProp))dashProp='';render()}
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
      <button class="btn sm u-fx-0-0-auto u-p-7px" title="Como se chega aos saldos" data-toca="camada" data-click="${stop}balancesDetail(${pid?`'${jsq(pid)}'`:'null'})">${ic('info',16)}</button></div>
    <div class="u-mt-13px">
      ${rows.map(r=>`<div class="stat"><span class="u-d-flex u-ai-center u-g-9px">
        <span class="avatar u-w-28px u-h-28px u-fs-11px u-fx-0-0-28px">${esc(initials(r.name))}</span>${esc(r.name)}</span>
        <b class="${Math.abs(r.v)<0.01?'':(r.v>0?'pos':'neg')}">${Math.abs(r.v)<0.01?'em dia':(r.v>0?'a receber '+euro2(r.v):'a pagar '+euro2(-r.v))}</b></div>`).join('')}
      ${tot>0.005?`<div class="divider"></div>
        <div class="hint">${plan.map(x=>`<b>${esc((owner(x.from)||{}).name)}</b> paga <b>${euro2(x.amount)}</b> a <b>${esc((owner(x.to)||{}).name)}</b>`).join('<br>')}</div>
        <div class="toolbar u-m-13px-0-0"><button class="btn primary" data-toca="camada" data-click="settleModal(${pid?`'${jsq(pid)}'`:'null'})">
          ${ic('check',16)} Pagar todas as dívidas</button></div>`
        :`<div class="hint u-mt-11px">Está tudo liquidado.</div>`}
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
    ${plans.map(x=>`<div class="card u-p-12px-14px">
      <div class="title u-fs-14px">${esc(x.name)}</div>
      ${x.plan.map(y=>`<div class="stat"><span>${esc((owner(y.from)||{}).name)} → ${esc((owner(y.to)||{}).name)}</span><b>${euro2(y.amount)}</b></div>`).join('')}
    </div>`).join('')}
    ${hist.length?`<div class="divider"></div><div class="flabel">Liquidações anteriores</div>
      ${hist.map(h=>`<div class="stat"><span class="small">${dPT(h.date)} · ${esc(h.propertyId?propName(h.propertyId):'Todos os imóveis')} · ${esc((owner(h.paidBy)||{}).name)} → ${esc((owner(h.toId)||{}).name)}</span><b>${euro2(h.amount)}</b></div>`).join('')}
      <div class="hint">Os acertos ficam nos movimentos, onde podem ser editados.</div>`:''}
    </div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="doSettle(${pid?`'${jsq(pid)}'`:'null'})">Registar pagamentos</button>`);
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

/* ================= FILTROS DAS LISTAS =================
   Pesquisa por texto + seletores no topo de cada página de registos, ao estilo dos movimentos. */
let listF={};
/* O estado dos filtros de uma lista (a pesquisa e os seletores), criado vazio da
   primeira vez.
   Recebe: k — a chave da lista (LFK).
   Devolve: o objeto dos filtros dessa lista. */
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
/* Mostra ou esconde o ✕ da pesquisa enquanto se escreve, conforme o campo tem
   texto. Era um «this.nextElementSibling.style.display=this.value?'':'none'»
   no atributo, que a gramática das ações não tem (é uma atribuição).
   Troca uma CLASSE, e não o el.style, porque o estado inicial do botão também
   passou a ser uma classe (u-d-none): um display='' já não tirava nada.
   Recebe: campo — o <input> da pesquisa; o ✕ é o irmão a seguir.
   Devolve: nada — põe ou tira a classe u-d-none ao ✕. */
function lqMostrarLimpar(campo){campo.nextElementSibling.classList.toggle('u-d-none',!campo.value)}
/* O ✕ da pesquisa de uma lista: esvazia o campo, refaz a pesquisa, esconde-se
   e devolve o foco ao campo. Era tudo no atributo, a começar por um const, que
   a gramática das ações não tem. Faz o mesmo e pela mesma ordem.
   Recebe: botao — o próprio ✕; k — a chave da lista ('lprops', 'lcts'…).
   Devolve: nada — limpa a pesquisa e agenda o redesenho (lfSearch). */
function lqLimpar(botao,k){
  const i=botao.previousElementSibling;
  i.value='';
  lfSearch(k,'');
  botao.classList.add('u-d-none');
  i.focus();
}
/* limpa o filtro do separador atual, seja ele qual for — para o botão dos
   estados vazios não ter de saber onde está
   Devolve: nada — limpa os filtros e redesenha a vista. */
function limparFiltroAtual(){
  if(typeof LFK!=='undefined'&&LFK[tab])return lfClear(LFK[tab]);
  /* o resto é análise, e cada serviço regista o seu «limpar» (os movimentos
     incluídos: os filtros deles limpam-se por aqui, e o proprietário pela base) */
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
   Devolve: string HTML do seletor (o sel() guarda a função que aplica o filtro:
   um window['onlf_…'] posto aqui, depois do arranque, ficava fora da lista dos
   nomes da app, e o selPick recusava-o). */
function lfSel(k,key,opts){
  const id='lfsel_'+k+'_'+key;
  const aplicar=()=>{lf(k)[key]=val(id)||'';if(k==='lprops')ownerFilter=lf(k).own||'';render()};
  return `<div class="u-w-100pc">${sel(id,lf(k)[key]||'',opts,aplicar,'vista')}</div>`;
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
  const sortRow=sorts?`<div class="u-d-flex u-fxd-column u-g-9px u-mt-9px">
      ${lfSel(k,'sb',[{v:'',label:sorts.defLabel||'Ordem original'}].concat(sorts.opts))}
      ${lfSel(k,'sd',[{v:'',label:'Ascendente'},{v:'desc',label:'Descendente'}])}</div>`:'';
  return `<div class="fwrap u-h-0"><div class="fpanel ${s._open?'on':''} u-t-0"><div class="card u-p-12px">
    ${k==='lprops'&&typeof fcSelector==='function'?fcSelector():''}
    <div class="qwrap"><input id="lq_${k}" class="txq" type="search" value="${esc(lf(k).q||'')}" placeholder="Pesquisar…" autocomplete="off"
      data-input="lfSearch('${jsq(k)}',this.value);lqMostrarLimpar(this)">
      <button class="qclear${(lf(k).q||'')?'':' u-d-none'}" data-toca="vista" data-click="lqLimpar(this,'${jsq(k)}')">✕</button></div>
    <div class="u-d-flex u-fxd-column u-g-9px u-mt-9px">${sels.join('')}</div>
    ${sortRow}
    <div class="toolbar u-m-12px-0-0">
      <button class="btn" data-toca="vista" data-click="lfClear('${jsq(k)}')">${ic('x',15)} Limpar</button>
      <button class="btn primary" data-toca="camada" data-click="lfApply('${jsq(k)}')">${ic('check',15)} Fechar</button>
    </div>
  </div></div></div>
  ${n?`<div class="small u-m-2px-0-10px">${found} resultado${found===1?'':'s'} com os filtros ativos${String(s.q||'').trim()?' · pesquisa: “'+esc(s.q.trim())+'”':''}.</div>`:''}`;
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
/* Fecha o leque do botão flutuante (#fabMenu). Era um
   document.getElementById('fabMenu').classList.remove('on') no atributo, e a
   gramática das ações não tem nem o document nem o classList. Quem a chama é
   um botão de dentro do leque, por isso o leque está sempre lá — como estava
   para o código de antes.
   Recebe: nada.
   Devolve: nada — tira a classe .on ao leque. */
function fabFecharMenu(){document.getElementById('fabMenu').classList.remove('on')}
/* Abre e fecha o leque do botão flutuante (#fabMenu), pela mesma razão.
   Recebe: nada.
   Devolve: nada — alterna a classe .on do leque. */
function fabAlternarMenu(){document.getElementById('fabMenu').classList.toggle('on')}
/* botão flutuante de adicionar, no canto inferior direito (o espaço no fundo da página é acrescentado no render)
   Recebe: actions — array de {act: código da ação do data-click, label, icon (opcional)}; com um só item sai o botão simples,
   com vários sai também o menu.
   Devolve: string HTML do botão (e do menu, quando há vários). */
function fab(actions){
  /* com nome: o + é um desenho, e um leitor de ecrã não lê desenhos. Tinha
     `title`, que o rato mostra e o teclado não, e quando havia várias ações
     nem isso — o botão que abre o leque anunciava-se «botão» e mais nada. */
  if(actions.length===1)return `<button class="fab" data-toca="camada" data-click="${actions[0].act}" aria-label="${esc(actions[0].label||'')}" title="${esc(actions[0].label||'')}">${ic('plus',26)}</button>`;
  return `<div class="fabmenu" id="fabMenu">${actions.map(a=>`<button class="btn primary" data-toca="camada" data-click="fabFecharMenu();${a.act}">${ic(a.icon||'plus',15)} ${esc(a.label)}</button>`).join('')}</div>
  <button class="fab" data-toca="nada" aria-label="Adicionar" title="Adicionar" data-click="fabAlternarMenu()">${ic('plus',26)}</button>`;
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
  return `<div class="toolbar u-jc-center u-mt-16px">
    <button type="button" class="btn primary" data-toca="${toca}" data-click="${act}">${esc(label)}</button></div>`;
}
// opções de imóvel para os seletores das listas: "Todos os imóveis" + um por imóvel
// Recebe: withAll (opcional) — sem efeito atual: as opções saem sempre com "Todos os imóveis" à cabeça.
// Devolve: array de opções {v, label} para um seletor.
const lfPropOpts=(withAll)=>[{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p=>({v:p.id,label:p.name})));
// marcas para os gráficos de longo prazo: um traço em cada ano terminado em 0 dentro do horizonte
// Recebe: y0 — o primeiro ano (número); n — quantos anos tem o horizonte.
// Devolve: array de {i: índice no eixo, label: o ano em texto}, um por ano terminado em 0.
const decadeMarks=(y0,n)=>{const out=[];for(let i=0;i<n;i++)if((y0+i)%10===0)out.push({i,label:String(y0+i)});return out};
// escreve uma definição, grava na base e redesenha — usado pelos inputs das definições e das projeções
// Recebe: k — o nome da definição (ex.: 'years', 'growth', 'inflation'); v — o novo valor.
// Devolve: nada — grava na base e redesenha a vista.
function setSet(k,v){db.settings[k]=v;save();render()}
