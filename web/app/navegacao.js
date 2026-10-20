/* ================= NAVEGAÇÃO ================= */
const TABS=[
  {id:'dashboard',icon:'home',label:'Visão geral',sub:'Indicadores do portefólio'},
  {id:'properties',icon:'building',label:'Imóveis',sub:'Dados, fotos, proprietários e crédito'},
  {id:'groups',icon:'layers',label:'Grupos',sub:'Imóveis em conjunto, só teus ou partilhados'},
  {id:'contracts',icon:'contract',label:'Contratos',sub:'Renda, impostos, inventário e anexos'},
  {id:'visits',icon:'door',label:'Visitas',sub:'Quem vem ver as casas'},
  {id:'tenants',icon:'users',label:'Inquilinos',sub:'Ficha e documentos de cada pessoa'},
  {id:'owners',icon:'crown',label:'Proprietários',sub:'Quem é dono de quê'},
  {id:'colaboradores',icon:'shield',label:'Colaboradores',sub:'Quem ajuda a gerir, e com que cargo'},
  {id:'transactions',icon:'lista',label:'Movimentos',sub:'Receitas, despesas, prestações, dívidas e acertos entre proprietários'},
  {id:'recurring',icon:'repetir',label:'Planeados',sub:'Movimentos recorrentes e modelos'},
  {id:'calendar',icon:'cal',label:'Calendário',sub:'Visitas e planeados, dia a dia'},
  {id:'credits',icon:'bank',label:'Créditos',sub:'Hipotecas dos teus imóveis: o capital desce com cada pagamento registado'},
  {id:'projections',icon:'trend',label:'Projeções',sub:'Estimativa ano a ano, a partir dos contratos, planeados e hipotecas registados'},
  {id:'reports',icon:'bars',label:'Avaliação',sub:'Quanto rendem as casas, imóvel a imóvel'},
  {id:'fisco',icon:'recibo',label:'IRS · Anexo F',sub:'O resumo para preencheres o Anexo F. A app resume; quem declara és tu.'},
  {id:'settings',icon:'gear',label:'Definições',sub:'Tema, categorias e etiquetas'}
];
let tab='dashboard',txFilter='',txProp='',txPaid='',txCat='',txSub='',txNoPayer=true,txSearch='',txDe='',txAte='',txSort='date',txDir='desc',repProp='',setPage='';
const SUBPAGE={tema:{label:'Tema',sub:'Claro, escuro ou o do telemóvel'},
               cats:{label:'Tipos de movimento',sub:'Como classificas o que entra e sai'},
               filtros:{label:'Filtros comuns',sub:'Define uma vez, aplica em qualquer vista'},
               tags:{label:'Etiquetas',sub:'Para marcar movimentos'},
               groups:{label:'Grupos',sub:'Conjuntos de imóveis, proprietários e contratos'},
               irs:{label:'IRS e dedução',sub:'Que despesas entram em cada coluna do Anexo F'},
               dados:{label:'Dados',sub:'Splitwise e cópias de segurança'}};
// O contentor onde cada vista é desenhada (o elemento #view).
// Devolve: o elemento #view do DOM (ou null se ainda não existir).
const view=()=>document.getElementById('view');
/* As secções da barra lateral (e do menu do telemóvel, que é a mesma): os
   cinco grupos do canvas de 2026-10. Ao cimo, sem título, a Visão geral; ao
   fundo, sem título, as Definições, a que o gavetaHtml junta a Ajuda e o
   cartão da conta. Sem título não se recolhem.
   «pessoas» não é um separador: é a porta única dos Inquilinos, dos
   Proprietários e dos Colaboradores (PESSOAS), que continuam a ser três
   serviços e três ecrãs, escolhidos lá dentro por um segmentado (abasDaArea).
   Os Grupos saíram do menu: são arrumação da conta e vivem nas Definições
   (definicoes.js:DEF_LINHAS). */
const NAV_GROUPS=[{label:'',ids:['dashboard']},{label:'Casas',ids:['properties','contracts','pessoas','visits']},
  {label:'Dinheiro',ids:['transactions','recurring','credits']},{label:'Análise',ids:['reports','projections','fisco']},
  {label:'Agenda',ids:['calendar']},{label:'',ids:['settings']}];
/* A porta «Pessoas»: os três separadores que junta, pela ordem em que abre.
   Os Colaboradores são o terceiro: quem ajuda a gerir também é gente, e
   procurava-se aqui antes de se procurar nas Definições (o pedido de
   2026-10-20). Sem sessão na nuvem escondem-se (acessos.js:separadoresEscondidos),
   e o segmentado fica com os dois de sempre. */
const PESSOAS=['tenants','owners','colaboradores'];
/* As áreas da barra de baixo do telemóvel: cada uma é uma porta para vários
   separadores, que no topo do ecrã se trocam por separadores segmentados
   (abasDaArea). A Visão geral e a Agenda são um separador só cada uma. */
const AREAS={casas:{label:'Casas',icon:'building',ids:['properties','contracts','pessoas','visits']},
  dinheiro:{label:'Dinheiro',icon:'carteira',ids:['transactions','recurring','credits']}};
/* o último separador visitado em cada área: voltar a «Casas» na barra de
   baixo volta aos Contratos se era lá que se estava, e não aos Imóveis */
const _ultimoNaArea={};
/* Os separadores que uma porta do menu abre: «pessoas» são três, as outras
   portas são o próprio separador.
   Recebe: id — um id de NAV_GROUPS ou de uma área.
   Devolve: array de ids de TABS. */
function idsDaPorta(id){return id==='pessoas'?PESSOAS:[id]}
/* Uma porta do menu está à vista quando pelo menos um dos separadores que
   abre não está escondido (pelo cargo ou por um serviço desligado).
   Recebe: id — a porta; fora — os ids escondidos (separadoresEscondidos).
   Devolve: true/false. */
function portaVisivel(id,fora){return idsDaPorta(id).some(x=>(fora||[]).indexOf(x)<0)}
/* A área da barra de baixo onde vive um separador.
   Recebe: id — um id de TABS.
   Devolve: 'casas', 'dinheiro', ou '' quando não está em nenhuma. */
function areaDe(id){
  return Object.keys(AREAS).find(a=>AREAS[a].ids.some(p=>idsDaPorta(p).indexOf(id)>-1))||'';
}
/* Para onde leva uma porta (ou uma área): «pessoas» ao separador onde já se
   está, ou ao primeiro dos três que se vê; uma área ao último separador que
   lá se visitou, ou à primeira porta que se vê.
   Recebe: id — a porta ou a área; fora — os ids escondidos.
   Devolve: o id de TABS de destino, ou '' sem nada à vista. */
function destinoDe(id,fora){
  const f=fora||[];
  if(AREAS[id]){
    const u=_ultimoNaArea[id];if(u&&f.indexOf(u)<0)return u;
    const p=AREAS[id].ids.find(x=>portaVisivel(x,f));return p?destinoDe(p,f):'';
  }
  const ids=idsDaPorta(id).filter(x=>f.indexOf(x)<0);
  return ids.indexOf(tab)>-1?tab:(ids[0]||'');
}
/* A porta acesa no menu: a do separador atual; a das Definições também nos
   Grupos, que vivem nelas, e não na Ajuda, que tem porta própria. Os
   Colaboradores acendem a das Pessoas (PESSOAS), e já não a das Definições.
   Recebe: id — a porta.
   Devolve: true/false. */
function portaAtiva(id){
  if(id==='settings')return (tab==='settings'&&setPage!=='ajuda')||tab==='groups';
  return idsDaPorta(id).indexOf(tab)>-1;
}
/* O rótulo e o ícone de uma porta: os do separador, menos a «Pessoas».
   Recebe: id — a porta.
   Devolve: {label, icon}. */
function rotuloDaPorta(id){
  if(id==='pessoas')return {label:'Pessoas',icon:'users'};
  const t=TABS.find(x=>x.id===id)||{label:id,icon:''};return {label:t.label,icon:t.icon};
}
/* contagem que cada crachá mostrava da última vez */
let _cntAnt={};
/* Diz se um crachá deve dar o pulso de entrada (index.html:.cnt.novo). Só
   quando o número MUDA: o buildNav corre a cada render, e o render corre
   também na sincronização de fundo — sem esta memória a app pulsava de 3 em 3
   minutos sem nada ter acontecido. A primeira vez não pulsa: ao abrir a app
   está tudo a aparecer, e um salto por cima disso é ruído.
   Recebe: chave — qual o crachá (ex.: 'recurring'); n — a contagem a mostrar.
   Devolve: ' novo' (com o espaço, para colar à classe) quando mudou; '' senão. */
