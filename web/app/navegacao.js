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
  {id:'transactions',icon:'swap',label:'Movimentos',sub:'Rendas, despesas e prestações'},
  {id:'recurring',icon:'clock',label:'Planeados',sub:'Movimentos recorrentes e modelos'},
  {id:'calendar',icon:'cal',label:'Calendário',sub:'Visitas e planeados, dia a dia'},
  {id:'credits',icon:'bank',label:'Créditos',sub:'Hipotecas de todos os imóveis'},
  {id:'projections',icon:'trend',label:'Projeções',sub:'Rendas futuras e aumentos anuais'},
  {id:'reports',icon:'bars',label:'Avaliação',sub:'Análise imóvel a imóvel'},
  {id:'fisco',icon:'recibo',label:'Declaração',sub:'O Anexo F, os recibos e os prazos da AT'},
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
/* As secções da gaveta. As duas sem título (label '') são as portas de todos
   os dias, ao cimo, e a das Definições, ao fundo: não são um assunto, e não
   se recolhem. A «Análise» junta o que olha para a frente (Projeções) e o que
   avalia o que já há (Avaliação), que antes se perdiam no fim das Finanças. */
const NAV_GROUPS=[{label:'',ids:['dashboard','calendar']},{label:'Património',ids:['properties','groups','contracts']},
  {label:'Pessoas',ids:['visits','tenants','owners','colaboradores']},{label:'Finanças',ids:['transactions','recurring','credits','fisco']},
  {label:'Análise',ids:['projections','reports']},{label:'',ids:['settings']}];
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
/* A gaveta está no rail do computador, só com ícones (body.rail)? Aí não há
   títulos a ler nem secções a recolher: os ícones ficam todos à vista. Abaixo
   de 900px o body.rail não vale — a gaveta é sempre a larga —, e quem o diz é
   o próprio aside, como no openDrawer, para não haver dois sítios a saber
   onde é o corte.
   Devolve: true no rail; false na gaveta larga ou sem body.rail. */
function gavetaNoRail(){
  const b=document.body;
  if(!b||!b.classList||!b.classList.contains('rail'))return false;
  const gav=document.querySelector('aside');
  const pos=gav&&typeof getComputedStyle==='function'?(getComputedStyle(gav)||{}).position:'';
  return pos!=='fixed';
}
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
  const g=NAV_GROUPS.find(x=>x.label&&x.ids.indexOf(tab)>-1),i=g?_gavetaFechadas.indexOf(g.label):-1;
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
   título (as portas de cima e as Definições) ficam como sempre. No rail
   (gavetaNoRail) os títulos voltam ao .navh de antes, sem botão. Uma
   secção sem separadores à vista desaparece com o título.
   O crachá do título vai no HTML mesmo com a secção aberta (a CSS
   esconde-o): assim recolher e abrir mudam só uma classe e um atributo, e o
   HTML gerado continua igual ao DOM (o buildNav compara-os).
   Recebe: fora — ids dos separadores escondidos (os de separadoresEscondidos).
   Devolve: o HTML (string) para o #nav. */
