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
/* Já há um movimento deste contrato neste mês?

   Ao mês, e não ao dia: a renda pode entrar no dia 3 ou no dia 9 e é a mesma
   renda. É o que impede o cursor de voltar a pedir o que já foi confirmado —
   e o que distingue «ainda não foi paga» de «já foi».
   Recebe: c — o contrato; iso — uma data AAAA-MM-DD.
   Devolve: true se já existe um movimento desse contrato nesse mês. */
function rendaJaLancada(c,iso){
  if(!c||!iso)return false;
  const mes=String(iso).slice(0,7);
  return (db.transactions||[]).some(t=>t.contractId===c.id&&String(t.date||'').slice(0,7)===mes);
}
/* Onde é que o cursor da renda deve estar.

   O cursor anda para onde tiver de andar — para a frente quando o contrato
   começa mais tarde, para trás quando o início é corrigido para antes —, mas
   NUNCA passa por cima de um mês que já tem movimento deste contrato. É essa
   regra que faz as duas coisas ao mesmo tempo: acompanha o contrato nos dois
   sentidos, e não há duplicado nenhum a inventar, porque ele nunca aterra num
   mês já lançado.
   Recebe: c — o contrato; next — o cursor atual; minNext — a primeira
   ocorrência que o contrato permite; from — o dia de pagamento.
   Devolve: a data do cursor, ou '' se já passou do fim do contrato. */
function cursorDaRenda(c,next,minNext,from){
  const passo=(iso,n)=>{const d=new Date(iso+'T00:00:00');let y=d.getFullYear(),m=d.getMonth()+n;
    y+=Math.floor(m/12);m=((m%12)+12)%12;return dayInMonth(y,m,from)};
  let x=next||minNext;
  if(!x)return '';
  /* para a frente: enquanto for cedo de mais, ou enquanto o mês já estiver
     lançado — é aqui que o confirmar deixa de poder duplicar */
  let guarda=0;
  while(guarda++<600&&((minNext&&x<minNext)||rendaJaLancada(c,x)))x=passo(x,1);
  /* para trás: enquanto o mês anterior ainda couber no contrato e não tiver
     movimento nenhum. Pára no primeiro mês lançado, e por isso nunca volta a
     pedir o que já foi confirmado. */
  guarda=0;
  while(guarda++<600){
    const ant=passo(x,-1);
    if(minNext&&ant<minNext)break;
    if(rendaJaLancada(c,ant))break;
    x=ant;
  }
  if(c.end&&x>c.end)return '';     // já não há renda nenhuma a pedir
  return x;
}
/* Mantém a recorrência automática da renda de um contrato: cria-a, atualiza-a
   ou remove-a conforme o contrato esteja ativo, com renda e com o automático
   ligado (autoRec). A janela payDay..payDayTo dá as datas; rendas antecipadas
   adiam a primeira ocorrência. A atualização passa pelo aplicaPlanoNaRec, o
   mesmo das prestações: despejar o modelo inteiro por cima apagava a divisão
   entre proprietários que o utilizador tinha dado à renda (o modelo traz
   split:null) e a categoria escolhida à mão. Mexe em db.recurring — quem
   chama grava.
   Recebe: c — o contrato a sincronizar (objeto de db.contracts).
   Devolve: nada — mexe em db.recurring; quem chama grava. */