function cntNovo(chave,n){
  const antes=_cntAnt[chave];_cntAnt[chave]=n;
  return antes!==undefined&&antes!==n?' novo':'';
}
/* As secções da gaveta que a pessoa recolheu, pelo rótulo (o label de
   NAV_GROUPS). Ficam no aparelho e não na conta: é uma arrumação do ecrã, e
   um telemóvel e um computador pedem arrumações diferentes. Sem nada
   guardado — ou com o armazenamento fechado, numa janela privada — está
   tudo aberto. */
const LS_GAVETA='gi_nav_fechadas';
let _gavetaFechadas=(function(){try{const v=JSON.parse(localStorage.getItem(LS_GAVETA)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]}catch(e){return []}})();
/* o separador da última pintura da gaveta: é a mudança dele que abre a
   secção onde se chegou (gavetaAbrirDoAtual) */
let _gavetaTabAnt;
/* Grava no aparelho as secções recolhidas. Um armazenamento que recusa
   (cheio, ou fechado) não pode partir um toque na gaveta: fica só em memória
   até a página recarregar.
   Devolve: nada. */
function gavetaGravar(){try{localStorage.setItem(LS_GAVETA,JSON.stringify(_gavetaFechadas))}catch(e){}}
/* O id do contentor dos itens de uma secção — o alvo do aria-controls do
   título, e por onde o gavetaAlternar encontra a secção no DOM.
   Recebe: rotulo — o label da secção (ex.: 'Finanças').
   Devolve: o id (string), ex.: 'gav-financas'. */
function gavetaIdDe(rotulo){return 'gav-'+deacc(rotulo).replace(/[^a-z0-9]+/g,'-')}
/* Quando se chega a um separador, a secção dele abre-se: nunca se fica num
   ecrã sem ver na gaveta onde se está. Vale para todos os caminhos — o go, a
   barra de baixo (goBarra), a página reposta ao recarregar
   (cloud/nucleo.js:restorePage) — porque não se pendura em nenhum: é o
   buildNav que repara que o separador mudou desde a última pintura. Por isso
   recolher À MÃO a secção onde se está continua a valer até se sair dela.
   Devolve: nada — tira a secção do separador atual das recolhidas (e grava), se lá estava. */
function gavetaAbrirDoAtual(){
  if(tab===_gavetaTabAnt)return;
  _gavetaTabAnt=tab;
  const g=NAV_GROUPS.find(x=>x.label&&x.ids.some(p=>idsDaPorta(p).indexOf(tab)>-1)),i=g?_gavetaFechadas.indexOf(g.label):-1;
  if(i>-1){_gavetaFechadas.splice(i,1);gavetaGravar()}
}
/* O crachá no título de uma secção, que só se vê com ela recolhida
   (estilos.css:.navsec-tit): a soma dos crachás que a gaveta mostraria nos
   itens, para um aviso não se perder atrás de uma secção fechada. A cor é a
   do mais urgente — vermelho se algum já passou do prazo, a de aviso só se
   todos forem de aviso — como o de um item sozinho. O pulso não se conta
   outra vez (seria um terceiro cntNovo a disputar a mesma memória): a soma
   pulsa quando um dos crachás dos itens pulsou nesta pintura.
   Recebe: ids — os separadores à vista na secção; itens — o HTML deles, já pintado pelo crachaHtml.
   Devolve: o HTML do crachá (string), ou '' quando a soma é zero. */
function gavetaCracha(ids,itens){
  let n=0,aviso=true;
  ids.forEach(id=>{const c=typeof crachaDe==='function'?crachaDe(id):null;
    if(!c||!c.n||(c.so&&c.so!=='gaveta'))return;
    n+=c.n;if(!c.aviso)aviso=false});
  if(!n)return '';
  return `<span class="cnt${/class="cnt novo/.test(itens)?' novo':''}${aviso?' u-bg-v-warn':''}">${n}</span>`;
}
/* O começo de uma secção com título: a caixa e a abertura do botão, até ao
   aria-controls. É tudo o que muda entre aberta e recolhida, e por isso é
   daqui que o gavetaAlternar troca uma pela outra no HTML guardado.
   Recebe: fechada — true se está recolhida; id — o do contentor (gavetaIdDe).
   Devolve: o HTML (string), por fechar — quem chama acrescenta o resto do botão. */
function gavetaCabeca(fechada,id){
  return `<div class="navsec${fechada?' fechada':''}"><button type="button" class="navsec-tit" aria-expanded="${!fechada}" aria-controls="${id}"`;
}
/* O HTML da gaveta, secção a secção (NAV_GROUPS), com o separador atual
   marcado e os crachás. As secções com título são um botão que recolhe
   (gavetaAlternar) e um contentor com os itens, que a CSS encolhe; as sem
   título (as portas de cima e as Definições) ficam como sempre. Uma
   secção sem separadores à vista desaparece com o título.
   O crachá do título vai no HTML mesmo com a secção aberta (a CSS
   esconde-o): assim recolher e abrir mudam só uma classe e um atributo, e o
   HTML gerado continua igual ao DOM (o buildNav compara-os).
   Recebe: fora — ids dos separadores escondidos (os de separadoresEscondidos).
   Devolve: o HTML (string) para o #nav. */
function gavetaHtml(fora){
  /* «Criar» ao cimo, a toda a largura (o canvas): a mesma folha do + da barra
     de baixo, e só quando há alguma coisa que esta pessoa possa adicionar */
  const criar=typeof acoesDeAdicionar==='function'&&acoesDeAdicionar().length
    ?`<button type="button" class="btn primary nav-criar" data-toca="camada" data-click="abrirAdicionar()">${ic('plus')}<span>Criar</span></button>`:'';
  /* cada destino é um <a> sem href (a navegação é pela gramática, data-click):
     o role="link" é o que faz o leitor de ecrã anunciá-lo como ligação — e
     dizer o aria-current —, e não como texto solto */
  const grupos=NAV_GROUPS.map(g=>{const ids=g.ids.filter(id=>portaVisivel(id,fora));if(!ids.length)return '';
    const itens=ids.map(id=>{const r=rotuloDaPorta(id),on=portaAtiva(id),dest=destinoDe(id,fora);
      return `<a class="${on?'on':''}" tabindex="0" ${on?'aria-current="page"':''} role="link" data-toca="ecra" data-click="go('${jsq(dest)}')">${ic(r.icon)}<span class="txt">${r.label}</span>${id==='pessoas'?'':crachaHtml(id,'gaveta')}</a>`}).join('');
    /* o fundo (as Definições, a Ajuda e a conta) vai numa caixa própria, que a
       CSS encosta ao fundo da barra e deixa sempre à vista (estilos.css:.nav-fundo):
       num ecrã de 900px de altura os grupos não cabem todos, e eram a Ajuda e
       a conta que ficavam por baixo, à espera de quem rolasse a barra */
    if(!g.label&&g.ids.indexOf('settings')>-1)return `<div class="nav-fundo"><div class="navh">${g.label}</div>`+itens+gavetaFundo()+'</div>';
    if(!g.label)return `<div class="navh">${g.label}</div>`+itens;
    const fechada=_gavetaFechadas.indexOf(g.label)>-1,id=gavetaIdDe(g.label);
    return `${gavetaCabeca(fechada,id)} data-toca="nada" data-click="gavetaAlternar('${jsq(g.label)}')">`+
      `<span class="txt">${g.label}</span>${gavetaCracha(ids,itens)}<span class="chev">${ic('chevD',14)}</span></button>`+
      `<div class="navsec-corpo" id="${id}"><div class="navsec-itens">${itens}</div></div></div>`}).join('');
  return criar+gavetaAmbito()+grupos;
}
/* O fundo da barra lateral, a seguir às Definições: a Ajuda e o cartão da
   conta (avatar com as iniciais, o nome, «Conta e partilha»). Os dois vivem
   na nuvem — a Ajuda são os pedidos ao suporte, a conta é a sessão —, e sem
   sessão não aparecem. São páginas das Definições (definicoes.js), e o toque
   leva lá direto (abrirDefinicoes).
   Devolve: o HTML (string), ou '' sem sessão. */
