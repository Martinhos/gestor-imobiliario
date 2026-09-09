/* ================= ARMAZENAMENTO ================= */
/* Onde a nuvem guarda a sessão. Vive aqui, e não só lá, porque o guarda da
   espera (auxiliares.js:sabemosOEstado) tem de saber se há sessão ANTES de a
   nuvem carregar: os ficheiros de web/app correm todos primeiro. O
   cloud/nucleo.js usa esta mesma constante, para não haver duas verdades. */
const LS_SESSAO='gi_cloud_user';
const KEY='gi_v13', OLDS=['gi_v12','gi_v11','gi_v10','gi_v9','gi_v8','gi_v6','gi_v5','gi_v4','gi_v3','gi_v2','gi_v1'];
let mem={};
/* lê do localStorage; se estiver bloqueado (modo privado), vale a cópia em memória desta sessão
   Recebe: k — a chave a ler (string, ex.: 'gi_v13').
   Devolve: o valor guardado (string), ou null se não existir nem no disco nem em memória. */
function rawGet(k){try{const v=localStorage.getItem(k);return v===null&&k in mem?mem[k]:v}catch(e){return k in mem?mem[k]:null}}
/* escreve no localStorage e numa cópia em memória; se o disco falhar, a app continua só em memória e avisa uma vez
   Recebe: k — a chave onde guardar; v — o valor, guardado como string.
   Devolve: nada — grava a chave (em memória sempre; no disco quando dá). */
function rawSet(k,v){mem[k]=String(v);try{localStorage.setItem(k,v)}catch(e){
  /* sem isto, «Guardado.» era mentira em modo privado ou com a quota cheia:
     um reinício levava a sessão toda sem nunca ter avisado */
  if(!rawSet._avisado){rawSet._avisado=1;
    setTimeout(function(){try{toast('Não consegui guardar neste aparelho — armazenamento cheio ou bloqueado. O que fizeres vive só nesta sessão.')}catch(x){}},0)}
}}

const STAMP=0.04;
/* taxa do imposto do selo sobre os juros: configurável em Definições, 4% por omissão
   Devolve: a taxa em fração (ex.: 0.04 para 4%). */
const stampPct=()=>{const v=Number((db&&db.settings||{}).stampPct);return isFinite(v)&&v>=0?v/100:STAMP};
const r2=v=>Math.round(v*100)/100;
/* comissão de amortização antecipada, conforme a fase da taxa (mista: fixa até
   fixedYears, variável depois). A fase vem de loanMes — a mesma conta que o
   plano de amortização usa, para a comissão e a taxa nunca discordarem.
   Recebe: l — a hipoteca (usa type, amortFeeFix, amortFeeVar, fixedYears e as prestações registadas).
   Devolve: a comissão em fração (ex.: 0.02 para 2%). */
function amortFeeRate(l){
  const F=isFinite(Number(l.amortFeeFix))?Number(l.amortFeeFix)/100:0.02;
  const V=isFinite(Number(l.amortFeeVar))?Number(l.amortFeeVar)/100:0.005;
  if(l.type==='variavel')return V;
  if(l.type==='fixa')return F;
  return loanMes(l)<Math.round((Number(l.fixedYears)||5)*12)?F:V;
}
/* quanto ainda se pode amortizar nesta prestação: dívida atual + o capital do próprio registo (em edição)
   Recebe: t — o movimento em causa (pode ser null; só pesa se estiver em edição, t._edit); l — a hipoteca.
   Devolve: o valor amortizável em euros (número). */