function syncContractRec(c){
  /* ctVivo e não isActive: um contrato que só começa daqui a um ano tem de
     ter a renda marcada desde já. Com o isActive, ela era apagada no arranque
     seguinte — e com ela a divisão entre proprietários e a categoria que a
     pessoa lhe tinha dado. O cálculo do «next», logo abaixo, já nunca marca
     nada antes do início. */
  const r=ctRecOf(c),want=ctVivo(c)&&c.rent>0&&c.autoRec!==false;
  if(!want){if(r)db.recurring=db.recurring.filter(x=>x.id!==r.id);return}
  const from=Math.max(1,Math.min(31,c.payDay||1)),to=Math.max(from,Math.min(31,c.payDayTo||from));
  const inc=catsIn(),cat='Rendas' in inc?'Rendas':'',sub=cat&&(inc[cat]||[]).indexOf('Renda mensal')>-1?'Renda mensal':'';
  const tx={kind:'income',label:'Renda '+ctName(c),amount:c.rent,propertyId:c.propertyId,contractId:c.id,category:cat,sub,split:null};
  /* A primeira ocorrência nunca é antes do início do contrato — nem antes dos
     meses de renda antecipada, quando os há. Vale para os dois ramos abaixo:
     o que cria a recorrência e o que atualiza uma que já existe. Só o
     primeiro é que respeitava o início, e por isso mudar a data de início
     para a frente deixava o planeado a pedir a renda no mês antigo, de um
     contrato que ainda não tinha começado. */
  let minNext='';
  if(c.start){
    const d=new Date(c.start+'T00:00:00');
    let y2=d.getFullYear(),m2=d.getMonth()+(c.advance>0?c.advance:0);
    y2+=Math.floor(m2/12);m2%=12;
    /* sem antecipadas, um início depois da janela desse mês salta para o mês seguinte */
    if(!(c.advance>0)&&c.start>dayInMonth(y2,m2,to)){m2++;if(m2>11){m2=0;y2++}}
    minNext=dayInMonth(y2,m2,from);
  }
  if(r){aplicaPlanoNaRec(r,tx,tx.label);r.end=c.end||'';
    /* se os dias da janela mudarem no contrato, a janela acompanha (mantendo o mês em curso) */
    if(r.next){const d=new Date(r.next+'T00:00:00');r.next=dayInMonth(d.getFullYear(),d.getMonth(),from);r.until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
    /* O cursor acompanha o contrato nos DOIS sentidos, e nunca passa por cima
       de um mês já lançado. Chegou a empurrar só para a frente, com medo de
       ressuscitar confirmações — mas uma confirmação não é um estado do
       planeado, é um movimento com registo próprio: o cursor não lhe toca. O
       único mal era voltar a pedir um mês já lançado, e é precisamente isso
       que o cursorDaRenda não deixa acontecer. */
    const x=cursorDaRenda(c,r.next,minNext,from);
    if(!x){db.recurring=db.recurring.filter(y=>y.id!==r.id);return}
    if(x!==r.next){const d=new Date(x+'T00:00:00');r.next=x;r.until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
    return}
  /* primeira janela: este mês se ainda não passou; senão o mês que vem; nunca antes do início do contrato */
  const t=new Date(today()+'T00:00:00');let y=t.getFullYear(),m=t.getMonth();
  if(today()>dayInMonth(y,m,to)){m++;if(m>11){m=0;y++}}
  let next=dayInMonth(y,m,from),until=to>from?dayInMonth(y,m,to):'';
  const x0=cursorDaRenda(c,next,minNext,from);
  if(!x0)return;                   // um contrato que já acabou não estreia planeado nenhum
  if(x0!==next){const d=new Date(x0+'T00:00:00');next=x0;until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
  db.recurring=db.recurring||[];
  db.recurring.push(normRec({auto:true,name:tx.label,autoName:tx.label,every:'month',next,until,end:c.end||'',tx}));
}
/* Varre as recorrências automáticas de contratos: apaga as órfãs (o contrato
   já não existe) e sincroniza cada contrato com syncContractRec. Uma
   prestação automática que ficou sem hipoteca mas se identifica sem dúvida
   (recLoanId) escapa: é o syncAllLoanRecs, logo a seguir, que lha devolve —
   apagá-la levava com ela a divisão e o pagador que o utilizador lhe deu.
   Devolve: nada — mexe em db.recurring; quem chama grava. */
function syncAllContractRecs(){
  (db.recurring||[]).slice().forEach(r=>{if(r.auto&&!(r.tx||{}).loanId&&!recLoanId(r)&&(!r.tx.contractId||!db.contracts.some(c=>c.id===r.tx.contractId)))db.recurring=db.recurring.filter(x=>x.id!==r.id)});
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
  /* se o utilizador já tem uma recorrência manual para esta prestação, não se duplica —
     um planeado da hipoteca que não é a prestação (o seguro de vida, uma amortização)
     não pode calar a automática, ou o utilizador deixava de ser lembrado dela */
  const manual=(db.recurring||[]).some(x=>!x.auto&&x.tx&&x.tx.loanId===l.id&&ehPrestacaoDe(x,l));
  const want=l.outstanding>0&&l.autoRec!==false&&!manual;
  if(!want){if(r)db.recurring=db.recurring.filter(x=>x.id!==r.id);return}
  const day=(()=>{const d=l.start?Number(l.start.slice(8,10)):0;return Math.max(1,Math.min(28,d||1))})();
  const tx=loanRecTx(p,l),name=tx.label;
  if(r){aplicaPlanoNaRec(r,tx,name);
    if(r.next){const d=new Date(r.next+'T00:00:00');r.next=dayInMonth(d.getFullYear(),d.getMonth(),day)}
    return}
  const t=new Date(today()+'T00:00:00');let y=t.getFullYear(),m=t.getMonth();
  if(today()>dayInMonth(y,m,day)){m++;if(m>11){m=0;y++}}
  db.recurring=db.recurring||[];
  db.recurring.push(normRec({auto:true,name,autoName:name,every:'month',next:dayInMonth(y,m,day),tx}));
}
/* Passa para um planeado automático que já existe só o que é do plano — tipo,
   montante, imóvel e a origem (hipoteca ou contrato) — mais a categoria
   enquanto ela estiver vazia. O que é do utilizador (quem paga, a divisão, as
   etiquetas, os comentários) fica como está: o sync despejava o modelo inteiro
   por cima com Object.assign e apagava a divisão a cada arranque. O nome só se
   refresca enquanto for o automático — autoName guarda o último que a app
   escreveu, e uma recorrência antiga (sem autoName) conta como automática, que
   é como se comportava até aqui. Serve as prestações e as rendas: cada modelo
   só traz a sua origem (loanId ou contractId), a outra fica intocada.
   Recebe: r — o planeado já existente (objeto de db.recurring); tx — o modelo
   do loanRecTx ou o da renda do contrato; name — o nome automático correspondente.
   Devolve: nada — altera r; quem chama grava. */
function aplicaPlanoNaRec(r,tx,name){
  const t=r.tx;
  ['kind','amount','propertyId','loanId','contractId'].forEach(k=>{if(tx[k]!==undefined)t[k]=tx[k]});
  if(!t.category){t.category=tx.category;t.sub=tx.sub}
  if(r.autoName===undefined||r.autoName===r.name){t.label=name;r.name=name;r.autoName=name}
}
// Apaga as recorrências automáticas de hipotecas que já não existem e
// sincroniza as das hipotecas vivas, imóvel a imóvel.
// Devolve: nada — mexe em db.recurring; quem chama grava.
function syncAllLoanRecs(){
  const live=id=>db.properties.some(p=>(p.loans||[]).some(l=>l.id===id));
  (db.recurring||[]).slice().forEach(r=>{if(r.auto&&(r.tx||{}).loanId&&!live(r.tx.loanId))db.recurring=db.recurring.filter(x=>x.id!==r.id)});
  repararRecsSemCredito();
  db.properties.forEach(p=>(p.loans||[]).forEach(l=>syncLoanRec(p,l)));
}
/* Este planeado é mesmo a prestação mensal da hipoteca l? Um pagamento de
   crédito mensal, que não é amortização antecipada, com um montante da ordem
   da prestação calculada. A banda é larga de propósito — de metade ao dobro
   de loanCalc(l).total: a prestação muda ao longo da vida do crédito (a
   Euribor sobe e desce, a mista salta de fase, o prazo restante encurta), por
   isso uma tolerância ao cêntimo rejeitava prestações verdadeiras; mas um
   seguro de vida ou uma amortização anual estão a uma ordem de grandeza de
   distância e ficam de fora. Errar por defeito custa um planeado a mais
   (o automático nasce ao lado do do utilizador); errar por excesso custa a
   prestação toda — deixa de ser pedida e o que se confirma conta como
   prestação paga, encurtando o prazo. Daí a mão pesada.
   Recebe: r — o planeado ({every, tx}); l — a hipoteca.
   Devolve: true quando o planeado é a prestação mensal daquela hipoteca. */
function ehPrestacaoDe(r,l){
  const tx=(r||{}).tx||{};
  if(tx.kind!=='loan'||tx.payType==='amortizacao'||(r||{}).every!=='month')return false;
  const alvo=loanCalc(l).total,a=Number(tx.amount)||0;
  return alvo>0&&a>=alvo/2&&a<=alvo*2;
}
/* Reparação no arranque: as prestações planeadas que ficaram sem crédito —
   criadas à mão antes de a hipoteca existir, ou vindas de uma versão que não
   as ligava — ganham a hipoteca do imóvel quando ela é uma só e está viva.
   Sem isto o movimento nascia sem crédito e não abatia capital nenhum, e o
   imóvel ficava com dois planeados para a mesma prestação (o do utilizador e
   o automático, que só se apaga a si próprio quando reconhece o do
   utilizador). Só se repara o que é mesmo a prestação mensal (ehPrestacaoDe):
   ligar o «Seguro de vida do crédito» ou uma amortização anual à hipoteca
   calava a prestação automática e fazia contar como prestação paga o que não
   é. Com duas ou mais hipotecas não se adivinha: fica por escolher e as listas
   avisam. Corre antes de sincronizar as hipotecas, para o automático já ver o
   planeado reparado e não duplicar.
   Devolve: nada — mexe em db.recurring; quem chama grava. */
function repararRecsSemCredito(){
  (db.recurring||[]).forEach(r=>{
    const tx=r.tx||{};
    if(tx.kind!=='loan'||tx.loanId)return;
    const id=recLoanId(r),x=id?anyLoan(id):null;
    if(x&&ehPrestacaoDe(r,x.l))tx.loanId=id;
  });
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
/* Um planeado que termina ao ser confirmado: «uma só vez», ou com fim e a
   ocorrência seguinte já para lá dele — o que o recAdvance apaga em vez de
   avançar. Num planeado alheio é o único apagar que o servidor aceita a quem
   tem «Adicionar e confirmar planeados» (é o que podeEditar consulta).
   Recebe: r — o planeado ({every, next, end}).
   Devolve: true se confirmar o apaga. */
function recTermina(r){
  if(!r)return false;
  if(r.every==='once')return true;
  return !!(r.end&&r.next&&nextDate(r.next,r.every)>r.end);
}
/* O crédito de uma prestação planeada (ou de um modelo): o que ela traz e,
   só quando não traz nenhum, a única hipoteca viva do imóvel. É a mesma regra
   do prefill do formulário, aqui em função pura para o recTx e o confirmRec
   não discordarem: até agora, abrir o planeado associava a hipoteca e o botão
   «Confirmar» do cartão não, e o movimento saía sem crédito e sem abater
   capital. Um planeado que traz uma hipoteca que já não existe naquele imóvel
   (apagada, ou de outro imóvel) devolve null em vez de cair na única viva:
   abater capital numa hipoteca que o utilizador nunca escolheu era pior do
   que pedir-lhe que escolha — é o que o recSemCredito passa a assinalar. Com
   duas ou mais vivas, ou depois de a hipoteca ter sido apagada (loanOff), não
   se adivinha nenhuma.
   Recebe: r — a prestação planeada ou o modelo ({tx:{kind,propertyId,loanId}}).
   Devolve: o id da hipoteca (texto), ou null quando não há nenhuma sem dúvida. */
function recLoanId(r){
  const tx=(r||{}).tx||{};
  if(tx.kind!=='loan')return null;
  const p=prop(tx.propertyId);
  if(!p)return tx.loanId||null;
  if(tx.loanId)return findLoan(p,tx.loanId)?tx.loanId:null;
  if((r||{}).loanOff)return null;   /* o delMort desligou-o: não se adivinha outra por ele */
  const ls=liveLoans(p);
  return ls.length===1?ls[0].id:null;
}
/* Falta escolher o crédito neste planeado? É um pagamento de crédito sem
   hipoteca que se possa apontar sem dúvida (recLoanId) e onde havia por onde
   escolher: um imóvel com mais do que uma hipoteca viva, um planeado que
   aponta para uma hipoteca que já não é daquele imóvel, ou um que ficou
   desligado por a hipoteca ter sido apagada. Confirmar às cegas dava um
   movimento sem crédito — ou, pior, capital abatido na hipoteca errada.
   Recebe: r — a prestação planeada.
   Devolve: true quando falta escolher a hipoteca. */
function recSemCredito(r){
  const tx=(r||{}).tx||{};
  if(tx.kind!=='loan'||recLoanId(r))return false;
  return !!tx.loanId||!!(r||{}).loanOff||liveLoans(prop(tx.propertyId)).length>1;
}
/* A hipoteca deste planeado já está liquidada? O formulário recusa gravar um
   pagamento novo numa hipoteca paga (movimento.js), mas o findLoan encontra-a
   com o capital a 0 e o botão «Confirmar» do cartão registava-o em silêncio —
   sem abater nada e a contar como prestação paga, o que encurtava o prazo de
   um crédito já pago. Os dois caminhos passam a dizer o mesmo.
   Recebe: r — a prestação planeada.
   Devolve: true quando o planeado aponta para uma hipoteca sem capital em dívida. */
function recCreditoPago(r){
  const id=recLoanId(r);if(!id)return false;
  const x=anyLoan(id);
  return !!x&&!(Number(x.l.outstanding)>0);
}
// Movimento normalizado a partir do tx da recorrência, datado de 'date' (ou da
// data prevista). Numa prestação, o crédito vem do recLoanId — quem paga e a
// divisão são os da recorrência. Só constrói: não regista nem toca na recorrência.
// Recebe: r — a recorrência de origem (objeto de db.recurring); date (opcional) — data
// AAAA-MM-DD do movimento; sem ela usa r.next.
// Devolve: o movimento normalizado (objeto pronto para db.transactions).
function recTx(r,date){
  const t=normTx(Object.assign({},JSON.parse(JSON.stringify(r.tx)),{date:date||r.next,label:r.tx.label||r.name}));
  if(t.kind==='loan')t.loanId=recLoanId(r);
  return t;
}
/* confirmar sem abrir: cria o movimento na data prevista e passa à seguinte
   Recebe: id — o id da recorrência a confirmar.
   Devolve: nada — regista o movimento, grava e redesenha. */
function quickConfirmRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const recusa=recusaConfirmar(r);if(recusa)return toast(recusa);
  /* sem saber a que hipoteca abate, o movimento saía sem crédito: abre-se para escolher */
  if(recSemCredito(r))return toast('Sem crédito associado — abre o planeado para escolher a hipoteca.');
  /* a mesma frase do formulário: confirmar depressa não pode aceitar o que o Guardar recusa */
  if(recCreditoPago(r))return toast('Esta hipoteca já está paga: não é possível associar novos pagamentos.');
  /* Um mês que já tem movimento deste contrato não se lança outra vez: salta
     e diz que saltou. Acontece quando a renda foi registada à mão, ou quando
     o cursor recuou com o contrato para um mês já pago. */
  const ct=r.tx&&r.tx.contractId?contract(r.tx.contractId):null;
  if(ct&&rendaJaLancada(ct,r.next)){
    const mes=r.next;recAdvance(r);save();buildNav();render();
    return toast('Já havia um movimento deste contrato em '+String(mes).slice(0,7)+' — o planeado saltou para o seguinte.');
  }
  const t=recTx(r);if(t.kind==='loan')applyLoan(t);
  db.transactions.push(t);recAdvance(r);save();buildNav();render();toast('Movimento confirmado.');
}
// Silencia ou reativa a recorrência: silenciada fica em Planeados à espera de
// confirmação, mas sem avisos nem contagem no menu. Grava e redesenha.
// Recebe: id — o id da recorrência a silenciar ou reativar.
// Devolve: nada — grava e redesenha.
function skipRec(id){const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const recusa=motivoRecusa((r.tx||{}).propertyId,'rec.add',r,'confirmar');if(recusa)return toast(recusa);
  r.muted=!r.muted;save();buildNav();render();toast(r.muted?'Silenciada: fica em Planeados à espera de confirmação, sem avisos.':'Volta a avisar.')}
/* Confirmar um planeado cria um movimento: num imóvel onde só colaboro pede
   «Adicionar e confirmar planeados» e também «Adicionar movimentos» — sem a
   segunda, o servidor recusava o movimento que a confirmação cria. Num
   planeado alheio, confirmar é avançá-lo (o servidor funde next e until) ou,
   quando termina (recTermina), apagá-lo — podeEditar sabe qual dos dois o
   servidor aceita. Uma prestação de hipoteca abate capital na ficha do
   imóvel: pede ainda «Editar a ficha do imóvel» (motivoCredito).
   Recebe: r — a recorrência.
   Devolve: a frase da recusa (texto), ou '' quando posso confirmar. */
function recusaConfirmar(r){
  const hid=(r&&r.tx||{}).propertyId;
  const m=motivoRecusa(hid,'rec.add',r,recTermina(r)?true:'confirmar');if(m)return m;
  if(!pode(hid,'tx.add'))return fraseSemPerm('tx.add');
  if((r&&r.tx||{}).kind==='loan')return motivoCredito(hid);
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
/* O corpo da ficha de um movimento planeado.

   «O que é isto que me estão a pedir para confirmar, de quanto, de onde vem,
   e desde quando está à espera?» O «de onde vem» é o que explica porque é
   que um planeado automático volta sozinho depois de apagado.
   Recebe: id — o id do planeado.
   Devolve: o HTML do corpo, ou vazio se o planeado já não existir. */
function recFicha(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return '';
  const t=r.tx||{};
  const vem=r.auto?(t.loanId?'Prestação da hipoteca '+esc(loanName(((anyLoan(t.loanId)||{}).l)||null))
    :(t.contractId&&contract(t.contractId)?'Renda do contrato '+esc(ctName(contract(t.contractId))):'')):'';
  return ficha([
    {tipo:'nota',valor:esc(motivoRecusa(t.propertyId,'rec.add',r))},
    t.amount?{rotulo:'Montante',valor:euro2(t.amount)}:null,
    {rotulo:'Quando',valor:esc(r.next||'')+(r.until&&r.until!==r.next?' a '+esc(r.until):'')+(r.every?' · '+esc(EVERY[r.every]||r.every):'')},
    {rotulo:'Estado',valor:(recIsLate(r)?'<span class="neg">Em atraso</span> desde '+esc(r.until||r.next||'')
      :(r.next&&r.next<=today()?'Por confirmar':'Em dia'))+(r.muted?' · silenciada':'')},
    {rotulo:'Tipo',valor:esc((KIND[t.kind]||{}).short||'')},
    /* um planeado pode estar num grupo de imóveis em vez de num imóvel */
    {rotulo:'Imóvel',valor:esc(propName(t.propertyId)||((grp(t.groupId)||{}).name||''))},
    vem?{tipo:'bloco',rotulo:'De onde vem',valor:vem}:null,
    {rotulo:'Categoria',valor:esc([t.category,t.sub].filter(Boolean).join(' / '))},
    (t.tags||[]).length?{rotulo:'Etiquetas',valor:(t.tags||[]).map(esc).join(' · ')}:null,
    owner(t.paidBy)?{rotulo:isIn(t.kind)?'Recebido por':'Pago por',valor:esc((owner(t.paidBy)||{}).name||'')}:null,
    String(t.notes||'').trim()?{tipo:'bloco',rotulo:'Comentários',valor:rich(t.notes)}:null,
  ]);
}
/* A ficha de um planeado: o que tocar num planeado passa a abrir.

   É a única ficha em que o botão do rodapé muda: quando há uma data por
   confirmar, o que se quer a seguir a ler é confirmar, e não editar. O
   «Confirmar» deixa de ser o efeito de tocar no cartão e passa a ser um
   botão que se carrega depois de se ver o que se está a confirmar.
   Recebe: id — o id do planeado.
   Devolve: nada — abre a janela. */
function recView(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const hid=(r.tx||{}).propertyId;
  const podeConf=r.next&&r.next<=today()&&!recusaConfirmar(r)&&!recSemCredito(r)&&!recCreditoPago(r);
  const podeEd=podeEditar(hid,'rec.add',r);
  abrirFicha({
    titulo:()=>{const x=(db.recurring||[]).find(y=>y.id===id);return x?x.name:'Planeado'},
    corpo:()=>recFicha(id),
    menu:()=>{const x=(db.recurring||[]).find(y=>y.id===id);if(!x)return '';
      const it=[];
      if(podeConf)it.push({label:'Confirmar sem rever',icon:'check',toca:'dados',act:`quickConfirmRec('${jsq(id)}')`});
      if(podeEditar(hid,'rec.add',x,'confirmar'))it.push({label:x.muted?'Reativar avisos':'Silenciar',icon:'clock',toca:'dados',act:`skipRec('${jsq(id)}')`});
      if(podeConf&&podeEd)it.push({label:'Editar',icon:'pen',toca:'camada',act:`editRec('${jsq(id)}')`});
      if(podeEditar(hid,'rec.add',x,true))it.push({label:'Apagar',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delRec('${jsq(id)}')`});
      return it.length?menu('fichaRec',it):''},
    editar:podeConf?{rotulo:'Confirmar',act:`confirmRec('${jsq(id)}')`}
      :(podeEd?{rotulo:'Editar',act:`editRec('${jsq(id)}')`}:null),
  });
}
/* O corpo da ficha de um modelo.

   Sem data, sem estado e sem periodicidade — é isso que distingue um modelo
   de um planeado, e a ficha deixa-o ver.
   Recebe: id — o id do modelo.
   Devolve: o HTML do corpo, ou vazio se o modelo já não existir. */
function tplFicha(id){
  const x=(db.templates||[]).find(y=>y.id===id);if(!x)return '';
  const t=x.tx||{};
  return ficha([
    t.amount?{rotulo:'Montante',valor:euro2(t.amount)}:null,
    {rotulo:'Tipo',valor:esc((KIND[t.kind]||{}).short||'')},
    t.label&&t.label!==x.name?{rotulo:'Descrição',valor:esc(t.label)}:null,
    {rotulo:'Imóvel',valor:esc(propName(t.propertyId)||((grp(t.groupId)||{}).name||''))},
    {rotulo:'Categoria',valor:esc([t.category,t.sub].filter(Boolean).join(' / '))},
    (t.tags||[]).length?{rotulo:'Etiquetas',valor:(t.tags||[]).map(esc).join(' · ')}:null,
    owner(t.paidBy)?{rotulo:isIn(t.kind)?'Recebido por':'Pago por',valor:esc((owner(t.paidBy)||{}).name||'')}:null,
    (t.split||{}).mode?{rotulo:'Divisão entre proprietários',
      valor:esc(((SPLIT_MODES.find(m=>m[0]===(t.split||{}).mode)||[])[1])||'')}:null,
    String(t.notes||'').trim()?{tipo:'bloco',rotulo:'Comentários',valor:rich(t.notes)}:null,
  ]);
}
/* A ficha de um modelo: o que tocar num modelo passa a abrir.
   O primário do rodapé é «Usar modelo», que é a pergunta que traz cá alguém.
   Recebe: id — o id do modelo.
   Devolve: nada — abre a janela. */
function tplView(id){
  const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;
  abrirFicha({
    titulo:()=>{const y=(db.templates||[]).find(z=>z.id===id);return y?y.name:'Modelo'},
    corpo:()=>tplFicha(id),
    menu:()=>menu('fichaTpl',[{label:'Editar',icon:'pen',toca:'camada',act:`editTpl('${jsq(id)}')`},
      {label:'Apagar',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delTpl('${jsq(id)}')`}]),
    editar:{rotulo:'Usar modelo',act:`newFromTemplate('${jsq(id)}')`},
  });
}
/* Abre o formulário de movimento carregado com a recorrência, em modo de
   edição: guardar altera a recorrência em vez de criar um movimento. Um
   planeado que não posso alterar (alheio, num imóvel onde só colaboro — os
   campos são de quem o criou; ou de um cargo que só vê) abre só de leitura:
   confirmar e silenciar ficam no toque longo.
   Recebe: id — o id da recorrência a editar.
   Devolve: nada — abre o formulário carregado com a recorrência. */
function editRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const recusa=motivoRecusa((r.tx||{}).propertyId,'rec.add',r);
  txModal(null,r.tx.kind,r.tx.propertyId,null,r.tx.contractId,Object.assign({},JSON.parse(JSON.stringify(r.tx)),{date:r.next,label:r.tx.label||r.name}));
  tForm._recId=id;tForm._every=r.every;tForm._recEnd=r.end||'';tForm._until=r.until||'';
  const h=modalTop().el.querySelector('.head h2');if(h)h.textContent=recusa?'Movimento recorrente':'Editar movimento recorrente';
  foldState.rec=true;repaintTx();
  if(recusa){onSave=null;modalSoLeitura('Planeado de um imóvel onde colaboras — só de leitura.')}
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
  const recusa=motivoRecusa((r.tx||{}).propertyId,'rec.add',r,true);if(recusa)return toast(recusa);
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
  const row=(r)=>{const late=recIsLate(r),semCred=recSemCredito(r),pago=!semCred&&recCreditoPago(r);return `<div class="card tap pend ${late?'late':''}" data-fk="rec:${esc(r.id)}" style="padding:11px 13px" data-toca="camada" onclick="confirmRec('${r.id}')">
    <div class="row-between" style="align-items:center">
      <div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</b>
        <span class="small">${esc(r.next)}${r.until&&r.until!==r.next?' – '+esc(r.until):''}${EVERY[r.every]?' · '+esc(EVERY[r.every]):''}${r.muted?' · silenciada':late?' · <b class="neg">em atraso</b>':''} · ${(KIND[r.tx.kind]||{}).short}${r.tx.propertyId?' · '+esc(propName(r.tx.propertyId)):''}</span>
        ${semCred?'<span class="small"><b class="amber">Sem crédito associado — abre para escolher</b></span>':''}
        ${pago?'<span class="small"><b class="amber">Hipoteca já paga — abre para rever</b></span>':''}</div>
      <b style="flex:0 0 auto">${r.tx.amount?euro2(r.tx.amount):''}</b></div>
    ${(()=>{const ok=podeEditar((r.tx||{}).propertyId,'rec.add',r,'confirmar'),conf=!recusaConfirmar(r)&&!semCred&&!pago;   /* sem permissão, só a linha */
      return ok||conf?`<div class="toolbar" style="margin:9px 0 0">
        ${conf?`<button class="btn sm primary" data-toca="dados" onclick="${stop}quickConfirmRec('${r.id}')">${ic('check',14)} Confirmar</button>`:''}
        ${ok?`<button class="btn sm" data-toca="dados" onclick="${stop}skipRec('${r.id}')">${r.muted?'Reativar':'Silenciar'}</button>`:''}</div>`:''})()}</div>`};
  const nl=pend.filter(recIsLate).length,open=!pendShut();
  return `<div class="card" id="pendCard" style="margin-bottom:14px">
    <div class="row-between tap" style="align-items:center;cursor:pointer;margin:-16px;padding:16px" data-toca="vista" onclick="pendToggle()">
      <div style="min-width:0"><div class="title">Movimentos por confirmar</div>
        <div class="small">${pend.length} à espera${nl?' · <b class="neg">'+nl+' em atraso</b>':''} · ${euro(sum(pend.map(r=>r.tx.amount||0)))}${open?'':' · toca para ver'}</div></div>
      <span style="flex:0 0 auto;display:inline-flex;transform:rotate(${open?'90':'-90'}deg)">${ic('chev',20)}</span></div>
    ${open?listaViva('pendentes',pend.map(r=>({chave:'pend:'+r.id,html:row(r)})),'','gap:8px;margin-top:12px')
    +`<div class="hint" style="margin-top:9px">Confirmar regista o movimento e agenda o seguinte. Silenciar deixa-o à espera, sem avisos.</div>`:''}</div>`;
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
  const recs=rcS.length?listaViva('recorrentes',rcS.map(r=>({chave:'rec:'+r.id,html:(r=>{const late=recIsLate(r),pend=r.next<=today();return `<div class="card tap ${pend?'pend':''} ${late?'late':''}" data-lp="rec:${esc(r.id)}" data-fk="recl:${esc(r.id)}" data-toca="camada" onclick="recView('${jsq(r.id)}')">
      <div class="row-between" style="align-items:center">
        <div style="min-width:0"><div class="title">${esc(r.name)}</div>
          <div class="small">${r.auto?'<span class="badge grey" style="margin-right:4px">'+((r.tx||{}).loanId?'da hipoteca':'do contrato')+'</span>':''}${esc(EVERY[r.every]||r.every)} · ${esc(r.next)}${r.until&&r.until!==r.next?' – '+esc(r.until):''} · ${pend?(r.muted?'silenciada · por confirmar':late?'<b class="neg">em atraso</b>':'<b class="amber">por confirmar</b>'):'em dia'}${r.end?' · termina '+esc(r.end):''}</div>
          <div class="small">${(KIND[r.tx.kind]||{}).short}${r.tx.propertyId?' · '+esc(propName(r.tx.propertyId)):''}${r.tx.category?' · '+esc(r.tx.category):''}</div>
          ${recSemCredito(r)?'<div class="small"><b class="amber">Sem crédito associado — abre para escolher</b></div>':''}</div>
        <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
          <b style="font-size:16px">${r.tx.amount?euro2(r.tx.amount):'—'}</b>${kebab('rec:'+r.id)}</div></div></div>`})(r)})),'','gap:8px')
    :`<div class="empty" style="padding:24px"><b>${lfCount('lrec')?'Nada neste filtro':'Sem movimentos recorrentes'}</b>${lfCount('lrec')?'':'Repete-se sozinho e pede confirmação todos os meses. As rendas e as prestações criam um sem tu fazeres nada.'}</div>`;
  const tpls=tp.length?listaViva('modelos',tp.map(x=>({chave:'tpl:'+x.id,html:`<div class="card tap" data-lp="tpl:${esc(x.id)}" data-fk="tpl:${esc(x.id)}" data-toca="camada" onclick="tplView('${jsq(x.id)}')">
      <div class="row-between" style="align-items:center">
        <div style="min-width:0"><div class="title">${esc(x.name)}</div>
          <div class="small">${(KIND[x.tx.kind]||{}).short}${x.tx.propertyId?' · '+esc(propName(x.tx.propertyId)):''}${x.tx.category?' · '+esc(x.tx.category):''}</div></div>
        <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
          <b style="font-size:16px">${x.tx.amount?euro2(x.tx.amount):'—'}</b>${kebab('tpl:'+x.id)}</div></div></div>`})),'','gap:8px')
    :`<div class="empty" style="padding:24px"><b>${lfCount('lrec')?'Nada neste filtro':'Sem modelos'}</b>${lfCount('lrec')?'':'Um modelo é um movimento guardado para copiar à mão quando precisares.'}</div>`;
  return head+pendingCard(true)+`<div class="section-title">Movimentos recorrentes</div>${recs}<div class="section-title" style="margin-top:18px">Modelos</div>${tpls}`;
}
/* secção do formulário: guardar como modelo e repetir
   Devolve: o HTML da secção dobrável "Datas e repetição" (texto). */
function recSect(){
  const t=tForm,every=t._every||'month';
  const body=`
    <label>Repetir${sel('t_every',every,Object.keys(EVERY).map(k=>({v:k,label:EVERY[k]})),'','rascunho')}</label>
    <div class="row">
      <label>Entre<input id="t_date" type="date" value="${esc(t.date)}"></label>
      <label>e<input id="t_until" type="date" value="${t._until||''}"></label></div>
    <label>Até (deixa de se repetir; opcional)<input id="t_recEnd" type="date" value="${t._recEnd||''}"></label>
    <div class="hint">Entra por confirmar no primeiro dia; passado o segundo sem confirmares, fica em atraso.</div>`;
  return fold('rec','Datas e repetição',body,{icon:'clock',open:true,summary:EVERY[every]});
}
