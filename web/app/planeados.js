/* ================= MODELOS E RECORRÊNCIAS ================= */
const EVERY={once:'uma só vez',week:'semanal',month:'mensal',quarter:'trimestral',year:'anual'};
/* Data da ocorrência seguinte: soma o período (semana, mês, trimestre ou ano)
   à data dada, prendendo o dia ao último do mês quando ele não existe
   (31 de janeiro + 1 mês dá 28/29 de fevereiro). Devolve AAAA-MM-DD;
   data inválida devolve hoje.
   Recebe: iso — data de partida em AAAA-MM-DD (vazia usa hoje); every — o período:
   'week', 'month', 'quarter' ou 'year' (qualquer outro conta como mês).
   Devolve: a data seguinte em AAAA-MM-DD (texto); se a data for inválida, a de hoje. */
function nextDate(iso,every){
  const d=new Date((iso||today())+'T00:00:00');if(isNaN(d))return today();
  if(every==='week'){d.setDate(d.getDate()+7)}
  else{const day=d.getDate(),m=every==='year'?12:every==='quarter'?3:1;d.setDate(1);d.setMonth(d.getMonth()+m);
    const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last))}
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
// Soma n dias a uma data AAAA-MM-DD e devolve no mesmo formato.
// Recebe: iso — data AAAA-MM-DD; n — quantos dias somar (número; negativo recua).
// Devolve: a data resultante em AAAA-MM-DD (texto).
const addDays=(iso,n)=>{const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
/* a renda de cada contrato ativo vive como movimento recorrente, criado e mantido pela app
   Recebe: c — o contrato (objeto de db.contracts).
   Devolve: a recorrência automática dessa renda em db.recurring, ou undefined se não existir. */
function ctRecOf(c){return (db.recurring||[]).find(r=>r.auto&&r.tx&&r.tx.contractId===c.id)}
// Data AAAA-MM-DD para o dia d do mês m (0-11) de y, preso ao último dia desse mês.
// Recebe: y — ano (número); m — mês 0-11 (número); d — dia pretendido (número).
// Devolve: a data em AAAA-MM-DD (texto), com o dia preso ao último do mês.
function dayInMonth(y,m,d){const last=new Date(y,m+1,0).getDate();return `${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`}
/* Mantém a recorrência automática da renda de um contrato: cria-a, atualiza-a
   ou remove-a conforme o contrato esteja ativo, com renda e com o automático
   ligado (autoRec). A janela payDay..payDayTo dá as datas; rendas antecipadas
   adiam a primeira ocorrência. Mexe em db.recurring — quem chama grava.
   Recebe: c — o contrato a sincronizar (objeto de db.contracts).
   Devolve: nada — mexe em db.recurring; quem chama grava. */
function syncContractRec(c){
  const r=ctRecOf(c),want=isActive(c)&&c.rent>0&&c.autoRec!==false;
  if(!want){if(r)db.recurring=db.recurring.filter(x=>x.id!==r.id);return}
  const from=Math.max(1,Math.min(31,c.payDay||1)),to=Math.max(from,Math.min(31,c.payDayTo||from));
  const inc=catsIn(),cat='Rendas' in inc?'Rendas':'',sub=cat&&(inc[cat]||[]).indexOf('Renda mensal')>-1?'Renda mensal':'';
  const tx={kind:'income',label:'Renda '+ctName(c),amount:c.rent,propertyId:c.propertyId,contractId:c.id,category:cat,sub,split:null};
  /* rendas antecipadas: a primeira ocorrência só aparece depois desses meses */
  let minNext='';
  if(c.start&&c.advance>0){const d=new Date(c.start+'T00:00:00');let y2=d.getFullYear(),m2=d.getMonth()+c.advance;y2+=Math.floor(m2/12);m2%=12;minNext=dayInMonth(y2,m2,from)}
  if(r){Object.assign(r.tx,tx);r.name='Renda '+ctName(c);r.end=c.end||'';
    /* se os dias da janela mudarem no contrato, a janela acompanha (mantendo o mês em curso) */
    if(r.next){const d=new Date(r.next+'T00:00:00');r.next=dayInMonth(d.getFullYear(),d.getMonth(),from);r.until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
    if(minNext&&r.next<minNext){const d=new Date(minNext+'T00:00:00');r.next=minNext;r.until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
    return}
  /* primeira janela: este mês se ainda não passou; senão o mês que vem; nunca antes do início do contrato */
  const t=new Date(today()+'T00:00:00');let y=t.getFullYear(),m=t.getMonth();
  if(today()>dayInMonth(y,m,to)){m++;if(m>11){m=0;y++}}
  let next=dayInMonth(y,m,from),until=to>from?dayInMonth(y,m,to):'';
  if(c.start&&next<c.start){const d=new Date(c.start+'T00:00:00');let y2=d.getFullYear(),m2=d.getMonth();
    if(c.start>dayInMonth(y2,m2,to)){m2++;if(m2>11){m2=0;y2++}}
    next=dayInMonth(y2,m2,from);until=to>from?dayInMonth(y2,m2,to):'';}
  if(minNext&&next<minNext){const d=new Date(minNext+'T00:00:00');next=minNext;until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
  db.recurring=db.recurring||[];
  db.recurring.push(normRec({auto:true,name:'Renda '+ctName(c),every:'month',next,until,end:c.end||'',tx}));
}
// Varre as recorrências automáticas de contratos: apaga as órfãs (o contrato
// já não existe) e sincroniza cada contrato com syncContractRec.
// Devolve: nada — mexe em db.recurring; quem chama grava.
function syncAllContractRecs(){
  (db.recurring||[]).slice().forEach(r=>{if(r.auto&&!(r.tx||{}).loanId&&(!r.tx.contractId||!db.contracts.some(c=>c.id===r.tx.contractId)))db.recurring=db.recurring.filter(x=>x.id!==r.id)});
  db.contracts.forEach(syncContractRec);
}
/* ---- prestações das hipotecas: recorrência automática, tal como as rendas dos contratos ----
   Recebe: l — a hipoteca (objeto de p.loans de um imóvel).
   Devolve: a recorrência automática dessa prestação em db.recurring, ou undefined se não existir. */
function loanRecOf(l){return (db.recurring||[]).find(r=>r.auto&&r.tx&&r.tx.loanId===l.id)}
/* Mantém a recorrência automática da prestação da hipoteca l do imóvel p:
   cria, atualiza ou remove conforme haja dívida por pagar e o automático
   esteja ligado. O dia de cobrança sai do dia do início do empréstimo
   (limitado a 28) e o valor vem de loanCalc. Mexe em db.recurring — quem
   chama grava.
   Recebe: p — o imóvel dono da hipoteca (objeto de db.properties); l — a hipoteca (objeto de p.loans).
   Devolve: nada — mexe em db.recurring; quem chama grava. */
function syncLoanRec(p,l){
  const r=loanRecOf(l);
  /* se o utilizador já tem uma recorrência manual para esta hipoteca, não se duplica */
  const manual=(db.recurring||[]).some(x=>!x.auto&&x.tx&&x.tx.loanId===l.id);
  const want=l.outstanding>0&&l.autoRec!==false&&!manual;
  if(!want){if(r)db.recurring=db.recurring.filter(x=>x.id!==r.id);return}
  const day=(()=>{const d=l.start?Number(l.start.slice(8,10)):0;return Math.max(1,Math.min(28,d||1))})();
  const tx=loanRecTx(p,l),name=tx.label;
  if(r){Object.assign(r.tx,tx);r.name=name;
    if(r.next){const d=new Date(r.next+'T00:00:00');r.next=dayInMonth(d.getFullYear(),d.getMonth(),day)}
    return}
  const t=new Date(today()+'T00:00:00');let y=t.getFullYear(),m=t.getMonth();
  if(today()>dayInMonth(y,m,day)){m++;if(m>11){m=0;y++}}
  db.recurring=db.recurring||[];
  db.recurring.push(normRec({auto:true,name,every:'month',next:dayInMonth(y,m,day),tx}));
}
// Apaga as recorrências automáticas de hipotecas que já não existem e
// sincroniza as das hipotecas vivas, imóvel a imóvel.
// Devolve: nada — mexe em db.recurring; quem chama grava.
function syncAllLoanRecs(){
  const live=id=>db.properties.some(p=>(p.loans||[]).some(l=>l.id===id));
  (db.recurring||[]).slice().forEach(r=>{if(r.auto&&(r.tx||{}).loanId&&!live(r.tx.loanId))db.recurring=db.recurring.filter(x=>x.id!==r.id)});
  db.properties.forEach(p=>(p.loans||[]).forEach(l=>syncLoanRec(p,l)));
}
/* O movimento-modelo da prestação da hipoteca l do imóvel p — o que a
   recorrência automática guarda em r.tx e o que as prestações inseridas em
   bloco copiam: descrição, prestação atual, imóvel, hipoteca e categoria.
   Recebe: p — o imóvel (objeto de db.properties); l — a hipoteca (objeto de p.loans).
   Devolve: o objeto do movimento (sem id nem data), pronto para normTx. */
function loanRecTx(p,l){
  const name='Prestação '+(l.name?l.name+' · ':'')+p.name;
  const out=cats(),cat='Crédito à habitação' in out?'Crédito à habitação':'',sub=cat&&(out[cat]||[]).indexOf('Prestação mensal')>-1?'Prestação mensal':'';
  return {kind:'loan',payType:'prestacao',label:name,amount:Math.round(loanCalc(l).total*100)/100,propertyId:p.id,loanId:l.id,category:cat,sub,split:null};
}
/* ---- prestações anteriores à app: quando o início de uma hipoteca recua ---- */
/* Retrato dos inícios das hipotecas de um imóvel, {idDaHipoteca: início},
   tirado ANTES de gravar — depois de db.properties[i]=pForm o prop(id) já é
   o próprio pForm e não há com que comparar.
   Recebe: p — o imóvel tal como está na db (objeto; aguenta null/undefined).
   Devolve: objeto {loanId: 'AAAA-MM-DD' ou ''}; vazio sem imóvel. */
function loanStartsAntes(p){const o={};loansOf(p).forEach(l=>{o[l.id]=l.start||''});return o}
// "set 2026" a partir de uma data AAAA-MM-DD, para as perguntas.
// Recebe: iso — data AAAA-MM-DD (texto).
// Devolve: o mês abreviado e o ano (texto), ex.: "set 2026".
const mesPt=iso=>(MES[Number(String(iso).slice(5,7))-1]||'')+' '+String(iso).slice(0,4);
/* Depois de gravar o imóvel: para cada hipoteca com dívida cujo início recuou
   (ou que é nova e começou no passado, ou cujo início acabou de ser
   preenchido) e à qual faltam prestações entre o início e a primeira
   registada, pergunta se se inserem — uma hipoteca de cada vez. Correr depois
   de syncAllLoanRecs, para a janela parar onde a recorrência começa (r.next).
   Recebe: p — o imóvel acabado de gravar (objeto de db.properties); antes — o
   retrato de loanStartsAntes tirado antes da gravação ({} num imóvel novo).
   Devolve: nada — abre a(s) pergunta(s); ao confirmar, insere e grava. */
function perguntarPrestacoesEmFalta(p,antes){
  const hoje=today();antes=antes||{};
  const fila=loansOf(p).filter(l=>{
    if(!(Number(l.outstanding)>0)||!l.start||l.start>hoje)return false;
    if(!(l.id in antes))return true;            /* hipoteca nova com início no passado */
    return !antes[l.id]||l.start<antes[l.id];   /* início preenchido agora, ou recuou */
  }).map(l=>{const r=loanRecOf(l);return {l,lista:loanPrestacoesEmFalta(l,db.transactions,hoje,r?r.next:'')}}).filter(x=>x.lista.length);
  const seguinte=()=>{const x=fila.shift();if(!x)return;
    const {l,lista}=x,n=lista.length,de=lista[0].date,a=lista[n-1].date,fim=lista[n-1].bal;
    confirmModal('Prestações em falta',`“${esc(loanName(l))}” começou a ${esc(mesPt(de))} e não tem ${n===1?'a prestação de '+esc(mesPt(de))+' registada':n+' prestações registadas, de '+esc(mesPt(de))+' a '+esc(mesPt(a))} (${euro2(sum(lista.map(x2=>x2.amount)))} no total). Inserir agora? Ficam com os juros, o selo e o capital do plano, e o capital em dívida desce de <b>${euro2(l.outstanding)}</b> para <b>${euro2(fim)}</b>${fim>0?'':' — o crédito fica liquidado'}.`,
      ()=>{inserirPrestacoesEmFalta(p,l,lista);seguinte()});
  };
  seguinte();
}
/* Regista as prestações calculadas como movimentos normais, com a cara da
   recorrência automática e a etiqueta "Estimativa", e abate-lhes o capital:
   o capital em dívida passa a ser o saldo depois da última, como se fossem
   confirmadas uma a uma. Ressincroniza a recorrência (o prazo restante
   encurtou: a prestação muda; com o crédito liquidado, desaparece), grava,
   redesenha e dá Anular em bloco — que tira os movimentos e repõe o capital.
   Recebe: p — o imóvel (objeto de db.properties); l — a hipoteca (objeto de
   p.loans); lista — as prestações de loanPrestacoesEmFalta.
   Devolve: nada — mexe em db.transactions, na hipoteca e em db.recurring, grava e redesenha. */
function inserirPrestacoesEmFalta(p,l,lista){
  if(!lista||!lista.length)return;
  const base=loanRecTx(p,l),os=ownersOfProp(p),paidBy=os.length===1?os[0]:null;
  const tags=db.settings.tags||(db.settings.tags=[]);if(tags.indexOf('Estimativa')<0)tags.push('Estimativa');
  const novos=lista.map(x=>normTx(Object.assign({},base,{date:x.date,amount:x.amount,interest:x.interest,stamp:x.stamp,principal:x.principal,fee:0,paidBy,tags:['Estimativa']})));
  const antes=l.outstanding;
  db.transactions=db.transactions.concat(novos);
  l.outstanding=r2(lista[lista.length-1].bal);
  syncLoanRec(p,l);save();buildNav();render();
  const ids=novos.map(t=>t.id);
  comDesfazer(novos.length===1?'Prestação inserida.':novos.length+' prestações inseridas.',()=>{
    db.transactions=db.transactions.filter(t=>ids.indexOf(t.id)<0);
    /* volta a procurar a hipoteca: um sync entretanto pode ter trocado os objetos da db (como o delTx faz) */
    const x=anyLoan(l.id);if(x){x.l.outstanding=antes;syncLoanRec(x.p,x.l)}
  });
}
/* ---- períodos em falta de um plano: a origem, o que já está, as datas ---- */
/* De onde vem a história de um plano: o início do contrato ou da hipoteca.
   A recorrência criada por eles arranca no mês corrente, por isso os meses
   anteriores não aparecem em lado nenhum sem isto.
   Recebe: r — o plano recorrente ({tx, next, …}) cuja origem se procura.
   Devolve: uma data AAAA-MM-DD — o início do contrato ou da hipoteca; sem eles, r.next. */
function origemDoPlano(r){
  const c=r.tx.contractId?contract(r.tx.contractId):null;
  if(c&&c.start)return c.start;
  if(r.tx.loanId){const x=anyLoan(r.tx.loanId);if(x&&x.l.start)return x.l.start}
  return r.next;
}
/* Já existe um movimento deste contrato/hipoteca nesse mês?
   Recebe: r — o plano recorrente; d — a data AAAA-MM-DD cujo mês se verifica.
   Devolve: true/false — se nesse mês já há movimento do mesmo contrato/hipoteca
   (ou, sem eles, do mesmo imóvel com a mesma descrição). */
function jaRegistado(r,d){
  const mo=String(d).slice(0,7);
  return (db.transactions||[]).some(t=>{
    if(String(t.date||'').indexOf(mo)!==0)return false;
    if(r.tx.contractId)return t.contractId===r.tx.contractId;
    if(r.tx.loanId)return t.loanId===r.tx.loanId;
    return t.propertyId===r.tx.propertyId&&t.label===r.tx.label;
  });
}
/* As prestações que faltam ao plano de uma hipoteca: a lista simulada
   (loanPrestacoesEmFalta) do início da hipoteca até à primeira registada,
   parando onde a recorrência começa (r.next). Cada uma abate o seu capital.
   Recebe: r — o plano recorrente com tx.loanId.
   Devolve: a lista de loanPrestacoesEmFalta; [] sem hipoteca ou sem nada a inserir. */
function planoPrestacoesEmFalta(r){
  const x=r&&r.tx&&r.tx.loanId?anyLoan(r.tx.loanId):null;
  if(!x||r.tx.kind!=='loan'||r.tx.payType==='amortizacao')return [];
  return loanPrestacoesEmFalta(x.l,db.transactions,today(),r.next||'');
}
/* As datas do plano que já passaram sem movimento registado, da origem
   (início do contrato ou da hipoteca) até hoje, respeitando o fim do plano.
   Numa hipoteca são as datas da lista simulada (planoPrestacoesEmFalta);
   nas outras, período a período a partir da origem, saltando os meses em que
   já há movimento. O guarda de 600 períodos evita ciclos com datas estragadas.
   Recebe: r — o plano recorrente a analisar.
   Devolve: array de datas AAAA-MM-DD por ordem cronológica; vazio sem plano ou sem próxima data. */
function datasEmFalta(r){
  if(!r||!r.next)return [];
  if((r.tx||{}).loanId)return planoPrestacoesEmFalta(r).map(x=>x.date);
  const t=today(),day=Number(String(r.next).slice(8,10))||1;
  const origin=String(origemDoPlano(r));let d;
  if(['month','quarter','year'].indexOf(r.every)>-1){
    d=dayInMonth(Number(origin.slice(0,4)),Number(origin.slice(5,7))-1,day);
    if(d<origin)d=nextDate(d,r.every);
  }else d=origin;
  const out=[];let guard=0;
  while(d&&d<=t&&guard++<600){
    if(!jaRegistado(r,d))out.push(d);
    if(r.every==='once')break;
    d=nextDate(d,r.every);
    if(r.end&&d>r.end)break;
  }
  return out;
}
/* recorrências vencidas (a data prevista já passou ou é hoje)
   Devolve: a lista dessas recorrências (array de objetos de db.recurring). */
function recPending(){const t=today();return (db.recurring||[]).filter(r=>r.next&&r.next<=t)}
/* silenciada: continua por confirmar em Planeados, mas não avisa nem conta no menu
   Devolve: as vencidas que não estão silenciadas (array de objetos de db.recurring). */
function recActive(){return recPending().filter(r=>!r.muted)}
/* em atraso: passou o último dia da janela sem confirmação */
const recIsLate=r=>!!(r.next&&r.next<=today()&&(r.until||r.next)<today());
// as vencidas que ainda avisam e cuja janela já fechou — alimenta os alertas de atraso
// Devolve: essas recorrências em atraso (array de objetos de db.recurring).
function recLate(){return recActive().filter(recIsLate)}
/* Avança a recorrência para a ocorrência seguinte (depois de confirmada):
   "uma só vez" apaga-se; as outras saltam para a próxima data mantendo a
   largura da janela next..until. Passado o fim (end), remove-se e avisa.
   Tira também o silêncio — confirmar volta a ligar os avisos.
   Recebe: r — a recorrência a avançar (objeto de db.recurring).
   Devolve: nada — altera r (ou tira-a de db.recurring); quem chama grava. */
function recAdvance(r){
  r.muted=false;
  if(r.every==='once'){db.recurring=db.recurring.filter(x=>x.id!==r.id);return}
  const gap=r.until&&r.until>r.next?Math.round((new Date(r.until+'T00:00:00')-new Date(r.next+'T00:00:00'))/864e5):0;
  r.next=nextDate(r.next,r.every);r.until=gap?addDays(r.next,gap):'';
  if(r.end&&r.next>r.end){db.recurring=db.recurring.filter(x=>x.id!==r.id);toast('“'+r.name+'” chegou ao fim: deixa de se repetir.')}
}
// Movimento normalizado a partir do tx da recorrência, datado de 'date' (ou da
// data prevista). Só constrói: não regista nem toca na recorrência.
// Recebe: r — a recorrência de origem (objeto de db.recurring); date (opcional) — data
// AAAA-MM-DD do movimento; sem ela usa r.next.
// Devolve: o movimento normalizado (objeto pronto para db.transactions).
function recTx(r,date){return normTx(Object.assign({},JSON.parse(JSON.stringify(r.tx)),{date:date||r.next,label:r.tx.label||r.name}))}
/* confirmar sem abrir: cria o movimento na data prevista e passa à seguinte
   Recebe: id — o id da recorrência a confirmar.
   Devolve: nada — regista o movimento, grava e redesenha. */
function quickConfirmRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const recusa=recusaConfirmar(r);if(recusa)return toast(recusa);
  const t=recTx(r);if(t.kind==='loan')applyLoan(t);
  db.transactions.push(t);recAdvance(r);save();buildNav();render();toast('Movimento confirmado.');
}
// Silencia ou reativa a recorrência: silenciada fica em Planeados à espera de
// confirmação, mas sem avisos nem contagem no menu. Grava e redesenha.
// Recebe: id — o id da recorrência a silenciar ou reativar.
// Devolve: nada — grava e redesenha.
function skipRec(id){const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const recusa=motivoRecusa((r.tx||{}).propertyId,'rec.add',r);if(recusa)return toast(recusa);
  r.muted=!r.muted;save();buildNav();render();toast(r.muted?'Silenciada: fica em Planeados à espera de confirmação, sem avisos.':'Volta a avisar.')}
/* Confirmar um planeado cria um movimento: num imóvel onde só colaboro pede
   «Adicionar e confirmar planeados» e também «Adicionar movimentos» — sem a
   segunda, o servidor recusava o movimento que a confirmação cria.
   Recebe: r — a recorrência.
   Devolve: a frase da recusa (texto), ou '' quando posso confirmar. */
function recusaConfirmar(r){
  const hid=(r&&r.tx||{}).propertyId;
  if(!pode(hid,'rec.add'))return fraseSemPerm('rec.add');
  if(!pode(hid,'tx.add'))return fraseSemPerm('tx.add');
  return '';
}
/* abrir para rever antes de confirmar
   Recebe: id — o id da recorrência a confirmar.
   Devolve: nada — abre o formulário do movimento em modo de confirmação. */
function confirmRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const recusa=recusaConfirmar(r);if(recusa)return toast(recusa);
  txModal(null,r.tx.kind,r.tx.propertyId,null,r.tx.contractId,Object.assign({},JSON.parse(JSON.stringify(r.tx)),{date:r.next,label:r.tx.label||r.name}));
  tForm._recConfirm=id;const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Confirmar movimento';
}
// Abre o formulário de movimento carregado com a recorrência, em modo de
// edição: guardar altera a recorrência em vez de criar um movimento.
// Recebe: id — o id da recorrência a editar.
// Devolve: nada — abre o formulário carregado com a recorrência.
function editRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const recusa=motivoRecusa((r.tx||{}).propertyId,'rec.add',r);if(recusa)return toast(recusa);
  txModal(null,r.tx.kind,r.tx.propertyId,null,r.tx.contractId,Object.assign({},JSON.parse(JSON.stringify(r.tx)),{date:r.next,label:r.tx.label||r.name}));
  tForm._recId=id;tForm._every=r.every;tForm._recEnd=r.end||'';tForm._until=r.until||'';
  const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Editar movimento recorrente';
  foldState.rec=true;repaintTx();
}
// Novo movimento recorrente: pergunta o tipo e abre o formulário já em modo
// recorrente (mensal por omissão), com a secção de repetição aberta.
// Devolve: nada — abre o formulário de movimento novo em modo recorrente.
function newRec(){
  newTxPick(k=>{txModal(null,k,null);tForm._recNew=true;tForm._every='month';
    const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Novo movimento recorrente';foldState.rec=true;repaintTx()});
}
// Novo modelo: pergunta o tipo e abre o formulário; guardar cria um modelo
// em vez de registar um movimento.
// Devolve: nada — abre o formulário de movimento novo em modo modelo.
function newTpl(){
  newTxPick(k=>{txModal(null,k,null);tForm._tplNew=true;
    const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Novo modelo';repaintTx()});
}
// Abre o formulário carregado com o modelo para o editar (guardar altera o modelo).
// Recebe: id — o id do modelo em db.templates.
// Devolve: nada — abre o formulário carregado com o modelo.
function editTpl(id){
  const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;
  txModal(null,x.tx.kind,x.tx.propertyId,null,x.tx.contractId,JSON.parse(JSON.stringify(x.tx)));
  tForm._tplId=id;tForm._tplName=x.name;
  const h=modalTop().el.querySelector('.head h2');if(h)h.textContent='Editar modelo';repaintTx();
}
/* Apaga a recorrência, com confirmação. Nas automáticas desliga também o
   autoRec no contrato ou na hipoteca de origem — sem isso, a sincronização
   voltava a criá-la logo a seguir. Os movimentos já registados ficam.
   Recebe: id — o id da recorrência a apagar.
   Devolve: nada — pede confirmação; ao confirmar, apaga, grava e redesenha. */
function delRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const recusa=motivoRecusa((r.tx||{}).propertyId,'rec.add',r);if(recusa)return toast(recusa);
  const isLoan=r.auto&&(r.tx||{}).loanId;
  confirmModal('Apagar movimento recorrente',r.auto?(isLoan?`Esta é a prestação de uma hipoteca. Apagar deixa de a pedir todos os meses (podes voltar a ligá-la na hipoteca).`:`Este é a renda de um contrato. Apagar deixa de a pedir todos os meses (podes voltar a ligá-la guardando o contrato de novo).`):`Deixar de repetir “${esc(r.name)}”? Os movimentos já criados ficam.`,()=>{
    if(r.auto){const c=contract((r.tx||{}).contractId);if(c)c.autoRec=false;
      if(isLoan)db.properties.forEach(p=>(p.loans||[]).forEach(l=>{if(l.id===r.tx.loanId)l.autoRec=false}))}
    db.recurring=db.recurring.filter(x=>x.id!==id);save();closeAllModals();buildNav();render();toast('Movimento recorrente apagado.');
  });
}
// Apaga o modelo, com confirmação; os movimentos criados a partir dele ficam.
// Recebe: id — o id do modelo a apagar.
// Devolve: nada — pede confirmação; ao confirmar, apaga, grava e redesenha.
function delTpl(id){
  const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;
  confirmModal('Apagar modelo',`Apagar o modelo “${esc(x.name)}”?`,()=>{db.templates=db.templates.filter(y=>y.id!==id);save();closeAllModals();render();toast('Modelo apagado.')});
}
/* Despeja o tx do modelo no formulário aberto, preservando o que é da sessão
   de edição (id, data e as marcas _rec/_tpl) para não trocar o modo do
   formulário. Redesenha o modal.
   Recebe: x — o modelo a aplicar (objeto com tx, p. ex. de db.templates).
   Devolve: nada — substitui tForm e redesenha o modal. */
function applyTemplate(x){
  if(!x)return;
  const keep={id:tForm.id,date:tForm.date,_edit:tForm._edit,_saver:tForm._saver,_recId:tForm._recId,_recNew:tForm._recNew,_every:tForm._every,_recEnd:tForm._recEnd,_until:tForm._until,_tplId:tForm._tplId,_tplNew:tForm._tplNew,_tplName:tForm._tplName};
  tForm=normTx(Object.assign({},JSON.parse(JSON.stringify(x.tx))));Object.assign(tForm,keep);
  if(tForm.amount)tForm._aA=tForm.amount;
  repaintTx();toast('Modelo aplicado.');
}
// Fecha o que estiver aberto e abre um movimento novo pré-preenchido com o modelo.
// Recebe: id — o id do modelo em db.templates.
// Devolve: nada — abre o formulário de movimento novo pré-preenchido.
function newFromTemplate(id){const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;closeAllModals();txModal(null,x.tx.kind,x.tx.propertyId,null,x.tx.contractId,JSON.parse(JSON.stringify(x.tx)))}
/* cartão dos movimentos em atraso / por confirmar */
let pendAll=false;
/* HTML do cartão "Movimentos por confirmar". Com all mostra também as
   silenciadas (é assim que a página Planeados o usa); sem all, só as que
   avisam (vista geral). Devolve '' quando não há nada; o aberto/fechado
   vem de pendShut().
   Recebe: all (opcional) — verdadeiro inclui também as silenciadas; falso ou omisso
   mostra só as que avisam.
   Devolve: o HTML do cartão (texto), ou '' quando não há nada por confirmar. */
function pendingCard(all){
  pendAll=!!all;   // para o colapso se redesenhar com a mesma lista
  const pend=all?recPending():recActive();
  if(!pend.length)return '';
  const row=(r)=>{const late=recIsLate(r);return `<div class="card tap pend ${late?'late':''}" style="padding:11px 13px" onclick="confirmRec('${r.id}')">
    <div class="row-between" style="align-items:center">
      <div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</b>
        <span class="small">${esc(r.next)}${r.until&&r.until!==r.next?' – '+esc(r.until):''}${EVERY[r.every]?' · '+esc(EVERY[r.every]):''}${r.muted?' · silenciada':late?' · <b class="neg">em atraso</b>':''} · ${(KIND[r.tx.kind]||{}).short}${r.tx.propertyId?' · '+esc(propName(r.tx.propertyId)):''}</span></div>
      <b style="flex:0 0 auto">${r.tx.amount?euro2(r.tx.amount):''}</b></div>
    ${(()=>{const ok=podeEditar((r.tx||{}).propertyId,'rec.add',r),conf=!recusaConfirmar(r);   /* sem permissão, só a linha */
      return ok||conf?`<div class="toolbar" style="margin:9px 0 0">
        ${conf?`<button class="btn sm primary" onclick="${stop}quickConfirmRec('${r.id}')">${ic('check',14)} Confirmar</button>`:''}
        ${ok?`<button class="btn sm" onclick="${stop}skipRec('${r.id}')">${r.muted?'Reativar':'Silenciar'}</button>`:''}</div>`:''})()}</div>`};
  const nl=pend.filter(recIsLate).length,open=!pendShut();
  return `<div class="card" id="pendCard" style="margin-bottom:14px">
    <div class="row-between tap" style="align-items:center;cursor:pointer;margin:-16px;padding:16px" onclick="pendToggle()">
      <div style="min-width:0"><div class="title">Movimentos por confirmar</div>
        <div class="small">${pend.length} à espera${nl?' · <b class="neg">'+nl+' em atraso</b>':''} · ${euro(sum(pend.map(r=>r.tx.amount||0)))}${open?'':' · toca para ver'}</div></div>
      <span style="flex:0 0 auto;display:inline-flex;transform:rotate(${open?'90':'-90'}deg);transition:transform .15s">${ic('chev',20)}</span></div>
    ${open?`<div class="list" style="gap:8px;margin-top:12px">${pend.map(row).join('')}</div>
    <div class="hint" style="margin-top:9px">Confirmar regista o movimento e agenda o seguinte. Silenciar deixa-o à espera, sem avisos.</div>`:''}</div>`;
}
/* Fechado por omissão, e a escolha fica no aparelho.

   A vista geral existe para se ver o património de relance. Com a lista
   aberta, quatro movimentos por confirmar ocupavam 600 dos 900px de um
   ecrã de computador — e o telemóvel inteiro — antes de aparecer um único
   indicador. O que é preciso saber (quantos esperam, quantos em atraso)
   cabe no cabeçalho; a lista abre-se com um toque de quem a quer.

   Guarda-se '0' explícito quando se abre, para distinguir "nunca mexeu"
   de "quis aberto". */
const PEND_LS='gi_pend_shut';
// O cartão está fechado? Verdade por omissão; só o '0' guardado quer dizer "aberto".
// Devolve: verdadeiro se o cartão está fechado, falso se o utilizador o quis aberto.
function pendShut(){try{return localStorage.getItem(PEND_LS)!=='0'}catch(e){return true}}
// Abre/fecha o cartão: guarda a escolha no aparelho e substitui só o cartão
// no DOM (render completo apenas se ele já não existir).
// Devolve: nada — guarda a escolha e atualiza o cartão no ecrã.
function pendToggle(){
  try{localStorage.setItem(PEND_LS,pendShut()?'0':'1')}catch(e){}
  const e=document.getElementById('pendCard');
  if(!e)return render();
  e.outerHTML=pendingCard(pendAll);
}
/* página das recorrências e modelos
   Devolve: o HTML da página (texto). */
function vRecurring(){
  const K='lrec',s=lf(K);
  const hit=(name,tx)=>lfHit(K,[name,tx.label,tx.category,tx.sub,tx.creditor,propName(tx.propertyId),String(tx.amount||''),(tx.tags||[]).join(' '),tx.notes].join(' '));
  const base=r=>((!s.k||r.tx.kind===s.k)&&(!s.p||r.tx.propertyId===s.p)&&hit(r.name,r.tx));
  const rc=(db.recurring||[]).filter(r=>{
    if(!base(r))return false;
    if(s.st==='pend'&&!(r.next&&r.next<=today()&&!r.muted))return false;
    if(s.st==='ok'&&!(r.next&&r.next>today()))return false;
    if(s.st==='muted'&&!r.muted)return false;
    if(s.st==='auto'&&!r.auto)return false;
    if(s.st==='manual'&&r.auto)return false;
    return true;
  }).sort((a,b)=>String(a.next).localeCompare(String(b.next)));
  const rcS=lfSort(K,rc,{nome:r=>r.name,valor:r=>r.tx.amount||0,data:r=>r.next||''});
  const tp=lfSort(K,(db.templates||[]).filter(x=>(!s.k||x.tx.kind===s.k)&&(!s.p||x.tx.propertyId===s.p)&&(!s.st||s.st==='manual')&&hit(x.name,x.tx)),
    {nome:x=>x.name,valor:x=>x.tx.amount||0,data:()=>0});
  const kinds=[{v:'',label:'Todos os tipos'},{v:'income',label:'Receitas'},{v:'expense',label:'Despesas'},{v:'loan',label:'Pagamentos de crédito'},{v:'owed',label:'Dívidas recebidas'},{v:'repay',label:'Pagamentos de dívida'}];
  const head=lfBar(K,[lfSel(K,'k',kinds),lfSel(K,'p',lfPropOpts()),
      lfSel(K,'st',[{v:'',label:'Todos os estados'},{v:'pend',label:'Por confirmar'},{v:'ok',label:'Em dia'},{v:'muted',label:'Silenciados'},{v:'auto',label:'Automáticos (contratos e hipotecas)'},{v:'manual',label:'Criados à mão'}])],
      rc.length+tp.length,
      {defLabel:'Ordenar pela próxima data',opts:[{v:'data',label:'Ordenar por data'},{v:'valor',label:'Ordenar por valor'},{v:'nome',label:'Ordenar por nome'}]})
    +((podeSemImovel()||casasComo('rec.add').length)?fab([{label:'Novo mov. recorrente',icon:'clock',act:'newRec()'},{label:'Novo modelo',icon:'file',act:'newTpl()'}]):'');
  const recs=rcS.length?`<div class="list" style="gap:8px">${rcS.map(r=>{const late=recIsLate(r),pend=r.next<=today();return `<div class="card tap ${pend?'pend':''} ${late?'late':''}" data-lp="rec:${esc(r.id)}" onclick="editRec('${jsq(r.id)}')">
      <div class="row-between" style="align-items:center">
        <div style="min-width:0"><div class="title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</div>
          <div class="small">${r.auto?'<span class="badge grey" style="margin-right:4px">'+((r.tx||{}).loanId?'da hipoteca':'do contrato')+'</span>':''}${esc(EVERY[r.every]||r.every)} · ${esc(r.next)}${r.until&&r.until!==r.next?' – '+esc(r.until):''} · ${pend?(r.muted?'silenciada · por confirmar':late?'<b class="neg">em atraso</b>':'<b class="amber">por confirmar</b>'):'em dia'}${r.end?' · termina '+esc(r.end):''}</div>
          <div class="small">${(KIND[r.tx.kind]||{}).short}${r.tx.propertyId?' · '+esc(propName(r.tx.propertyId)):''}${r.tx.category?' · '+esc(r.tx.category):''}</div></div>
        <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
          <b style="font-size:16px">${r.tx.amount?euro2(r.tx.amount):'—'}</b>${kebab('rec:'+r.id)}</div></div></div>`}).join('')}</div>`
    :`<div class="empty" style="padding:24px"><b>${lfCount('lrec')?'Nada neste filtro':'Sem movimentos recorrentes'}</b>${lfCount('lrec')?'':'Repete-se sozinho e pede confirmação todos os meses. As rendas e as prestações criam um sem tu fazeres nada.'}</div>`;
  const tpls=tp.length?`<div class="list" style="gap:8px">${tp.map(x=>`<div class="card tap" data-lp="tpl:${esc(x.id)}" onclick="editTpl('${jsq(x.id)}')">
      <div class="row-between" style="align-items:center">
        <div style="min-width:0"><div class="title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name)}</div>
          <div class="small">${(KIND[x.tx.kind]||{}).short}${x.tx.propertyId?' · '+esc(propName(x.tx.propertyId)):''}${x.tx.category?' · '+esc(x.tx.category):''}</div></div>
        <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
          <b style="font-size:16px">${x.tx.amount?euro2(x.tx.amount):'—'}</b>${kebab('tpl:'+x.id)}</div></div></div>`).join('')}</div>`
    :`<div class="empty" style="padding:24px"><b>${lfCount('lrec')?'Nada neste filtro':'Sem modelos'}</b>${lfCount('lrec')?'':'Um modelo é um movimento guardado para copiar à mão quando precisares.'}</div>`;
  return head+pendingCard(true)+`<div class="section-title">Movimentos recorrentes</div>${recs}<div class="section-title" style="margin-top:18px">Modelos</div>${tpls}`;
}
/* secção do formulário: guardar como modelo e repetir
   Devolve: o HTML da secção dobrável "Datas e repetição" (texto). */
function recSect(){
  const t=tForm,every=t._every||'month';
  const body=`
    <label>Repetir${sel('t_every',every,Object.keys(EVERY).map(k=>({v:k,label:EVERY[k]})))}</label>
    <div class="row">
      <label>Entre<input id="t_date" type="date" value="${esc(t.date)}"></label>
      <label>e<input id="t_until" type="date" value="${t._until||''}"></label></div>
    <label>Até (deixa de se repetir; opcional)<input id="t_recEnd" type="date" value="${t._recEnd||''}"></label>
    <div class="hint">Entra por confirmar no primeiro dia; passado o segundo sem confirmares, fica em atraso.</div>`;
  return fold('rec','Datas e repetição',body,{icon:'clock',open:true,summary:EVERY[every]});
}