function loanAvail(t,l){
  let a=Number(l.outstanding)||0;
  if(t&&t._edit&&t.id){const old=db.transactions.find(x=>x.id===t.id);
    if(old&&old.kind==='loan'&&old.loanId===l.id&&old.principal)a=r2(a+old.principal)}
  return a;
}
const CATS0={
  'Impostos':['IMI','AIMI','IRS sobre rendas','Imposto do selo','Mais-valias','Outro imposto'],
  'Condomínio':['Quota mensal','Quota extraordinária','Fundo de reserva'],
  'Seguros':['Multirriscos','Vida (crédito)','Renda garantida','Responsabilidade civil'],
  'Obras e benfeitorias':['Remodelação','Pintura','Canalização','Eletricidade','Cozinha','Casa de banho','Janelas'],
  'Manutenção e reparações':['Eletrodomésticos','Caldeira / AVAC','Pequenas reparações','Chaves e fechaduras','Pragas'],
  'Água, luz e gás':['Água','Eletricidade','Gás','Internet e TV'],
  'Gestão e mediação':['Comissão de arrendamento','Gestão do imóvel','Anúncios','Vistorias'],
  'Serviços profissionais':['Contabilidade','Advogado','Notário e registos','Certificado energético','Avaliação'],
  'Mobiliário e equipamento':['Mobiliário','Eletrodomésticos','Decoração'],
  'Limpeza e jardim':['Limpeza','Jardinagem','Recolha de lixo'],
  'Custos bancários':['Comissões','Amortização antecipada','Avaliação do banco'],
  'Crédito à habitação':['Prestação mensal','Amortização antecipada'],
  'Dívidas a terceiros':['Reembolso de empréstimo','Juros'],
  'Outros':[]
};
/* receitas: rendas, reembolsos, empréstimos recebidos… */
const CATS_IN0={
  'Rendas':['Renda mensal','Renda em atraso','Caução'],
  'Reembolsos':['Seguro','Condomínio','Inquilino','Estado'],
  'Empréstimos recebidos':['Família','Amigos','Outro'],
  'Subsídios e apoios':[],
  'Outras receitas':[]
};
const TAGS0=['Urgente','A reembolsar','Recorrente','Dedutível','Em disputa'];
const blank={v:13,properties:[],owners:[],tenants:[],contracts:[],transactions:[],settlements:[],templates:[],recurring:[],groups:[],visits:[],
  settings:{growth:2,inflation:2,years:10,theme:'auto',capTarget:5,quota:100,payTax:true,stampPct:4,
            cats:JSON.parse(JSON.stringify(CATS0)),catsIn:JSON.parse(JSON.stringify(CATS_IN0)),tags:TAGS0.slice()}};

/* id único para qualquer registo novo; onde não há crypto.randomUUID, serve data + aleatório
   Devolve: uma string única (UUID, ou 'id' + data + aleatório como recurso). */
function uid(){try{return crypto.randomUUID()}catch(e){return 'id'+Date.now()+Math.random().toString(16).slice(2,8)}}
/* versões anteriores guardavam a imagem em base64 dentro dos dados (rebentava a quota do localStorage);
   agora fica só em IndexedDB. O que vier em "data" é migrado para lá e retirado dos dados. */
const INLINE_DATA=[];
const normFile=f=>{const o=Object.assign({id:uid(),name:'',type:'',size:0,added:''},f||{});
  if(o.data){INLINE_DATA.push({id:o.id,data:o.data});delete o.data}return o};
/* despacha para o IndexedDB os anexos que o normFile apanhou em base64 e grava os dados já sem eles;
   o que já existir lá não é reescrito, e uma falha num ficheiro não trava os outros
   Devolve: nada — esvazia INLINE_DATA, envia os anexos para o IndexedDB e grava a base no fim. */
function migrateInline(){
  if(!INLINE_DATA.length)return;
  const list=INLINE_DATA.splice(0);
  Promise.all(list.map(x=>idbGet(x.id).then(b=>{if(b)return;return fetch(x.data).then(r=>r.blob()).then(bl=>idbPut(x.id,bl))}).catch(()=>{})))
    .then(()=>{save()});
}
/* normaliza uma hipoteca: omissões preenchidas, campos extintos (active, taeg, mtic) fora, anexos pelo normFile
   Recebe: l — a hipoteca em bruto (objeto parcial de qualquer versão, ou nada).
   Devolve: um objeto novo com todos os campos da hipoteca preenchidos. */
function normLoan(l){const o=Object.assign({id:uid(),name:'',bank:'',outstanding:0,years:30,type:'fixa',
  rate:0,fixedYears:5,euribor:0,spread:0,index:'6m',start:'',stampTax:true,amortFeeFix:2,amortFeeVar:0.5,files:[]},l||{});
  delete o.active;delete o.taeg;delete o.mtic;
  if(o.stampTax===undefined)o.stampTax=true;
  o.files=(o.files||[]).map(normFile);return o}
/* normaliza uma visita a um imóvel: quem vem (texto livre — ainda não é
   inquilino, não há ficha), onde, quando (data + horas), estado, desfecho
   e comentários. O contacto é opcional, para confirmar ou remarcar.
   Recebe: v — a visita em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo com todos os campos da visita preenchidos. */
function normVisit(v){return Object.assign({id:uid(),propertyId:'',roomId:'',nomes:'',contacto:'',
  date:'',start:'',end:'',estado:'agendada',resultado:'',notas:''},v||{})}
/* normaliza uma ficha de pessoa (dono ou inquilino): campos em falta ficam vazios, anexos pelo normFile.
   houseId é o imóvel a que a ficha está presa (vazio numa ficha só minha): é
   com ele que a ficha de um inquilino criada por um colaborador sobe como
   registo desse imóvel, mesmo sem contrato — persiste e mantém o que vier.
   Recebe: p — a ficha em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo com todos os campos da ficha preenchidos. */