function gavetaFundo(){
  const u=typeof window!=='undefined'&&window.CW&&CW.user;if(!u)return '';
  const ajudaOn=tab==='settings'&&setPage==='ajuda',nome=u.name||u.email||'A minha conta';
  return `<a class="${ajudaOn?'on':''}" tabindex="0" ${ajudaOn?'aria-current="page"':''} role="link" data-toca="ecra" data-click="abrirDefinicoes('ajuda')">${ic('ajuda')}<span class="txt">Ajuda</span></a>`+
    `<button type="button" class="nav-conta" data-toca="ecra" data-click="abrirDefinicoes('cloud')"><span class="avatar">${esc(initials(nome))}</span>`+
    `<span class="u-minw-0"><b>${esc(nome)}</b><small>Conta e partilha</small></span></button>`;
}
/* O âmbito em foco, no menu: «Proprietário em foco» com quem está escolhido
   (o canvas, M-Menu). Só com mais do que um proprietário — com um só não há
   o que escolher. O toque abre a escolha (escolherAmbito).
   Devolve: o HTML (string), ou ''. */
function gavetaAmbito(){
  if(!db.owners||db.owners.length<2)return '';
  const nome=typeof ownerFilterName==='function'&&ownerFilterName();
  return `<button type="button" class="nav-ambito" data-toca="camada" data-click="escolherAmbito()">${ic('users',18)}`+
    `<span class="u-minw-0"><small>Proprietário em foco</small><b>${nome?esc(nome)+(ownerIsGrp()?'':' · quota'):'Todos'}</b></span>${ic('chevD',16)}</button>`;
}
/* Recolhe ou abre uma secção da gaveta. É da família «nada»: muda o DOM que
   já lá está — uma classe na secção, o aria-expanded no título — e não chama
   o buildNav nem o render. Um nó acabado de escrever não tem de onde partir,
   e a transição da altura (estilos.css:.navsec-corpo) só corre num nó vivo;
   e o foco, que está no título, fica nele. Não navega nem fecha a gaveta.
   Troca também a mesma secção no HTML que o buildNav guardou, para a
   próxima pintura (a sincronização de fundo) ver que nada mudou e não
   recriar a gaveta debaixo do dedo. Troca-a por texto, e não pedindo o HTML
   outra vez: pintar de novo passava pelo cntNovo e gastava o pulso de um
   crachá que ainda ninguém viu.
   Recebe: rotulo — o label da secção (ex.: 'Finanças').
   Devolve: nada — grava as recolhidas e atualiza a secção no ecrã. */
function gavetaAlternar(rotulo){
  const i=_gavetaFechadas.indexOf(rotulo),fechar=i<0,id=gavetaIdDe(rotulo);
  if(fechar)_gavetaFechadas.push(rotulo);else _gavetaFechadas.splice(i,1);
  gavetaGravar();
  const b=document.querySelector('#nav [aria-controls="'+id+'"]'),nav=document.getElementById('nav');
  if(!b)return;
  b.setAttribute('aria-expanded',String(!fechar));
  if(b.parentNode)b.parentNode.classList.toggle('fechada',fechar);
  /* sem o começo antigo no guardado (não devia acontecer), o replace não
     muda nada e a próxima pintura reescreve: o lado seguro */
  if(nav&&typeof nav._gavetaHtml==='string')nav._gavetaHtml=nav._gavetaHtml.replace(gavetaCabeca(!fechar,id),gavetaCabeca(fechar,id));
}
/* Reconstrói a navegação da gaveta (gavetaHtml), marcando o separador atual
   e o crachá dos planeados pendentes — na cor de aviso quando nenhum passou
   do prazo. Refaz também a barra de baixo. Quem só colabora não vê os
   separadores que o cargo não abre (separadoresEscondidos): um grupo que
   fique vazio desaparece com o título.
   Corre a cada render, e o render corre também na sincronização de fundo:
   só reescreve o #nav quando o HTML mudou. Reescrever o mesmo recriava os
   nós por nada — tirava o foco a quem anda de teclado na gaveta e cortava a
   meio uma secção a recolher.
   Devolve: nada — reescreve o HTML de #nav (se mudou) e chama buildTabbar. */
function buildNav(){
  /* os separadores escondidos: os que o cargo não abre e os serviços
     desligados nesta conta (acessos.js:separadoresEscondidos) */
  const fora=typeof separadoresEscondidos==='function'?separadoresEscondidos():[];
  gavetaAbrirDoAtual();
  const el=document.getElementById('nav'),html=gavetaHtml(fora);
  if(el&&el._gavetaHtml!==html){el.innerHTML=html;el._gavetaHtml=html}
  buildTabbar(fora);
}
/* O crachá de um separador, se o serviço dele registou um (os «Planeados»
   contam os pendentes na gaveta; o «Calendário» mostra o mesmo número só na
   barra de baixo, onde toma o lugar deles). É o serviço que diz o número, se
   é de aviso e onde aparece (`so`: 'gaveta' ou 'barra'); a base só pinta — e
   só pulsa quando o número muda (cntNovo), contado uma vez por sítio.
   Recebe: id — o separador; onde — 'gaveta' ou 'barra', o sítio que pede.
   Devolve: o HTML do crachá (string), ou '' sem crachá, com zero, ou fora do sítio dele. */
function crachaHtml(id,onde){
  const c=typeof crachaDe==='function'?crachaDe(id):null;
  if(!c||!c.n||(c.so&&c.so!==onde))return '';
  return `<span class="cnt${cntNovo(id,c.n)}${c.aviso?' u-bg-v-warn':''}">${c.n}</span>`;
}
/* Os quatro destinos da barra de baixo do telemóvel (o canvas de 2026-10):
   Início, as duas áreas — Casas e Dinheiro, cada uma com os seus separadores
   no topo — e a Agenda; o + vai a meio. São as mesmas portas da barra lateral,
   agrupadas: tudo o que se faz todos os dias fica a um toque, e a área
   lembra-se do separador onde se estava (_ultimoNaArea). */
const TABBAR=['dashboard','casas','dinheiro','calendar'];
/* o rótulo e o ícone de cada destino da barra de baixo */
const BARRA_ROTULO={dashboard:['Início','home'],calendar:['Agenda','cal']};
/* os destinos que a barra de baixo mostra agora, pela ordem à vista: é por
   eles que o goBarra sabe para que lado corre a fita */
let _barraAgora=TABBAR.slice();
/* Reconstrói a barra de baixo do telemóvel com os destinos de TABBAR; um
   destino escondido dá o lugar a outro que o cargo abre
   (acessos.js:barraDeBaixo). O crachá de cada um vem do serviço que o
   registou (crachaHtml). A meio vai o + (abrirAdicionar) — um botão, não um
   quinto destino: sólido e mais alto —, só quando há alguma coisa para
   adicionar (acessos.js:acoesDeAdicionar); a barra ganha então a classe
   `mais` e diz quantos destinos tem (d0…d4), que é o que a grelha do CSS lê
   para o manter a meio quando quem colabora tem menos. O + não entra em
   _barraAgora: a fita do goBarra conta só destinos.
   Recebe: fora (opcional) — ids de separadores a esconder (os de separadoresEscondidos).
   Devolve: nada — reescreve o HTML e as classes de #tabbar (se o elemento existir). */
function buildTabbar(fora){
  const el=document.getElementById('tabbar');if(!el)return;
  _barraAgora=typeof barraDeBaixo==='function'?barraDeBaixo(TABBAR,fora):TABBAR.filter(id=>(fora||[]).indexOf(id)<0);
  const aqui=areaDe(tab)||tab;
  const itens=_barraAgora.map(id=>{const [rot,icone]=AREAS[id]?[AREAS[id].label,AREAS[id].icon]:(BARRA_ROTULO[id]||[rotuloDaPorta(id).label,rotuloDaPorta(id).icon]);
    const on=id===aqui;
    return `<a class="${on?'on':''}" tabindex="0" ${on?'aria-current="page"':''} role="link" data-toca="ecra" data-click="goBarra('${jsq(id)}')">${ic(icone,22)}<span>${rot}</span>${AREAS[id]?'':crachaHtml(id,'barra')}</a>`});
  const mais=typeof acoesDeAdicionar==='function'&&acoesDeAdicionar().length>0;
  if(mais)itens.splice(Math.ceil(itens.length/2),0,`<button type="button" class="tabmais" data-toca="camada" data-click="abrirAdicionar()" aria-label="Criar" title="Criar">${ic('plus',24)}</button>`);
  el.className='tabbar'+(mais?' mais d'+_barraAgora.length:'');
  el.innerHTML=itens.join('');
}
/* as ações da folha «Criar» aberta, pela posição: o botão diz o índice
   (criarEscolha(i)) e a ação vem daqui, sem texto de ação dentro de outro */
