/* ================= NAVEGAÇÃO ================= */
const TABS=[
  {id:'dashboard',icon:'home',label:'Visão geral',sub:'Indicadores do portefólio'},
  {id:'properties',icon:'building',label:'Imóveis',sub:'Dados, fotos, proprietários e crédito'},
  {id:'contracts',icon:'contract',label:'Contratos',sub:'Renda, impostos, inventário e anexos'},
  {id:'tenants',icon:'users',label:'Inquilinos',sub:'Ficha e documentos de cada pessoa'},
  {id:'owners',icon:'crown',label:'Proprietários',sub:'Quem é dono de quê'},
  {id:'transactions',icon:'swap',label:'Movimentos',sub:'Rendas, despesas e prestações'},
  {id:'recurring',icon:'clock',label:'Planeados',sub:'Movimentos recorrentes e modelos'},
  {id:'credits',icon:'bank',label:'Créditos',sub:'Hipotecas de todos os imóveis'},
  {id:'projections',icon:'trend',label:'Projeções',sub:'Rendas futuras e aumentos anuais'},
  {id:'reports',icon:'file',label:'Avaliação',sub:'Análise imóvel a imóvel'},
  {id:'settings',icon:'gear',label:'Definições',sub:'Tema, categorias e etiquetas'}
];
let tab='dashboard',txFilter='',txProp='',txPaid='',txCat='',txSub='',txNoPayer=true,txSearch='',txSort='date',txDir='desc',repProp='',setPage='';
const SUBPAGE={cats:{label:'Tipos de movimento',sub:'Como classificas o que entra e sai'},
               tags:{label:'Etiquetas',sub:'Para marcar movimentos'},
               groups:{label:'Grupos',sub:'Conjuntos de imóveis, proprietários e contratos'},
               dados:{label:'Dados',sub:'Splitwise e cópias de segurança'}};
const view=()=>document.getElementById('view');
const NAV_GROUPS=[{label:'Património',ids:['dashboard','properties','contracts']},{label:'Pessoas',ids:['tenants','owners']},
  {label:'Finanças',ids:['transactions','recurring','credits','projections','reports']},{label:'Aplicação',ids:['settings']}];
function buildNav(){
  const late=recActive().length;
  document.getElementById('nav').innerHTML=NAV_GROUPS.map(g=>`<div class="navh">${g.label}</div>`+g.ids.map(id=>{const t=TABS.find(x=>x.id===id);
    return `<a class="${t.id===tab?'on':''}" tabindex="0" ${t.id===tab?'aria-current="page"':''} onclick="go('${t.id}')">${ic(t.icon)}<span class="txt">${t.label}</span>${t.id==='recurring'&&late?`<span class="cnt" ${recLate().length?'':'style="background:var(--warn)"'}>${late}</span>`:''}</a>`}).join('')).join('');
}
function go(id){tab=id;setPage='';donutCat='';closeDrawer();buildNav();render();try{window.scrollTo(0,0)}catch(e){}}
function goSet(p){setPage=p;render();try{window.scrollTo(0,0)}catch(e){}}
function openDrawer(){if(document.body.classList.contains('open'))return;closeFilterPanels();document.body.classList.add('open');pushHist();lockPage();
  const b=document.querySelector('.burger');if(b)b.setAttribute('aria-expanded','true');
  // o foco entra na gaveta: sem isto, o teclado continuava atrás do véu
  const a=document.querySelector('#nav a');try{if(a)a.focus()}catch(e){}}
function closeFilterPanels(){
  let was=false;
  if(typeof LFK!=='undefined'&&LFK[tab]&&lf(LFK[tab])._open){lf(LFK[tab])._open=false;lfDraft=null;was=true}
  if(typeof anaOpen!=='undefined'&&anaOpen[tab]){anaOpen[tab]=false;was=true}
  if(was){closePops();render()}
}
function closeDrawer(fromPop){if(!document.body.classList.contains('open'))return;document.body.classList.remove('open');lockPage();
  const b=document.querySelector('.burger');if(b)b.setAttribute('aria-expanded','false')}
