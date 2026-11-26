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
/* a renda de cada contrato ativo vive como movimento recorrente, criado e mantido pela app
   Recebe: c — o contrato (objeto de db.contracts).
   Devolve: a recorrência automática dessa renda em db.recurring, ou undefined se não existir. */
function ctRecOf(c){return (db.recurring||[]).find(r=>r.auto&&r.tx&&r.tx.contractId===c.id)}
/* Já está lançada a renda deste contrato neste mês?

   Ao mês, e não ao dia: a renda pode entrar no dia 3 ou no dia 9 e é a mesma
   renda. É o que impede o cursor de voltar a pedir o que já foi confirmado —
   e o que distingue «ainda não foi paga» de «já foi». Conta só o que é renda
   (ehRenda: uma receita nos totais, das Rendas ou sem categoria com contrato):
   a caução e os empréstimos recebidos são dinheiro que se devolve e não pagam
   mês nenhum — e a caução entra quase sempre no mês de início, que era o mês
   cuja renda planeada ficava calada. E conta pelo mês a que a renda respeita
   (mesDaRenda): a de agosto paga a 3 de setembro é de agosto. Uma renda
   paga só em parte (t.parcial, a resposta «Pagamento parcial» do
   movimento.js:txPerguntarRendaAbaixo) não fecha o mês: o resto fica em
   dívida, e o planeado continua a pedi-lo (D115).
   Recebe: c — o contrato; iso — uma data AAAA-MM-DD.
   Devolve: true se já existe uma renda desse contrato para esse mês. */
function rendaJaLancada(c,iso){
  if(!c||!iso)return false;
  const mes=String(iso).slice(0,7);
  return (db.transactions||[]).some(t=>t.contractId===c.id&&ehRenda(t)&&!t.parcial&&mesDaRenda(t)===mes);
}
/* O mês a que uma renda respeita: o que o movimento diz (periodo), e a data
   nos que não o dizem (os de antes do campo, os que vêm de um planeado).
   Recebe: t — o movimento.
   Devolve: 'AAAA-MM' (texto; '' sem data nem periodo). */
function mesDaRenda(t){return /^\d{4}-\d{2}$/.test(String(t.periodo||''))?t.periodo:String(t.date||'').slice(0,7)}
/* A data de compra de uma casa, para os planeados. A regra vive com a casa
   (imovel.js:dataDeCompra); os Planeados não requerem os Imóveis, e sem eles
   ligados não há chão nenhum.
   Recebe: id — o id do imóvel (vazio: sem imóvel).
   Devolve: 'AAAA-MM-DD' (texto), ou ''. */
function compraDaCasa(id){return id&&servicoLigado('properties')?dataDeCompra(id):''}
/* O primeiro dia de pagamento (o dia `dia` de cada mês) no dia da compra da
   casa ou depois: o chão do cursor da renda.
   Recebe: id — o id do imóvel; dia — o dia do mês em que se paga (1–31,
   preso ao último dia nos meses mais curtos).
   Devolve: 'AAAA-MM-DD' (texto), ou '' sem data de compra. */
function primeiraDesdeACompra(id,dia){
  const compra=compraDaCasa(id);if(!compra)return '';
  let y=Number(compra.slice(0,4)),m=Number(compra.slice(5,7))-1,d=dayInMonth(y,m,dia||1);
  if(d<compra){m++;if(m>11){m=0;y++}d=dayInMonth(y,m,dia||1)}
  return d;
}
/* Onde é que o cursor da renda deve estar.

   O cursor anda para onde tiver de andar — para a frente quando o contrato
   começa mais tarde, para trás quando o início é corrigido para antes —, mas
   NUNCA passa por cima de um mês que já tem a renda deste contrato. É essa
   regra que faz as duas coisas ao mesmo tempo: acompanha o contrato nos dois
   sentidos, e não há duplicado nenhum a inventar, porque ele nunca aterra num
   mês já lançado.
   Nem recua para antes da compra da casa (imovel.js:dataDeCompra): o chão é
   o primeiro dia de pagamento desde ela, mesmo num contrato antigo com o
   início antes — um contrato «desde 1870» numa casa comprada em 2020 pedia
   600 rendas em atraso (ticket de QA a3a6d2d4).
   Recebe: c — o contrato; next — o cursor atual; minNext — a primeira
   ocorrência que o contrato permite; from — o dia de pagamento; semFim
   (opcional) — true para não parar no fim do contrato (o que continua depois
   do termo, ctRendaDepoisDoTermo).
   Devolve: a data do cursor, ou '' se já passou do fim do contrato. */
function cursorDaRenda(c,next,minNext,from,semFim){
  const passo=(iso,n)=>{const d=new Date(iso+'T00:00:00');let y=d.getFullYear(),m=d.getMonth()+n;
    y+=Math.floor(m/12);m=((m%12)+12)%12;return dayInMonth(y,m,from)};
  const chao=primeiraDesdeACompra((c||{}).propertyId,from);
  if(chao&&(!minNext||minNext<chao))minNext=chao;
  let x=next||minNext;
  if(!x)return '';
  /* cedo de mais salta logo para o chão: um cursor velho décadas atrás não
     chegava lá nas 600 voltas de um mês */
  if(minNext&&x<minNext)x=minNext;
  /* para a frente: enquanto for cedo de mais, ou enquanto o mês já estiver
     lançado — é aqui que o confirmar deixa de poder duplicar */
  let guarda=0;
  while(guarda++<600&&((minNext&&x<minNext)||rendaJaLancada(c,x)))x=passo(x,1);
  /* para trás: enquanto o mês anterior ainda couber no contrato e não tiver
     renda. Pára no primeiro mês lançado, e por isso nunca volta a pedir o que
     já foi confirmado — e volta ao mês que só tinha a caução. */
  guarda=0;
  while(guarda++<600){
    const ant=passo(x,-1);
    if(minNext&&ant<minNext)break;
    if(rendaJaLancada(c,ant))break;
    x=ant;
  }
  if(!semFim&&c.end&&x>c.end)return '';     // já não há renda nenhuma a pedir
  return x;
}
/* O contrato continua depois do termo? Um contrato com prazo certo
   renova-se sozinho no termo (Código Civil, art. 1096.º), e muita gente
   continua a registar as rendas sem carregar em «Renovar…». Com o termo (o
   c.end com as renovações registadas, irs.js:irsFimEfetivo) já passado, sem
   «Terminar contrato» (active a false, ou o dia da cessação,
   irs.js:irsCessacao) e com uma renda de um mês depois do termo (mesDaRenda:
   a do último mês paga com atraso não conta), o planeado da renda fica e
   continua a pedir as seguintes. Apagá-lo calava as rendas que a pessoa
   continua a receber, e que se declaram (D15); a Declaração diz o resto
   (fisco-avisos.js).
   Recebe: c — o contrato.
   Devolve: true ou false. */
function ctRendaDepoisDoTermo(c){
  if(!c||c.active===false)return false;
  const fim=String(irsFimEfetivo(c)||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fim)||fim>=today())return false;
  if(irsCessacao(c).data)return false;
  const mes=fim.slice(0,7);
  return (db.transactions||[]).some(t=>t.contractId===c.id&&ehRenda(t)&&mesDaRenda(t)>mes);
}
/* O molde do movimento da renda de um contrato: receita, na categoria das
   Rendas (e na Renda mensal) quando existem — pelo id, com o nome que tiverem
   nesta conta (dados.js:catDoIdIrs, N005) —, com o imóvel e o contrato. É o tx
   do planeado da renda (syncContractRec) e o do plano de um contrato terminado
   (ctPlanoTerminado).
   Recebe: c — o contrato.
   Devolve: o molde (objeto). */
function ctMoldeDaRenda(c){
  const n=catDoIdIrs('catsIn','rendas/renda-mensal')||catDoIdIrs('catsIn','rendas')||{category:'',sub:''};
  return {kind:'income',label:'Renda '+ctName(c),amount:c.rent,propertyId:c.propertyId,contractId:c.id,category:n.category,sub:n.sub,split:null};
}
/* Um contrato que já terminou não tem planeado de renda (syncContractRec só
   os quer vivos), e por isso a janela do preenchimento não tinha por onde lhe
   pegar: quem adiciona um contrato antigo, já acabado, ficava sem maneira de
   registar as rendas dele de uma vez (KAN-132). Este é o plano que ele teria,
   sem ir para db.recurring: o molde da renda, mensal, no dia do pagamento, do
   início ao dia em que o contrato acabou mesmo (a cessação, fisco.cessacao —
   irs.js:irsCessacao), ou ao termo estipulado (c.end) quando não a há, ou até
   hoje, num terminado sem fim escrito. Contava sempre até ao c.end, e um
   contrato que acabou a 30/06 com o termo em 2029 pedia as rendas de julho a
   hoje, que nunca existiram (N031).
   Recebe: c — o contrato.
   Devolve: o plano ({id, virtual, every, next, end, name, tx}), ou null quando
   o contrato não terminou, não tem renda nem início, ou tem planeado. */
function ctPlanoTerminado(c){
  if(!c||ctEstado(c)!=='terminado'||!(c.rent>0)||!/^\d{4}-\d{2}-\d{2}$/.test(String(c.start||'')))return null;
  if(ctRecOf(c))return null;
  const from=Math.max(1,Math.min(31,c.payDay||1)),tx=ctMoldeDaRenda(c);
  return {id:'ct-fim:'+c.id,virtual:true,every:'month',next:dayInMonth(Number(c.start.slice(0,4)),Number(c.start.slice(5,7))-1,from),
    until:'',end:irsCessacao(c).data||c.end||today(),name:tx.label,tx};
}
/* As rendas que faltam a um contrato terminado: as datas do plano dele
   (ctPlanoTerminado) sem renda registada nesse mês (datasEmFalta).
   Recebe: c — o contrato.
   Devolve: array de datas AAAA-MM-DD; vazio quando não é o caso. */
function ctRendasEmFalta(c){
  const r=ctPlanoTerminado(c);
  return r?datasEmFalta(r):[];
}
/* As rendas por registar de qualquer contrato, para o botão da ficha
   (contrato.js:ctValores). Num terminado, as do plano dele (ctRendasEmFalta).
   Num em vigor, as do planeado da renda desde o início do contrato
   (datasEmFalta), e também no que continua depois do termo
   (ctRendaDepoisDoTermo), que guarda o planeado — o planeado de um contrato novo arranca no mês corrente, e
   até ao dia da renda nem há linha por confirmar em Planeados, por isso a
   janela que abre ao adicioná-lo era o único caminho até elas (pedido de
   2026-11-14). Só com duas ou mais, como no ⋯ da linha por confirmar: uma só é
   a deste mês, que o «Registar renda» já trata.
   Recebe: c — o contrato.
   Devolve: {datas, recId} — as datas AAAA-MM-DD e o id do planeado (vazio num
   terminado); datas vazio quando não há nada a mostrar. */
function ctRendasPorRegistar(c){
  const fim=ctRendasEmFalta(c);
  if(fim.length)return {datas:fim,recId:''};
  const r=c&&(ctEstado(c)!=='terminado'||ctRendaDepoisDoTermo(c))&&servicoLigado('recurring')?ctRecOf(c):null;
  const d=r&&!(r.tx||{}).loanId?datasEmFalta(r):[];
  return d.length>=2?{datas:d,recId:r.id}:{datas:[],recId:''};
}
/* Mantém a recorrência automática da renda de um contrato: cria-a, atualiza-a
   ou remove-a conforme o contrato esteja ativo, com renda e com o automático
   ligado (autoRec). A janela payDay..payDayTo dá as datas; rendas antecipadas
   adiam a primeira ocorrência. A atualização passa pelo aplicaPlanoNaRec, o
   mesmo das prestações: despejar o modelo inteiro por cima apagava a divisão
   entre proprietários que o utilizador tinha dado à renda (o modelo traz
   split:null) e a categoria escolhida à mão. Antes, passa à frente as
   ocorrências já vencidas dos encargos do imóvel que o contrato põe a cargo
   do inquilino (recSaltarEncargosDoInquilino, Q13). Mexe em db.recurring —
   quem chama grava.
   Recebe: c — o contrato a sincronizar (objeto de db.contracts).
   Devolve: nada — mexe em db.recurring; quem chama grava. */