function normPerson(p){const o=Object.assign({id:uid(),name:'',phone:'',email:'',nif:'',gender:'',marital:'',
  nationality:'Portuguesa',birth:'',cc:'',ccValid:'',taxAddress:'',notes:'',files:[],houseId:''},p||{});
  o.files=(o.files||[]).map(normFile);return o}
/* normaliza um imóvel e migra o que mudou entre versões: equity passa a purchase, o crédito único
   vira lista de hipotecas, quartos em texto ganham id, e quotas de donos removidos são descartadas
   Recebe: p — o imóvel em bruto, de qualquer versão dos dados (ou nada).
   Devolve: um objeto novo com o imóvel completo e já migrado. */
function normProp(p){
  const o=Object.assign({id:uid(),name:'',address:'',use:'investimento',rentalMode:'inteiro',rooms:[],
    value:0,purchase:0,ownerIds:[],ownerShares:{},notes:'',listing:'',photos:[],loans:[],
    parish:'',concelho:'',freguesia:'',fraction:'',floor:'',street:'',doorNumber:'',postalCode:'',locality:'',registry:'',matrix:'',licence:'',energyCert:'',energyClass:'',energyValid:''},p||{});
  if(!o.purchase&&p&&p.equity)o.purchase=p.equity;   /* v12 chamava-lhe capital próprio */
  delete o.equity;
  /* v8 tinha um crédito único; passa a ser a primeira hipoteca da lista */
  if(!o.loans.length&&o.loan&&o.loan.active)o.loans=[Object.assign({},o.loan,{name:'Aquisição'})];
  if(!o.loans.length&&Array.isArray(p&&p.loans))o.loans=p.loans.slice();
  o.loans=(o.loans||[]).map(normLoan).map(l=>Object.assign(l,{name:l.name||l.bank||'Hipoteca'}));
  ['vpt','imiRate','status','monthlyRent','rentIncrease','tenant','loan','loanId'].forEach(k=>{delete o[k]});
  o.rooms=(o.rooms||[]).map(r=>typeof r==='string'?{id:uid(),name:r}:Object.assign({id:uid(),name:''},r));
  o.photos=(o.photos||[]).map(normFile);
  const sh={};Object.keys(o.ownerShares||{}).forEach(k=>{const v=Number(o.ownerShares[k]);if((o.ownerIds||[]).indexOf(k)>-1&&isFinite(v)&&v>=0)sh[k]=v});
  o.ownerShares=sh;
  return o;
}
/* normaliza um contrato: omissões preenchidas; itens do inventário e chaves ganham id próprio
   Recebe: c — o contrato em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo com todos os campos do contrato preenchidos. */
function normContract(c){
  const o=Object.assign({id:uid(),name:'',propertyId:null,roomId:null,tenantIds:[],rent:0,taxRate:0,iban:'',
    ownerEmail:'',ownerPhone:'',tenantEmail:'',tenantPhone:'',ownerContactId:'',tenantContactId:'',
    photoIds:[],keys:[],
    deposit:0,payDay:1,payDayTo:0,advance:0,autoRec:true,start:'',end:'',increase:null,active:true,notes:'',files:[],inventory:[]},c||{});
  o.files=(o.files||[]).map(normFile);
  o.inventory=(o.inventory||[]).map(i=>Object.assign({id:uid(),name:'',qty:1,state:'usado'},i));
  o.keys=(o.keys||[]).map(i=>Object.assign({id:uid(),name:'',qty:1},i));
  return o;
}
/* kind: income (renda), expense (despesa), loan (prestação), owed (dívida recebida de terceiro),
   repay (pagamento dessa dívida), settle (acerto entre proprietários: paidBy → toId).
   split: como o valor se divide entre os donos — {mode:'equal'|'quota'|'pct'|'percent'|'amount'|'adjust',parts:{ownerId:n}};
   em 'adjust', parts é o extra de cada um por cima da parte igual */
const normTx=t=>{const o=Object.assign({id:uid(),kind:'expense',label:'',amount:0,date:'',propertyId:null,contractId:null,
  loanId:null,payType:'prestacao',paidBy:null,toId:null,creditor:'',category:'',sub:'',tags:[],notes:'',split:null,groupId:null,psplit:null},t||{});
  if(o.split&&(!o.split.mode||o.split.mode==='quota'))o.split=null;
  if(o.split){o.split={mode:o.split.mode,parts:Object.assign({},o.split.parts||{})}}
  if(o.propertyId)o.groupId=null;
  if(!o.groupId)o.psplit=null;
  if(o.psplit&&!o.psplit.mode)o.psplit=null;
  if(o.psplit){o.psplit={mode:o.psplit.mode,parts:Object.assign({},o.psplit.parts||{})}}
  return o};