let _criar=[];
/* O + da barra de baixo e o «Criar» da barra lateral. Com uma só ação
   corre-a logo — uma folha com uma opção é um toque a mais; com várias abre
   a folha «Criar» (o canvas, M-Criar), com a ação natural do ecrã onde se
   está em primeiro (acessos.js:acaoDoSeparador) — os tipos de movimento na
   Visão geral e nos Movimentos, a linha «neste ecrã» por cima de tudo nos
   outros. Escolher fecha a folha e corre a ação pela gramática (criarEscolha).
   Fecha primeiro a gaveta do telemóvel, se o «Criar» veio de lá: senão,
   fechada a folha (ou guardado o registo), voltava-se ao menu aberto, com o
   véu por cima do que acabou de se criar e sem a barra de baixo.
   Devolve: nada — corre a ação, ou abre a folha; sem nada para adicionar não faz nada. */
function abrirAdicionar(){
  closeDrawer();
  const todas=acoesDeAdicionar();
  if(!todas.length)return;
  if(todas.length===1)return correrAcao(todas[0].act);
  /* A folha «Criar» do canvas (M-Criar): o movimento pelos cinco tipos
     (tipos.js:TX_TYPES) — é o que se cria todos os dias, e escolher o tipo
     aqui poupa a pergunta seguinte —; depois os modelos guardados, em chips;
     depois o resto dos registos. «A ação do contexto vem primeiro» (o
     contrato): num ecrã cuja ação não é o movimento (os Contratos, as
     Visitas…), essa linha sai do resto e sobe para o topo da folha, por
     cima dos tipos, marcada «neste ecrã». As posições dos tipos registam-se
     primeiro, para criarEscolha(0…4) serem sempre os cinco tipos. */
  const aqui=acaoDoSeparador(tab),mov=todas.find(a=>a.id==='movimento');
  const outras=todas.filter(a=>a.id!=='movimento'),destaque=outras.find(a=>a.id===aqui)||null;
  _criar=[];
  const regista=act=>{_criar.push(act);return _criar.length-1};
  /* a cor de cada tipo é a do dinheiro dele (o canvas): receita verde, despesa
     laranja, crédito roxo, dívida âmbar, transferência cobalto */
  const cor={income:'in',expense:'out',loan:'loan',owed:'amber'};
  const tipos=mov?TX_TYPES.map(([k,icone,rot])=>`<button type="button" class="criar-tipo" data-toca="camada" data-click="criarEscolha(${regista(`criarMovimento('${jsq(k)}')`)})"><span class="ic ${cor[k]||''}">${ic(icone,20)}</span><span>${rot}</span></button>`).join(''):'';
  /* os modelos são dos Planeados: sem esse serviço nesta conta, não se oferecem */
  const modelos=mov&&servicoLigado('recurring')?(db.templates||[]).slice(0,8):[];
  const chips=modelos.map(x=>`<button type="button" class="chip" data-toca="camada" data-click="criarEscolha(${regista(`newFromTemplate('${jsq(x.id)}')`)})">${esc(x.name)}${x.tx&&x.tx.propertyId?' <span class="n">· '+esc(propName(x.tx.propertyId))+'</span>':''}</button>`).join('');
  const linha=a=>`<button type="button" class="criar-outro" data-toca="camada" data-click="criarEscolha(${regista(a.act)})">${ic(a.icon,20)}<span>${esc(a.label)}${a===destaque?'<small>neste ecrã</small>':''}</span></button>`;
  const topo=destaque?`<div class="criar-outros criar-aqui">${linha(destaque)}</div>`:'';
  const resto=outras.filter(a=>a!==destaque).map(linha).join('');
  const corpo=topo+(tipos?`<p class="lbl criar-tit">Novo movimento</p><div class="criar-tipos">${tipos}</div>`:'')+
    (chips?`<p class="lbl criar-tit">A partir de um modelo</p><div class="chips-fila">${chips}</div>`:'')+
    (resto?`<p class="lbl criar-tit">Outros registos</p><div class="criar-outros">${resto}</div>`:'');
  openModal('Criar',`<div class="criar">${corpo}</div>`,SEM_RODAPE);
}
/* Um tipo de movimento escolhido na folha «Criar». Nos Movimentos o
   formulário nasce com os filtros da lista (newTxFromFilters): é o que lá se
   está a ver. Fora deles esses filtros não se veem — o go() guarda-os entre
   ecrãs —, e uma despesa criada na Visão geral não pode nascer num imóvel
   que ninguém escolheu ali: abre limpa, só com o imóvel em foco na Visão
   geral (dashProp), que a faixa do âmbito mostra. Um grupo em foco não passa
   ao formulário (um movimento de grupo é um lote, e escolhe-se lá dentro).
   Pagar um crédito abate capital na ficha do imóvel: sem «Editar a ficha»
   diz-se antes de abrir (acessos.js:motivoCredito), como nos Movimentos.
   Os dois formulários são do serviço dos Movimentos: chamam-se pela guarda
   (servicos.js:chamarServico), como os atalhos de acessos.js.
   Recebe: k — o tipo ('income', 'expense', 'loan', 'owed' ou 'settle').
   Devolve: nada — abre o formulário, ou o aviso de porque não. */
function criarMovimento(k){
  if(tab==='transactions')return chamarServico('transactions','newTxFromFilters',k);
  const pid=tab==='dashboard'&&dashProp&&!String(dashProp).startsWith('g:')?dashProp:null;
  if(k==='loan'&&pid){const rc=motivoCredito(pid);if(rc)return toast(rc)}
  chamarServico('transactions','txModal',{kind:k||'income',propId:pid});
}
/* Um toque numa opção da folha «Criar»: fecha a folha e corre a ação pela
   gramática das ações (eventos.js:correrAcao), como o menu ⋯ dos imóveis — os
   nomes são de serviços, e é a gramática que os resolve na hora.
   Recebe: i — a posição da ação em _criar.
   Devolve: nada. */
function criarEscolha(i){const act=_criar[i];closeModal();if(act)correrAcao(act)}
// Muda de separador: limpa a subpágina das Definições e o donut, fecha a
// gaveta, refaz a navegação e repinta, com scroll para o topo.
// Recebe: id — o separador de destino (um id de TABS, ex.: 'transactions').
// Devolve: nada — redesenha a vista.
/* De onde veio a mudança de separador, e para que lado.

   A barra de baixo é uma fita com quatro destinos e uma ordem À VISTA: ir dos
   Movimentos para os Imóveis é andar um lugar para a direita, e a pessoa viu
   o lugar antes de lá tocar. A gaveta são quinze destinos agrupados por
   assunto — da «Visão geral» para as «Definições» não há lado nenhum, e uma
   fita a correr ali inventava uma vizinhança que não existe.

   É uma variável, e não um segundo argumento do go: dois dos embrulhos da
   nuvem chamam-no com um argumento só (cloud/anexos.js, cloud/selecao.js), e
   um go(id,lado) chegava cá sem o lado — o deslize nunca acontecia, sem erro
   nenhum, que é o pior sítio onde isto podia falhar. */
let _ladoSep=0;
/* Um toque na barra de baixo. Só este caminho desliza.
   Recebe: id — o separador de destino.
   Devolve: nada — navega, com a fita a correr para o lado certo. */
function goBarra(id){
  /* um destino da barra pode ser uma área (Casas, Dinheiro): o lado conta-se
     pela área onde se está, e o destino é o separador onde se ficou nela */
  const i=_barraAgora.indexOf(areaDe(tab)||tab),j=_barraAgora.indexOf(id);
  const fora=typeof separadoresEscondidos==='function'?separadoresEscondidos():[];
  const dest=AREAS[id]?destinoDe(id,fora):id;if(!dest)return;
  /* esconder separadores tira itens da fita mas não lhes troca a ordem */
  _ladoSep=(i>-1&&j>-1&&i!==j)?(j>i?1:-1):0;
  try{go(dest)}finally{_ladoSep=0}   // o go GLOBAL: a nuvem embrulha-o
}
/* Muda de separador: limpa a subpágina das Definições e o donut, fecha a
   gaveta, refaz a navegação e repinta, com scroll para o topo. Vindo da barra
   de baixo (goBarra), o painel vira como uma fita para o lado certo.
   Recebe: id — o separador de destino (um id de TABS, ex.: 'transactions').
   Devolve: nada — redesenha a vista. */