function syncContractRec(c){
  /* os encargos do imóvel que este contrato põe a cargo do inquilino (Q13)
     deixam de se pedir ao senhorio nos meses em que ele está em vigor */
  recSaltarEncargosDoInquilino((c||{}).propertyId);
  /* ctVivo e não isActive: um contrato que só começa daqui a um ano tem de
     ter a renda marcada desde já. Com o isActive, ela era apagada no arranque
     seguinte — e com ela a divisão entre proprietários e a categoria que a
     pessoa lhe tinha dado. O cálculo do «next», logo abaixo, já nunca marca
     nada antes do início. */
  /* nem o que continua depois do termo (ctRendaDepoisDoTermo): esse fica,
     sem fim, até alguém o renovar ou terminar (D15) */
  const depois=ctRendaDepoisDoTermo(c),fimDoPlano=depois?'':(c.end||'');
  const r=ctRecOf(c),want=(ctVivo(c)||depois)&&c.rent>0&&c.autoRec!==false;
  if(!want){if(r)db.recurring=db.recurring.filter(x=>x.id!==r.id);return}
  const from=Math.max(1,Math.min(31,c.payDay||1)),to=Math.max(from,Math.min(31,c.payDayTo||from));
  const tx=ctMoldeDaRenda(c);
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
  if(r){
    /* com retenção na fonte, o montante é o que entra (recRendaComRetencao) */
    const v=recRendaComRetencao(r,c);tx.amount=v.amount;
    aplicaPlanoNaRec(r,tx,tx.label);r.end=fimDoPlano;
    if(v.retencao!==(Number(r.tx.retencao)||0))r.tx.retencao=v.retencao;
    /* se os dias da janela mudarem no contrato, a janela acompanha (mantendo o mês em curso) */
    if(r.next){const d=new Date(r.next+'T00:00:00');r.next=dayInMonth(d.getFullYear(),d.getMonth(),from);r.until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
    /* O cursor acompanha o contrato nos DOIS sentidos, e nunca passa por cima
       de um mês já lançado. Chegou a empurrar só para a frente, com medo de
       ressuscitar confirmações — mas uma confirmação não é um estado do
       planeado, é um movimento com registo próprio: o cursor não lhe toca. O
       único mal era voltar a pedir um mês já lançado, e é precisamente isso
       que o cursorDaRenda não deixa acontecer. E não recua para antes do
       chão do «Começar a partir de hoje» (recDesde), no dia de pagamento
       desse mês: sem isto, o arranque seguinte voltava a pedir os meses
       largados de propósito. */
    const desde=recDesde(r),chaoRec=desde?dayInMonth(Number(desde.slice(0,4)),Number(desde.slice(5,7))-1,from):'';
    const x=cursorDaRenda(c,r.next,chaoRec&&(!minNext||minNext<chaoRec)?chaoRec:minNext,from,depois);
    if(!x){db.recurring=db.recurring.filter(y=>y.id!==r.id);return}
    if(x!==r.next){const d=new Date(x+'T00:00:00');r.next=x;r.until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
    return}
  /* primeira janela: este mês se ainda não passou; senão o mês que vem; nunca antes do início do contrato */
  const t=new Date(today()+'T00:00:00');let y=t.getFullYear(),m=t.getMonth();
  if(today()>dayInMonth(y,m,to)){m++;if(m>11){m=0;y++}}
  let next=dayInMonth(y,m,from),until=to>from?dayInMonth(y,m,to):'';
  const x0=cursorDaRenda(c,next,minNext,from,depois);
  if(!x0)return;                   // um contrato que já acabou não estreia planeado nenhum
  if(x0!==next){const d=new Date(x0+'T00:00:00');next=x0;until=to>from?dayInMonth(d.getFullYear(),d.getMonth(),to):''}
  db.recurring=db.recurring||[];
  db.recurring.push(normRec({auto:true,name:tx.label,autoName:tx.label,every:'month',next,until,end:fimDoPlano,tx}));
}
/* O montante e a retenção do planeado da renda de um contrato (D23). A renda
   do contrato (c.rent) é a renda bruta, e o movimento guarda o que entrou: com
   retenção na fonte no planeado, o montante é a renda menos a retenção
   (irs-papeis.js:rendaBruta soma-as de volta). Era sempre a renda inteira, e
   a retenção por cima: 1 000 € de renda com 250 € retidos davam 1 250 € de
   renda ilíquida no Anexo F. Quando a renda do contrato muda, a retenção
   acompanha-a na mesma proporção (é uma taxa da renda: 25 %). Um planeado com
   o montante ainda igual à renda inteira (o que a app lá punha) fica com a
   retenção que tem, e o montante passa a ser a renda menos ela.
   Recebe: r — o planeado da renda (null quando ainda não existe); c — o contrato.
   Devolve: {amount, retencao} — em euros, ao cêntimo; retencao 0 sem retenção. */
function recRendaComRetencao(r,c){
  const renda=r2(Number((c||{}).rent)||0),t=(r&&r.tx)||{};
  let ret=r2(Number(t.retencao)||0);
  if(!(ret>0)||!(renda>0))return {amount:renda,retencao:ret>0?ret:0};
  const a=r2(Number(t.amount)||0),bruto=r2(a+ret),difere=(x,y)=>Math.abs(x-y)>0.005;
  if(difere(bruto,renda)&&difere(a,renda)&&bruto>0)ret=r2(ret*renda/bruto);
  ret=Math.min(ret,renda);
  return {amount:r2(renda-ret),retencao:ret};
}
/* A renda do contrato num mês, quando se sabe que é a de hoje (c.rent): sem
   atualização anual (c.increase vazio ou 0), desde o início do contrato; com
   ela, desde o último aniversário do início até hoje — antes dele a renda
   era outra, e a app não guarda a história. É a renda com que o Confirmar
   (recAbaixoDoContrato) e o formulário da renda (movimento.js:txRendaAbaixo,
   N080) comparam o que entra: um planeado com o que a gestora transfere
   (950 € numa renda de 1 000 €) não é a renda do recibo.
   Recebe: c — o contrato; mes — 'AAAA-MM'.
   Devolve: a renda em euros (número), ou 0 quando não se sabe (antes do
   início, antes da última atualização, sem renda). */
function recRendaDoContrato(c,mes){
  const renda=r2(Number((c||{}).rent)||0),ini=String((c||{}).start||'');
  if(!(renda>0)||!/^\d{4}-\d{2}$/.test(String(mes||'')))return 0;
  const temIni=/^\d{4}-\d{2}-\d{2}$/.test(ini);
  if(temIni&&mes<ini.slice(0,7))return 0;
  if(c.increase==null||Number(c.increase)===0||!temIni)return renda;
  const h=today();let y=Number(h.slice(0,4));
  if(String(y)+ini.slice(4)>h)y--;
  const desde=y<Number(ini.slice(0,4))?ini.slice(0,7):String(y)+ini.slice(4,7);
  return mes>=desde?renda:0;
}
/* A renda seguinte com a retenção que a anterior teve (N081). Com janeiro e
   fevereiro registados com o retido na fonte e o planeado sem retenção, o
   Confirmar de março gravava a renda sem ela, e o aviso da Declaração calava-
   se (já havia retenções no ano). A proposta: a última renda registada deste
   contrato antes do mês do planeado (pelo mês a que respeita, sem as pagas só
   em parte) teve retenção, e o planeado não tem; a mesma taxa sobre a renda
   do contrato nesse mês (recRendaDoContrato) ou, sem ela, sobre o montante
   do planeado.
   Recebe: r — o planeado.
   Devolve: {amount, retencao, mes, retAntes, brutaAntes} — o que entra, o
   retido, o mês da renda anterior e o que ela teve —, ou null. */
function recRetencaoProposta(r){
  const t=(r&&r.tx)||{},mes=recPeriodo(r);
  if(t.kind!=='income'||!t.contractId||!mes||(Number(t.retencao)||0)>0)return null;
  const c=contract(t.contractId);
  if(!c||irsReceitaDe(Object.assign({},t,{date:r.next})).papel!=='renda')return null;
  const ant=(db.transactions||[]).filter(x=>x&&x.contractId===c.id&&ehRenda(x)&&!x.parcial&&mesDaRenda(x)<mes)
    .sort((a,b)=>mesDaRenda(b).localeCompare(mesDaRenda(a))||String(b.date||'').localeCompare(String(a.date||'')))[0];
  const ret=ant?r2(Number(ant.retencao)||0):0,bruta=ant?r2(rendaBruta(ant)):0;
  if(!(ret>0)||!(bruta>0))return null;
  const base=r2(recRendaDoContrato(c,mes)||Number(t.amount)||0);
  if(!(base>0))return null;
  const nova=Math.min(base,r2(base*ret/bruta));
  return {amount:r2(base-nova),retencao:nova,mes:mesDaRenda(ant),retAntes:ret,brutaAntes:bruta};
}
/* Leva a retenção na fonte ao planeado da renda de um contrato: a taxa sobre
   a renda do contrato, e o montante passa a ser o que entra (D23; o
   syncContractRec mantém-na quando a renda muda, recRendaComRetencao). Só a
   quem pode alterar o planeado.
   Recebe: c — o contrato; taxa — a percentagem da renda retida (ex.: 25).
   Devolve: true se mudou o planeado; false sem planeado, sem renda, sem
   permissão ou com uma taxa fora de (0, 100). */
function recLevarRetencao(c,taxa){
  const r=c?ctRecOf(c):null,tx=Number(taxa),renda=r2(Number((c||{}).rent)||0);
  if(!r||!r.tx||!(tx>0)||tx>=100||!(renda>0))return false;
  if(!podeEditar(c.propertyId,'rec.add',r))return false;
  const ret=r2(renda*tx/100);
  r.tx.retencao=ret;r.tx.amount=r2(renda-ret);
  return true;
}
/* As taxas de retenção que um contrato pode ter num ano: as do bloco
   retencao da versão desse ano (irs-AAAA.js), pelo fisco-avisos.js:
   fiscoAvRetencaoCerta quando a Declaração está nesta conta (a renda
   moderada só nas rendas que cabem nela); sem ela, a taxa geral.
   Recebe: c — o contrato; ano — o ano (número).
   Devolve: {taxas:[%], minimo:€} — taxas vazio quando a versão não as diz. */
function recTaxasDeRetencao(c,ano){
  const certa=servicoLigado('fisco')?fiscoAvRetencaoCerta(c,{date:today()},ano):null;
  if(certa)return {taxas:certa.taxas.filter(x=>Number(x)>0),minimo:Number(certa.minimo)||0};
  const R=(irsAno(ano)||{}).retencao;
  return {taxas:R&&Number(R.taxa)>0?[Number(R.taxa)]:[],minimo:0};
}
/* Ao marcar «Retém IRS na fonte» na ficha de um inquilino (pessoas.js),
   propõe levar a retenção ao planeado da renda dos contratos dele que estão
   em vigor e cujo planeado ainda não a tem (N081): sem isto, cada Confirmar
   registava a renda inteira sem retido, e as Retenções na fonte do Anexo F
   ficavam a 0 €. Uma folha com a taxa (ou as taxas) do ano e «Agora não»;
   escolhida, recLevarRetencao em cada um, com Anular. Uma retenção abaixo do
   mínimo da versão não se propõe.
   Recebe: tid — o id do inquilino.
   Devolve: true se abriu a pergunta; false quando não há o que propor. */
function recPropoeRetencaoDoInquilino(tid){
  if(!tid)return false;
  const ano=Number(today().slice(0,4));
  const alvos=(db.contracts||[]).filter(c=>c&&(c.tenantIds||[]).indexOf(tid)>-1&&Number(c.rent)>0&&(ctVivo(c)||ctRendaDepoisDoTermo(c)))
    .map(c=>({c,r:ctRecOf(c),tx:recTaxasDeRetencao(c,ano)}))
    .filter(x=>x.r&&x.r.tx&&!((Number(x.r.tx.retencao)||0)>0)&&x.tx.taxas.length&&podeEditar(x.c.propertyId,'rec.add',x.r));
  if(!alvos.length)return false;
  const taxas=[...new Set([].concat(...alvos.map(x=>x.tx.taxas)))].sort((a,b)=>b-a);
  const um=alvos.length===1?alvos[0]:null;
  const cabe=(x,tx)=>x.tx.taxas.indexOf(tx)>-1&&!(x.tx.minimo>0&&r2(Number(x.c.rent)*tx/100)<x.tx.minimo);
  const moderada=Number(((irsAno(ano)||{}).retencao||{}).moderada)||0;
  const opts=taxas.filter(tx=>alvos.some(x=>cabe(x,tx))).map(tx=>{
    const ret=um?r2(Number(um.c.rent)*tx/100):0;
    return {v:tx,label:'Reter '+dec(tx)+' %'+(taxas.length>1&&tx===moderada?' (renda moderada)':''),icon:'check',
      sub:um?euro2(r2(Number(um.c.rent)-ret))+' entram e '+euro2(ret)+' ficam retidos, em cada renda.'
        :'Nas rendas planeadas de '+listaE(alvos.filter(x=>cabe(x,tx)).map(x=>ctName(x.c)))+'.'};
  });
  if(!opts.length)return false;
  opts.push({v:0,label:'Agora não',icon:'x',sub:'O planeado fica sem retenção: o retido regista-se em cada renda, ao confirmar.'});
  const nomes=listaE(alvos.map(x=>ctName(x.c)));
  pickModal('O inquilino retém IRS: e a renda planeada?',opts,o=>{
    closeModal();
    if(!o||!(o.v>0))return;
    const antes=alvos.map(x=>({id:x.r.id,amount:x.r.tx.amount,retencao:x.r.tx.retencao}));
    const feitos=alvos.filter(x=>cabe(x,o.v)&&recLevarRetencao(x.c,o.v));
    if(!feitos.length)return;
    save();buildNav();render();
    comDesfazer('A renda planeada passa a ter '+dec(o.v)+' % retidos na fonte.',()=>{
      antes.forEach(a=>{const r=(db.recurring||[]).find(y=>y.id===a.id);if(r&&r.tx){r.tx.amount=a.amount;r.tx.retencao=a.retencao}});
    });
  },`<div class="hint u-fs-14px">Quem retém entrega à AT parte da renda por ti, e o recibo diz quanto. ${um?'A renda planeada de '+esc(nomes)+', '+euro2(um.c.rent)+', está':'As rendas planeadas de '+esc(nomes)+' estão'} sem retenção: com ela, o Confirmar regista o que entra e o retido, e as Retenções na fonte do Anexo F ficam certas.</div>`);
  return true;
}
/* Varre as recorrências automáticas de contratos: apaga as órfãs (o contrato
   já não existe) e sincroniza cada contrato com syncContractRec. Uma
   prestação automática que ficou sem hipoteca mas se identifica sem dúvida
   (recLoanId) escapa: é o syncAllLoanRecs, logo a seguir, que lha devolve —
   apagá-la levava com ela a divisão e o pagador que o utilizador lhe deu. Os
   planeados da ficha do imóvel (tx.propRec) são do syncAllPropRecs: não são
   órfãos de contrato nenhum.
   Devolve: nada — mexe em db.recurring; quem chama grava. */
function syncAllContractRecs(){
  // sem os Contratos nesta conta cada planeado de renda pareceria órfão: não se toca em nada
  if(!servicoLigado('contracts'))return;
  (db.recurring||[]).slice().forEach(r=>{if(r.auto&&!(r.tx||{}).loanId&&!(r.tx||{}).propRec&&!recLoanId(r)&&(!r.tx.contractId||!db.contracts.some(c=>c.id===r.tx.contractId)))db.recurring=db.recurring.filter(x=>x.id!==r.id)});
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
  /* um início que passou para o futuro leva a próxima com ele: não há
     prestação antes de o crédito começar (credito.js:primeiraPrestacao) */
  const chao=l.start&&l.start>today()?primeiraPrestacao(l,today()):'';
  if(r){aplicaPlanoNaRec(r,tx,name);
    if(r.next){const d=new Date(r.next+'T00:00:00');r.next=dayInMonth(d.getFullYear(),d.getMonth(),day)}
    if(chao&&(!r.next||r.next<chao))r.next=chao;
    return}
  db.recurring=db.recurring||[];
  db.recurring.push(normRec({auto:true,name,autoName:name,every:'month',next:primeiraPrestacao(l,today()),tx}));
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
  // sem Imóveis ou Créditos nesta conta cada prestação automática pareceria órfã: não se toca em nada
  if(!servicoLigado('properties')||!servicoLigado('credits'))return;
  const live=id=>db.properties.some(p=>(p.loans||[]).some(l=>l.id===id));
  (db.recurring||[]).slice().forEach(r=>{if(r.auto&&(r.tx||{}).loanId&&!live(r.tx.loanId))db.recurring=db.recurring.filter(x=>x.id!==r.id)});
  repararRecsSemCredito();
  db.properties.forEach(p=>(p.loans||[]).forEach(l=>syncLoanRec(p,l)));
}
/* ---- despesas fixas da ficha do imóvel: recorrência automática, tal como as rendas e as prestações ----
   Recebe: p — o imóvel (objeto de db.properties); kind (opcional) — 'imi',
   'condominio' ou 'seguro', para só os dessa origem.
   Devolve: os planeados automáticos desse imóvel (array de objetos de
   db.recurring), as prestações do IMI pela ordem. */
function propRecsOf(p,kind){return (db.recurring||[]).filter(r=>r.auto&&r.tx&&r.tx.propRec&&(!kind||r.tx.propRec===kind)&&r.tx.propertyId===p.id).sort((a,b)=>(a.tx.propRecN||0)-(b.tx.propRecN||0))}
/* As prestações do IMI pela lei: até 100 € uma só, em maio; de 100 a 500 €
   duas, em maio e novembro; acima de 500 € três, em maio, agosto e novembro.
   Divide-se ao cêntimo, e os cêntimos que sobram ficam na primeira: 1 000 €
   em três são 333,34 + 333,33 + 333,33.
   Recebe: imi — o IMI do ano (euros).
   Devolve: array de {n (1..), mes (1–12), amount}; vazio sem IMI. */
function imiPrestacoes(imi){
  const v=Math.round((Number(imi)||0)*100)/100;if(!(v>0))return [];
  const meses=v<=100?[5]:v<=500?[5,11]:[5,8,11],n=meses.length,cada=Math.round(v/n*100)/100;
  return meses.map((mes,i)=>({n:i+1,mes,amount:i?cada:Math.round((v-cada*(n-1))*100)/100}));
}
/* O último dia de um mês: deste ano, ou do que vem se esse dia já passou.
   Recebe: mes — o mês (1–12).
   Devolve: a data em AAAA-MM-DD (texto). */
function proximoFimDoMes(mes){
  const y=Number(today().slice(0,4)),d=dayInMonth(y,mes-1,31);
  return d<today()?dayInMonth(y+1,mes-1,31):d;
}
/* Mantém os planeados automáticos de um imóvel — o IMI nas prestações da lei
   (imiPrestacoes), o condomínio todos os meses no dia 1 e o seguro uma vez
   por ano no fim do mês escolhido (ou do corrente, quando nasce) — pelo molde
   das rendas e das prestações: cria os que faltam, passa o valor aos que já
   existem sem mexer no next que a pessoa acertou (aplicaPlanoNaRec), e apaga
   os que ficaram sem valor na ficha. Quando o número de prestações do IMI
   muda, refaz as prestações do zero; quando o mês do seguro muda, o planeado
   vai para o fim desse mês. A categoria é a da árvore: o IMI pelo id do IRS
   ('impostos/imi', com o nome que tiver nesta conta — dados.js:catDoIdIrs,
   N005); o condomínio e o seguro, que não têm id, por Condomínio / Quota mensal
   e Seguros / Multirriscos ou, com a categoria noutro nome, pela categoria
   (sem id do IRS) que tem essa subcategoria — enquanto ela lá estiver,
   como a renda faz com as Rendas. Só nos imóveis de que sou dono: quem
   colabora recebe os planeados do dono com os registos da casa, e não os
   cria por ele. No fim passa à frente as ocorrências vencidas dos encargos
   que um contrato em vigor põe a cargo do inquilino
   (recSaltarEncargosDoInquilino, Q13). Mexe em db.recurring — quem chama grava.
   Recebe: p — o imóvel (objeto de db.properties).
   Devolve: nada — mexe em db.recurring; quem chama grava. */
function syncPropRecs(p){
  if(!p||!cargoDe(p.id).dono)return;
  const arv=cats(),catDe=(c,s)=>{
    if(c in arv)return {category:c,sub:(arv[c]||[]).indexOf(s)>-1?s:''};
    const k=Object.keys(arv).find(x=>Array.isArray(arv[x])&&arv[x].indexOf(s)>-1&&!catIrsId('cats',x));
    return k?{category:k,sub:s}:{category:'',sub:''};
  };
  /* o IMI pelo id (N005): com os Impostos noutro nome, o planeado nasce na
     categoria certa, e o IMI vai ao campo dele */
  const imiCat=catDoIdIrs('cats','impostos/imi')||catDoIdIrs('cats','impostos')||catDe('Impostos','IMI');
  const imi=imiPrestacoes(p.imi),quer=imi.map(x=>({propRec:'imi',propRecN:x.n,amount:x.amount,every:'year',next:proximoFimDoMes(x.mes),
    name:'IMI · '+p.name+(imi.length>1?' ('+x.n+'.ª de '+imi.length+')':''),cat:{category:imiCat.category,sub:imiCat.sub}}));
  /* o mês de hoje em 1–12 é, em base 0, o mês seguinte: o dia 1 que vem */
  if(p.condominio>0){let y=Number(today().slice(0,4)),m=Number(today().slice(5,7));if(m>11){m=0;y++}
    quer.push({propRec:'condominio',propRecN:0,amount:r2(p.condominio),every:'month',next:dayInMonth(y,m,1),name:'Condomínio · '+p.name,cat:catDe('Condomínio','Quota mensal')})}
  if(p.seguro>0)quer.push({propRec:'seguro',propRecN:0,amount:r2(p.seguro),every:'year',next:proximoFimDoMes(p.seguroMes||mesAtual()),name:'Seguro · '+p.name,cat:catDe('Seguros','Multirriscos')});
  /* o número de prestações do IMI mudou: as datas e os valores são outros, refaz-se do zero */
  const nImi=propRecsOf(p,'imi').length;
  if(nImi&&nImi!==imi.length)db.recurring=db.recurring.filter(r=>!(r.auto&&r.tx&&r.tx.propRec==='imi'&&r.tx.propertyId===p.id));
  quer.forEach(q=>{
    const tx={kind:'expense',label:q.name,amount:q.amount,propertyId:p.id,category:q.cat.category,sub:q.cat.sub,split:null,propRec:q.propRec,propRecN:q.propRecN};
    const r=propRecsOf(p,q.propRec).find(x=>(x.tx.propRecN||0)===q.propRecN);
    if(r){aplicaPlanoNaRec(r,tx,q.name);
      if(q.propRec==='seguro'&&p.seguroMes&&Number(String(r.next).slice(5,7))!==p.seguroMes)r.next=q.next;
      return}
    db.recurring=db.recurring||[];
    db.recurring.push(normRec({auto:true,name:q.name,autoName:q.name,every:q.every,next:q.next,tx}));
  });
  propRecsOf(p).forEach(r=>{if(!quer.some(q=>q.propRec===r.tx.propRec&&q.propRecN===(r.tx.propRecN||0)))db.recurring=db.recurring.filter(x=>x.id!==r.id)});
  /* os que um contrato em vigor põe a cargo do inquilino não se pedem (Q13) */
  recSaltarEncargosDoInquilino(p.id);
}
// Apaga os planeados da ficha de imóveis que já não existem e sincroniza os
// dos imóveis vivos (syncPropRecs).
// Devolve: nada — mexe em db.recurring; quem chama grava.
function syncAllPropRecs(){
  // sem os Imóveis nesta conta cada planeado da ficha pareceria órfão: não se toca em nada
  if(!servicoLigado('properties'))return;
  (db.recurring||[]).slice().forEach(r=>{if(r.auto&&(r.tx||{}).propRec&&!prop(r.tx.propertyId))db.recurring=db.recurring.filter(x=>x.id!==r.id)});
  db.properties.forEach(syncPropRecs);
}
/* ---- os encargos do imóvel a cargo do inquilino (Q13, D114) ----
   O contrato diz que encargos do imóvel paga o inquilino (c.encargosInquilino,
   ids de dados.js:ENCARGOS_DO_INQUILINO). Nos meses em que esse contrato está
   em vigor, o planeado desse encargo do mesmo imóvel não se pede nem se
   confirma: quem o confirmava deduzia o que não pagou. */
/* O encargo do imóvel que um planeado paga: pelo planeado automático da ficha
   do imóvel (tx.propRec: 'imi', 'condominio', 'seguro', ids fixos) e, num
   planeado feito à mão, pela categoria que o IRS lê — o id do IMI
   (dados.js:txCatIrsId, 'impostos/imi') ou a coluna do Anexo F
   (irs-papeis.js:irsColunaDe: 'imi' ou 'condominio'). Nunca pelo nome: a
   categoria pode ter outro nesta conta. O seguro e a água, luz e gás não têm
   id nem coluna própria: feitos à mão não se reconhecem.
   Recebe: r — o planeado (ou o molde, {tx}).
   Devolve: o id do encargo ('condominio', 'imi', 'seguro'…), ou ''. */
function recEncargoDoInquilino(r){
  const t=(r&&r.tx)||{};
  if(t.kind!=='expense'||!t.propertyId)return '';
  const ids=ENCARGOS_DO_INQUILINO.map(e=>e.id);
  if(t.propRec)return ids.indexOf(t.propRec)>-1?t.propRec:'';
  if(txCatIrsId(t,true)==='impostos/imi')return 'imi';
  const col=irsColunaDe(t).col;
  return (col==='imi'||col==='condominio')&&ids.indexOf(col)>-1?col:'';
}
/* O contrato está em vigor neste mês, para os encargos que põe a cargo do
   inquilino? Do mês do início ao mês do último dia em vigor: a cessação, o
   termo de um terminado, ou o termo com as renovações (irs.js:irsFimReal).
   Um contrato que continua depois do termo (ctRendaDepoisDoTermo) não tem
   fim; um terminado sem data nenhuma não está em vigor.
   Recebe: c — o contrato; mes — 'AAAA-MM'.
   Devolve: true ou false. */
function ctEmVigorNoMes(c,mes){
  if(!c||!/^\d{4}-\d{2}$/.test(String(mes||'')))return false;
  const ini=String(c.start||'').slice(0,7);
  if(ini&&mes<ini)return false;
  const fim=String(irsFimReal(c)||'');
  if(!fim)return c.active!==false;
  if(ctRendaDepoisDoTermo(c))return true;
  return mes<=fim.slice(0,7);
}
/* Esta ocorrência do planeado é de um encargo que o inquilino paga? Um
   contrato do mesmo imóvel, em vigor no mês dela (ctEmVigorNoMes), com esse
   encargo em c.encargosInquilino (lido com cuidado: um contrato sem o campo
   não suspende nada).
   Recebe: r — o planeado; d — a data 'AAAA-MM-DD' da ocorrência.
   Devolve: o contrato que o põe a cargo do inquilino, ou null. */
function recSuspensaPeloInquilino(r,d){
  const pid=((r||{}).tx||{}).propertyId;
  if(!pid||!/^\d{4}-\d{2}-\d{2}$/.test(String(d||'')))return null;
  /* primeiro os contratos da casa com encargos marcados: sem nenhum (o caso de
     quase todos), nem se procura o encargo do planeado — isto corre a cada pintura */
  const cs=(db.contracts||[]).filter(c=>c&&c.propertyId===pid&&Array.isArray(c.encargosInquilino)&&c.encargosInquilino.length);
  if(!cs.length)return null;
  const enc=recEncargoDoInquilino(r),mes=String(d).slice(0,7);
  return enc?cs.find(c=>c.encargosInquilino.indexOf(enc)>-1&&ctEmVigorNoMes(c,mes))||null:null;
}
/* O que o Confirmar diz de um planeado de um encargo que o inquilino paga
   (recSuspensaPeloInquilino): de quem é, e até quando, sem o registar.
   Recebe: c — o contrato que o põe a cargo do inquilino.
   Devolve: a frase (texto). */
function recFraseDoInquilino(c){
  const fim=String(irsFimReal(c)||'');
  return 'Este encargo é do inquilino enquanto o contrato '+ctName(c)+' estiver em vigor'+
    (fim&&!ctRendaDepoisDoTermo(c)?' (até '+dPT(fim)+')':'')+': o planeado não o pede nesses meses. Se o pagaste tu, regista-o como despesa.';
}
/* Passa um planeado à ocorrência seguinte, sem mais nada: a largura da janela
   next..until fica; «uma só vez», ou a seguinte para lá do fim (end), sai da
   base. É o passo do recAdvance, sem o aviso e sem mexer no silêncio.
   Recebe: r — o planeado (objeto de db.recurring).
   Devolve: true se ficou, false se saiu. */
function recPassarUma(r){
  if(r.every==='once'){db.recurring=db.recurring.filter(x=>x.id!==r.id);return false}
  const gap=r.until&&r.until>r.next?Math.round((new Date(r.until+'T00:00:00')-new Date(r.next+'T00:00:00'))/864e5):0;
  r.next=nextDate(r.next,r.every);r.until=gap?addDays(r.next,gap):'';
  if(r.end&&r.next>r.end){db.recurring=db.recurring.filter(x=>x.id!==r.id);return false}
  return true;
}
/* Passa à frente, nos planeados das despesas de um imóvel, as ocorrências já
   vencidas (até hoje) de um encargo que o inquilino paga nesse mês
   (recSuspensaPeloInquilino). Sem isto o planeado ficava parado no primeiro
   mês do contrato e, quando ele acabasse, pedia de uma vez todos os meses
   que o inquilino pagou. As de hoje em diante esperam pelo dia delas: o
   contrato pode acabar antes. Só a quem é dono da casa, como o syncPropRecs:
   quem colabora não mexe nos planeados do dono, e o recPorConfirmar já não
   lhos pede.
   Recebe: pid — o id do imóvel.
   Devolve: nada — mexe em db.recurring; quem chama grava. */
function recSaltarEncargosDoInquilino(pid){
  if(!pid||!cargoDe(pid).dono)return;
  const hoje=today();
  (db.recurring||[]).slice().forEach(r=>{
    if(!r||!r.tx||r.tx.propertyId!==pid||!recEncargoDoInquilino(r))return;
    let guarda=0;
    while(guarda++<1200&&/^\d{4}-\d{2}-\d{2}$/.test(String(r.next||''))&&r.next<=hoje&&recSuspensaPeloInquilino(r,r.next)){
      if(!recPassarUma(r))break;
    }
  });
}
/* O planeado de um encargo do imóvel com a ocorrência neste mês: o que a
   pergunta da renda abaixo (movimento.js:txPerguntarRendaAbaixo) oferece
   saltar, quando o inquilino descontou o encargo na renda.
   Recebe: pid — o id do imóvel; enc — o id do encargo (ENCARGOS_DO_INQUILINO);
   mes — 'AAAA-MM'.
   Devolve: o planeado, ou null. */
function recDoEncargoNoMes(pid,enc,mes){
  if(!pid||!enc||!mes)return null;
  return (db.recurring||[]).find(r=>r&&r.tx&&r.tx.propertyId===pid&&recEncargoDoInquilino(r)===enc&&String(r.next||'').slice(0,7)===mes)||null;
}
/* Salta a ocorrência deste mês do planeado de um encargo (recDoEncargoNoMes),
   sem registar nada: o inquilino pagou-o e descontou-o na renda, e confirmá-lo
   também deduzia o mesmo dinheiro duas vezes (D114).
   Recebe: id — o id do planeado.
   Devolve: nada — mexe em db.recurring; quem chama grava. */
function recSaltarEncargo(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(r)recPassarUma(r);
}
/* ---- a renda paga só em parte (D115) ---- */
/* O planeado da renda de um contrato com a ocorrência no mês a que uma renda
   respeita: o que confirmo (recId), ou o automático do contrato (ctRecOf).
   O montante dele mais a retenção é a renda em vigor nesse mês — nunca o
   c.rent de hoje, que depois de uma atualização dava falsos alarmes nos meses
   de antes. Sem planeado nesse mês, não há com que comparar.
   Recebe: c — o contrato; mes — 'AAAA-MM'; recId (opcional) — o planeado que
   se está a confirmar.
   Devolve: o planeado, ou null. */
function recDaRendaNoMes(c,mes,recId){
  if(!c||!mes)return null;
  const r=recId?(db.recurring||[]).find(x=>x.id===recId):ctRecOf(c);
  if(!r||!r.tx||r.tx.kind!=='income'||r.tx.contractId!==c.id)return null;
  return recPeriodo(r)===mes?r:null;
}
/* O que falta da renda do mês de um planeado, depois de uma renda paga só em
   parte (t.parcial): a renda do planeado (montante mais retenção) menos as
   rendas desse contrato já registadas nesse mês (mesDaRenda); a retenção do
   resto é a do planeado menos a já retida. É o que o Confirmar regista, em
   vez da renda inteira outra vez. Um planeado abaixo da renda do contrato
   (o que a gestora transfere, N080) conta a renda do contrato quando ela se
   sabe nesse mês (recRendaDoContrato): o pagamento parcial de 950 € num
   planeado de 950 € deixava um resto de 0, e o Confirmar seguinte pedia a
   renda inteira outra vez.
   Recebe: r — o planeado.
   Devolve: {amount, retencao} do resto, ou null quando não há renda nenhuma
   desse mês (ou o planeado não é de uma renda de contrato). */
function recRestoDaRenda(r){
  const t=(r&&r.tx)||{},mes=recPeriodo(r);
  if(t.kind!=='income'||!t.contractId||!mes)return null;
  const ja=(db.transactions||[]).filter(x=>x.contractId===t.contractId&&ehRenda(x)&&mesDaRenda(x)===mes);
  if(!ja.length)return null;
  const c=contract(t.contractId);
  const bruto=Math.max(r2((Number(t.amount)||0)+(Number(t.retencao)||0)),c?recRendaDoContrato(c,mes):0),resto=r2(bruto-sum(ja.map(rendaBruta)));
  if(!(resto>0.005))return null;
  const ret=Math.min(resto,Math.max(0,r2((Number(t.retencao)||0)-sum(ja.map(x=>Number(x.retencao)||0)))));
  return {amount:r2(resto-ret),retencao:ret};
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
/* o movimento-modelo da prestação (loanRecTx) vive no motor do crédito
   (credito.js), e a pergunta pelas prestações desde o início de uma hipoteca
   (perguntarPrestacoesEmFalta, inserirPrestacoesEmFalta) nos Créditos
   (creditos.js): são movimentos numa hipoteca, e correm sem os Planeados */
/* ---- períodos em falta de um plano: a origem, o que já está, as datas ---- */
/* De onde vem a história de um plano: o início do contrato ou da hipoteca.
   A recorrência criada por eles arranca no mês corrente, por isso os meses
   anteriores não aparecem em lado nenhum sem isto.
   Nunca antes da compra da casa (a do contrato, ou a do plano): antes dela
   não há história nenhuma a registar, mesmo com um início mais antigo.
   Recebe: r — o plano recorrente ({tx, next, …}) cuja origem se procura;
   cru (opcional) — true para a origem sem o chão da compra.
   Devolve: uma data AAAA-MM-DD — o início do contrato ou da hipoteca; sem
   eles, r.next; a data de compra quando eles são antes dela; e o chão do
   «Começar a partir de hoje» (recDesde) quando é depois de tudo isso. */
function origemDoPlano(r,cru){
  const c=r.tx.contractId?contract(r.tx.contractId):null;
  let o=r.next;
  if(c&&c.start)o=c.start;
  else if(r.tx.loanId){const x=anyLoan(r.tx.loanId);if(x&&x.l.start)o=x.l.start}
  if(cru)return o;
  const compra=compraDaCasa(c?c.propertyId:r.tx.propertyId);
  if(compra&&o&&String(o)<compra)o=compra;
  /* «Começar a partir de hoje» (CW.startFromToday) larga o que vem de trás:
     o que fica antes do r.desde já não está em falta */
  const chao=recDesde(r);
  return chao&&o&&String(o)<chao?chao:o;
}
/* O chão que o «Começar a partir de hoje» deixou num planeado (r.desde): as
   datas antes dele ficam por registar de propósito, e nem o preenchimento
   nem o cursor da renda voltam a elas. Nunca passa do r.next: quem depois
   recua a próxima data à mão volta a ter o que pôs.
   Recebe: r — o planeado ({next, desde}).
   Devolve: 'AAAA-MM-DD' (texto), ou '' sem chão. */
function recDesde(r){
  const d=String((r||{}).desde||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return '';
  const n=String((r||{}).next||'');
  return /^\d{4}-\d{2}-\d{2}$/.test(n)&&n<d?n:d;
}
/* O plano começa antes da compra da casa? É o que a janela do preenchimento
   explica, para as datas não parecerem erradas ao lado do início do contrato.
   Recebe: r — o plano recorrente.
   Devolve: a data de compra em DD/MM/AAAA quando a origem do plano é antes
   dela (e o preenchimento começa nela), ou ''. */
function planoAntesDaCompra(r){
  const o=origemDoPlano(r,true),c=origemDoPlano(r);
  /* só quando é a compra que manda: com o chão do «Começar a partir de hoje»
     (recDesde) depois dela, as datas começam no chão, e a frase da compra
     dizia uma data que não é a da compra */
  const ct=r.tx.contractId?contract(r.tx.contractId):null,compra=compraDaCasa(ct?ct.propertyId:r.tx.propertyId);
  return o&&c!==o&&c===compra?dPT(c):'';
}
/* Já existe o movimento deste plano nesse mês? Num contrato, a renda desse
   mês — pela mesma regra do rendaJaLancada (só renda, e pelo mês a que
   respeita: uma caução não é a renda do mês de início); numa hipoteca, um
   pagamento dela; sem eles, um movimento do mesmo imóvel com a mesma descrição.
   Fora dos contratos o mês é também o do periodo, quando o há (o mês previsto
   que o confirmar guarda, recPeriodo), e senão o da data.
   Recebe: r — o plano recorrente; d — a data AAAA-MM-DD cujo mês se verifica.
   Devolve: true/false — se nesse mês o plano já tem o seu movimento. */
function jaRegistado(r,d){
  const mo=String(d).slice(0,7);
  /* um planeado de um grupo ou de «Todos»: o movimento dele entra partido por
     imóvel, e cada parte leva o grupo (ou «Todos») no lote */
  const alvo=r.tx.groupId?'g:'+r.tx.groupId:(r.tx.todos?'todos':'');
  return (db.transactions||[]).some(t=>{
    if(r.tx.contractId)return t.contractId===r.tx.contractId&&ehRenda(t)&&mesDaRenda(t)===mo;
    if(mesDaRenda(t)!==mo)return false;
    if(r.tx.loanId)return t.loanId===r.tx.loanId;
    if(alvo&&t.lote&&t.lote.alvo===alvo)return t.label===r.tx.label;
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
  const lista=loanPrestacoesEmFalta(x.l,db.transactions,today(),r.next||''),chao=recDesde(r);
  /* as de antes do «Começar a partir de hoje» ficam por registar */
  return lista.filter(p=>(!chao||p.date>=chao)&&!recDepoisDaVenda(r,p.date));
}
/* As datas do plano que já passaram sem movimento registado, da origem
   (início do contrato ou da hipoteca) até hoje, respeitando o fim do plano.
   Numa hipoteca são as datas da lista simulada (planoPrestacoesEmFalta);
   nas outras, período a período a partir da origem (que nunca é antes da
   compra da casa: origemDoPlano), saltando os meses em que já há movimento.
   O teto de 600 períodos fica com os MAIS RECENTES, até hoje: andava da
   origem para a frente e parava aos 600, e um contrato «desde 1870» propunha
   as rendas de 1870 a 1919 (ticket de QA a3a6d2d4). O guarda das voltas
   evita ciclos com datas estragadas.
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
  /* primeiro as datas (só contas de calendário), guardando as 600 últimas;
     só depois se pergunta a cada uma se já tem movimento */
  const datas=[];let guard=0;
  while(d&&d<=t&&guard++<100000){
    datas.push(d);
    if(datas.length>600)datas.shift();
    if(r.every==='once')break;
    const seg=nextDate(d,r.every);
    if(!(seg>d))break;
    d=seg;
    if(r.end&&d>r.end)break;
  }
  /* nem as de um encargo que o inquilino pagou nesse mês (Q13) */
  return datas.filter(x=>!jaRegistado(r,x)&&!recDepoisDaVenda(r,x)&&!recSuspensaPeloInquilino(r,x));
}
/* O dia em que foi vendido o imóvel de um planeado (p.vendido, que o «Marcar
   como vendido» escreve; dados.js:imovelVendido), também quando a venda está
   marcada para um dia que ainda não chegou.
   Recebe: r — o planeado (ou o molde, {tx}).
   Devolve: 'AAAA-MM-DD', ou '' sem imóvel, sem venda ou com a venda desfeita. */
function recVendidoEm(r){
  const pid=((r||{}).tx||{}).propertyId;if(!pid)return '';
  const p=(db.properties||[]).find(x=>x&&x.id===pid);
  const v=p&&typeof p.vendido==='string'?p.vendido:'';
  return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:'';
}
/* Esta ocorrência do planeado é de depois da venda do imóvel (D33)? Depois
   do dia da venda a casa já não é minha: o IMI, o condomínio, o seguro, a
   renda e o resto desse imóvel deixam de pedir confirmação (Pede atenção,
   Planeados, agenda, preenchimento), e as de antes continuam. Não se apaga
   nada: é a data que corta, e o «Desfazer venda» devolve-as.
   Recebe: r — o planeado; d — a data 'AAAA-MM-DD' da ocorrência.
   Devolve: true quando a casa já estava vendida nesse dia. */
function recDepoisDaVenda(r,d){
  const v=recVendidoEm(r);
  return !!v&&/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))&&String(d)>v;
}
/* O planeado acabou com a venda do imóvel? A próxima ocorrência dele já é
   de depois do dia da venda (recDepoisDaVenda), e por isso não volta a
   pedir nada: a prestação da hipoteca, a renda do contrato, o IMI e o
   condomínio de um imóvel vendido. Sai da lista dos Planeados (vRecurring) e
   da «Próxima renda» da ficha do contrato (contrato.js:ctValoresDaFicha):
   chegavam lá com a próxima data depois da venda (KAN-127-6). Não se apaga
   nada — o «Desfazer venda» devolve-os; os de antes da venda continuam até
   serem confirmados.
   Recebe: r — o planeado.
   Devolve: true ou false. */
function recAcabouNaVenda(r){return !!(r&&r.next&&recDepoisDaVenda(r,r.next))}
/* O planeado está por confirmar? A data prevista já passou ou é hoje, não é
   de depois da venda do imóvel (recDepoisDaVenda), nem de um encargo que um
   contrato em vigor nesse mês põe a cargo do inquilino
   (recSuspensaPeloInquilino, Q13): esse não se pede, nem fica em atraso.
   Recebe: r — o planeado.
   Devolve: true ou false. */
function recPorConfirmar(r){
  return !!(r&&r.next&&r.next<=today()&&!recDepoisDaVenda(r,r.next)&&!recSuspensaPeloInquilino(r,r.next));
}
/* recorrências vencidas (a data prevista já passou ou é hoje), sem as de
   depois da venda do imóvel (recPorConfirmar)
   Devolve: a lista dessas recorrências (array de objetos de db.recurring). */
function recPending(){return (db.recurring||[]).filter(recPorConfirmar)}
/* silenciada: continua por confirmar em Planeados, mas não avisa nem conta no menu
   Devolve: as vencidas que não estão silenciadas (array de objetos de db.recurring). */
function recActive(){return recPending().filter(r=>!r.muted)}
/* em atraso: passou o último dia da janela sem confirmação (e não é de
   depois da venda do imóvel)
   Recebe: r — o planeado.
   Devolve: true se está em atraso. */
const recIsLate=r=>!!(recPorConfirmar(r)&&(r.until||r.next)<today());
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
  /* o passo é o do recPassarUma; só o fim de um que se repetia se diz */
  if(!recPassarUma(r)&&r.every!=='once')toast('“'+r.name+'” chegou ao fim: deixa de se repetir.');
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
/* Depois de «Recusar desta vez» (cloud/painel.js:CW.rejectRec, já com o
   recAdvance feito): numa renda automática de contrato o chão (r.desde) passa
   para a nova próxima data. Sem ele, o cursor da renda (syncContractRec, que
   recua enquanto o mês anterior não tem renda) voltava ao mês recusado no
   arranque seguinte, e a recusa desfazia-se sozinha. Só aí: os outros
   planeados não têm cursor que recue, e numa hipoteca o chão escondia ao
   «Preencher» as prestações de antes do plano, que ninguém recusou. O
   preço, numa renda: os meses sem renda de antes de um mês já pago deixam de
   ser propostos ao preencher — o cursor já não os pedia.
   Recebe: r — o planeado recusado (pode já ter saído de db.recurring).
   Devolve: nada — muda r.desde quando é o caso; quem chama grava. */
function recRecusadaFixa(r){
  if(!r||!r.auto||!(r.tx||{}).contractId||!r.next)return;
  if(!(db.recurring||[]).some(x=>x.id===r.id))return;
  if(String(r.desde||'')<r.next)r.desde=r.next;
}
/* A k-ésima ocorrência de um planeado a contar do r.next (k = 0 é o próprio
   next), presa ao dia do next: de 31/01 em diante dá 28/02 e 31/03 — o
   nextDate encadeado ficava no 28 para sempre. A semana são 7 dias; o mês, o
   trimestre e o ano contam meses, como o nextDate.
   Recebe: r — o planeado ({next, every}); k — quantas ocorrências à frente (≥ 0).
   Devolve: a data em AAAA-MM-DD (texto). */
function recDataN(r,k){
  if(!k)return r.next;
  if(r.every==='week')return addDays(r.next,7*k);
  const passo=r.every==='year'?12:r.every==='quarter'?3:1;
  const m=Number(r.next.slice(5,7))-1+passo*k;
  return dayInMonth(Number(r.next.slice(0,4))+Math.floor(m/12),m%12,Number(r.next.slice(8,10)));
}
/* «Começar a partir de hoje»: a primeira ocorrência que ainda não passou —
   a de hoje em diante, ou a que tem a janela (next..until) aberta hoje, que
   ainda não está em atraso (recIsLate) e é a que se quer registar —, com a
   largura da janela mantida, como no recAdvance. Sem nenhuma — um «uma só
   vez» que já passou, ou o fim (end) antes dela —, o planeado termina. Não
   mexe no r: quem chama aplica, e o Anular repõe o que lá estava.
   Recebe: r — o planeado ({next, until, every, end}); hoje (opcional) —
   'AAAA-MM-DD' (por omissão, o dia da app).
   Devolve: {next, until} da ocorrência (until '' sem janela), ou {fim: true}. */
function recComecarHoje(r,hoje){
  if(!r||!/^\d{4}-\d{2}-\d{2}$/.test(String(r.next||'')))return {fim:true};
  hoje=hoje||today();
  const gap=r.until&&r.until>r.next?Math.round((new Date(r.until+'T00:00:00')-new Date(r.next+'T00:00:00'))/864e5):0;
  for(let k=0;k<100000;k++){
    const next=recDataN(r,k);
    if(r.end&&next>r.end)return {fim:true};
    const until=gap?addDays(next,gap):'';
    if((until||next)>=hoje)return {next,until};
    if(r.every==='once')return {fim:true};
  }
  return {fim:true};
}
/* O que o «Começar a partir de hoje» larga: as datas em falta (datasEmFalta)
   antes da ocorrência que fica (recComecarHoje) — todas, quando o planeado
   termina. Numa hipoteca a lista simulada pára no r.next, e as do próprio
   plano daí para a frente (as que já venceram sem pagamento) contam também.
   Recebe: r — o planeado.
   Devolve: {next, until, fim, datas} — a ocorrência que fica (ou fim) e as
   datas largadas, por ordem (array de 'AAAA-MM-DD'). */
function recComecarHojeResumo(r){
  const novo=recComecarHoje(r,today()),antes=d=>novo.fim||d<novo.next;
  const datas=datasEmFalta(r).filter(antes);
  if(r&&r.next&&(r.tx||{}).loanId){
    const meses=new Set(datas.map(d=>d.slice(0,7)));
    for(let k=0;k<100000;k++){
      const d=recDataN(r,k);
      if(!antes(d)||d>today()||(r.end&&d>r.end))break;
      if(!meses.has(d.slice(0,7))&&!jaRegistado(r,d)){datas.push(d);meses.add(d.slice(0,7))}
      if(r.every==='once')break;
    }
  }
  return {next:novo.next||'',until:novo.until||'',fim:!!novo.fim,datas:datas.sort()};
}
/* Posso «Começar a partir de hoje» neste planeado? Há pelo menos uma data a
   largar; com o planeado a terminar, posso apagá-lo (num alheio, só quando o
   servidor o aceita: podeEditar com recTermina). E a renda automática de um
   contrato que acaba antes da próxima não termina aqui: o syncContractRec
   voltava a criá-la no arranque seguinte, com os meses largados em atraso —
   essa termina-se no contrato. As permissões de silenciar e recusar
   (podeEditar com 'confirmar') são de quem chama, como no pendMenuItens.
   Recebe: r — o planeado.
   Devolve: true/false. */
function recPodeComecarHoje(r){
  if(!r||!r.next)return false;
  const s=recComecarHojeResumo(r);
  if(!s.datas.length)return false;
  if(!s.fim)return true;
  if(r.auto&&(r.tx||{}).contractId)return false;
  return podeEditar((r.tx||{}).propertyId,'rec.add',r,true);
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
/* O mês a que respeita o movimento que confirmar um planeado regista: o da
   data prevista (r.next). Confirmar regista o dinheiro no dia de hoje, e a
   renda de outubro confirmada a 15 de novembro continua a ser a de outubro —
   para o cursor (rendaJaLancada, mesDaRenda) e para o IRS (fisco.js, os anos
   anteriores, só nas rendas). Vale para todos os planeados: a despesa ou a
   prestação de setembro confirmada em novembro é a de setembro para o
   jaRegistado, senão o «Preencher N em falta» dava novembro por registado.
   Recebe: r — a recorrência a confirmar.
   Devolve: 'AAAA-MM' (texto), ou '' sem data prevista. */
function recPeriodo(r){
  return /^\d{4}-\d{2}/.test(String((r&&r.next)||''))?String(r.next).slice(0,7):'';
}
/* Confirmar sem abrir: cria o movimento com a data de hoje (o dia em que o
   dinheiro se regista, e não a data prevista, que num planeado em atraso já
   passou; ticket de QA e8ec9555) e passa à seguinte. A renda de um contrato
   leva o mês previsto em periodo (recPeriodo). O «Preencher N em falta»
   (cloud/painel.js:fillCriar) não é confirmar: fica com a data de cada mês.
   Numa renda cujo dia previsto é de outro ano que hoje (recPedeODia), não
   regista: pergunta primeiro o dia em que entrou (recPerguntarDia), porque a
   renda conta no IRS do ano em que se recebe (D22, decisão do Martinho).
   O encargo que um contrato em vigor põe a cargo do inquilino não se confirma
   (recSuspensaPeloInquilino, Q13), e a renda de um mês pago só em parte
   regista o resto (recRestoDaRenda, D115).
   Numa renda, antes de registar, as perguntas que mudam o que se regista,
   uma de cada vez e só quando é o caso: o mês anterior com duas rendas (uma
   delas pode ser esta, paga antes do dia: N146, recDuasRendasAntes); a
   retenção que a renda anterior teve e o planeado não tem (N081,
   recRetencaoProposta); o planeado abaixo da renda do contrato (N080,
   recAbaixoDoContrato); e o dia em que entrou (D22). As respostas seguem no
   `o` para a pergunta seguinte. Com o recibo (o «Confirmar e emiti o
   recibo», recConfirmarComRecibo, D8), a renda nasce com ele marcado.
   Recebe: id — o id da recorrência a confirmar; o (opcional) — as respostas
   já dadas: {dia — o dia AAAA-MM-DD em que entrou (sem ele, hoje); recibo —
   true para marcar o recibo eletrónico; duas — o mês anterior já
   respondido; ret — a retenção aceite ({amount, retencao}) ou false;
   abaixo — a renda do contrato aceite ({amount, retencao}) ou false}; um
   texto em vez do objeto é o dia (a forma de antes).
   Devolve: nada — regista o movimento, grava e redesenha (ou abre a pergunta). */
function quickConfirmRec(id,o){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  o=typeof o==='string'?{dia:o}:o&&typeof o==='object'?o:{};
  const dia=/^\d{4}-\d{2}-\d{2}$/.test(String(o.dia||''))?String(o.dia):'';
  const recusa=recusaConfirmar(r);if(recusa)return toast(recusa);
  if(recDepoisDaVenda(r,r.next))return toast('O imóvel foi vendido a '+dPT(recVendidoEm(r))+': o planeado já não pede nada depois disso.');
  const sus=recSuspensaPeloInquilino(r,r.next);if(sus)return toast(recFraseDoInquilino(sus));
  /* sem saber a que hipoteca abate, o movimento saía sem crédito: abre-se para escolher */
  if(recSemCredito(r))return toast('Sem crédito associado — abre o planeado para escolher a hipoteca.');
  /* a mesma frase do formulário: confirmar depressa não pode aceitar o que o Guardar recusa */
  if(recCreditoPago(r))return toast('Esta hipoteca já está paga: não é possível associar novos pagamentos.');
  /* Um mês que já tem a renda deste contrato não se lança outra vez: salta
     e diz que saltou. Acontece quando a renda foi registada à mão, ou quando
     o cursor recuou com o contrato para um mês já pago. Uma caução no mês não
     é a renda dele (rendaJaLancada), e não o faz saltar. */
  const ct=r.tx&&r.tx.contractId?contract(r.tx.contractId):null;
  if(ct&&rendaJaLancada(ct,r.next)){
    const mes=r.next;recAdvance(r);save();buildNav();render();
    return toast('Já havia a renda deste contrato de '+mesPt(mes)+' — o planeado saltou para o seguinte.');
  }
  /* depois de um pagamento parcial, o que entra é o resto da renda, e não ela
     outra vez (D115): as perguntas de baixo não são para ele */
  const resto=recRestoDaRenda(r);
  /* As perguntas abrem depois de quem chamou acabar: o «Pede atenção» refaz
     a janela dele a seguir ao Confirmar (notificacoes.js), e a pergunta tem
     de ficar por cima */
  if(!resto&&!o.duas){const d=recDuasRendasAntes(r);if(d){setTimeout(()=>recPerguntarDuas(id,o,d),0);return}}
  if(!resto&&o.ret===undefined){const p=recRetencaoProposta(r);if(p){setTimeout(()=>recPerguntarRetencao(id,o,p),0);return}}
  /* o que entra: o resto, a retenção aceite, a renda do contrato aceite, ou o planeado */
  const v=resto?{amount:resto.amount,retencao:resto.retencao}:o.abaixo?o.abaixo:o.ret?o.ret:null;
  if(!resto&&o.abaixo===undefined){
    const a=recAbaixoDoContrato(r,v||{amount:r.tx.amount,retencao:r.tx.retencao});
    if(a){setTimeout(()=>recPerguntarAbaixo(id,o,a),0);return}
  }
  /* a renda de dezembro confirmada em janeiro (ou a de janeiro, que pode ter
     entrado em dezembro): o ano do IRS é o do dia em que entrou, e esse
     pergunta-se; as respostas de cima esperam por ele (recRespostas) */
  if(!dia&&recPedeODia(r)){recRespostas={id,o};setTimeout(()=>recPerguntarDia(id),0);return}
  /* um planeado de um grupo ou de «Todos os imóveis» entra partido por imóvel,
     como pelo formulário (movimento.js:registarMolde); o que não se parte
     (um grupo sem imóveis) não avança o planeado */
  const mol=recTx(r,dia||today()),periodo=recPeriodo(r);if(periodo)mol.periodo=periodo;
  if(v){mol.amount=v.amount;mol.retencao=v.retencao}
  /* o «Confirmar e emiti o recibo» (D8): só onde a renda o pede */
  if(o.recibo&&recPedeRecibo(r,dia||today()))mol.recibo=true;
  const reg=registarMolde(mol);if(reg.erro)return toast(reg.erro);
  reg.partes.forEach(t=>{if(t.kind==='loan')applyLoan(t);db.transactions.push(t)});
  /* o movimento nasce aqui: o «Ver» abre a ficha dele (de vários imóveis, a primeira parte, que a ficha lê como o lote) */
  const nid=reg.partes[0].id;
  recAdvance(r);save();buildNav();render();
  avisoComVer(mol.recibo?'Renda confirmada, com o recibo eletrónico emitido.':'Movimento confirmado.','transactions',()=>chamarServico('transactions','txView',nid));
}
/* As respostas de um Confirmar que espera pela pergunta do dia (a última):
   {id, o} — o planeado e o que já se respondeu (quickConfirmRec, confirmRec).
   O «Confirmar» da folha do dia (recConfirmarNoDia) leva-as consigo; um
   Confirmar novo de outro planeado substitui-as. null sem nenhum à espera. */
let recRespostas=null;
/* O «Confirmar e emiti o recibo» do Confirmar da renda (D8, maqueta 4): o
   mesmo Confirmar, com o recibo eletrónico marcado na renda que nasce — num
   toque, sem abrir o formulário e o «Editar» da renda depois (N062). As
   perguntas do quickConfirmRec seguem como no Confirmar.
   Recebe: id — o id do planeado.
   Devolve: nada — confirma (ou abre a pergunta). */
function recConfirmarComRecibo(id){quickConfirmRec(id,{recibo:true})}
/* O Confirmar deste planeado cria uma renda que pede o recibo de renda
   eletrónico? Uma receita de um contrato com o papel que o pede
   (prazos.js:PZ_PAPEIS_RECIBO: a renda, a caução e as outras receitas
   prediais da natureza 02; nunca a caução de um
   direito real de habitação duradoura, pzCaucaoDoDhd), num contrato cujas
   rendas o pedem (prazos.js:pzPedeRecibo: declarado, fora da categoria B e do
   arrendamento rural, num imóvel em Portugal), sem a dispensa dos recibos no
   ano do dia em que entra (irs-papeis.js:irsSituacao). É o que mostra o
   «Confirmar e emiti o recibo» (D8) e o que o deixa marcar.
   Recebe: r — o planeado; dia (opcional) — o dia AAAA-MM-DD da renda (hoje
   por omissão).
   Devolve: true ou false. */
function recPedeRecibo(r,dia){
  const t=(r&&r.tx)||{};
  if(t.kind!=='income'||!t.contractId)return false;
  const c=contract(t.contractId);if(!c)return false;
  const d=/^\d{4}-\d{2}-\d{2}$/.test(String(dia||''))?String(dia):today();
  const papel=irsReceitaDe(Object.assign({},t,{date:d})).papel;
  if(PZ_PAPEIS_RECIBO.indexOf(papel)<0||pzCaucaoDoDhd(papel,c)||!pzPedeRecibo(c))return false;
  return !irsSituacao(Number(d.slice(0,4))).dispensaRecibos;
}
/* O mês antes de outro.
   Recebe: mes — 'AAAA-MM'.
   Devolve: 'AAAA-MM'. */
function recMesAnterior(mes){
  const y=Number(String(mes).slice(0,4)),m=Number(String(mes).slice(5,7));
  return m>1?y+'-'+String(m-1).padStart(2,'0'):(y-1)+'-12';
}
/* O mês antes do da renda deste planeado tem duas rendas do contrato, e a
   segunda pode ser a deste mês, paga antes do dia (N146): a de dezembro paga
   a 28/11 e registada pelo «+» com o mês da data ficou como a segunda de
   novembro, e o planeado volta a pedir dezembro — quem a confirmava por
   hábito registava uma renda que não recebeu. Só com duas ou mais rendas
   inteiras (sem as pagas só em parte) que juntas passam de uma renda e meia
   do planeado, e só quando posso alterar a mais recente.
   Recebe: r — o planeado.
   Devolve: {mes, t, n} — o mês anterior, a renda mais recente dele e quantas
   tem —, ou null. */
function recDuasRendasAntes(r){
  const tx=(r&&r.tx)||{},mes=recPeriodo(r);
  if(tx.kind!=='income'||!tx.contractId||!mes)return null;
  const c=contract(tx.contractId);if(!c)return null;
  const ant=recMesAnterior(mes);
  const rs=(db.transactions||[]).filter(x=>x&&x.contractId===c.id&&ehRenda(x)&&!x.parcial&&mesDaRenda(x)===ant)
    .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  if(rs.length<2)return null;
  const bruto=r2((Number(tx.amount)||0)+(Number(tx.retencao)||0));
  if(bruto>0&&sum(rs.map(rendaBruta))<bruto*1.5)return null;
  const t=rs[rs.length-1];
  return podeEditar(t.propertyId,'tx.add',t)?{mes:ant,t,n:rs.length}:null;
}
/* A pergunta do mês anterior com duas rendas (recDuasRendasAntes): a mais
   recente é a deste mês — passa a ser dela, e não se regista outra
   (recEraDesteMes) — ou regista-se esta (o Confirmar segue).
   Recebe: id — o id do planeado; o — as respostas já dadas; d — o que o
   recDuasRendasAntes devolveu.
   Devolve: nada — abre a folha. */
function recPerguntarDuas(id,o,d){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const este=pzMes(recPeriodo(r)),antes=pzMes(d.mes),quando=dPT(d.t.date);
  pickModal(antes.charAt(0).toUpperCase()+antes.slice(1)+' tem '+d.n+' rendas deste contrato',[
    {v:'era',label:'A de '+quando+' é a de '+este,icon:'check',sub:'Passa a ser a renda de '+este+', e não se regista outra.'},
    {v:'nova',label:'Registar a renda de '+este,icon:'plus',sub:'As '+d.n+' são de '+antes+', e a de '+este+' entrou agora.'}],
    x=>{closeModal();if(x&&x.v==='era')recEraDesteMes(id,d.t.id);else quickConfirmRec(id,Object.assign({},o,{duas:true}));recRefazAtencao()},
    `<div class="hint u-fs-14px">A renda de ${esc(este)} pode já ter entrado: a de ${quando} (${euro2(rendaBruta(d.t))}) ficou como renda de ${esc(antes)}.</div>`);
}
/* «É a deste mês», na pergunta das duas rendas: a renda mais recente do mês
   anterior passa a ser a do mês do planeado (o periodo), o planeado passa à
   seguinte sem registar nada, com Anular.
   Recebe: id — o id do planeado; tid — o id da renda.
   Devolve: nada — grava e redesenha. */
function recEraDesteMes(id,tid){
  const r=(db.recurring||[]).find(x=>x.id===id),t=(db.transactions||[]).find(x=>x.id===tid);
  if(!r||!t)return;
  const mes=recPeriodo(r),antesT=t.periodo||'',antesR=JSON.parse(JSON.stringify(r));
  t.periodo=mes;
  recAdvance(r);save();buildNav();render();
  comDesfazer('A renda de '+dPT(t.date)+' passou a ser a de '+pzMes(mes)+'.',()=>{
    const x=(db.transactions||[]).find(y=>y.id===tid);if(x)x.periodo=antesT;
    const i=(db.recurring||[]).findIndex(y=>y.id===id);
    if(i>-1)db.recurring[i]=antesR;else{db.recurring=db.recurring||[];db.recurring.push(antesR)}
  });
}
/* A pergunta da retenção (recRetencaoProposta): a renda anterior teve o
   retido na fonte e o planeado não o tem. «Também teve» regista a renda com a
   mesma taxa e leva-a ao planeado (para não voltar a perguntar); «Não teve»
   regista o planeado como está.
   Recebe: id — o id do planeado; o — as respostas já dadas; p — a proposta.
   Devolve: nada — abre a folha. */
function recPerguntarRetencao(id,o,p){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const base=r2(Number(r.tx.amount)||0),ant=pzMes(p.mes);
  pickModal('A renda de '+ant+' teve retenção na fonte',[
    {v:'sim',label:'Também teve: '+euro2(p.amount)+' e '+euro2(p.retencao)+' retidos',icon:'check',sub:'O planeado passa a pedir a renda com a retenção.'},
    {v:'nao',label:'Não teve: '+euro2(base),icon:'x',sub:'Regista o que o planeado diz, sem retenção.'}],
    x=>{
      closeModal();
      if(x&&x.v==='sim'){
        const rr=(db.recurring||[]).find(y=>y.id===id);
        if(rr&&rr.tx&&podeEditar((rr.tx||{}).propertyId,'rec.add',rr)){rr.tx.amount=p.amount;rr.tx.retencao=p.retencao}
        quickConfirmRec(id,Object.assign({},o,{ret:{amount:p.amount,retencao:p.retencao}}));
      }else quickConfirmRec(id,Object.assign({},o,{ret:false}));
      recRefazAtencao();
    },
    `<div class="hint u-fs-14px">Em ${esc(ant)}, o inquilino reteve ${euro2(p.retAntes)} de ${euro2(p.brutaAntes)} e entregou-os à AT por ti (vêm no recibo). O IRS conta a renda inteira, e o retido vai às Retenções na fonte. E esta renda?</div>`);
}
/* O planeado de uma renda está abaixo da renda do contrato (N080)? Quem
   escreve no planeado o que a gestora transfere (950 € numa renda de
   1 000 €) confirmava doze meses sem pergunta, e a Declaração ficava com a
   renda líquida. Só numa renda de contrato do mês corrente ou do anterior —
   onde o formulário (movimento.js:txRendaAbaixo) também compara com a renda
   do contrato —, e só quando ela se sabe (recRendaDoContrato).
   Recebe: r — o planeado; v — o que se vai registar ({amount, retencao}).
   Devolve: {renda, bruto} — a renda do contrato e a do planeado —, ou null. */
function recAbaixoDoContrato(r,v){
  const t=(r&&r.tx)||{},mes=recPeriodo(r);
  if(t.kind!=='income'||!t.contractId||!mes)return null;
  const c=contract(t.contractId);
  if(!c||irsReceitaDe(Object.assign({},t,{date:r.next})).papel!=='renda')return null;
  const hoje=today().slice(0,7);
  if(mes>hoje||mes<recMesAnterior(hoje))return null;
  const renda=recRendaDoContrato(c,mes),bruto=r2((Number((v||{}).amount)||0)+(Number((v||{}).retencao)||0));
  return renda>0&&bruto>0&&renda-bruto>0.005?{renda,bruto}:null;
}
/* A pergunta do planeado abaixo da renda do contrato (recAbaixoDoContrato):
   «A renda é a do contrato» regista-a (com a retenção na mesma proporção) e
   o planeado passa a pedi-la; «Entraram X» abre a renda no formulário, cujo
   Guardar pergunta porquê — pagamento parcial, comissão da gestora, retenção
   ou outro desconto (movimento.js:txPerguntarRendaAbaixo).
   Recebe: id — o id do planeado; o — as respostas já dadas; a — o que o
   recAbaixoDoContrato devolveu.
   Devolve: nada — abre a folha. */
function recPerguntarAbaixo(id,o,a){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const v=o.ret?o.ret:{amount:r2(Number(r.tx.amount)||0),retencao:r2(Number(r.tx.retencao)||0)};
  const ret=v.retencao>0?r2(v.retencao*a.renda/a.bruto):0,cheia={amount:r2(a.renda-ret),retencao:ret};
  const c=contract(r.tx.contractId);
  pickModal('O planeado está abaixo da renda do contrato',[
    {v:'inteira',label:'A renda é a do contrato: '+euro2(a.renda),icon:'check',sub:'Regista-a, e o planeado passa a pedir esta renda.'},
    {v:'menos',label:'Entraram '+euro2(v.amount),icon:'pen',sub:'Abre a renda para dizeres porquê: pagamento parcial, comissão da gestora, retenção ou outro desconto.'}],
    x=>{
      closeModal();
      if(x&&x.v==='inteira'){
        const rr=(db.recurring||[]).find(y=>y.id===id);
        if(rr&&rr.tx&&podeEditar((rr.tx||{}).propertyId,'rec.add',rr)){rr.tx.amount=cheia.amount;rr.tx.retencao=cheia.retencao}
        quickConfirmRec(id,Object.assign({},o,{abaixo:cheia}));
      }else if(x)confirmRec(id,Object.assign({},o,{valores:v}));
      recRefazAtencao();
    },
    `<div class="hint u-fs-14px">A renda do contrato ${esc(ctName(c))} é ${euro2(a.renda)}, e este planeado regista ${euro2(a.bruto)}. O IRS conta a renda do recibo, antes da comissão da gestora e de descontos, que se registam à parte, como despesa.</div>`);
}
/* Depois de uma resposta às perguntas do Confirmar, o «Pede atenção» de
   baixo refaz-se, como depois do Confirmar dele: a linha com o mês já
   confirmado confirmava outro ao segundo toque.
   Devolve: nada. */
function recRefazAtencao(){
  const top=modalTop();
  if(top&&top.title==='Pede atenção')notifModal(_atencaoFiltro);
}
/* O «Confirmar» de uma renda pergunta o dia em que entrou? Só numa renda (o
   papel da Declaração, irs-papeis.js:irsReceitaDe: a renda e a caução, que
   contam no ano em que se recebem) cujo dia previsto (r.next) é de outro ano
   que hoje: a de dezembro confirmada em janeiro entrou em dezembro ou em
   janeiro, e cada um é a Declaração de um ano diferente (D22, decisão do
   Martinho). E na renda de janeiro confirmada em janeiro (N146): paga antes
   do dia — o regime supletivo do Código Civil (art. 1075.º n.º 2) vence-a no
   1.º dia útil do mês anterior —, pode ter entrado ainda em dezembro, e é do
   IRS desse ano. Nos outros meses do mesmo ano a data de hoje serve (o ano do
   IRS é o mesmo). As prestações e as despesas não perguntam.
   Recebe: r — o planeado.
   Devolve: true ou false. */
function recPedeODia(r){
  const t=(r&&r.tx)||{},n=String((r&&r.next)||''),h=today();
  if(t.kind!=='income'||!/^\d{4}-\d{2}-\d{2}$/.test(n))return false;
  if(n.slice(0,4)===h.slice(0,4)&&n.slice(5,7)!=='01')return false;
  const papel=irsReceitaDe(Object.assign({},t,{date:n})).papel;
  return papel==='renda'||papel==='caucao';
}
/* A pergunta do dia em que a renda entrou (recPedeODia): uma folha só com o
   dia, por preencher — é ele que decide o ano da Declaração, e um valor já
   escrito confirmava-se sem ninguém o ler. O mês a que respeita fica o
   previsto (recPeriodo). Na renda de janeiro do ano de hoje, diz que a que
   entrou ainda em dezembro é do IRS do ano anterior.
   Recebe: id — o id do planeado.
   Devolve: nada — abre a folha. */
function recPerguntarDia(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const n=String(r.next||''),janeiro=n.slice(0,4)===today().slice(0,4);
  openModal('Em que dia entrou?',
    `<div class="form"><div class="hint u-fs-14px"><b>${esc(r.name)}</b>, prevista para ${dPT(r.next)}, conta no IRS do ano em que a recebeste, e não no do mês a que respeita${janeiro?': se entrou ainda em dezembro, é do IRS de '+(Number(n.slice(0,4))-1):''}. Indica o dia em que entrou.</div>
    <label>Dia em que entrou <span class="req">*</span><input id="rec_dia" type="date" value="" max="${today()}"></label>
    <div class="hint u-mt-n6px">O mês a que respeita fica o da renda prevista, ${esc(mesPt(r.next))}.</div></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>`+
    `<button class="btn primary" data-toca="dados" data-click="recConfirmarNoDia('${jsq(id)}')">Confirmar</button>`);
}
/* O «Confirmar» da pergunta do dia (recPerguntarDia): o dia é obrigatório,
   não passa de hoje nem fica antes da compra da casa (a regra do formulário
   do movimento); fecha a folha e segue com esse dia e as respostas que
   esperavam por ele (recRespostas): o Confirmar (quickConfirmRec) ou, vindo
   do «Rever» e do «Confirmar» da ficha, o formulário com esse dia
   (confirmRec). O «Pede atenção» de baixo refaz-se (recRefazAtencao).
   Recebe: id — o id do planeado.
   Devolve: nada — confirma, ou diz o erro junto ao campo. */
function recConfirmarNoDia(id){
  const dia=String(val('rec_dia')||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))return falhaCampo('rec_dia','Indica o dia em que a renda entrou.');
  if(dia>today())return falhaCampo('rec_dia','O dia em que entrou não pode ser depois de hoje.');
  const r=(db.recurring||[]).find(x=>x.id===id),compra=r?compraDaCasa((r.tx||{}).propertyId):'';
  if(compra&&dia<compra)return falhaCampo('rec_dia','O imóvel foi comprado a '+dPT(compra)+': uma receita não pode ser de antes.');
  const o=Object.assign({},recRespostas&&recRespostas.id===id?recRespostas.o:{},{dia});
  recRespostas=null;
  closeModal();
  if(o.rever)confirmRec(id,o);else quickConfirmRec(id,o);
  recRefazAtencao();
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
/* Abrir para rever antes de confirmar. A data começa no dia de hoje, como no
   Confirmar (quickConfirmRec), e continua editável; a renda de um contrato
   traz o mês previsto no «Mês a que respeita» (recPeriodo) — sem ele, o
   formulário tirava-o da data de hoje (movimento.js:prefill). Num mês pago
   só em parte, o montante e a retenção são o resto (recRestoDaRenda); o
   encargo que o inquilino paga não abre (recSuspensaPeloInquilino).
   É o «Rever», o «Confirmar» da ficha do planeado (recView) e o toque no
   «Por confirmar» da ficha do imóvel. Numa renda que pede o dia em que
   entrou (recPedeODia: a de dezembro em janeiro, a de janeiro), pergunta-o
   primeiro, como o Confirmar (N026): o formulário abria com o dia de hoje, e
   a renda de dezembro guardada assim ia à Declaração do ano seguinte; abre
   depois com o dia dito, e o Guardar não volta a perguntar enquanto a data
   for essa (movimento.js, txModo.diaPerguntado). Com a renda anterior a ter o
   retido na fonte e o planeado sem ele, abre já com a retenção
   (recRetencaoProposta, N081), que se vê e se corrige no campo.
   Recebe: id — o id da recorrência a confirmar; o (opcional) — as respostas
   do Confirmar ({dia, recibo, ret, valores: o montante e a retenção com que
   abre}).
   Devolve: nada — abre o formulário do movimento em modo de confirmação (ou a pergunta do dia). */
function confirmRec(id,o){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  o=typeof o==='string'?{dia:o}:o&&typeof o==='object'?o:{};
  const dia=/^\d{4}-\d{2}-\d{2}$/.test(String(o.dia||''))?String(o.dia):'';
  const recusa=recusaConfirmar(r);if(recusa)return toast(recusa);
  if(recDepoisDaVenda(r,r.next))return toast('O imóvel foi vendido a '+dPT(recVendidoEm(r))+': o planeado já não pede nada depois disso.');
  const sus=recSuspensaPeloInquilino(r,r.next);if(sus)return toast(recFraseDoInquilino(sus));
  if(!dia&&recPedeODia(r)){recRespostas={id,o:Object.assign({},o,{rever:true})};setTimeout(()=>recPerguntarDia(id),0);return}
  const preset=Object.assign({},JSON.parse(JSON.stringify(r.tx)),{date:dia||today(),label:r.tx.label||r.name});
  const periodo=recPeriodo(r);if(periodo)preset.periodo=periodo;
  /* depois de um pagamento parcial, o formulário abre com o resto (D115) */
  const resto=recRestoDaRenda(r);
  if(resto){preset.amount=resto.amount;preset.retencao=resto.retencao}
  else if(o.valores){preset.amount=o.valores.amount;preset.retencao=o.valores.retencao}
  else{const p=o.ret===false?null:o.ret||recRetencaoProposta(r);if(p){preset.amount=p.amount;preset.retencao=p.retencao}}
  if(o.recibo&&recPedeRecibo(r,dia||today()))preset.recibo=true;
  txModal({kind:r.tx.kind,propId:r.tx.propertyId,ctId:r.tx.contractId,preset,modo:'confirmar',recId:id,diaPerguntado:dia});
}
/* Onde fica o movimento de um molde (um planeado ou um modelo), na ficha e no
   cartão: o imóvel; o grupo; «Todos os imóveis» num molde de todos os imóveis
   (e num acerto sem imóvel, que é de todos); ou «Sem imóvel» — o movimento
   avulso, que só conta nos totais. Eram o imóvel ou o grupo, e um molde sem
   nenhum dos dois não dizia nada.
   Recebe: t — o tx do molde.
   Devolve: o texto, por escapar; '' com um imóvel que já não está nesta base. */
function imovelDoMolde(t){
  t=t||{};
  if(t.propertyId)return propName(t.propertyId);
  if(t.groupId){const g=grp(t.groupId);return g?g.name:'Grupo que não está nesta conta'}
  return t.todos||t.kind==='settle'?'Todos os imóveis':'Sem imóvel';
}
/* O que o IRS faz ao seguro da ficha do imóvel, para a ficha do planeado
   (D06). O campo «Seguro» da ficha cria um planeado em Seguros › Multirriscos,
   e o multirriscos não é gasto do Anexo F (a AT, proc. 1115/2017: é
   facultativo). Diz-se pela coluna que a despesa teria
   (irs-papeis.js:irsColunaDe), com a nota da regra (dados.js:IRS_MAPA_NOTAS): quem mudou a
   categoria do planeado para uma que deduz não lê que não deduz.
   Recebe: t — o tx do planeado.
   Devolve: o texto (com um espaço à frente), ou '' fora do seguro da ficha ou
   quando a despesa entra no Anexo F. */
function recSeguroNoIrs(t){
  if(!t||t.propRec!=='seguro')return '';
  if(irsColunaDe(Object.assign({},t,{kind:'expense'})).col!=='nao')return '';
  const k=[t.category,t.sub].filter(Boolean).join(' / '),nota=Object.prototype.hasOwnProperty.call(IRS_MAPA_NOTAS,k)?IRS_MAPA_NOTAS[k]:'';
  return ' Não entra no Anexo F do IRS: este seguro não é um gasto que se deduza das rendas.'+(nota?' '+esc(nota):'');
}
/* O corpo da ficha de um movimento planeado.

   «O que é isto que me estão a pedir para confirmar, de quanto, de onde vem,
   e desde quando está à espera?» O «de onde vem» é o que explica porque é
   que um planeado automático volta sozinho depois de apagado. Um encargo que
   o inquilino paga nesse mês (recSuspensaPeloInquilino) diz porque não se pede.
   Recebe: id — o id do planeado.
   Devolve: o HTML do corpo, ou vazio se o planeado já não existir. */
function recFicha(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return '';
  const t=r.tx||{},sus=recSuspensaPeloInquilino(r,r.next);
  const vem=r.auto?(t.loanId?'Prestação da hipoteca '+esc(loanName(((anyLoan(t.loanId)||{}).l)||null))
    :(t.contractId&&contract(t.contractId)?'Renda do contrato '+esc(ctName(contract(t.contractId)))
    :(t.propRec?({imi:'IMI',condominio:'Condomínio',seguro:'Seguro'})[t.propRec]+' do imóvel '+esc(propName(t.propertyId))+' — o valor vive na ficha do imóvel; apagar este planeado remove-o de lá.'+recSeguroNoIrs(t):''))):'';
  return ficha([
    {tipo:'nota',valor:esc(motivoRecusa(t.propertyId,'rec.add',r))},
    t.amount?{rotulo:'Montante',valor:euro2(t.amount)}:null,
    {rotulo:'Quando',valor:dPT(r.next||'')+(r.until&&r.until!==r.next?' a '+dPT(r.until):'')+(r.every?' · '+esc(EVERY[r.every]||r.every):'')},
    {rotulo:'Estado',valor:(recIsLate(r)?'<span class="perigo">Em atraso</span> desde '+dPT(r.until||r.next||'')
      :(recPorConfirmar(r)?'Por confirmar':(recDepoisDaVenda(r,r.next)?'Imóvel vendido a '+dPT(recVendidoEm(r))
      :(sus?'Pago pelo inquilino':'Em dia'))))+(r.muted?' · silenciada':'')},
    /* o encargo que um contrato em vigor põe a cargo do inquilino (Q13) diz porque não se pede */
    sus?{tipo:'nota',valor:esc(recFraseDoInquilino(sus))}:null,
    {rotulo:'Tipo',valor:esc((KIND[t.kind]||{}).short||'')},
    /* um planeado pode estar num grupo de imóveis, ou em «Todos», em vez de num imóvel */
    {rotulo:'Imóvel',valor:esc(imovelDoMolde(t))},
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
  const podeConf=recPorConfirmar(r)&&!recusaConfirmar(r)&&!recSemCredito(r)&&!recCreditoPago(r);
  const podeEd=podeEditar(hid,'rec.add',r);
  abrirFicha({
    titulo:()=>{const x=(db.recurring||[]).find(y=>y.id===id);return x?x.name:'Planeado'},
    corpo:()=>recFicha(id),
    menu:()=>{const x=(db.recurring||[]).find(y=>y.id===id);if(!x)return '';
      const it=[];
      if(podeConf)it.push({label:'Confirmar sem rever',icon:'check',toca:'dados',act:`quickConfirmRec('${jsq(id)}')`});
      /* o «Confirmar e emiti o recibo» (D8), sem rever, na renda que o pede */
      if(podeConf&&recPedeRecibo(x))it.push({label:'Confirmar e emiti o recibo',icon:'check',toca:'dados',act:`recConfirmarComRecibo('${jsq(id)}')`});
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
    {rotulo:'Imóvel',valor:esc(imovelDoMolde(t))},
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
   confirmar e silenciar ficam no ⋯ da ficha (recView).
   Recebe: id — o id da recorrência a editar.
   Devolve: nada — abre o formulário carregado com a recorrência. */
function editRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const recusa=motivoRecusa((r.tx||{}).propertyId,'rec.add',r);
  /* Quem não pode alterar recebe a FICHA, e não o formulário do movimento com
     os campos apagados por cima. */
  if(recusa)return recView(id);
  txModal({kind:r.tx.kind,propId:r.tx.propertyId,ctId:r.tx.contractId,
    preset:Object.assign({},JSON.parse(JSON.stringify(r.tx)),{date:r.next,label:r.tx.label||r.name}),
    modo:'rec',recId:id,every:r.every,recEnd:r.end||'',until:r.until||''});
}
// Novo movimento recorrente: pergunta o tipo e abre o formulário já em modo
// recorrente (mensal por omissão), com a secção de repetição aberta.
// Devolve: nada — abre o formulário de movimento novo em modo recorrente.
function newRec(){
  newTxPick(k=>txModal({kind:k,modo:'rec',every:'month'}));
}
// Novo modelo: pergunta o tipo e abre o formulário; guardar cria um modelo
// em vez de registar um movimento.
// Devolve: nada — abre o formulário de movimento novo em modo modelo.
function newTpl(){
  newTxPick(k=>txModal({kind:k,modo:'tpl'}));
}
// Abre o formulário carregado com o modelo para o editar (guardar altera o modelo).
// Recebe: id — o id do modelo em db.templates.
// Devolve: nada — abre o formulário carregado com o modelo.
function editTpl(id){
  const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;
  txModal({kind:x.tx.kind,propId:x.tx.propertyId,ctId:x.tx.contractId,preset:JSON.parse(JSON.stringify(x.tx)),modo:'tpl',tplId:id,tplName:x.name});
}
/* Apaga a recorrência, com confirmação. Nas automáticas desliga também o
   autoRec no contrato ou na hipoteca de origem — sem isso, a sincronização
   voltava a criá-la logo a seguir. Num planeado da ficha do imóvel (IMI,
   condomínio, seguro) o campo É o planeado: apagar põe o valor a zero na
   ficha, e as prestações irmãs do IMI vão com ele — a frase di-lo antes. Os
   movimentos já registados ficam.
   Recebe: id — o id da recorrência a apagar.
   Devolve: nada — pede confirmação; ao confirmar, apaga, grava e redesenha. */
function delRec(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const recusa=motivoRecusa((r.tx||{}).propertyId,'rec.add',r,true);if(recusa)return toast(recusa);
  const isLoan=r.auto&&(r.tx||{}).loanId,pr=r.auto?(r.tx||{}).propRec:'';
  const doImovel=pr?`Este é ${({imi:'o IMI',condominio:'o condomínio',seguro:'o seguro'})[pr]} da ficha do imóvel ${esc(propName(r.tx.propertyId))}. Apagar remove também o valor da ficha${pr==='imi'?' (e as outras prestações)':''}; para voltar, escreve-o de novo no imóvel.`:'';
  confirmModal('Apagar movimento recorrente',r.auto?(isLoan?`Esta é a prestação de uma hipoteca. Apagar deixa de a pedir todos os meses (podes voltar a ligá-la na hipoteca).`:doImovel||`Este é a renda de um contrato. Apagar deixa de a pedir todos os meses (podes voltar a ligá-la guardando o contrato de novo).`):`Deixar de repetir “${esc(r.name)}”? Os movimentos já criados ficam.`,()=>{
    recTirar(r);save();closeAllModals();buildNav();render();toast('Movimento recorrente apagado.');
  });
}
/* Tira um planeado da base com as regras do apagar — as do delRec, e as da
   seleção de vários (cloud/selecao-listas.js), que é por isso que vivem
   aqui uma vez só. Num automático desliga o autoRec no contrato ou na
   hipoteca de origem (sem isso a sincronização voltava a criá-lo); num da
   ficha do imóvel (IMI, condomínio, seguro) põe o valor a zero na ficha e
   leva as prestações irmãs. Não grava nem repinta: quem chama decide.
   Recebe: r — o planeado (de db.recurring).
   Devolve: o que é preciso para o repor (recRepor): {recs, cts, loans, props}
   — as cópias do que saiu e os valores de antes do que mudou. */
function recTirar(r){
  const t=r.tx||{},pr=r.auto?t.propRec:'',d={recs:[],cts:[],loans:[],props:[]};
  if(r.auto){
    const c=contract(t.contractId);if(c){d.cts.push([c.id,c.autoRec]);c.autoRec=false}
    if(t.loanId)db.properties.forEach(p=>(p.loans||[]).forEach(l=>{if(l.id===t.loanId){d.loans.push([p.id,l.id,l.autoRec]);l.autoRec=false}}));
    if(pr){const p=prop(t.propertyId);if(p){d.props.push([p.id,pr,p[pr]]);p[pr]=0}}
  }
  const sai=x=>x.id===r.id||!!(pr&&x.auto&&x.tx&&x.tx.propRec===pr&&x.tx.propertyId===t.propertyId);
  d.recs=JSON.parse(JSON.stringify((db.recurring||[]).filter(sai)));
  db.recurring=(db.recurring||[]).filter(x=>!sai(x));
  return d;
}
/* O Anular de um recTirar: os planeados voltam (os que entretanto não
   tenham voltado por outra via), e o contrato, a hipoteca e a ficha do
   imóvel ficam como estavam. Não grava nem repinta (o comDesfazer fá-lo).
   Recebe: d — o que o recTirar devolveu.
   Devolve: nada — mexe no db. */
function recRepor(d){
  if(!d)return;
  const ha={};(db.recurring||[]).forEach(x=>{ha[x.id]=1});
  db.recurring=(db.recurring||[]).concat((d.recs||[]).filter(x=>!ha[x.id]));
  (d.cts||[]).forEach(([id,antes])=>{const c=contract(id);if(c)c.autoRec=antes});
  (d.loans||[]).forEach(([pid,lid,antes])=>{const p=prop(pid);const l=p&&(p.loans||[]).find(y=>y.id===lid);if(l)l.autoRec=antes});
  (d.props||[]).forEach(([pid,campo,antes])=>{const p=prop(pid);if(p)p[campo]=antes});
}
/* ---- vários de uma vez: a seleção de vários dos Planeados ----
   A camada da seleção (cloud/selecao-listas.js) marca; as regras de cada
   planeado — quem pode silenciar, quem pode apagar, o que um automático
   arrasta — são as daqui, as mesmas do skipRec e do delRec. */
/* Os planeados de uma lista de ids, pela ordem da base; os que já não
   existem não entram.
   Recebe: ids — os ids (array).
   Devolve: os planeados (array). */
function recsDe(ids){
  const q={};(ids||[]).forEach(i=>{q[i]=1});
  return (db.recurring||[]).filter(r=>q[r.id]);
}
/* O que a seleção pode fazer ao silêncio: silenciar quando todos avisam,
   reativar quando todos estão silenciados; misturados, nenhum dos dois —
   um botão só não diz o que faria a cada um.
   Recebe: ids — os ids marcados (array).
   Devolve: 'silenciar', 'reativar', 'misto', ou '' sem nenhum. */
function recMudoDaSelecao(ids){
  const rs=recsDe(ids);if(!rs.length)return '';
  const m=rs.filter(r=>r.muted).length;
  return m===0?'silenciar':m===rs.length?'reativar':'misto';
}
/* Silencia ou reativa vários, com a regra do skipRec: num imóvel onde só
   colaboro, silenciar pede «Adicionar e confirmar planeados»
   (motivoRecusa com 'confirmar'). Os que não posso ficam como estão. Não
   grava nem repinta.
   Recebe: ids — os ids (array); mudo — true silencia, false reativa.
   Devolve: {feitos, recusa, antes} — os ids mudados, a frase da primeira
   recusa ('' sem nenhuma) e quantos ficaram de fora (fora), e o muted de
   antes de cada um, para o Anular (recMudoRepor). */
function recMudarVarios(ids,mudo){
  const out={feitos:[],recusa:'',fora:0,antes:{}};
  recsDe(ids).forEach(r=>{
    const m=motivoRecusa((r.tx||{}).propertyId,'rec.add',r,'confirmar');
    if(m){out.fora++;if(!out.recusa)out.recusa=m;return}
    out.antes[r.id]=!!r.muted;r.muted=!!mudo;out.feitos.push(r.id);
  });
  return out;
}
/* O Anular de um recMudarVarios: cada planeado volta ao silêncio que tinha.
   Recebe: antes — {id: muted} (o antes do recMudarVarios).
   Devolve: nada — mexe no db. */
function recMudoRepor(antes){
  recsDe(Object.keys(antes||{})).forEach(r=>{r.muted=antes[r.id]});
}
/* Quais dos marcados posso apagar, com a regra do delRec (motivoRecusa com
   true: só os meus, ou um alheio que termina ao confirmar).
   Recebe: ids — os ids marcados (array).
   Devolve: {ok, recusa, fora} — os planeados que posso apagar, a frase da
   primeira recusa ('' sem nenhuma) e quantos ficam de fora. */
function recPodeApagar(ids){
  const out={ok:[],recusa:'',fora:0};
  recsDe(ids).forEach(r=>{
    const m=motivoRecusa((r.tx||{}).propertyId,'rec.add',r,true);
    if(m){out.fora++;if(!out.recusa)out.recusa=m}else out.ok.push(r);
  });
  return out;
}
/* A frase da confirmação de apagar vários planeados: o que acontece aos
   movimentos, o que os automáticos arrastam (as rendas, as prestações, os da
   ficha do imóvel), como no delRec, e os que ficam de fora por não os
   poder apagar.
   Recebe: ids — os ids marcados (array).
   Devolve: o HTML da frase (texto), com o que vem de fora escapado. */
function recApagarFrase(ids){
  const {ok,recusa,fora}=recPodeApagar(ids),n=ok.length,conta=(k,um,uns)=>k+' '+(k===1?um:uns);
  const ct=ok.filter(r=>r.auto&&!(r.tx||{}).loanId&&!(r.tx||{}).propRec).length;
  const pr=ok.filter(r=>r.auto&&(r.tx||{}).loanId).length,im=ok.filter(r=>r.auto&&(r.tx||{}).propRec).length;
  const f=[(n===1?'Deixa':'Deixam')+' de se repetir; os movimentos já criados ficam.'];
  const volta=k=>(k===1?'volta':'voltam')+' a ligar-se ';
  if(ct)f.push(conta(ct,'é a renda de um contrato','são rendas de contratos')+': '+volta(ct)+'guardando o contrato de novo.');
  if(pr)f.push(conta(pr,'é a prestação de uma hipoteca','são prestações de hipotecas')+': '+volta(pr)+'na hipoteca.');
  if(im)f.push(conta(im,'vem','vêm')+' da ficha do imóvel (IMI, condomínio, seguro): o valor sai também da ficha.');
  if(fora)f.push(conta(fora,'fica','ficam')+' de fora: '+recusa);
  return f.map(esc).join('<br>');
}
/* Apaga vários planeados com as regras do delRec (recTirar), um a um; os que
   não posso apagar ficam. Não grava nem repinta.
   Recebe: ids — os ids (array).
   Devolve: {feitos, recusa, fora, desfaz} — os ids apagados, a frase da
   primeira recusa, quantos ficaram de fora, e a lista do que cada recTirar
   devolveu (para o Anular, recRepor de trás para a frente). */
function recApagarVarios(ids){
  const out={feitos:[],recusa:'',fora:0,desfaz:[]};
  recsDe(ids).forEach(r=>{
    /* um planeado do IMI leva as irmãs: a seguinte da lista já pode ter saído */
    if(!(db.recurring||[]).some(x=>x.id===r.id)){out.feitos.push(r.id);return}
    const m=motivoRecusa((r.tx||{}).propertyId,'rec.add',r,true);
    if(m){out.fora++;if(!out.recusa)out.recusa=m;return}
    out.desfaz.push(recTirar(r));out.feitos.push(r.id);
  });
  return out;
}
/* Apaga vários modelos, como o delTpl a cada um: os movimentos criados a
   partir deles ficam. Não grava nem repinta.
   Recebe: ids — os ids dos modelos (array).
   Devolve: as cópias dos modelos apagados (array), para o Anular. */
function tplApagarVarios(ids){
  const q={};(ids||[]).forEach(i=>{q[i]=1});
  const sai=JSON.parse(JSON.stringify((db.templates||[]).filter(x=>q[x.id])));
  db.templates=(db.templates||[]).filter(x=>!q[x.id]);
  return sai;
}
// Apaga o modelo, com confirmação; os movimentos criados a partir dele ficam.
// Recebe: id — o id do modelo a apagar.
// Devolve: nada — pede confirmação; ao confirmar, apaga, grava e redesenha.
function delTpl(id){
  const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;
  confirmModal('Apagar modelo',`Apagar o modelo “${esc(x.name)}”?`,()=>{db.templates=db.templates.filter(y=>y.id!==id);save();closeAllModals();render();toast('Modelo apagado.')});
}
/* Despeja o tx do modelo no formulário aberto, preservando o que é da sessão
   de edição (o id, a data e se é uma edição) e os anexos do movimento (a
   fatura é dele, e o modelo não os tem: sem os guardar, gravar deixava o
   ficheiro sem registo, e a arrumação do arranque apagava-o). O modo do
   formulário vive à parte (movimento.js:txModo), e por isso não há marcas a
   enumerar para ele não se trocar. Redesenha o modal.
   Recebe: x — o modelo a aplicar (objeto com tx, p. ex. de db.templates).
   Devolve: nada — substitui tForm e redesenha o modal. */
function applyTemplate(x){
  if(!x)return;
  /* o criado também fica: um movimento já guardado não salta para o topo do dia só por lhe aplicar um modelo */
  const keep={id:tForm.id,date:tForm.date,_edit:tForm._edit};
  if(tForm.criado)keep.criado=tForm.criado;
  if(tForm.files)keep.files=tForm.files;
  tForm=normTx(Object.assign({},JSON.parse(JSON.stringify(x.tx))));Object.assign(tForm,keep);
  if(tForm.amount)tForm._aA=tForm.amount;
  repaintTx();toast('Modelo aplicado.');
}
// Fecha o que estiver aberto e abre um movimento novo pré-preenchido com o modelo.
// Recebe: id — o id do modelo em db.templates.
// Devolve: nada — abre o formulário de movimento novo pré-preenchido.
function newFromTemplate(id){const x=(db.templates||[]).find(y=>y.id===id);if(!x)return;closeAllModals();txModal({kind:x.tx.kind,propId:x.tx.propertyId,ctId:x.tx.contractId,preset:JSON.parse(JSON.stringify(x.tx))})}
/* ---- as peças de uma linha de planeado: o valor, quando, o selo, a origem ---- */
/* O valor de um molde com a cor do dinheiro e o sinal: o que entra a verde
   (.pos), a prestação a roxo (.prest), o resto do que sai a laranja (.neg)
   com o − à frente; a transferência sem cor nem sinal. As três diferem também
   em luminosidade — é a regra das cores do dinheiro (estilos.css:.pos).
   Recebe: t — o tx do molde ({kind, amount}).
   Devolve: o HTML do valor (texto); um travessão sem montante. */
function recValor(t){
  t=t||{};
  if(!(Number(t.amount)>0))return '<b class="num plan-num">—</b>';
  const sai=flowOf(t.kind)==='out',cls=t.kind==='loan'?'prest':isIn(t.kind)?'pos':sai?'neg':'';
  return `<b class="num plan-num ${cls}">${sai?'−':''}${euro2(t.amount)}</b>`;
}
/* Uma data curta para as linhas: dia e mês no ano corrente, a data inteira
   noutro ano (um planeado anual de 2027 não pode passar por um deste ano).
   Recebe: iso — a data em AAAA-MM-DD.
   Devolve: 'dd/mm' ou 'dd/mm/aaaa' (texto); '' sem data. */
function recDiaCurto(iso){
  const d=dPT(iso);if(!d)return '';
  return String(iso).slice(0,4)===today().slice(0,4)?d.slice(0,5):d;
}
/* Quando é que um planeado pede confirmação: o dia, ou a janela «entre … e …»
   quando ela tem dois dias diferentes.
   Recebe: r — o planeado ({next, until}).
   Devolve: o texto (sem HTML). */
function recQuando(r){
  if(!r||!r.next)return '';
  return r.until&&r.until!==r.next?'entre '+recDiaCurto(r.next)+' e '+recDiaCurto(r.until):recDiaCurto(r.next);
}
/* A periodicidade em palavras, com o dia do mês nos mensais: «mensal, dia 5»
   ou, com janela, «mensal, 1 – 8».
   Recebe: r — o planeado ({every, next, until}).
   Devolve: o texto (sem HTML). */
function recRepete(r){
  const p=EVERY[r.every]||r.every||'';
  if(r.every!=='month'||!r.next)return p;
  const d1=Number(String(r.next).slice(8,10)),d2=r.until&&r.until!==r.next?Number(String(r.until).slice(8,10)):0;
  return d2?p+', '+d1+' – '+d2:p+', dia '+d1;
}
/* O selo do estado de um planeado: «Silenciado» a cinzento, «Em atraso» a
   vermelho, «Por confirmar» a cobalto — e nada quando ainda não chegou a data.
   Recebe: r — o planeado.
   Devolve: o HTML do selo (texto), ou ''. */
function recSelo(r){
  if(!r||!r.next||r.next>today())return r&&r.muted?'<span class="badge grey">Silenciado</span>':'';
  if(r.muted)return '<span class="badge grey">Silenciado</span>';
  return recIsLate(r)?'<span class="badge red">Em atraso</span>':'<span class="badge">Por confirmar</span>';
}
/* O selo de onde vem um planeado: da hipoteca a roxo, do contrato a cobalto,
   do imóvel (o IMI, o condomínio e o seguro da ficha) e, o que a pessoa
   criou, «personalizado» a cinzento (dizia «à mão», que não soava bem:
   ticket de QA 7df0696b).
   Recebe: r — o planeado ({auto, tx}).
   Devolve: o HTML do selo (texto). */
function recOrigem(r){
  const t=(r||{}).tx||{};
  if(!r||!r.auto)return '<span class="badge grey">personalizado</span>';
  if(t.loanId)return '<span class="badge loan">da hipoteca</span>';
  if(t.propRec)return '<span class="badge grey">do imóvel</span>';
  return '<span class="badge">do contrato</span>';
}
/* cartão dos movimentos em atraso / por confirmar */
let pendAll=false;
/* As opções do ⋯ de uma linha por confirmar: silenciar (ou reativar), recusar
   desta vez, preencher os períodos em falta e começar a partir de hoje — as
   três últimas são da nuvem (cloud/painel.js:CW.rejectRec, CW.fillMissed,
   CW.startFromToday) e só entram quando ela as tem. Recusar não destrói nada
   (avança o planeado sem criar movimento), por isso vive aqui e não num botão
   vermelho. Preencher cria movimentos: pede o mesmo que confirmar. Começar a
   partir de hoje larga as em falta de uma vez, sem criar movimentos: pede o
   mesmo que recusar, e só aparece com alguma data a largar
   (recPodeComecarHoje) — também com uma só, que o Preencher não mostra.
   Recebe: r — o planeado; ok — se posso silenciá-lo e recusá-lo; podeConf —
   se posso registar o movimento dele.
   Devolve: a lista de opções do componentes.js:menu (array, vazio sem nenhuma). */
function pendMenuItens(r,ok,podeConf){
  const id=jsq(r.id),it=[],nuvem=typeof window!=='undefined'&&window.CW?window.CW:null;
  if(ok)it.push({label:r.muted?'Reativar avisos':'Silenciar avisos',icon:'clock',toca:'dados',act:`skipRec('${id}')`});
  if(ok&&nuvem&&typeof nuvem.rejectRec==='function')it.push({label:'Recusar desta vez',icon:'x',toca:'camada',act:`CW.rejectRec('${id}')`});
  const n=podeConf&&nuvem&&typeof nuvem.fillMissed==='function'?datasEmFalta(r).length:0;
  if(n>=2)it.push({label:'Preencher '+n+' em falta',icon:'lista',toca:'camada',act:`CW.fillMissed('${id}')`});
  if(ok&&nuvem&&typeof nuvem.startFromToday==='function'&&recPodeComecarHoje(r))
    it.push({label:'Começar a partir de hoje',icon:'cal',toca:'camada',act:`CW.startFromToday('${id}')`});
  return it;
}
/* Uma linha do cartão dos por confirmar: o nome, de onde é e quando (tocar
   abre a ficha do planeado — ler primeiro), o valor com a cor do dinheiro e o
   selo do estado, e as ações: Confirmar (regista já, quickConfirmRec), Rever
   (abre o formulário, confirmRec) e o ⋯ com o resto (pendMenuItens). Sem a
   borda colorida à esquerda de antes: o estado diz-se no selo. Cada ação só
   aparece a quem a pode fazer; uma prestação sem crédito ou de uma hipoteca
   paga não se confirma às cegas — fica o Rever, que abre o formulário. O
   texto e o valor vão juntos (.plan-pend-topo): num cartão estreito só as
   ações descem, e um valor largo («1 250,00 €») já não arrasta o valor e o
   selo para baixo dos botões.
   Recebe: r — o planeado por confirmar.
   Devolve: o HTML da linha (texto). */
function pendLinha(r){
  const t=r.tx||{},semCred=recSemCredito(r),pago=!semCred&&recCreditoPago(r);
  const ok=podeEditar(t.propertyId,'rec.add',r,'confirmar'),recusa=recusaConfirmar(r),conf=!recusa&&!semCred&&!pago;
  const id=jsq(r.id),onde=imovelDoMolde(t),itens=pendMenuItens(r,ok,!recusa);
  const acoes=(conf?`<button type="button" class="btn sm primary" data-toca="dados" data-click="quickConfirmRec('${id}')">${ic('check',16)} Confirmar</button>`:'')
    /* a renda de um contrato que pede o recibo eletrónico: o segundo botão (D8, maqueta 4) */
    +(conf&&recPedeRecibo(r)?`<button type="button" class="btn sm" data-toca="dados" data-click="recConfirmarComRecibo('${id}')">Confirmar e emiti o recibo</button>`:'')
    +(recusa?'':`<button type="button" class="btn sm" data-toca="camada" data-click="confirmRec('${id}')">Rever</button>`)
    +(itens.length?menu('pend_'+r.id,itens):'');
  return `<div class="plan-pend-linha" data-fk="rec:${esc(r.id)}">
    <div class="plan-pend-topo"><div class="plan-txt tap" data-toca="camada" data-click="recView('${id}')">
      <p class="title">${esc(r.name)}</p>
      <p class="small num">${[onde?esc(onde):'',esc(recQuando(r))].filter(Boolean).join(' · ')}</p>
      ${semCred?'<p class="small"><b class="amber">Sem crédito associado — abre para escolher</b></p>':''}
      ${pago?'<p class="small"><b class="amber">Hipoteca já paga — abre para rever</b></p>':''}</div>
    <div class="plan-valor">${recValor(t)}${recSelo(r)}</div></div>
    ${acoes?`<div class="plan-acoes">${acoes}</div>`:''}</div>`;
}
/* O total do cabeçalho do cartão «Por confirmar», com o sinal das linhas por
   baixo (planeados.js:recValor): o que entra soma, o que sai (a prestação
   incluída) subtrai, a transferência conta zero. Somava os montantes todos
   como positivos — com uma renda de 425 € e um condomínio de 85 € dizia
   510 €, e as linhas diziam +425 e −85.
   Recebe: pend — os planeados por confirmar (array).
   Devolve: euros com sinal (número, arredondado ao cêntimo). */
function pendTotal(pend){
  return r2(sum((pend||[]).map(r=>{const t=r.tx||{},v=Number(t.amount)||0;return isIn(t.kind)?v:isOut(t.kind)?-v:0})));
}
/* HTML do cartão «Por confirmar». Com all mostra também as silenciadas (é
   assim que a página Planeados o usa); sem all, só as que avisam (vista
   geral). O cabeçalho diz o que é preciso saber — quantas em atraso, o total
   com sinal (pendTotal: verde quando entra mais do que sai, laranja com o −
   quando sai mais), quantas esperam — e abre e fecha a lista (pendShut). As
   em atraso vêm primeiro. Devolve '' quando não há nada.
   Recebe: all (opcional) — verdadeiro inclui também as silenciadas; falso ou omisso
   mostra só as que avisam.
   Devolve: o HTML do cartão (texto), ou '' quando não há nada por confirmar. */
function pendingCard(all){
  pendAll=!!all;   // para o colapso se redesenhar com a mesma lista
  /* Nada por confirmar enquanto não se sabe (espera.js:sabemosOEstado):
     antes do primeiro estado do servidor, este cartão anunciava rendas já
     confirmadas noutro aparelho — apareciam e desapareciam um segundo
     depois. */
  if(!sabemosOEstado())return '';
  const pend=all?recPending():recActive();
  if(!pend.length)return '';
  const atraso=r=>!r.muted&&recIsLate(r);
  const nl=pend.filter(atraso).length,open=!pendShut(),total=pendTotal(pend);
  const ordem=pend.slice().sort((a,b)=>(atraso(b)?1:0)-(atraso(a)?1:0)||String(a.next).localeCompare(String(b.next)));
  return `<div class="card plan-pend u-mb-14px" id="pendCard">
    <div class="plan-pend-cab tap" data-toca="vista" data-click="pendToggle()" aria-expanded="${open?'true':'false'}">
      <div class="plan-pend-tit"><h3>Por confirmar</h3>${nl?`<span class="badge red">${nl} em atraso</span>`:''}</div>
      <b class="num plan-pend-total ${total<0?'neg':'pos'}">${euro2(total)}</b>
      <span class="plan-pend-chev${open?' aberto':''}">${ic('chevD',20)}</span>
      <p class="small plan-pend-sub">${pend.length} à espera${open?'':' · toca para ver'}</p></div>
    ${open?listaViva('pendentes',ordem.map(r=>({chave:'pend:'+r.id,html:pendLinha(r)})),'plan-pend-linhas')
    +`<p class="hint plan-pend-dica">Confirmar regista o movimento e agenda o seguinte. Silenciar deixa-o à espera, sem avisos.</p>`:''}</div>`;
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
  /* o cartão é outro nó: o cabeçalho e os textos tocáveis voltam a entrar no Tab */
  tornarFocavel(document.getElementById('pendCard'));
}
/* A frase do estado vazio sobre quem cria planeados sozinho: as rendas (dos
   Contratos), as prestações (dos Créditos) e o IMI, o condomínio e o seguro da
   ficha (dos Imóveis) — só os dos serviços ligados nesta conta, para não
   prometer o que não existe nela.
   Devolve: a frase com espaço à frente (texto), ou '' sem nenhum dos três. */
function recOrigensFrase(){
  const o=[];
  if(servicoLigado('contracts'))o.push('as rendas');
  if(servicoLigado('credits'))o.push('as prestações');
  if(servicoLigado('properties'))o.push('o IMI, o condomínio e o seguro da ficha de cada imóvel');
  if(!o.length)return '';
  const s=listaE(o);
  return ' '+s[0].toUpperCase()+s.slice(1)+' criam um sem tu fazeres nada.';
}
/* ---- quem vem de trás: os planeados com períodos passados por registar ----
   Um contrato ou um planeado que começou antes de ser registado deixa meses
   sem movimento. A nuvem pergunta-o uma vez, numa janela, quando o planeado
   nasce (cloud/painel.js:offerFill); a página dos Planeados di-lo numa faixa
   enquanto houver o que registar, com «Registar os N» (a janela do
   preenchimento, com as datas, o total e o aviso de estimativa:
   cloud/painel.js:CW.fillMissed) e «Agora não». As prestações ficam de fora,
   como no offerFill: é ao gravar a hipoteca que se pergunta por elas
   (creditos.js:perguntarPrestacoesEmFalta). */
const RETRO_LS='gi_retro_agora_nao';
/* Os «Agora não» deste aparelho: id do planeado → quantos períodos faltavam
   quando se disse. A faixa volta se passarem a faltar mais.
   Devolve: o objeto (vazio se não houver nada ou a leitura falhar). */
function recRetroVistos(){
  try{const o=JSON.parse(localStorage.getItem(RETRO_LS)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch(e){return {}}
}
/* Os planeados que vêm de trás: dois ou mais períodos passados sem movimento
   (datasEmFalta), que avisam (não silenciados), que não são prestações, que
   posso confirmar (recusaConfirmar) e por que não se disse «Agora não» com
   estes mesmos períodos em falta. Nada antes de se saber o estado
   (espera.js:sabemosOEstado), como o cartão dos por confirmar.
   Devolve: array de {r, datas} pela ordem da base. */
function recRetroCandidatos(){
  if(!sabemosOEstado())return [];
  const vistos=recRetroVistos();
  return (db.recurring||[]).filter(r=>!r.muted&&(r.tx||{}).kind!=='loan'&&!(r.tx||{}).loanId&&!recusaConfirmar(r))
    .map(r=>({r,datas:datasEmFalta(r)}))
    .filter(x=>x.datas.length>=2&&!(Number(vistos[x.r.id])>=x.datas.length));
}
/* Os períodos em falta numa frase: até seis meses do mesmo ano, os nomes
   («faltam jul, ago e set», e «de 2025» quando não são deste); mais do que
   isso, a atravessar anos, ou noutro passo, a contagem e as duas pontas.
   Recebe: datas — as datas em falta (AAAA-MM-DD, por ordem); every — o passo do planeado.
   Devolve: o texto (sem HTML). */
function recRetroMeses(datas,every){
  const n=datas.length,a0=String(datas[0]||'').slice(0,4);
  if(every==='month'&&n<=6&&datas.every(d=>d.slice(0,4)===a0))
    return 'faltam '+listaE(datas.map(d=>MES[Number(d.slice(5,7))-1]||''))+(a0!==today().slice(0,4)?' de '+a0:'');
  const pal=({week:'semanas',quarter:'trimestres',year:'anos'})[every]||'meses';
  return 'faltam '+n+' '+pal+', de '+dPT(datas[0])+' a '+dPT(datas[n-1]);
}
/* A faixa de quem vem de trás, por cima dos por confirmar: um planeado de cada
   vez (o primeiro dos recRetroCandidatos), a dizer desde quando, o que falta,
   quanto se regista e com que etiqueta. Só com a nuvem, que é quem regista
   (CW.fillMissed).
   Devolve: o HTML da faixa (texto), ou '' sem nada a dizer. */
function recRetroFaixa(){
  if(!(typeof window!=='undefined'&&window.CW&&typeof window.CW.fillMissed==='function'))return '';
  const cs=recRetroCandidatos();if(!cs.length)return '';
  const {r,datas}=cs[0],n=datas.length,v=Number((r.tx||{}).amount)||0,mais=cs.length-1;
  return `<section class="plan-retro" aria-labelledby="planRetroTit">
    <h2 id="planRetroTit">«${esc(r.name)}» vem de trás</h2>
    <p class="num">Começa a ${dPT(origemDoPlano(r))}: ${esc(recRetroMeses(datas,r.every))}. Registamos ${n} movimentos de ${euro2(v)} (${euro2(r2(v*n))}), com a etiqueta «Estimativa»?</p>
    ${mais?`<p class="small plan-retro-mais">Há mais ${mais} ${mais===1?'planeado':'planeados'} assim; aparecem a seguir.</p>`:''}
    <div class="plan-retro-acoes">
      <button type="button" class="btn sm primary" data-toca="camada" data-click="CW.fillMissed('${jsq(r.id)}')">Registar os ${n}</button>
      <button type="button" class="btn sm" data-toca="vista" data-click="recRetroAgoraNao('${jsq(r.id)}')">Agora não</button></div></section>`;
}
/* «Agora não» na faixa de quem vem de trás: guarda no aparelho quantos
   períodos faltavam, para a faixa passar ao seguinte e só voltar a este se
   passarem a faltar mais. Os ids de planeados que já não existem saem.
   Recebe: id — o id do planeado.
   Devolve: nada — grava no aparelho e redesenha. */
function recRetroAgoraNao(id){
  const r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const o=recRetroVistos(),vivos={};
  (db.recurring||[]).forEach(x=>{vivos[x.id]=1});
  Object.keys(o).forEach(k=>{if(!vivos[k])delete o[k]});
  o[id]=datasEmFalta(r).length;
  try{localStorage.setItem(RETRO_LS,JSON.stringify(o))}catch(e){}
  render();
}
/* Os estados do filtro dos Planeados (o «st» do lf('lrec')): o valor, o que o
   chip ligado diz e o rótulo da escolha. Primeiro os quatro que eram chips
   (Todos, Automáticos, Personalizados, Silenciados), depois os do dia. Os
   personalizados guardam o valor 'manual' de sempre (o filtro guardado). */
const REC_ESTADOS=[['','Todos','Todos os estados'],['auto','Automáticos','Automáticos (contratos, hipotecas e imóveis)'],['manual','Personalizados','Personalizados'],
  ['muted','Silenciados','Silenciados'],['pend','Por confirmar','Por confirmar'],['ok','Em dia','Em dia']];
/* O estado dos Planeados mudou — o chip do estado ou o seletor do painel
   (vistas.js:lfCabeca), que são o mesmo filtro lf('lrec').st. Um valor que
   não é um estado limpa o filtro.
   Recebe: v — '', 'auto', 'manual', 'muted', 'pend' ou 'ok'.
   Devolve: nada — muda o filtro e redesenha. */
function recChip(v){
  lf('lrec').st=REC_ESTADOS.some(x=>x[0]&&x[0]===v)?v:'';
  render();
}
/* Uma linha da lista dos planeados: o nome, a periodicidade e a próxima data
   (ou, chegada a data, quando pede confirmação), o tipo e o imóvel, o selo da
   origem e o do estado, e o valor com a cor do dinheiro. Tocar abre a ficha,
   com as opções no ⋯; o toque longo entra na seleção de vários com ela
   marcada (cloud/selecao-listas.js:lpLongo).
   Recebe: r — o planeado.
   Devolve: o HTML da linha (texto). */
function recLinha(r){
  const t=r.tx||{},pend=recPorConfirmar(r),onde=imovelDoMolde(t);
  return `<div class="plan-linha tap" data-lp="rec:${esc(r.id)}" data-fk="recl:${esc(r.id)}" data-toca="camada" data-click="recView('${jsq(r.id)}')">
    <div class="plan-txt">
      <p class="title">${esc(r.name)}</p>
      <p class="small num">${esc(recRepete(r))}${r.next?' · '+(pend?esc(recQuando(r)):'próxima '+recDiaCurto(r.next)):''}${r.end?' · termina '+dPT(r.end):''}</p>
      <p class="small">${esc((KIND[t.kind]||{}).short||'')}${onde?' · '+esc(onde):''}${t.category?' · '+esc(t.category):''}</p>
      ${recSemCredito(r)?'<p class="small"><b class="amber">Sem crédito associado — abre para escolher</b></p>':''}
      <div class="plan-selos">${recOrigem(r)}${recSelo(r)}</div></div>
    ${recValor(t)}</div>`;
}
/* Um planeado (ou um modelo) passa no filtro «Imóvel» da lista? Vazio, todos;
   um id, esse imóvel; 'g:ID' (um grupo de imóveis,
   componentes.js:imoveisEGruposOpts), os dos imóveis do grupo e os que são do
   próprio grupo (o tx.groupId).
   Recebe: t — o movimento do planeado ou do modelo (o tx); v — o valor do
   filtro (lf('lrec').p).
   Devolve: true/false. */
function recNoImovel(t,v){
  if(!v)return true;
  if(String(v).startsWith('g:')){
    const gid=String(v).slice(2),g=grp(gid);
    return t.groupId===gid||(!!g&&!!t.propertyId&&(g.ids||[]).indexOf(t.propertyId)>-1);
  }
  return t.propertyId===v;
}
/* Um grupo de imóveis tem planeados ou modelos? O que decide se entra no
   filtro «Imóvel» dos Planeados (componentes.js:imoveisEGruposOpts): um
   planeado ou um modelo num dos imóveis dele, ou do próprio grupo.
   Recebe: g — o grupo.
   Devolve: true/false. */
function recGrupoTemPlaneados(g){
  return (db.recurring||[]).concat(db.templates||[]).some(x=>recNoImovel(x.tx||{},'g:'+g.id));
}
/* A página dos Planeados (o canvas M-Planeados): a faixa de quem vem de trás,
   o cartão dos por confirmar e, por cima do que filtram, os filtros dos
   Movimentos (vistas.js:lfCabeca) — a pesquisa à vista com o funil do painel
   completo e os chips do estado (Automáticos, Personalizados, Silenciados,
   Por confirmar, Em dia, cada um com quantos há: planeados.js:recChip), do
   tipo e, no ecrã largo, do imóvel —; depois a lista dos planeados num cartão
   e os modelos em chips com o valor. O «Novo recorrente» vive no cabeçalho
   (navegacao.js:#hdrAcao) e no +, e o modelo novo no + (à cabeça, aqui:
   acessos.js:outrasDoSeparador) — a secção dos Modelos já não tem botão ao
   lado do título; os vazios têm o seu botão, e com filtros são o vazio dos
   filtros (vistas.js:vazioFiltro, com «Limpar filtros»). Com um estado que
   não o «Personalizados», os Modelos saem: um modelo não tem estado.
   Devolve: o HTML da página (texto). */
function vRecurring(){
  const K='lrec',s=lf(K);
  const hit=(name,tx)=>lfHit(K,[name,tx.label,tx.category,tx.sub,tx.creditor,propName(tx.propertyId),String(tx.amount||''),(tx.tags||[]).join(' '),tx.notes].join(' '));
  /* os de um imóvel vendido que já só pediam depois da venda não estão (recAcabouNaVenda) */
  const base=r=>(!recAcabouNaVenda(r)&&(!s.k||r.tx.kind===s.k)&&recNoImovel(r.tx,s.p)&&hit(r.name,r.tx));
  /* um planeado está num estado? (o filtro e as contagens do chip) */
  const noEstado=(r,st)=>{
    if(st==='pend')return !!(recPorConfirmar(r)&&!r.muted);
    if(st==='ok')return !!(r.next&&r.next>today());
    if(st==='muted')return !!r.muted;
    if(st==='auto')return !!r.auto;
    if(st==='manual')return !r.auto;
    return true;
  };
  const daBase=(db.recurring||[]).filter(base);
  const rc=daBase.filter(r=>noEstado(r,s.st)).sort((a,b)=>String(a.next).localeCompare(String(b.next)));
  const rcS=lfSort(K,rc,{nome:r=>r.name,valor:r=>r.tx.amount||0,data:r=>r.next||''});
  const tp=lfSort(K,(db.templates||[]).filter(x=>(!s.k||x.tx.kind===s.k)&&recNoImovel(x.tx,s.p)&&(!s.st||s.st==='manual')&&hit(x.name,x.tx)),
    {nome:x=>x.name,valor:x=>x.tx.amount||0,data:()=>0});
  const kinds=[{v:'',label:'Todos os tipos'},{v:'income',label:'Receitas'},{v:'expense',label:'Despesas'},{v:'loan',label:'Pagamentos de crédito'},{v:'owed',label:'Dívidas recebidas'},{v:'repay',label:'Pagamentos de dívida'}];
  /* os filtros por cima do que filtram, e só com alguma coisa para filtrar.
     As escolhas do estado dizem quantos há em cada um pelos olhos dos outros
     filtros (o tipo, o imóvel e a pesquisa contam; o estado é o próprio
     campo); o filtro por imóvel só com os Imóveis ligados nesta conta */
  const head=!(db.recurring||[]).length&&!(db.templates||[]).length?'':lfCabeca(K,{nome:['planeado','planeados'],dos:'dos planeados',n:rc.length+tp.length,
    campos:[{chave:'st',nome:'Estado',curto:'Todos',rapido:true,aplicar:recChip,rotulo:v=>(REC_ESTADOS.find(x=>x[0]===v)||[])[1]||v,
        opcoes:REC_ESTADOS.map(([v,,rot])=>({v:v,label:rot,n:v?daBase.filter(r=>noEstado(r,v)).length:daBase.length}))},
      {chave:'k',nome:'Tipo',curto:'Todos',rapido:true,opcoes:kinds},
      servicoLigado('properties')?{chave:'p',nome:'Imóvel',curto:'Todos',rapido:'largo',opcoes:imoveisEGruposOpts(db.properties,s.p,recGrupoTemPlaneados)}:null],
    ordem:{omissao:'Próxima data',opcoes:[{v:'data',label:'Data'},{v:'valor',label:'Valor'},{v:'nome',label:'Nome'}]}});
  /* quem pode adicionar: a condição do «Novo recorrente» do cabeçalho, para os vazios e o «Novo modelo» */
  const adiciona=podeSemImovel()||casasComo('rec.add').length;
  /* com filtros, o vazio é o dos filtros, com «Limpar filtros» (vistas.js:vazioFiltro) */
  const filtrado=lfCount('lrec')>0;
  const recs=rcS.length?`<div class="card plan-lista">${listaViva('recorrentes',rcS.map(r=>({chave:'rec:'+r.id,html:recLinha(r)})),'plan-linhas')}</div>`
    :filtrado?vazioFiltro():`<div class="empty u-p-24px"><b>Sem movimentos recorrentes</b>Repete-se sozinho e pede confirmação todos os meses.${recOrigensFrase()}${adiciona?saida('Novo movimento recorrente','newRec()','camada'):''}</div>`;
  /* um modelo não tem data nem origem: com um estado escolhido (Automáticos,
     Silenciados, Por confirmar, Em dia) a secção sai, em vez de dizer sempre
     que não há nada; «Personalizados» deixa-os, que são todos da pessoa */
  if(s.st&&s.st!=='manual')return recRetroFaixa()+pendingCard(true)+head+recs;
  const tpls=tp.length?listaViva('modelos',tp.map(x=>({chave:'tpl:'+x.id,html:`<button type="button" class="chip plan-modelo" data-lp="tpl:${esc(x.id)}" data-fk="tpl:${esc(x.id)}" data-toca="camada" data-click="tplView('${jsq(x.id)}')"><span class="plan-modelo-nome">${esc(x.name)}</span>${Number(x.tx.amount)>0?` <span class="n">${euro2(x.tx.amount)}</span>`:''}</button>`})),'chips-fila plan-modelos')
    :filtrado?vazioFiltro():`<div class="empty u-p-24px"><b>Sem modelos</b>Um modelo é um movimento guardado para copiar à mão quando precisares.${adiciona?saida('Novo modelo','newTpl()','camada'):''}</div>`;
  return recRetroFaixa()+pendingCard(true)+head+recs
    +`<div class="plan-cab"><h2>Modelos</h2></div>${tpls}`;
}
/* secção do formulário de um planeado: a periodicidade, a janela e o fim — os
   campos do planeado, que vivem no modo do formulário (movimento.js:txModo) e
   não no movimento
   Devolve: o HTML da secção dobrável "Datas e repetição" (texto). */
function recSect(){
  const t=tForm,m=txModo,every=m.every||'month';
  const body=`
    <label>Repetir${sel('t_every',every,Object.keys(EVERY).map(k=>({v:k,label:EVERY[k]})),'','rascunho')}</label>
    <div class="row">
      <label>Entre<input id="t_date" type="date" value="${esc(t.date)}"></label>
      <label>e<input id="t_until" type="date" value="${esc(m.until||'')}"></label></div>
    <label>Até (deixa de se repetir; opcional)<input id="t_recEnd" type="date" value="${esc(m.recEnd||'')}"></label>
    <div class="hint">Entra por confirmar no primeiro dia; passado o segundo sem confirmares, fica em atraso.</div>`;
  return fold('rec','Datas e repetição',body,{icon:'clock',open:true,summary:EVERY[every]});
}
/* ---- registo do serviço (servicos.js) ---- */
/* O crachá dos Planeados na gaveta: os pendentes, na cor de aviso quando
   nenhum passou do prazo. É a mesma afirmação do sino, e espera pelo mesmo
   (espera.js:sabemosOEstado): antes do primeiro estado do servidor
   contava rendas já confirmadas noutro aparelho.
   Devolve: {n, aviso} — a contagem e se pinta na cor de aviso. */
function recCracha(){
  const n=sabemosOEstado()?recActive().length:0;
  return {n:n,aviso:!recLate().length};
}
/* A folha das opções de um planeado (data-lp "rec:<id>", pelo lpMenu): com
   rec.add confirmo e silencio qualquer planeado (o servidor só lhe funde
   next, until e muted); editar os campos e apagar é só o que eu criei — o
   alheio que termina ao confirmar apaga-se pelo Confirmar, não por aqui. Os
   outros serviços acrescentam as suas opções por lpExtras. Com a nuvem, o
   toque longo já não a abre: entra na seleção de vários
   (cloud/selecao-listas.js:lpLongo), e as opções de um só vivem no ⋯ da
   ficha (recView); a folha fica para quem chama o lpMenu.
   Recebe: a — as partes do data-lp (['rec', id]).
   Devolve: nada — abre a folha de opções (ou nada, se o planeado já não existir). */
function lpPlaneado(a){
  const id=a[1],r=(db.recurring||[]).find(x=>x.id===id);if(!r)return;
  const hid=(r.tx||{}).propertyId,conf=podeEditar(hid,'rec.add',r,'confirmar'),edita=podeEditar(hid,'rec.add',r),opts=[];
  if(recPorConfirmar(r)&&!recusaConfirmar(r)){
    opts.push({label:'Confirmar',icon:'check',act:()=>quickConfirmRec(id)});
    if(recPedeRecibo(r))opts.push({label:'Confirmar e emiti o recibo',icon:'check',act:()=>recConfirmarComRecibo(id)});
  }
  if(conf)opts.push({label:r.muted?'Reativar avisos':'Silenciar',icon:'clock',act:()=>skipRec(id)});
  lpExtrasDe('rec',a).forEach(o=>opts.push(o));
  if(edita)opts.push({label:'Editar',icon:'pen',act:()=>editRec(id)},{label:'Apagar',icon:'trash',act:()=>delRec(id)});
  /* «Selecionar vários» só a quem pode silenciar ou apagar: a seleção não tem outras ações */
  if(conf||podeEditar(hid,'rec.add',r,true))lpPortaSelecao('rec',id,opts);
  return lpShow(r.name,opts);
}
/* A folha das opções de um modelo (data-lp "tpl:<id>", pelo lpMenu). Com a
   nuvem, o toque longo entra na seleção (cloud/selecao-listas.js:lpLongo), e
   as opções de um só vivem na ficha (tplView).
   Recebe: a — as partes do data-lp (['tpl', id]).
   Devolve: nada — abre a folha de opções (ou nada, se o modelo já não existir). */
function lpModelo(a){
  const id=a[1],x=(db.templates||[]).find(y=>y.id===id);if(!x)return;
  const opts=[{label:'Usar modelo',icon:'plus',act:()=>newFromTemplate(id)},{label:'Editar',icon:'pen',act:()=>editTpl(id)}];
  lpExtrasDe('tpl',a).forEach(o=>opts.push(o));
  opts.push({label:'Apagar',icon:'trash',act:()=>delTpl(id)});
  lpPortaSelecao('tpl',id,opts);
  return lpShow(x.name,opts);
}
/* A porta da seleção de vários no fim da folha das opções de um planeado ou
   de um modelo, como o «Selecionar vários» da folha dos imóveis
   (cloud/selecao-listas.js): entra na seleção desse tipo com o tocado já
   marcado. Só na página dos Planeados — a folha abre-se também noutros
   ecrãs, onde não há seleção — e só com a camada da seleção carregada.
   Recebe: tipo — 'rec' ou 'tpl'; id — o id do tocado; opts — as opções da
   folha, a que se acrescenta.
   Devolve: nada — acrescenta a opção ao opts. */
function lpPortaSelecao(tipo,id,opts){
  if(tab!=='recurring'||!(typeof window!=='undefined'&&window.CW&&typeof window.CW.selLEntrar==='function'))return;
  opts.push({label:'Selecionar vários',icon:'caixaVisto',act:()=>window.CW.selLEntrar(tipo,id)});
}
registarServico({id:'recurring',vistas:{recurring:'vRecurring'},lp:{rec:'lpPlaneado',tpl:'lpModelo'},cracha:{recurring:'recCracha'}});