/* as liquidações antigas (lista própria) passam a movimentos do tipo "acerto"
   Recebe: d — a base de dados (usa d.settlements e d.transactions).
   Devolve: nada — acrescenta os acertos a d.transactions e esvazia d.settlements. */
function migrateSettlements(d){
  (d.settlements||[]).forEach(x=>{
    if(d.transactions.some(t=>t.id===x.id))return;
    d.transactions.push(normTx({id:x.id||uid(),kind:'settle',label:'Transferência entre proprietários',amount:Number(x.amount)||0,date:x.date||'',
      propertyId:x.propertyId||null,paidBy:x.fromId||null,toId:x.toId||null}));
  });
  d.settlements=[];
}
/* categorias novas que uma base antiga ainda não tem
   Recebe: st — o objeto settings da base.
   Devolve: nada — completa st.cats, st.catsIn e st.exclude no próprio objeto. */
function fillCats(st){
  st.exclude=st.exclude||{};
  if(!st.cats||!Object.keys(st.cats).length)st.cats=JSON.parse(JSON.stringify(CATS0));
  else['Crédito à habitação','Dívidas a terceiros'].forEach(k=>{if(!(k in st.cats))st.cats[k]=CATS0[k].slice()});
  if(!st.catsIn||!Object.keys(st.catsIn).length)st.catsIn=JSON.parse(JSON.stringify(CATS_IN0));
}
const normSettle=x=>Object.assign({id:uid(),date:'',propertyId:null,fromId:null,toId:null,amount:0},x||{});
/* modelo: um movimento guardado para repetir à mão; recorrência: repete-se sozinho e pede confirmação */
const TX_TPL_KEYS=['kind','label','amount','propertyId','groupId','psplit','contractId','loanId','paidBy','toId','creditor','category','sub','tags','notes','split','interest','stamp','principal','fee','payType'];
/* cópia profunda de um movimento só com os campos que fazem sentido repetir (TX_TPL_KEYS):
   é o que os modelos e as recorrências guardam — data e id ficam de fora de propósito
   Recebe: t — o movimento a copiar.
   Devolve: um objeto novo só com os campos de TX_TPL_KEYS presentes em t (cópia profunda). */
function txSnapshot(t){const o={};TX_TPL_KEYS.forEach(k=>{if(t[k]!==undefined)o[k]=JSON.parse(JSON.stringify(t[k]))});return o}
const normTpl=x=>{const o=Object.assign({id:uid(),name:''},x||{});o.tx=txSnapshot(normTx(o.tx||{}));return o};
const normRec=x=>{const o=Object.assign({id:uid(),name:'',every:'month',next:'',until:'',end:'',muted:false,auto:false},x||{});o.tx=txSnapshot(normTx(o.tx||{}));if(o.until&&o.until<o.next)o.until=o.next;return o};
/* grupo: conjunto de imóveis, proprietários ou contratos com um nome */
const normGroup=g=>{const o=Object.assign({id:uid(),name:'',kind:'prop',ids:[]},g||{});o.ids=(o.ids||[]).slice();return o};

const CATMAP={'IMI':['Impostos','IMI'],'Seguro':['Seguros','Multirriscos'],'Água/Luz/Gás':['Água, luz e gás',''],
  'Obras':['Obras e benfeitorias',''],'Manutenção':['Manutenção e reparações',''],'Comissões':['Gestão e mediação','']};

let db=load();
/* lê os dados guardados (ou a versão antiga mais recente que houver), normaliza tudo e faz as
   migrações maiores: inquilinos com renda passam a contratos, categorias renomeadas são remapeadas
   e as liquidações antigas viram movimentos de acerto; devolve sempre uma base utilizável
   Devolve: a base de dados completa e normalizada (o objeto que passa a viver em db). */