function go(id){
  const lado=_ladoSep,desde=_desdeSep;_ladoSep=0;_desdeSep=0;
  /* um separador de um serviço desligado nesta conta não abre: diz-se
     porquê e fica-se onde se está (um atalho antigo, um endereço guardado) */
  if(typeof separadorLigado==='function'&&!separadorLigado(id)){toast(hintServicoDesligado(servicoDoSeparador(id)));return}
  const area=areaDe(id);if(area)_ultimoNaArea[area]=id;
  const pintar=()=>{tab=id;setPage='';aoMudarDeSeparador();closeDrawer();fecharFiltros();_entrar=1;buildNav();render();
    try{window.scrollTo(0,0)}catch(e){}};
  /* tocar no separador aceso não é uma travessia, é uma repintura — e essa já
     tem o acompanhamento das peças */
  if(!lado||id===tab||typeof deslizarPainel!=='function')return pintar();
  return deslizarPainel(pintar,lado,desde);
}
/* ---- deslizar entre os separadores de uma área ----
   No telemóvel, os separadores de uma área (Imóveis, Contratos, Pessoas,
   Visitas; Movimentos, Planeados, Créditos) são um carrossel: arrastar de
   lado na vista leva a página com o dedo, e largar depois de um quarto da
   largura, ou com um sacudir, acaba a viagem até ao vizinho pela fita da
   barra de baixo (continuidade.js:deslizarPainel), a partir de onde o dedo a
   deixou. Largar antes disso devolve a página ao sítio. Nas pontas não há
   vizinho: a página resiste, e não dá a volta.

   As regras são as do calendário (calendario.js:calArrastar): o eixo decide-se
   aos 10px, e um gesto que começa na vertical é da página, que rola como
   sempre — o touch-action:pan-y do #view (estilos.css, «deslizar entre
   separadores») deixa o browser rolar, e nesse caso chega o pointercancel e a
   página volta ao sítio. E nunca rouba um gesto que já tem dono
   (sepGestoLivre, sepEstadoLivre). */
/* De onde o dedo largou a página: o go lê-o junto com o _ladoSep, e pela
   mesma razão (os embrulhos da nuvem chamam o go com um argumento só). */
let _desdeSep=0;
/* o arrasto em curso: {id,x0,y0,dx,desl,ativo,w,vx,xa,ta,v,r0,meio,viz,mexe,esp,espD}, ou null */
let _sepArrasto=null;
/* true enquanto a página volta ao sítio (200ms): um dedo novo nesse instante
   apanhava-a com a animação de regresso ainda por cima do transform */
let _sepVolta=false;
/* As bordas do ecrã são do sistema: o voltar do Android e do Safari nasce lá. */
const SEP_BORDA=20;
/* Onde um arrasto de lado já tem dono, e por isso nunca vira o separador: a
   grelha do calendário, a leitura dos gráficos (e das barras da dívida dos
   Créditos, pela mesma classe), o puxador das fotos, um bloco do painel em
   edição, os campos de texto e as janelas. O que rola de lado vê-se pela
   medida, e não pelo nome (sepRolaDeLado). */
const SEP_NAO_ROUBA='#calDias,.chartbox[data-lido],.pgrab,#view.cw-edit .cw-blk,'+
  'input,textarea,select,[contenteditable]:not([contenteditable="false"]),.modal';
/* A porta vizinha da atual, na área onde se está, pela ordem dos separadores
   que se veem (abasDaArea).
   Recebe: d — +1 a seguinte (a da direita), -1 a anterior; fora (opcional) —
   os ids escondidos (separadoresEscondidos).
   Devolve: o id da porta (de AREAS), ou '' na ponta ou fora de uma área com
   separadores. */
function portaVizinha(d,fora){
  const f=fora||(typeof separadoresEscondidos==='function'?separadoresEscondidos():[]);
  const area=areaComSeparadores(f);if(!area||!d)return '';
  const portas=AREAS[area].ids.filter(id=>portaVisivel(id,f));
  const i=portas.findIndex(id=>idsDaPorta(id).indexOf(tab)>-1);
  return i>-1&&portas[i+(d>0?1:-1)]||'';
}
/* O separador para onde um arrasto leva: o destino da porta vizinha (as
   Pessoas abrem nos Inquilinos, ou nos Proprietários se só esses se veem).
   Recebe: d — +1 a seguinte, -1 a anterior; fora (opcional) — os ids escondidos.
   Devolve: o id de TABS, ou '' sem vizinho. */
function vizinhoNaArea(d,fora){
  const f=fora||(typeof separadoresEscondidos==='function'?separadoresEscondidos():[]);
  const p=portaVizinha(d,f);return p?destinoDe(p,f):'';
}
/* Diz se um elemento rola de lado: tem mais largura do que mostra e deixa-se
   rolar (as filas de chips, as tabelas, os totais dos Movimentos, os
   tutoriais da Ajuda, o plano dos Créditos). Um contentor com overflow:auto
   que cabe inteiro não conta — lá o arrasto é da página.
   Recebe: el — o elemento.
   Devolve: true/false. */
function sepRolaDeLado(el){
  if(!el||!(el.scrollWidth>el.clientWidth+1))return false;
  let ox='';try{ox=getComputedStyle(el).overflowX}catch(e){}
  return ox==='auto'||ox==='scroll';
}
/* Diz se um arrasto que começa neste elemento pode ser de virar o
   separador: tem de ser dentro do #view, e nem o elemento nem os pais até ao
   #view podem ter já dono para um arrasto de lado (SEP_NAO_ROUBA,
   sepRolaDeLado).
   Recebe: alvo — o elemento onde o dedo pousou (o target do pointerdown).
   Devolve: true/false. */
function sepGestoLivre(alvo){
  const v=document.getElementById('view');
  if(!alvo||!v||typeof alvo.closest!=='function'||!v.contains(alvo))return false;
  if(alvo.closest(SEP_NAO_ROUBA))return false;
  for(let el=alvo;el&&el!==v;el=el.parentElement)if(sepRolaDeLado(el))return false;
  return true;
}
/* Diz se a app está num estado em que um arrasto pode virar o separador: um
   ecrã até 900px (no computador a barra lateral mostra as portas todas), uma
   área com separadores, e nada por cima nem a meio — uma janela, a gaveta, a
   seleção (dos Movimentos ou de uma lista), o painel em edição.
   Devolve: true/false. */
function sepEstadoLivre(){
  let estreito=false;
  try{estreito=!!(window.matchMedia&&window.matchMedia('(max-width:900px)').matches)}catch(e){}
  if(!estreito)return false;
  if(typeof modalStack!=='undefined'&&modalStack.length)return false;
  const b=document.body,cl=b&&b.classList;
  if(cl&&(cl.contains('open')||cl.contains('sel-on')))return false;
  if(window.CW&&(window.CW.editMode||window.CW.selMode))return false;
  return !!areaComSeparadores();
}
/* A resistência de uma ponta: a página anda cada vez menos quanto mais se
   puxa, e nunca passa de uma fração da largura (a curva das listas do iOS).
   Recebe: dx — px que o dedo andou; w — a largura da página.
   Devolve: px a que a página fica (com o sinal de dx). */
function sepElastico(dx,w){
  const a=Math.abs(dx),l=w||1;
  return Math.sign(dx)*(1-1/(a*.55/l+1))*l*.5;
}
/* Começa (talvez) um arrasto entre separadores: guarda onde o dedo pousou e
   fica à escuta. Só passa a arrastar no sepArrastoMove, quando o dedo andou
   na horizontal. O rato não entra: num ecrã estreito de computador, arrastar
   é selecionar texto.
   Recebe: e — o PointerEvent do pointerdown (ouvido no documento).
   Devolve: nada — liga os ouvintes do documento. */