function gavetaHtml(fora){
  const rail=gavetaNoRail();
  return NAV_GROUPS.map(g=>{const ids=g.ids.filter(id=>fora.indexOf(id)<0);if(!ids.length)return '';
    const itens=ids.map(id=>{const t=TABS.find(x=>x.id===id);
      return `<a class="${t.id===tab?'on':''}" tabindex="0" ${t.id===tab?'aria-current="page"':''} data-toca="ecra" data-click="go('${jsq(t.id)}')">${ic(t.icon)}<span class="txt">${t.label}</span>${crachaHtml(t.id,'gaveta')}</a>`}).join('');
    if(!g.label||rail)return `<div class="navh">${g.label}</div>`+itens;
    const fechada=_gavetaFechadas.indexOf(g.label)>-1,id=gavetaIdDe(g.label);
    return `${gavetaCabeca(fechada,id)} data-toca="nada" data-click="gavetaAlternar('${jsq(g.label)}')">`+
      `<span class="txt">${g.label}</span>${gavetaCracha(ids,itens)}<span class="chev">${ic('chevD',14)}</span></button>`+
      `<div class="navsec-corpo" id="${id}"><div class="navsec-itens">${itens}</div></div></div>`}).join('');
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
   crachá que ainda ninguém viu. No rail não faz nada: lá não há secções.
   Recebe: rotulo — o label da secção (ex.: 'Finanças').
   Devolve: nada — grava as recolhidas e atualiza a secção no ecrã. */
function gavetaAlternar(rotulo){
  if(gavetaNoRail())return;
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
/* Os quatro destinos quentes, a um toque no telemóvel. A auditoria mediu:
   com tudo atrás da gaveta, qualquer mudança de ecrã custava dois. O
   Calendário tomou o lugar dos Planeados: mostra-os dia a dia (e às
   visitas), e a confirmação rápida continua no cartão da vista geral. */
const TABBAR=['dashboard','transactions','properties','calendar'];
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
  const itens=_barraAgora.map(id=>{const t=TABS.find(x=>x.id===id);
    return `<a class="${id===tab?'on':''}" tabindex="0" ${id===tab?'aria-current="page"':''} data-toca="ecra" data-click="goBarra('${jsq(id)}')">${ic(t.icon,20)}<span>${t.label==='Visão geral'?'Geral':t.label}</span>${crachaHtml(id,'barra')}</a>`});
  const mais=typeof acoesDeAdicionar==='function'&&acoesDeAdicionar().length>0;
  if(mais)itens.splice(Math.ceil(itens.length/2),0,`<button type="button" class="tabmais" data-toca="camada" data-click="abrirAdicionar()" aria-label="Adicionar" title="Adicionar">${ic('plus',26)}</button>`);
  el.className='tabbar'+(mais?' mais d'+_barraAgora.length:'');
  el.innerHTML=itens.join('');
}
/* O + da barra de baixo. Com uma só ação corre-a logo — uma folha com uma
   opção é um toque a mais; com várias abre a folha com tudo o que se pode
   adicionar, a ação natural do ecrã onde se está em primeiro e marcada
   «neste ecrã» (acessos.js:acaoDoSeparador). Escolher fecha a folha e corre
   a ação pela gramática das ações (eventos.js:correrAcao), como o menu ⋯ dos
   imóveis: os nomes são de serviços, e é a gramática que os resolve na hora.
   Devolve: nada — corre a ação, ou abre a folha; sem nada para adicionar não faz nada. */
function abrirAdicionar(){
  const todas=acoesDeAdicionar();
  if(!todas.length)return;
  if(todas.length===1)return correrAcao(todas[0].act);
  const aqui=acaoDoSeparador(tab);
  const lista=todas.filter(a=>a.id===aqui).concat(todas.filter(a=>a.id!==aqui));
  pickModal('O que queres adicionar?',lista.map(a=>({v:a.id,label:a.label,sub:a.id===aqui?'neste ecrã':'',icon:a.icon,act:a.act})),
    o=>{closeModal();correrAcao(o.act)});
}
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
  const i=_barraAgora.indexOf(tab),j=_barraAgora.indexOf(id);
  /* esconder separadores tira itens da fita mas não lhes troca a ordem */
  _ladoSep=(i>-1&&j>-1&&i!==j)?(j>i?1:-1):0;
  try{go(id)}finally{_ladoSep=0}   // o go GLOBAL: a nuvem embrulha-o
}
/* Muda de separador: limpa a subpágina das Definições e o donut, fecha a
   gaveta, refaz a navegação e repinta, com scroll para o topo. Vindo da barra
   de baixo (goBarra), o painel vira como uma fita para o lado certo.
   Recebe: id — o separador de destino (um id de TABS, ex.: 'transactions').
   Devolve: nada — redesenha a vista. */
function go(id){
  const lado=_ladoSep;_ladoSep=0;
  /* um separador de um serviço desligado nesta conta não abre: diz-se
     porquê e fica-se onde se está (um atalho antigo, um endereço guardado) */
  if(typeof separadorLigado==='function'&&!separadorLigado(id)){toast(hintServicoDesligado(servicoDoSeparador(id)));return}
  const pintar=()=>{tab=id;setPage='';aoMudarDeSeparador();closeDrawer();fecharFiltros();_entrar=1;buildNav();render();
    try{window.scrollTo(0,0)}catch(e){}};
  /* tocar no separador aceso não é uma travessia, é uma repintura — e essa já
     tem o acompanhamento das peças */
  if(!lado||id===tab||typeof deslizarPainel!=='function')return pintar();
  return deslizarPainel(pintar,lado);
}
// Navega dentro das Definições: p é a subpágina ('' volta ao menu). Entrar
// numa subpágina arma o histórico, para o voltar do sistema subir a Definições.
// A antiga subpágina dos Grupos passou a separador: 'groups' vai para lá,
// aqui na base e não só no embrulho da nuvem (cloud/nucleo.js).
// Recebe: p — a subpágina das Definições (uma chave de SUBPAGE; '' volta ao menu).
// Devolve: nada — redesenha a vista.
function goSet(p){if(p==='groups')return go('groups');setPage=p;if(p)pushHist();_entrar=1;render();try{window.scrollTo(0,0)}catch(e){}}
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