function load(){
  let d=null;
  try{d=JSON.parse(rawGet(KEY)||'null')}catch(e){}
  if(!d)for(const k of OLDS){let o=null;try{o=JSON.parse(rawGet(k)||'null')}catch(e){}if(o){d=o;break}}
  d=d||{};
  const out=Object.assign({},blank,d,{settings:Object.assign({},blank.settings,d.settings||{})});
  fillCats(out.settings);
  if(!Array.isArray(out.settings.tags))out.settings.tags=TAGS0.slice();
  const newContracts=[];

  out.properties=(out.properties||[]).map(p=>{
    const np=normProp(p);
    if(p.use==null)np.use=(p.status==='proprio')?'proprio':'investimento';
    /* versões antigas guardavam a renda no imóvel ou nos inquilinos */
    const olds=(d.tenants||[]).filter(t=>t.propertyId===np.id);
    if(olds.length&&!(d.contracts||[]).length){
      if(olds.length>1){
        np.rentalMode='quartos';
        olds.forEach((t,i)=>{
          const room={id:uid(),name:(t.notes&&/quarto/i.test(t.notes))?t.notes:'Quarto '+(i+1)};
          np.rooms.push(room);
          newContracts.push(normContract({propertyId:np.id,roomId:room.id,tenantIds:[t.id],rent:t.rent||0,
            deposit:t.deposit||0,start:t.start||'',end:t.end||'',increase:p.rentIncrease==null?null:p.rentIncrease,active:t.active!==false}));
        });
      }else{
        const t=olds[0];
        newContracts.push(normContract({propertyId:np.id,tenantIds:[t.id],rent:t.rent||p.monthlyRent||0,
          deposit:t.deposit||0,start:t.start||'',end:t.end||'',increase:p.rentIncrease==null?null:p.rentIncrease,active:t.active!==false}));
      }
    }else if(!olds.length&&!(d.contracts||[]).length&&Number(p.monthlyRent)>0&&p.status==='arrendado'){
      newContracts.push(normContract({propertyId:np.id,rent:Number(p.monthlyRent),increase:p.rentIncrease==null?null:p.rentIncrease}));
    }
    return np;
  });

  out.owners=(out.owners||[]).map(normPerson);
  out.groups=(out.groups||[]).map(normGroup);
  out.settlements=(out.settlements||[]).map(normSettle);
  out.templates=(out.templates||[]).map(normTpl);
  out.recurring=(out.recurring||[]).map(normRec);
  out.visits=(out.visits||[]).map(normVisit);
  out.tenants=(out.tenants||[]).map(normPerson);
  out.contracts=((out.contracts||[]).map(normContract)).concat(newContracts);
  out.transactions=(out.transactions||[]).map(t=>{
    const n=normTx(Object.assign({},t,{kind:t.kind==='debt'?'loan':t.kind}));
    if(n.category&&CATMAP[n.category]){n.sub=n.sub||CATMAP[n.category][1];n.category=CATMAP[n.category][0]}
    if(!n.contractId&&t.tenantId){
      const c=out.contracts.find(x=>x.propertyId===n.propertyId&&(x.tenantIds||[]).indexOf(t.tenantId)>-1);
      if(c)n.contractId=c.id;
    }
    return n;
  });
  migrateSettlements(out);
  return out;
}
/* grava a base inteira no aparelho e reagenda os lembretes no telemóvel
   Devolve: nada — grava db no localStorage e chama scheduleReminders. */
function save(){rawSet(KEY,JSON.stringify(db));scheduleReminders()}
/* lembretes no telemovel: quando um recorrente entra para confirmar e quando passa a atraso */
let _remT=null;
/* reagenda as notificações locais via ponte Android (fora da app instalada não faz nada): espera
   400ms para juntar gravações seguidas numa só chamada e envia até 60 lembretes futuros, por data
   Devolve: nada — entrega a lista de lembretes à ponte Android (fora dela, não faz nada). */
function scheduleReminders(){
  if(!(window.Android&&Android.scheduleReminders))return;
  clearTimeout(_remT);
  _remT=setTimeout(()=>{try{
    const at=(iso,h)=>{const d=new Date(iso+'T00:00:00');d.setHours(h,0,0,0);return d.getTime()};
    const list=[];
    (db.recurring||[]).forEach(r=>{
      if(!r.next||r.muted)return;
      const v=r.tx&&r.tx.amount?' ('+euro2(r.tx.amount)+')':'';
      list.push({id:'c_'+r.id+'_'+r.next,at:at(r.next,9),title:'Por confirmar: '+r.name,
        text:'“'+r.name+'”'+v+' entrou hoje para os movimentos por confirmar.'});
      const lim=addDays(r.until&&r.until>r.next?r.until:r.next,1);
      list.push({id:'l_'+r.id+'_'+lim,at:at(lim,9),title:'Em atraso: '+r.name,
        text:'“'+r.name+'”'+v+' passou o prazo sem confirmação.'});
    });
    if(typeof prazosLembretes==='function')list.push(...prazosLembretes());
    Android.scheduleReminders(JSON.stringify(list.filter(x=>x.at>Date.now()).sort((a,b)=>a.at-b.at).slice(0,60)));
  }catch(e){}},400);
}