function sepArrastar(e){
  if(_sepArrasto||!e||e.button>0||e.isPrimary===false||e.pointerType==='mouse')return;
  // a meio de uma fita a página está em viagem: um dedo agora pegava nela a meio
  if(_sepVolta||(typeof _fimPainel!=='undefined'&&_fimPainel))return;
  const larg=window.innerWidth||0;
  if(e.clientX<SEP_BORDA||(larg&&e.clientX>larg-SEP_BORDA))return;
  if(!sepEstadoLivre()||!sepGestoLivre(e.target))return;
  _sepArrasto={id:e.pointerId,x0:e.clientX,y0:e.clientY,dx:0,desl:0,ativo:false,w:0,vx:0,xa:e.clientX,ta:Date.now()};
  document.addEventListener('pointermove',sepArrastoMove);
  document.addEventListener('pointerup',sepArrastoFim);
  document.addEventListener('pointercancel',sepArrastoFim);
}
/* O dedo andou: decide se o gesto é de virar o separador (horizontal) ou da
   página (vertical), e, sendo de virar, leva a página com ele.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada — mexe no transform do #view. */
function sepArrastoMove(e){
  const a=_sepArrasto;if(!a||e.pointerId!==a.id)return;
  let dx=e.clientX-a.x0;const dy=e.clientY-a.y0;
  if(!a.ativo){
    // o dedo foi para cima ou para baixo: é a página a rolar, não é connosco
    if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx))return sepArrastoLargar();
    if(Math.abs(dx)<10)return;
    /* entretanto pode ter aberto uma janela (o toque longo) ou começado uma
       seleção: o gesto deixou de ser nosso */
    const v=document.getElementById('view');
    if(!v||!sepEstadoLivre())return sepArrastoLargar();
    const r=v.getBoundingClientRect(),alt=window.innerHeight||0;
    a.ativo=true;a.v=v;a.r0=r;a.w=r.width||window.innerWidth||1;
    a.meio=(Math.max(r.top,0)+Math.min(r.bottom,alt||r.bottom))/2;
    a.viz={'1':vizinhoNaArea(1),'-1':vizinhoNaArea(-1)};
    a.mexe=!semMovimento()&&!!v.parentNode;
    // a folga de decidir não conta: a página arranca colada ao dedo, sem salto
    a.x0+=dx<0?-10:10;dx=e.clientX-a.x0;
    if(a.mexe)v.parentNode.classList.add('sep-arrasto');
  }
  /* um toque longo que chegou a meio (o dedo parou antes dos 12px dele) abriu
     uma janela ou uma seleção: a página volta ao sítio e o gesto acaba */
  else if(!sepEstadoLivre())return sepArrastoFim({type:'pointercancel',pointerId:a.id});
  const agora=Date.now(),dt=agora-a.ta;
  // a velocidade dos últimos instantes, alisada: é ela que diz se o gesto foi um sacudir
  if(dt>0)a.vx=.6*((e.clientX-a.xa)/dt)+.4*a.vx;
  a.xa=e.clientX;a.ta=agora;a.dx=dx;
  // arrastar para a esquerda traz o separador da direita, que é o seguinte
  const d=dx<0?1:-1,tem=!!a.viz[d];
  a.desl=tem?dx:sepElastico(dx,a.w);
  if(a.mexe)a.v.style.transform='translateX('+a.desl+'px)';
  sepEspreita(a,tem&&dx?d:0);
}
/* O nome do separador que vem, a espreitar no espaço que a página deixa ao
   sair para o lado — sem ele, o arrasto mostrava um vazio e não dizia para
   onde se ia. Acende-se quando largar já vira. Não é tocável nem lido pelo
   leitor de ecrã: quem lê tem os separadores no topo do ecrã. Sem movimento
   (prefers-reduced-motion) fica parado à beira do ecrã, e só aparece.
   Recebe: a — o arrasto em curso; d — o lado do vizinho (+1, -1), ou 0 para
   o esconder (na ponta, ou com o dedo de volta ao sítio).
   Devolve: nada — cria, posiciona ou esconde o .sep-espreita. */
function sepEspreita(a,d){
  if(!d){if(a.esp)a.esp.classList.remove('on');return}
  if(!a.esp){
    if(typeof camadaDeSaida!=='function')return;
    a.esp=document.createElement('div');a.esp.className='sep-espreita';a.esp.setAttribute('aria-hidden','true');
    camadaDeSaida().appendChild(a.esp);
  }
  const el=a.esp;
  if(a.espD!==d){
    a.espD=d;
    const nome=esc(rotuloDaPorta(portaVizinha(d)).label);
    el.innerHTML=d>0?'<span>'+nome+'</span>'+ic('chevR',16):ic('chev',16)+'<span>'+nome+'</span>';
    el.style.top=Math.round(a.meio)+'px';
    a.espW=el.offsetWidth||0;
  }
  /* colado à borda da página que sai, 12px para dentro do vazio; sem
     movimento, à beira do ecrã do lado de onde o vizinho viria */
  const borda=d>0?a.r0.right+(a.mexe?a.desl:-a.espW-24):a.r0.left+(a.mexe?a.desl:a.espW+24);
  const x=d>0?borda+12:borda-12-a.espW;
  el.style.transform='translate('+Math.round(x)+'px,-50%)';
  el.classList.add('on');
  el.classList.toggle('pronto',Math.abs(a.dx)>a.w/4);
}
/* Tira os ouvintes do documento e esquece o arrasto.
   Devolve: nada. */
function sepArrastoLargar(){
  document.removeEventListener('pointermove',sepArrastoMove);
  document.removeEventListener('pointerup',sepArrastoFim);
  document.removeEventListener('pointercancel',sepArrastoFim);
  _sepArrasto=null;
}
/* Devolve a página ao estado de antes do arrasto: sem o transform do dedo,
   sem o corte do pai, sem o nome a espreitar.
   Recebe: a — o arrasto que acabou.
   Devolve: nada. */
function sepArrastoArrumar(a){
  if(a.v)a.v.style.transform='';
  if(a.v&&a.v.parentNode)a.v.parentNode.classList.remove('sep-arrasto');
  if(a.esp)a.esp.remove();
}
/* O dedo saiu: vira para o separador vizinho, se o gesto chegou para isso,
   ou devolve a página ao sítio. Um pointercancel (o browser ficou com o
   gesto, para rolar) nunca vira. O toque que o browser dispara a seguir não é
   um toque num cartão — engole-se, senão largar a página em cima de um
   imóvel abria-o.
   Recebe: e — o PointerEvent do pointerup ou do pointercancel.
   Devolve: nada — vira pelo sepIrPara ou anima o regresso. */
function sepArrastoFim(e){
  const a=_sepArrasto;if(!a||(e&&e.pointerId!==a.id))return;
  sepArrastoLargar();
  if(!a.ativo)return;
  sepEngolirToque();
  const d=a.dx<0?1:-1,alvo=a.viz[d];
  const vira=!!alvo&&e.type!=='pointercancel'&&(Math.abs(a.dx)>a.w/4||
    (Math.abs(a.dx)>30&&Math.abs(a.vx)>.4&&(a.vx<0)===(a.dx<0)));
  if(a.esp){a.esp.remove();a.esp=null}
  if(vira){
    /* o #view sai do arrasto ANTES de a fita o medir; ela parte de onde ele estava */
    const desde=a.mexe?a.desl:0;
    sepArrastoArrumar(a);
    return sepIrPara(alvo,d,desde);
  }
  if(!a.mexe||!a.desl||!a.v.animate)return sepArrastoArrumar(a);
  const v=a.v,de=a.desl,dur=msDoToken('--medio',200);
  v.style.transform='';_sepVolta=true;
  const an=v.animate([{transform:'translateX('+de+'px)'},{transform:'none'}],
    {duration:dur,easing:tokenTexto('--curva-entra','cubic-bezier(0,0,.2,1)')});
  let feito=false;
  const fim=()=>{if(feito)return;feito=true;_sepVolta=false;sepArrastoArrumar(a)};
  an.onfinish=fim;
  // a rede de sempre: num separador escondido o onfinish não chega
  setTimeout(fim,dur+120);
}
/* Vai para o separador vizinho, com a fita a correr para o lado certo e a
   partir de onde o dedo deixou a página — o mesmo caminho do goBarra.
   Recebe: id — o separador de destino; d — +1 se vem da direita, -1 da
   esquerda; desde — px a que a página estava deslocada (0 sem movimento).
   Devolve: nada — navega. */
