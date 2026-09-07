/* ================= NAVEGAÇÃO ================= */
const TABS=[
  {id:'dashboard',icon:'home',label:'Visão geral',sub:'Indicadores do portefólio'},
  {id:'properties',icon:'building',label:'Imóveis',sub:'Dados, fotos, proprietários e crédito'},
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
  {id:'reports',icon:'file',label:'Avaliação',sub:'Análise imóvel a imóvel'},
  {id:'settings',icon:'gear',label:'Definições',sub:'Tema, categorias e etiquetas'}
];
let tab='dashboard',txFilter='',txProp='',txPaid='',txCat='',txSub='',txNoPayer=true,txSearch='',txDe='',txAte='',txSort='date',txDir='desc',repProp='',setPage='';
const SUBPAGE={cats:{label:'Tipos de movimento',sub:'Como classificas o que entra e sai'},
               filtros:{label:'Filtros comuns',sub:'Define uma vez, aplica em qualquer vista'},
               tags:{label:'Etiquetas',sub:'Para marcar movimentos'},
               groups:{label:'Grupos',sub:'Conjuntos de imóveis, proprietários e contratos'},
               dados:{label:'Dados',sub:'Splitwise e cópias de segurança'}};
// O contentor onde cada vista é desenhada (o elemento #view).
// Devolve: o elemento #view do DOM (ou null se ainda não existir).
const view=()=>document.getElementById('view');
const NAV_GROUPS=[{label:'Património',ids:['dashboard','calendar','properties','contracts']},{label:'Pessoas',ids:['visits','tenants','owners','colaboradores']},
  {label:'Finanças',ids:['transactions','recurring','credits','projections','reports']},{label:'Aplicação',ids:['settings']}];
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
/* Reconstrói a navegação da gaveta (agrupada por NAV_GROUPS), marcando o
   separador atual e o crachá dos planeados pendentes — na cor de aviso quando
   nenhum passou do prazo. Refaz também a barra de baixo. Quem só colabora
   não vê os separadores que o cargo não abre (separadoresEscondidos): um
   grupo que fique vazio desaparece com o título.
   Devolve: nada — reescreve o HTML de #nav e chama buildTabbar. */
function buildNav(){
  const late=recActive().length,fora=typeof separadoresEscondidos==='function'?separadoresEscondidos():[];
  document.getElementById('nav').innerHTML=NAV_GROUPS.map(g=>{const ids=g.ids.filter(id=>fora.indexOf(id)<0);if(!ids.length)return '';
    return `<div class="navh">${g.label}</div>`+ids.map(id=>{const t=TABS.find(x=>x.id===id);
    return `<a class="${t.id===tab?'on':''}" tabindex="0" ${t.id===tab?'aria-current="page"':''} onclick="go('${t.id}')">${ic(t.icon)}<span class="txt">${t.label}</span>${t.id==='recurring'&&late?`<span class="cnt${cntNovo('recurring',late)}" ${recLate().length?'':'style="background:var(--warn)"'}>${late}</span>`:''}</a>`}).join('')}).join('');
  buildTabbar(late,fora);
}
/* Os quatro destinos quentes, a um toque no telemóvel. A auditoria mediu:
   com tudo atrás da gaveta, qualquer mudança de ecrã custava dois. O
   Calendário tomou o lugar dos Planeados: mostra-os dia a dia (e às
   visitas), e a confirmação rápida continua no cartão da vista geral. */
const TABBAR=['dashboard','transactions','properties','calendar'];
// Reconstrói a barra de baixo do telemóvel com os destinos de TABBAR;
// late é a contagem de planeados pendentes para o crachá.
// Recebe: late — a contagem de planeados pendentes (número), para o crachá;
// fora (opcional) — ids de separadores a esconder (os de separadoresEscondidos).
// Devolve: nada — reescreve o HTML de #tabbar (se o elemento existir).
function buildTabbar(late,fora){
  const el=document.getElementById('tabbar');if(!el)return;
  el.innerHTML=TABBAR.filter(id=>(fora||[]).indexOf(id)<0).map(id=>{const t=TABS.find(x=>x.id===id);
    return `<a class="${id===tab?'on':''}" tabindex="0" ${id===tab?'aria-current="page"':''} onclick="go('${id}')">${ic(t.icon,20)}<span>${t.label==='Visão geral'?'Geral':t.label}</span>${id==='calendar'&&late?`<span class="cnt${cntNovo('calendar',late)}">${late}</span>`:''}</a>`}).join('');
}
// Muda de separador: limpa a subpágina das Definições e o donut, fecha a
// gaveta, refaz a navegação e repinta, com scroll para o topo.
// Recebe: id — o separador de destino (um id de TABS, ex.: 'transactions').
// Devolve: nada — redesenha a vista.
function go(id){tab=id;setPage='';donutCat='';closeDrawer();_entrar=1;buildNav();render();try{window.scrollTo(0,0)}catch(e){}}
// Navega dentro das Definições: p é a subpágina ('' volta ao menu). Entrar
// numa subpágina arma o histórico, para o voltar do sistema subir a Definições.
// Recebe: p — a subpágina das Definições (uma chave de SUBPAGE; '' volta ao menu).
// Devolve: nada — redesenha a vista.
function goSet(p){setPage=p;if(p)pushHist();_entrar=1;render();try{window.scrollTo(0,0)}catch(e){}}
/* Abre a gaveta de navegação: fecha primeiro os painéis de filtros, arma o
   histórico (o voltar do sistema fecha-a) e trava o scroll do fundo.
   Devolve: nada — abre a gaveta e passa o foco para dentro dela. */
function openDrawer(){if(document.body.classList.contains('open'))return;closeFilterPanels();document.body.classList.add('open');pushHist();lockPage();
  const b=document.querySelector('.burger');if(b)b.setAttribute('aria-expanded','true');
  // o foco entra na gaveta: sem isto, o teclado continuava atrás do véu
  const a=document.querySelector('#nav a');try{if(a)a.focus()}catch(e){}}
// Fecha os painéis de filtros abertos na vista atual (funil das listas e painel
// de análise), deitando fora o rascunho; só repinta se algum estava aberto.
// Devolve: nada — fecha os painéis e repinta quando algum estava aberto.
function closeFilterPanels(){
  let was=false;
  if(typeof LFK!=='undefined'&&LFK[tab]&&lf(LFK[tab])._open){lf(LFK[tab])._open=false;lfDraft=null;was=true}
  if(typeof anaOpen!=='undefined'&&anaOpen[tab]){anaOpen[tab]=false;was=true}
  if(was){closePops();render()}
}
// Fecha a gaveta se estiver aberta e destrava o scroll do fundo. fromPop marca
// as chamadas vindas do voltar do sistema (de momento não muda o comportamento).
// Recebe: fromPop (opcional) — verdadeiro nas chamadas vindas do voltar do sistema (sem efeito de momento).
// Devolve: nada — fecha a gaveta e destrava o scroll.
function closeDrawer(fromPop){if(!document.body.classList.contains('open'))return;document.body.classList.remove('open');lockPage();
  const b=document.querySelector('.burger');if(b)b.setAttribute('aria-expanded','false')}