function sepIrPara(id,d,desde){
  _ladoSep=d;_desdeSep=desde||0;
  try{go(id)}finally{_ladoSep=0;_desdeSep=0}   // o go GLOBAL: a nuvem embrulha-o
}
/* Engole o próximo clique, venha de onde vier — o que o browser dispara logo
   a seguir ao fim de um arrasto. Corre na captura do window, depois da
   ligação das ações (eventos.js), e trava-o antes de chegar ao cartão onde o
   dedo saiu.
   Devolve: nada. */
function sepEngolirToque(){
  const engole=ev=>{ev.stopPropagation();ev.preventDefault();tira()};
  const tira=()=>window.removeEventListener('click',engole,true);
  window.addEventListener('click',engole,true);
  // se não vier clique nenhum (o browser não o dá depois de um arrasto), o próximo toque é a sério
  setTimeout(tira,350);
}
document.addEventListener('pointerdown',sepArrastar);
// Navega dentro das Definições: p é a subpágina ('' volta ao menu). Entrar
// numa subpágina arma o histórico, para o voltar do sistema subir a Definições.
// Os Grupos são um separador que vive nas Definições: a linha deles na raiz
// chama goSet('groups'), e daqui vai para o separador (aqui na base e não só
// no embrulho da nuvem, cloud/nucleo.js). Os Colaboradores viveram lá até
// 2026-10-20 e são agora das Pessoas: um goSet('colaboradores') que sobre (um
// atalho, uma ação antiga) leva também ao separador.
// Refaz também a barra lateral: a Ajuda tem porta própria, e entrar nela (ou
// sair dela para as Perguntas frequentes) muda a porta acesa sem mudar de
// separador — o render não toca na barra, e ficava aceso o «Definições». O
// buildNav só reescreve o #nav quando o HTML muda.
// Recebe: p — a subpágina das Definições (uma chave de SUBPAGE; '' volta ao menu).
// Devolve: nada — redesenha a vista e a barra lateral.
function goSet(p){if(p==='groups'||p==='colaboradores')return go(p);setPage=p;if(p)pushHist();_entrar=1;buildNav();render();try{window.scrollTo(0,0)}catch(e){}}
/* Leva a uma página das Definições a partir de qualquer sítio — a Ajuda e a
   conta, no fundo da barra lateral: muda de separador e abre a página.
   Recebe: p — a subpágina ('ajuda', 'cloud', …).
   Devolve: nada — redesenha a vista. */
function abrirDefinicoes(p){if(tab!=='settings')go('settings');if(tab==='settings')goSet(p)}
/* A escolha do proprietário em foco (o «Proprietário em foco» do menu): todos,
   uma pessoa (os valores passam à quota-parte dela) ou um grupo de
   proprietários. É o mesmo filtro do seletor das vistas (vistas.js:ownerBar,
   ambito.js:ownerFilter), e larga o imóvel em foco se ele sair do âmbito.
   Devolve: nada — abre a escolha; escolher repinta. */
function escolherAmbito(){
  const opts=[{v:'',label:'Todos os proprietários',icon:'users'}]
    .concat(db.owners.map(o=>({v:o.id,label:o.name,sub:'os valores na quota-parte de '+(o.name||'').split(' ')[0],avatar:1})))
    .concat(grpsOf('owner').map(g=>({v:'g:'+g.id,label:g.name,sub:'grupo de proprietários',icon:'layers'})));
  pickModal('Proprietário em foco',opts,o=>{closeModal();closeDrawer();ownerFilter=o.v;if(dashProp&&!inScope(dashProp))dashProp='';buildNav();render()});
}
/* Os separadores de uma área, no topo do ecrã do telemóvel (o canvas, M-Casas
   e M-Movimentos): Imóveis/Contratos/Pessoas/Visitas e
   Movimentos/Planeados/Créditos, num segmentado. No computador escondem-se
   (estilos.css:.abas-area) — lá a barra lateral mostra as portas todas. E nas
   Pessoas, em todos os ecrãs, o segundo segmentado: Inquilinos, Proprietários
   ou Colaboradores, com quantos há de cada (contagemDePessoas). Uma área com
   uma porta só à vista (um cargo, um serviço desligado) não escreve
   separadores, e as Pessoas com um só à vista não escrevem o segmentado.
   Devolve: o HTML (string), ou '' fora das áreas. */
function abasDaArea(){
  const fora=typeof separadoresEscondidos==='function'?separadoresEscondidos():[];
  const area=areaComSeparadores(fora);let html='';
  /* <a> sem href, como os da barra: o role="link" é o que os anuncia */
  if(area){
    const ids=AREAS[area].ids.filter(id=>portaVisivel(id,fora));
    html+=`<nav class="segm abas-area" aria-label="${AREAS[area].label}">${ids.map(id=>{
      const on=portaAtiva(id),c=id==='pessoas'||typeof crachaDe!=='function'?null:crachaDe(id);
      return `<a ${on?'class="on" aria-current="page" ':''}role="link" tabindex="0" data-toca="ecra" data-click="go('${jsq(destinoDe(id,fora))}')">${rotuloDaPorta(id).label}${c&&c.n?' <span class="n">'+c.n+'</span>':''}</a>`}).join('')}</nav>`;
  }
  if(PESSOAS.indexOf(tab)>-1){
    const ps=PESSOAS.filter(id=>fora.indexOf(id)<0);
    if(ps.length>1)html+=`<nav class="segm abas-pessoas" aria-label="Tipo de pessoa">${ps.map(id=>{
      const on=id===tab,n=contagemDePessoas(id);
      return `<a ${on?'class="on" aria-current="page" ':''}role="link" tabindex="0" data-toca="ecra" data-click="go('${jsq(id)}')">${rotuloDaPorta(id).label}${n==null?'':' <span class="n">'+n+'</span>'}</a>`}).join('')}</nav>`;
  }
  return html?`<div class="abas">${html}</div>`:'';
}
/* Quantos há de cada tipo de pessoa, para o segmentado das Pessoas: as
   fichas dos inquilinos e dos proprietários, que estão na base; e quem
   colabora nos meus imóveis, que só a nuvem sabe
   (cloud/colaboradores.js:contarColaboradores — cada pessoa uma vez, mesmo
   com dois cargos). Antes de o servidor responder não há número: um «0»
   ali era afirmar o que ainda não se sabe.
   Recebe: id — 'tenants', 'owners' ou 'colaboradores'.
   Devolve: o número, ou null quando não se sabe. */
function contagemDePessoas(id){
  if(id==='colaboradores')return typeof contarColaboradores==='function'?contarColaboradores():null;
  return ((id==='tenants'?db.tenants:db.owners)||[]).length;
}
/* O âmbito sempre à vista (o canvas: «Âmbito sempre à vista»): com um
   proprietário em foco, uma faixa no topo do ecrã diz de quem são os valores
   e limpa-se num toque; na Visão geral diz também o imóvel em foco. Sem foco,
   nada.
   Devolve: o HTML (string), ou ''. */
function faixaDoAmbito(){
  const nome=ownerFilter?ownerFilterName():'',casa=tab==='dashboard'&&dashProp?propName(dashProp):'';
  if(!nome&&!casa)return '';
  const n=scope().length;
  const titulo=nome?(ownerIsGrp()?'Grupo «'+nome+'»':nome+' · quota'):casa;
  const frase=nome?(ownerIsGrp()?'Os imóveis dos proprietários do grupo':'Valores na quota-parte de '+nome.split(' ')[0])+', em '+n+(n===1?' imóvel':' imóveis')+(casa?' · em foco: '+casa:''):'Imóvel em foco na visão geral';
  return `<div class="faixa-ambito" role="status">${ic(nome?'users':'building',20)}<p><b>${esc(titulo)}</b><span>${esc(frase)}</span></p>`+
    `<button type="button" class="btn sm ghost" data-toca="vista" data-click="limparAmbito()">Limpar</button></div>`;
}
/* Limpa o âmbito em foco: o proprietário e o imóvel da visão geral.
   Devolve: nada — repinta. */
function limparAmbito(){ownerFilter='';dashProp='';buildNav();render()}
/* o rótulo do botão da ação do ecrã no cabeçalho, pela ação */
const ROTULO_ACAO={movimento:'Novo movimento',imovel:'Novo imóvel',contrato:'Novo contrato',inquilino:'Novo inquilino',
  proprietario:'Novo proprietário',visita:'Marcar visita',planeado:'Novo recorrente',hipoteca:'Nova hipoteca'};
/* As ações secundárias do cabeçalho do computador, por separador: só as que o
   canvas desenha no cabeçalho e que a app já tem. Hoje é uma — o «Exportar
   CSV» dos Movimentos (D-Movimentos), a mesma exportação das Definições →
   Dados (copias.js:downloadCsv, só com o que é meu: definicoes.js:exportarSoMeu).
   As da Avaliação e do IRS (partilhar, exportar) já estão na barra do topo
   dessas vistas, logo por baixo do cabeçalho, e não se repetem aqui. */
const ACAO_SECUNDARIA={transactions:{rotulo:'Exportar CSV',act:'exportarSoMeu(downloadCsv)',toca:'nada',quando:()=>(db.transactions||[]).length>0}};
/* A ação principal do ecrã, no cabeçalho do computador (o canvas: «Novo
   movimento» na Visão geral, «Novo contrato» nos Contratos), na ponta direita
   (index.html:#hdrAcao, a seguir ao sino e aos filtros). É a mesma da folha
   «Criar» que fica em primeiro (acessos.js:acaoDoSeparador), só quando esta
   pessoa a pode fazer; no telemóvel esconde-se, porque o + da barra de baixo
   já a põe em primeiro. Pinta também a secundária (ACAO_SECUNDARIA), à
   esquerda da principal.
   Devolve: nada — pinta os botões #hdrAcao e #hdrSec (vazios escondem-se, pelo :empty). */
function pintarAcaoDoCabecalho(){
  const s=document.getElementById('hdrSec'),sec=ACAO_SECUNDARIA[tab];
  if(s){
    if(sec&&sec.quando()){s.textContent=sec.rotulo;s.setAttribute('data-click',sec.act);s.setAttribute('data-toca',sec.toca)}
    else{s.innerHTML='';s.removeAttribute('data-click')}
  }
  const b=document.getElementById('hdrAcao');if(!b)return;
  const aqui=acaoDoSeparador(tab),a=aqui&&acoesDeAdicionar().find(x=>x.id===aqui);
  if(!a||(tab==='settings')){b.innerHTML='';b.removeAttribute('data-click');return}
  b.innerHTML=ic('plus',18)+'<span>'+(ROTULO_ACAO[a.id]||a.label)+'</span>';
  b.setAttribute('data-click',a.act);
}
/* A área com separadores onde o separador atual vive: Casas ou Dinheiro,
   quando mostram mais do que uma porta (abasDaArea escreve-as no topo).
   Uma área com uma porta só à vista (um cargo, um serviço desligado) não
   conta: lá o separador é o ecrã inteiro.
   Recebe: fora (opcional) — os ids escondidos (separadoresEscondidos); sem ele pergunta.
   Devolve: 'casas', 'dinheiro', ou ''. */
function areaComSeparadores(fora){
  const f=fora||(typeof separadoresEscondidos==='function'?separadoresEscondidos():[]);
  const area=areaDe(tab);
  return area&&AREAS[area].ids.filter(id=>portaVisivel(id,f)).length>1?area:'';
}
/* O título do cabeçalho. Numa área com separadores (Casas, Dinheiro) leva os
   dois nomes, cada um no seu <span>: o do separador, que o computador mostra
   (a barra lateral não diz em que área se está), e o da área, que o
   telemóvel mostra (o canvas: M-Casas e M-Movimentos — os separadores logo
   por baixo já dizem onde se está). Quem escolhe é a CSS
   (estilos.css:#pageTitle .tit-area), e não uma medida no render: assim
   acompanha uma rotação ou um redimensionar sem repintar.
   Recebe: meta — o separador ou a subpágina das Definições ({label}).
   Devolve: o HTML do título (string). */
function tituloDoEcraHtml(meta){
  const area=tab==='settings'?'':areaComSeparadores();
  if(!area)return esc(meta.label);
  return '<span class="tit-sep">'+esc(meta.label)+'</span><span class="tit-area">'+esc(AREAS[area].label)+'</span>';
}
/* O subtítulo do cabeçalho (só no computador): o do separador (TABS.sub) ou
   o da subpágina das Definições; na Visão geral, com movimentos, o período
   dos indicadores (o canvas, Main: «Ano de 2026 · até hoje, 17/10/2026») —
   os indicadores somam o ano corrente inteiro (metricas.js:metrics), por
   isso, havendo movimentos deste ano com data depois de hoje, diz até onde
   eles vão em vez de «até hoje». Nos Colaboradores, quantas pessoas
   colaboram e quantos convites esperam (cloud/colaboradores.js:resumoDosColaboradores),
   o que dizia a linha das Definições antes de eles passarem para as Pessoas.
   Recebe: meta — o separador ou a subpágina ({sub}).
   Devolve: o texto (string). */
function subtituloDoEcra(meta){
  if(tab==='colaboradores')return typeof resumoDosColaboradores==='function'?resumoDosColaboradores():meta.sub;
  if(tab!=='dashboard'||!(db.transactions||[]).length)return meta.sub;
  const hoje=today(),ano=String(YEAR);
  const ultimo=db.transactions.reduce((m,t)=>{const d=String(t.date||'');return d.indexOf(ano)===0&&d>m?d:m},'');
  return 'Ano de '+ano+' · '+(ultimo>hoje?'com movimentos até '+dPT(ultimo):'até hoje, '+dPT(hoje));
}
/* Abre a gaveta de navegação: fecha primeiro os painéis de filtros, arma o
   histórico (o voltar do sistema fecha-a) e trava o scroll do fundo.
   Devolve: nada — abre a gaveta e passa o foco para dentro dela. */
function openDrawer(){if(document.body.classList.contains('open'))return;
  /* Sem gaveta não há nada para abrir. Acima de 900px o aside é uma coluna do
     ecrã, e o body.open não lhe mexe — mas o lockPage tranca a página na
     mesma. Dava um toque que não fazia nada e deixava o ecrã preso.
     Pergunta-se ao próprio elemento, e não à largura, para não haver dois
     sítios a saber onde é o corte. */
  const gav=document.querySelector('aside');
  if(gav&&typeof getComputedStyle==='function'){
    const pos=(getComputedStyle(gav)||{}).position;
    if(pos&&pos!=='fixed')return;
  }
  closeFilterPanels();document.body.classList.add('open');pushHist();lockPage();
  const b=document.querySelector('.burger');if(b)b.setAttribute('aria-expanded','true');
  /* o foco entra na gaveta: sem isto, o teclado continuava atrás do véu. No
     primeiro sítio que se alcança — um item solto, o título de uma secção ou
     um item de uma secção aberta —, e nunca num item recolhido, que o
     visibility tira do foco e onde o focus() caía em silêncio */
  const a=document.querySelector('#nav>a,#nav .navsec-tit,#nav .navsec:not(.fechada) a');try{if(a)a.focus()}catch(e){}}
/* Abrir a gaveta fecha os painéis de filtros. É o mesmo gesto da mudança de
   separador, e vai pelo mesmo caminho (vistas.js:fecharFiltros — as listas, o
   dos movimentos e os de análise, só no estado); eram duas funções com dois
   nomes a fazer metade cada uma. Aqui só se decide se há que repintar: quando
   o deste separador estava aberto, que é o que se vê.
   Devolve: nada — fecha os painéis e repinta quando o do separador atual estava aberto. */
function closeFilterPanels(){
  const a=analiseDe(tab);
  const was=!!((LFK[tab]&&lf(LFK[tab])._open)||anaOpen[tab]||(a&&a.aberto&&a.aberto()));
  fecharFiltros();
  if(was){closePops();render()}
}
// Fecha a gaveta se estiver aberta e destrava o scroll do fundo. fromPop marca
// as chamadas vindas do voltar do sistema (de momento não muda o comportamento).
// Recebe: fromPop (opcional) — verdadeiro nas chamadas vindas do voltar do sistema (sem efeito de momento).
// Devolve: nada — fecha a gaveta e destrava o scroll.
function closeDrawer(fromPop){if(!document.body.classList.contains('open'))return;document.body.classList.remove('open');lockPage();
  const b=document.querySelector('.burger');if(b)b.setAttribute('aria-expanded','false')}
