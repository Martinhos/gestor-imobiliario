/* ================= MOVIMENTO ================= */
let tForm={};
/* O modo do formulário do movimento aberto, à parte do tForm — que é só o
   movimento. 'tx' regista ou altera um movimento; 'confirmar' regista o que
   um planeado pede (recId) e avança-o; 'rec' cria ou altera um planeado
   (recId; sem ele é novo) sem criar movimento nenhum; 'tpl' cria ou altera um
   modelo (tplId; sem ele é novo) e, com alsoTx, regista também o movimento.
   Os campos do planeado (every, until, recEnd) e do modelo (tplName) são
   daqui, e não do movimento. Viviam no tForm como bandeiras _rec…/_tpl…, que
   o guardar apagava por prefixo e o applyTemplate tinha de enumerar à mão. */
let txModo={modo:'tx'};
/* Abre o formulário do movimento: registar, alterar, confirmar um planeado,
   criar ou alterar um planeado ou um modelo.
   A regra de quem chama: um objeto. A única forma curta é txModal(id) — um
   texto sozinho —, que é o mesmo que txModal({id}): abre esse movimento para o
   alterar (ou a ficha, a quem não pode). A forma por posições (id, kind,
   propId, _x, ctId, preset) saiu com o adaptador que a traduzia; mais do que
   um argumento rebenta, para ninguém a trazer de volta sem dar por isso. Um
   onclick escrito em texto também leva o objeto: txModal({id:'…'}).
   Recebe: o — {id, kind, propId, ctId, preset, modo, recId, tplId, alsoTx,
   every, until, recEnd, tplName}, ou só o id (texto): id do movimento a
   alterar (sem ele é um novo); kind o tipo ('income', 'expense', 'loan',
   'owed', 'repay' ou 'settle'; 'income' por omissão); propId e ctId o imóvel e
   o contrato a pré-escolher; preset os campos do movimento para preencher à
   partida (dos filtros, de um botão «Pagar», de um planeado ou de um modelo);
   o resto é o modo (txModo).
   Devolve: nada — abre o modal do movimento e liga o guardar. */
function txModal(o){
  if(arguments.length>1)throw new Error('txModal: passa um objeto ({id, kind, propId, ctId, preset…}); a forma por posições saiu');
  if(typeof o==='string')o={id:o};
  else if(!o||typeof o!=='object')o={};
  const id=o.id||null;
  foldState={};
  /* Quem não pode alterar recebe a FICHA, e não este formulário com os campos
     apagados. E antes do openModal: não se decora uma janela já aberta,
     escolhe-se qual é a janela a abrir. */
  const _t=id?(db.transactions||[]).find(x=>x.id===id):null;
  if(id&&!_t)return;
  if(_t&&!podeEditar(_t.propertyId,'tx.add',_t))return txView(id);
  const modo=['confirmar','rec','tpl'].indexOf(o.modo)>-1?o.modo:'tx';
  txModo={modo,recId:o.recId||null,tplId:o.tplId||null,alsoTx:!!o.alsoTx,every:o.every||'month',until:o.until||'',recEnd:o.recEnd||'',tplName:o.tplName||''};
  /* sem imóvel escolhido: com um só imóvel onde posso adicionar fica esse; quem não
     é dono de nenhum não tem «Todos os imóveis» e fica com o primeiro permitido —
     senão o seletor mostrava o primeiro e o movimento gravava-se sem imóvel */
  const auto=(db.properties.length===1||!podeSemImovel())?((casasComo('tx.add')[0]||{}).id||null):null;
  tForm=_t?normTx(JSON.parse(JSON.stringify(_t))):
    normTx(Object.assign({kind:o.kind||'income',date:today(),amount:'',propertyId:o.propId||auto,contractId:o.ctId||null,split:null},o.preset||{}));
  if(tForm.contractId&&!tForm.propertyId){const c=contract(tForm.contractId);if(c)tForm.propertyId=c.propertyId}
  if(!id&&!tForm.propertyId&&!tForm.groupId&&!podeSemImovel())tForm.propertyId=auto;   /* um preset sem imóvel (modelo) também */
  tForm._edit=!!id;
  if(!id&&tForm.amount){tForm._aA=tForm.amount}
  prefill();
  const m=id?menu('tx',[{label:'Apagar movimento',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delTx('${jsq(id)}')`}]):'';
  openModal(txTitulo(),txBody(),null,m);
  onSave=()=>txGuardar(id);
}
/* O título do formulário do movimento, pelo modo e pelo tipo.
   Devolve: o título (texto). */
function txTitulo(){
  const m=txModo;
  if(m.modo==='confirmar')return 'Confirmar movimento';
  if(m.modo==='rec')return m.recId?'Editar movimento recorrente':'Novo movimento recorrente';
  if(m.modo==='tpl')return m.tplId?'Editar modelo':'Novo modelo';
  const nome=txTypeName(tForm.kind);
  return tForm._edit?'Editar '+nome:txNewWord(tForm.kind)+nome;
}
/* O Guardar do formulário do movimento: recolhe o que está no ecrã, valida o
   que é comum aos modos e entrega ao guardar do modo (txGuardarPlaneado,
   txGuardarModelo, txGuardarMovimento). A distribuição de um pagamento de
   crédito sai aqui da função pura (distribuicaoDe), uma vez, com o que está
   no formulário — pintar o cartão não a escreve.
   Recebe: id — o id do movimento em edição (null num novo).
   Devolve: nada — grava e fecha, ou diz o que falta. */
function txGuardar(id){
  collectTx();
  const m=txModo,planeado=m.modo==='rec';
  /* a primeira barreira: o servidor recusaria na mesma, mas aqui diz-se porquê antes de gravar.
     Criar ou alterar um planeado não cria movimentos: pede «Adicionar e confirmar planeados»
     (e, a alterar, ser quem o criou); o resto — movimentos, e o Confirmar — pede «Adicionar movimentos» */
  const recusa=planeado?motivoRecusa(tForm.propertyId,'rec.add',m.recId?(db.recurring||[]).find(x=>x.id===m.recId):null)
    :motivoRecusa(tForm.propertyId,'tx.add',id?db.transactions.find(x=>x.id===id):null);
  if(recusa)return toast(recusa);
  if(!tForm.propertyId&&!podeSemImovel())return toast('Escolhe o imóvel.');
  /* um pagamento de crédito a sério (não um planeado nem um modelo só) abate capital
     na ficha do imóvel: sem «Editar a ficha» o movimento subia e a dívida não */
  if(tForm.kind==='loan'&&!planeado&&(m.modo!=='tpl'||m.alsoTx)){const rc=motivoCredito(tForm.propertyId);if(rc)return toast(rc)}
  if(!tForm.label.trim())return falhaCampo('t_label','Escreve uma descrição.');
  if(!(tForm.amount>0))return falhaCampo('t_amount','Indica um montante.');
  /* com hipotecas vivas, um pagamento de crédito sem hipoteca ia parar à conta errada ou a nenhuma */
  if(tForm.kind==='loan'&&!tForm.loanId&&liveLoans(prop(tForm.propertyId)).length)return falhaCampo('t_loan','Indica a hipoteca.');
  if(tForm.kind==='settle'){
    if(!tForm.propertyId&&tForm.groupId)return toast('Um acerto é de um imóvel ou de todos os imóveis, não de um grupo.');
    if(!tForm.paidBy||!tForm.toId)return toast('Indica quem paga e quem recebe.');
    if(tForm.paidBy===tForm.toId)return toast('Quem paga e quem recebe têm de ser pessoas diferentes.');
  }
  const se=splitError();if(se)return toast(se);
  const pe=psplitError();if(pe)return toast(pe);
  const lV=tForm.kind==='loan'&&tForm.loanId?findLoan(prop(tForm.propertyId),tForm.loanId):null;
  if(lV){
    Object.assign(tForm,distribuicaoDe(tForm,lV));
    if(tForm.payType!=='amortizacao'){
      if(Number(tForm.interest)<0||Number(tForm.stamp)<0||Number(tForm.principal)<0)return toast('Juros e selo ultrapassam o montante: baixa os juros na tabela da distribuição.');
      const s=r2(Number(tForm.interest||0)+Number(tForm.stamp||0)+Number(tForm.principal||0));
      if(Math.abs(s-tForm.amount)>0.011)return toast('Juros, selo e capital têm de somar o montante ('+euro2(tForm.amount)+').');
    }
    const av=loanAvail(tForm,lV);
    if(Number(tForm.principal)>av+0.011)return toast('Só faltam '+euro2(av)+' pagar nesta hipoteca — não podes amortizar mais do que isso.');
    if(!tForm._edit&&!(Number(lV.outstanding)>0))return toast('Esta hipoteca já está paga: não é possível associar novos pagamentos.');
  }
  if(planeado)return txGuardarPlaneado();
  if(m.modo==='tpl')return txGuardarModelo();
  return txGuardarMovimento(id);
}
/* Guardar no modo 'rec': só o planeado muda (ou nasce); não cria movimentos.
   O txGuardar já validou.
   Devolve: nada — grava, fecha e redesenha. */
function txGuardarPlaneado(){
  const m=txModo,every=m.every||'month',recEnd=m.recEnd||'';
  let until=m.until||'';if(until&&until<tForm.date)until='';
  if(!m.recId){db.recurring=db.recurring||[];db.recurring.push(normRec({name:tForm.label,every,next:tForm.date,until,end:recEnd,tx:txSnapshot(tForm)}))}
  else{const r=(db.recurring||[]).find(x=>x.id===m.recId);if(r){r.tx=txSnapshot(tForm);r.name=tForm.label;r.every=every;r.next=tForm.date;r.until=until;r.end=recEnd;
    if(r.tx.loanId)delete r.loanOff}}   /* escolheu a hipoteca à mão: a marca do delMort deixa de fazer sentido */
  save();closeModal();buildNav();render();toast(m.recId?'Movimento recorrente atualizado.':'Movimento recorrente criado.');
}
/* Guardar no modo 'tpl': o modelo muda (ou nasce) e, com alsoTx, regista-se
   também o movimento. O txGuardar já validou.
   Devolve: nada — grava, fecha e redesenha. */
function txGuardarModelo(){
  const m=txModo,name=String(m.tplName||'').trim()||tForm.label;
  if(!m.tplId){db.templates=db.templates||[];db.templates.push(normTpl({name,tx:txSnapshot(tForm)}))}
  else{const x=(db.templates||[]).find(y=>y.id===m.tplId);if(x){x.name=name;x.tx=txSnapshot(tForm)}}
  if(m.alsoTx){const tx=normTx(txSnapshot(tForm));tx.date=tForm.date||today();if(tx.kind==='loan')applyLoan(tx);db.transactions.push(tx)}
  save();closeModal();buildNav();render();toast(!m.tplId?(m.alsoTx?'Modelo criado e movimento registado.':'Modelo criado.'):'Modelo atualizado.');
}
/* Guardar nos modos 'tx' e 'confirmar': o movimento entra (ou substitui o que
   se editou) e, confirmando um planeado, este avança. Um pagamento de crédito
   abate na hipoteca pelo applyLoan; a hipoteca de onde um movimento editado
   saiu (outra, ou já não é pagamento de crédito) volta a derivar o capital
   em dívida. O txGuardar já validou.
   Recebe: id — o id do movimento em edição (null num novo).
   Devolve: nada — grava, fecha e redesenha. */
function txGuardarMovimento(id){
  const recId=txModo.modo==='confirmar'?txModo.recId:null;
  const old=id?db.transactions.find(x=>x.id===id):null;
  /* as hipotecas tocadas ficam com o capital do início gravado ANTES de os movimentos mudarem */
  const tocadas=[old&&old.kind==='loan'?old.loanId:null,tForm.kind==='loan'?tForm.loanId:null].filter(Boolean);
  tocadas.forEach(lid=>{const x=anyLoan(lid);if(x)fixarCapitalInicio(x.l,db.transactions)});
  if(tForm.kind==='loan')applyLoan(tForm);
  Object.keys(tForm).forEach(k=>{if(k[0]==='_')delete tForm[k]});
  const i=db.transactions.findIndex(x=>x.id===tForm.id);
  if(i<0)db.transactions.push(tForm);else db.transactions[i]=tForm;
  tocadas.forEach(lid=>{const x=anyLoan(lid);if(x)acertarCapital(x.l)});
  if(recId&&servicoLigado('recurring')){const r=(db.recurring||[]).find(x=>x.id===recId);if(r)recAdvance(r)}
  save();closeModal();buildNav();render();refreshDetail();toast(recId?'Movimento confirmado.':'Movimento guardado.');
}
/* Afina o tForm depois de mudar o imóvel ou o tipo: limpa quem paga/recebe se já não for dono,
   escolhe a hipoteca viva por defeito e, se o montante ainda estiver vazio, sugere valor e
   descrição a partir da renda do contrato ou da prestação da hipoteca. As sugestões ficam
   marcadas em _aA/_aL para o keepTyped as distinguir do que o utilizador escreveu.
   Devolve: nada — só mexe no tForm; quem chama repinta depois. */
function prefill(){
  const p=prop(tForm.propertyId);
  const ows=p?ownersOfProp(p).slice():(tForm.groupId?txGroupOwners(tForm).map(o=>o.id):donosGlobais().map(o=>o.id));
  /* num acerto, quem já lá está fica — pode não ser dono do imóvel (dívida de grupo paga por outro) */
  if(tForm.kind==='settle')[tForm.paidBy,tForm.toId].forEach(o=>{if(o&&ows.indexOf(o)<0&&owner(o))ows.push(o)});
  if(tForm.paidBy&&ows.indexOf(tForm.paidBy)<0)tForm.paidBy=null;
  if(tForm.toId&&ows.indexOf(tForm.toId)<0)tForm.toId=null;
  if(tForm.kind==='settle'&&!tForm.label)tForm.label='Transferência entre proprietários';
  /* imóvel com um só proprietário: os movimentos dele ficam com esse proprietário por defeito */
  if(p&&!tForm.paidBy&&tForm.kind!=='settle'){const os=ownersOfProp(p);if(os.length===1)tForm.paidBy=os[0]}
  /* a hipoteca fica associada mesmo que o montante já esteja escrito — só a sugestão de valores é que é saltada;
     com várias vivas não se escolhe nenhuma ao acaso: o seletor pede para escolher */
  if(tForm.kind==='loan'&&p&&!tForm._edit){
    const ls=liveLoans(p);
    if(!tForm.loanId||!findLoan(p,tForm.loanId))tForm.loanId=ls.length===1?ls[0].id:null;
  }
  /* numa renda nova o mês a que respeita é, quase sempre, o mês em que entra:
     sugere-se, e quem recebe em atraso corrige o campo */
  if(tForm.kind==='income'&&!tForm._edit&&tForm.contractId&&!tForm.periodo&&/^\d{4}-\d{2}/.test(String(tForm.date||'')))tForm.periodo=String(tForm.date).slice(0,7);
  if(tForm.amount)return;
  const set=(a,l)=>{tForm.amount=Math.round(a*100)/100;tForm._aA=tForm.amount;if(!tForm.label){tForm.label=l;tForm._aL=l}};
  if(tForm.kind==='income'&&p){
    const c=tForm.contractId?contract(tForm.contractId):null;
    if(c)set(c.rent,'Renda '+ctName(c));
    else{const ac=activeContracts(p.id);if(ac.length===1)set(ac[0].rent,'Renda '+ctName(ac[0]))}
  }
  if(tForm.kind==='loan'&&p){
    const l=tForm.loanId?findLoan(p,tForm.loanId):null;
    if(l)set(loanCalc(l).total,'Prestação '+(l.name?l.name+' · ':'')+p.name);
  }
}
// Antes de repintar por causa de uma mudança: guarda o que está no DOM e esvazia
// descrição/montante se ainda forem as sugestões automáticas — o que foi escrito à mão fica.
// Devolve: nada — só mexe no tForm.
function keepTyped(){collectTx();if(tForm.label===tForm._aL)tForm.label='';if(tForm.amount===tForm._aA)tForm.amount=''}
/* O corpo da ficha de um movimento: o que se sabe sobre ele, para ler.

   Pela ordem da pergunta que traz alguém aqui — vi esta linha na lista: o
   que foi, de quanto, quando, de que imóvel, quem pagou, e quanto disto é
   meu. O resto (a hipoteca, a dívida a terceiros, a categoria) só aparece
   quando é deste movimento.
   Recebe: id — o id do movimento.
   Devolve: o HTML do corpo, ou vazio se o movimento já não existir. */
function txFicha(id){
  const t=(db.transactions||[]).find(x=>x.id===id);if(!t)return '';
  const K=KIND[t.kind]||KIND.expense,p=prop(t.propertyId);
  const l=t.kind==='loan'&&pode(t.propertyId,'loan.view')?findLoan(p,t.loanId):null;
  const os=p?ownersOfProp(p):[];
  const ct=t.contractId?contract(t.contractId):null;
  const cred=(t.creditor||'').trim();
  const nome=o=>esc((owner(o)||{}).name||'?');
  /* A divisão entre proprietários só na minha casa: num imóvel de
     colaboração o servidor apaga as quotas, e o que sobrava era uma
     repartição por igual — um número inventado com ar de combinado. */
  const verDivisao=countsBetweenOwners(t)&&p&&souDono(t.propertyId)&&os.length>1;
  const modo=(lista,m,def)=>{const x=lista.find(y=>y[0]===(m||def));return x?x[1]:''};
  /* O que o IRS pergunta a este movimento. Numa renda: o mês a que respeita,
     o que ficou retido na fonte (e a renda bruta, que é o que o Anexo F quer)
     e o recibo eletrónico — este só num contrato declarado, porque só aí a AT
     o espera. Numa despesa: a coluna do Anexo F, e de onde veio a decisão. */
  const renda=t.kind==='income',recibo=renda&&ehRenda(t)&&ctDeclarado(ct);
  const col=t.kind==='expense'?irsColunaDe(t):null;
  const origem=col?({movimento:'escolhida neste movimento',sub:'pela subcategoria',categoria:'pela categoria',
    omissao:'sem regra, cai em Outros',excluido:'não conta: categoria fora dos totais'}[col.origem]||''):'';
  return ficha([
    {tipo:'nota',valor:esc(motivoRecusa(t.propertyId,'tx.add',t))},
    {rotulo:'Montante',valor:`<span class="${K.color}">${K.sign}${euro2(t.amount)}</span>`},
    {rotulo:'Tipo',valor:esc(K.short)+(t.kind==='loan'?(t.payType==='amortizacao'?' · amortização':' · prestação'):'')},
    {rotulo:'Data',valor:dPT(t.date)},
    {rotulo:'Imóvel',valor:t.propertyId?esc(propName(t.propertyId)):(t.groupId?esc('Grupo '+((grp(t.groupId)||{}).name||'')):'Todos os imóveis')},
    ct&&pode(t.propertyId,'contract.view')?{rotulo:'Contrato',valor:esc(ctName(ct))}:null,
    renda&&ehRenda(t)&&t.periodo?{rotulo:'Mês da renda',valor:esc(mesPt(t.periodo))}:null,
    renda&&t.retencao>0?{rotulo:'Retido na fonte',valor:euro2(t.retencao)}:null,
    renda&&t.retencao>0?{rotulo:'Renda bruta',valor:euro2(rendaBruta(t))}:null,
    recibo?{rotulo:'Recibo eletrónico',valor:t.recibo?'Emitido':'Por emitir'}:null,
    t.kind==='settle'?{rotulo:'Transferência',valor:nome(t.paidBy)+' → '+nome(t.toId)}:null,
    t.kind!=='settle'&&owner(t.paidBy)?{rotulo:isIn(t.kind)?'Recebido por':'Pago por',valor:nome(t.paidBy)}:null,
    /* o txSplitCents e o psplitCents devolvem os cêntimos PELA ORDEM da lista
       que recebem, e não por id: liam-se por chave (c[o.id]) e a ficha dizia
       0 € a toda a gente — nos donos, o «os» são ids, e nem o nome saía */
    verDivisao?{tipo:'bloco',rotulo:'Divisão entre proprietários',valor:(function(){
      const c=txSplitCents(t,p,os);
      return esc(modo(SPLIT_MODES,(t.split||{}).mode,'quota'))+'<br>'+
        os.map((o,i)=>nome(o)+' · '+euro2((c[i]||0)/100)).join('<br>');
    })()}:null,
    t.groupId&&txProps(t).length>1?{tipo:'bloco',rotulo:'Divisão entre imóveis',valor:(function(){
      const ps=txProps(t),c=psplitCents(t,ps,Math.abs(Math.round((Number(t.amount)||0)*100)));
      return esc(modo(PSPLIT_MODES,(t.psplit||{}).mode,'equal'))+'<br>'+
        ps.map((x,i)=>esc(x.name)+' · '+euro2((c[i]||0)/100)).join('<br>');
    })()}:null,
    l?{rotulo:'Hipoteca',valor:esc(loanName(l))}:null,
    /* os juros e o capital vivem no próprio movimento e chegam inteiros a
       quem tem tx.view: pedir loan.view aqui escondia-os a quem tem direito */
    t.kind==='loan'&&(t.principal||t.interest||t.fee)?{tipo:'bloco',rotulo:'Distribuição do pagamento',
      valor:t.payType==='amortizacao'
        ?'Abate ao capital <b>'+euro2(t.principal||0)+'</b>'+(t.fee?' · comissão <b>'+euro2(t.fee)+'</b>':'')
        :'Juros <b>'+euro2(t.interest||0)+'</b> · capital <b>'+euro2(t.principal||0)+'</b>'+(t.stamp?' · imposto do selo <b>'+euro2(t.stamp)+'</b>':'')}:null,
    /* o saldo é o de HOJE, já com este pagamento abatido — não é um retrato
       à data do movimento, e o rótulo tem de o dizer */
    l?{rotulo:'Capital ainda em dívida',valor:euro(l.outstanding)}:null,
    t.kind==='owed'&&cred?{rotulo:'De quem recebi',valor:esc(cred)}:null,
    t.kind==='repay'&&cred?{rotulo:'A quem devolvi',valor:esc(cred)}:null,
    /* só com imóvel: sem ele, creditorBalances filtra pelo âmbito e pelo
       filtro de proprietário da vista que está por trás da janela, e o saldo
       mudava conforme o filtro que por acaso estivesse ligado */
    (t.kind==='owed'||t.kind==='repay')&&t.propertyId&&cred?{tipo:'bloco',rotulo:'Conta com esta pessoa',
      valor:(function(){const r=creditorBalances(t.propertyId).find(x=>x.creditor===cred);
        return r?'Recebido '+euro2(r.received)+' · devolvido '+euro2(r.repaid)+' · falta <b>'+euro2(r.due)+'</b>':''})()}:null,
    {rotulo:'Categoria',valor:esc([t.category,t.sub].filter(Boolean).join(' / '))},
    col?{rotulo:'Anexo F',valor:esc(irsColunaNome(col.col))+(origem?' <span class="small u-fw-400">'+esc(origem)+'</span>':'')}:null,
    (t.tags||[]).length?{rotulo:'Etiquetas',valor:(t.tags||[]).map(esc).join(' · ')}:null,
    !countsInTotals(t)?{tipo:'nota',valor:isPassivo(t)
      ?'Não entra nos totais nem no resultado: é dinheiro que se devolve — uma caução ou um empréstimo recebido.'
      :'Não entra nos totais nem no resultado.'}:null,
    String(t.notes||'').trim()?{tipo:'bloco',rotulo:'Comentários',valor:rich(t.notes)}:null,
  ]);
}
/* O «Editar» da ficha de um movimento. A chamada ao txModal leva um objeto,
   como todas as outras, e um objeto literal fica fora da gramática das ações:
   por isso a ação chama esta, e não o txModal diretamente.
   Recebe: id — o id do movimento a alterar.
   Devolve: nada — abre o formulário do movimento. */
function editarMovimento(id){
  txModal({id:id});
}
/* A ficha de um movimento: o que tocar numa linha de movimento passa a abrir.
   Recebe: id — o id do movimento.
   Devolve: nada — abre a janela. */
function txView(id){
  const t=(db.transactions||[]).find(x=>x.id===id);if(!t)return;
  const ok=podeEditar(t.propertyId,'tx.add',t);
  abrirFicha({
    titulo:()=>{const x=(db.transactions||[]).find(y=>y.id===id);return x?(x.label||'Movimento'):'Movimento'},
    corpo:()=>txFicha(id),
    menu:()=>{
      const x=(db.transactions||[]).find(y=>y.id===id);if(!x)return '';
      const it=[];
      /* os atalhos para outros serviços só com eles ligados nesta conta:
         desligados, a ficha continua a dizer o imóvel, o contrato e a
         hipoteca em texto, mas não promete um ecrã que não existe */
      if(servicoLigado('properties')&&x.propertyId&&prop(x.propertyId))it.push({label:'Ver imóvel',icon:'building',toca:'camada',act:`propView('${jsq(x.propertyId)}')`});
      if(servicoLigado('contracts')&&x.contractId&&contract(x.contractId)&&pode(x.propertyId,'contract.view'))
        it.push({label:'Ver contrato',icon:'contract',toca:'camada',act:`ctView('${jsq(x.contractId)}')`});
      /* num pagamento de crédito a pergunta seguinte é «quanto é que ainda
         falta», e a ficha da hipoteca é onde isso está por inteiro */
      if(servicoLigado('credits')&&x.kind==='loan'&&pode(x.propertyId,'loan.view')&&findLoan(prop(x.propertyId),x.loanId))
        it.push({label:'Ver hipoteca',icon:'bank',toca:'camada',act:`mortView('${jsq(x.propertyId)}','${jsq(x.loanId)}')`});
      if(ok)it.push({label:'Apagar movimento',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delTx('${jsq(id)}')`});
      return it.length?menu('fichaTx',it):'';
    },
    editar:ok?{rotulo:'Editar',act:`editarMovimento('${jsq(id)}')`}:null,
  });
}

const SPLIT_MODES=[['equal','Partes iguais','o mesmo para cada proprietário'],['quota','Quotas do imóvel','pela quota-parte de cada um'],['pct','Quotas a definir','em partes: quem tem 2 paga o dobro de quem tem 1 (2 e 1 → 2/3 e 1/3)'],['percent','Percentagem','percentagem de cada um; devem somar 100'],['amount','Valor certo','montante de cada um; têm de somar o total'],['adjust','Ajuste','um extra por cima da parte igual: tira-se ao total o extra de cada um, o resto divide-se em partes iguais por todos e cada um soma o seu (15 € com 5 de extra para um de dois → 10 € e 5 €)']];
/* Monta o HTML do formulário do movimento a partir do tForm. Os campos variam com o tipo
   (contrato nas rendas, hipoteca e distribuição nos créditos, credor nas dívidas a terceiros,
   quem paga/recebe nos acertos) e com o contexto (modelo, recorrência, grupo de imóveis).
   Só devolve a string; quem a põe no DOM é o openModal ou o repaintTx.
   Devolve: o HTML do formulário (string). */
function txBody(){
  /* os contratos que ainda não acabaram, e não só os em vigor: a caução e as
     rendas antecipadas de um contrato recebem-se ANTES de ele começar, e sem
     isto esse dinheiro não tinha a que se ligar */
  const t=tForm,p=prop(t.propertyId),acs=servicoLigado('contracts')&&t.propertyId?contractsOf(t.propertyId).filter(ctVivo):[];
  const lns=liveLoans(p);
  const curLoan=t.kind==='loan'&&t.loanId?findLoan(p,t.loanId):null;
  /* com várias vivas e nenhuma escolhida, a primeira opção pede a escolha; uma hipoteca que não
     existe neste imóvel (dados importados) aparece como desconhecida em vez de fingir ser a primeira */
  const lnOpts=(!t.loanId&&lns.length>1?[{v:'',label:'— escolhe a hipoteca —'}]:[])
    .concat(lns.map(l=>({v:l.id,label:loanName(l)+' · '+euro(l.outstanding)})))
    .concat(curLoan&&!(Number(curLoan.outstanding)>0)?[{v:curLoan.id,label:loanName(curLoan)+' · liquidada'}]:[])
    .concat(t.kind==='loan'&&t.loanId&&!curLoan?[{v:t.loanId,label:'Hipoteca desconhecida (outro imóvel)'}]:[]);
  /* sem imóvel, a despesa pode na mesma ser paga por alguém; num grupo, pelos donos dos imóveis do grupo */
  const ows=(p?ownersOfProp(p).map(owner):(t.groupId?txGroupOwners(t):donosGlobais())).filter(Boolean);
  if(t.kind==='settle')[t.paidBy,t.toId].forEach(o=>{const x=o&&owner(o);if(x&&!ows.some(y=>y.id===o))ows.push(x)});
  const cs=catsFor(t.kind)||{},subs=(cs[t.category]||[]).slice();
  if(t.sub&&subs.indexOf(t.sub)<0)subs.unshift(t.sub);
  /* «Crédito à habitação» é dos pagamentos de crédito: uma despesa assim classificada contava como despesa e não abatia nada */
  const catKeys=Object.keys(cs).filter(c=>!(t.kind==='expense'&&c==='Crédito à habitação'));if(t.category&&catKeys.indexOf(t.category)<0)catKeys.unshift(t.category);
  const credit=t.kind==='owed'||t.kind==='repay',settle=t.kind==='settle';
  const owOpts=[{v:'',label:'Todos os proprietários'}].concat(ows.map(o=>({v:o.id,label:o.name})));
  /* a categoria e a subcategoria são texto de quem as escreveu — e o resumo da dobra entra no HTML tal e qual */
  const catSum=esc([t.category,t.sub].filter(Boolean).join(' / '))+((t.tags||[]).length?(t.category?' · ':'')+t.tags.length+' etiqueta'+(t.tags.length===1?'':'s'):'');
  const planeado=txModo.modo==='rec',modelo=txModo.modo==='tpl';
  return `<div class="form">
    ${modelo?`<label>Nome do modelo<input id="t_tplName" value="${esc(txModo.tplName||'')}" placeholder="Ex.: Renda mensal T2" autocomplete="off"></label>`:''}
    ${credit?`<div class="seg c2">${[['owed','users','Recebida','alguém me emprestou'],['repay','down','Paga','devolvo a essa pessoa']].map(([k,i,l,sb])=>`<button type="button" class="opt ${t.kind===k?'on':''}" data-toca="rascunho" data-click="setKind('${k}')"><span class="ic">${ic(i,18)}</span><b>${l}</b><small>${sb}</small></button>`).join('')}</div>`:''}
    <label>Descrição <span class="req">*</span><input id="t_label" value="${esc(t.label)}" placeholder="${t.kind==='income'?'Renda de agosto':t.kind==='loan'?'Prestação de agosto':t.kind==='owed'?'Empréstimo para obras':t.kind==='repay'?'Devolução de parte do empréstimo':t.kind==='settle'?'Acerto entre proprietários':'Condomínio'}" autocomplete="off"></label>
    <div class="row">
      <label>Montante (€) <span class="req">*</span><div class="u-d-flex u-g-7px u-ai-center">
        <input id="t_amount" type="text" inputmode="decimal" class="u-fx-1 u-minw-0" value="${t.amount||''}" placeholder="900" data-input="txMontanteEscrito(this.value)">
        <button type="button" class="btn sm primary${calcLoanTotal()!=null&&Math.abs((num(t.amount)||0)-calcLoanTotal())>0.011?'':' u-d-none'} u-fx-0-0-auto u-p-9px-12px" id="amt_reset" title="Repor a prestação calculada" data-toca="rascunho" data-click="onAmtReset()">Repor</button></div></label>
      ${planeado?'<span></span>':`<label>Data<input id="t_date" type="date" value="${esc(t.date)}"></label>`}</div>
    <label>Imóvel${sel('t_prop',t.propertyId||(t.groupId?'g:'+t.groupId:''),(podeSemImovel()?[{v:'',label:'Todos os imóveis'}]:[]).concat(propOptsPara(planeado?'rec.add':'tx.add',t.propertyId)).concat(podeSemImovel()?gdiv(gOpts('prop')):[]),'onPropChange','rascunho')}</label>
    ${t.kind==='income'&&acs.length?`<label>Contrato${sel('t_ct',t.contractId||'',[{v:'',label:'Todos os contratos'}].concat(acs.map(c=>({v:c.id,label:ctName(c)+(ctEstado(c)==='futuro'&&c.start?' · começa a '+dPT(c.start):'')}))),'onCtChange','rascunho')}</label>`:''}
    ${t.kind==='income'&&(t.contractId||t.category==='Rendas')?txFiscoSect():''}
    ${t.kind==='loan'&&lnOpts.length?`<label>Hipoteca${sel('t_loan',t.loanId||'',lnOpts,'onLoanChange','rascunho')}</label>`:''}
    ${credit?`<label>${t.kind==='owed'?'De quem recebo':'A quem pago'}<input id="t_creditor" value="${esc(t.creditor||'')}" placeholder="Pai, amigo, empreiteiro…" autocomplete="off" list="creditorList" data-input="refreshCredHint()">
        <datalist id="creditorList">${knownCreditors().map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label>
      <div class="hint" id="credHint">${credHint()}</div>`:''}
    ${settle?(ows.length>1?`<div class="row">
        <label>Quem paga${sel('t_paid',t.paidBy||'',owOpts,'','rascunho')}</label>
        <label>Quem recebe${sel('t_to',t.toId||'',owOpts,'','rascunho')}</label></div>
      <div class="hint">Transferência entre proprietários deste imóvel: acerta as contas entre donos e não conta como receita nem despesa.</div>`
      :`<div class="hint">Escolhe um imóvel com pelo menos dois proprietários.</div>`)
    :(ows.length?`<label>${isIn(t.kind)?'Recebido por':'Pago por'}${sel('t_paid',t.paidBy||'',owOpts,'','rascunho')}</label>`:'')}
    <div id="loanHint">${loanHint()}</div>
    ${settle?'':fold('cat','Categoria e etiquetas',`<div class="${subs.length||t.category?'row':''}">
      <label>Categoria${sel('t_cat',t.category,[{v:'',label:'— sem categoria —'}].concat(catKeys.map(c=>({v:c,label:c}))).concat([{v:'__new__',label:'+ Criar categoria…'}]),'onCatChange','rascunho')}</label>
      ${subs.length||t.category?`<label>Subcategoria${sel('t_sub',t.sub,[{v:'',label:'— indiferente —'}].concat(subs.map(x=>({v:x,label:x}))).concat([{v:'__new__',label:'+ Criar subcategoria…'}]),'onSubChange','rascunho')}</label>`:''}</div>
      ${t.kind==='expense'?`<label>Coluna no Anexo F${sel('t_irscol',t.irsCol||'',[{v:'',label:'Pela categoria: '+irsColunaNome(irsColunaDe(Object.assign({},t,{irsCol:''})).col)}].concat(IRS_COLUNAS.map(x=>({v:x[0],label:x[1]}))),'onIrsCol','rascunho')}</label>
      <div class="hint u-mt-n6px">Só o que pagaste para obter a renda entra. Juros, mobiliário, eletrodomésticos e obras que acrescentam valor ficam de fora.</div>`:''}
      <div><div class="flabel">Etiquetas</div>${tagField((t.tags||[]).map(g=>({id:g,label:g})),'Adicionar','addTxTag()','delTxTag','grey')}</div>`,
      {icon:'tag',open:!!(t.category||(t.tags||[]).length),summary:catSum||'sem categoria'})}
    ${(!settle&&t.groupId&&txProps(t).length>1)?psplitSect():''}
    ${(!settle&&!credit&&ows.length>1)?splitSect(ows):''}
    ${credit&&ows.length>1?`<div class="hint">Dívidas a terceiros não entram nas contas entre proprietários: ficam com quem as recebe ou paga.</div>`:''}
    ${planeado&&servicoLigado('recurring')?recSect():''}
    ${richEditor('Comentários','t_notes',t.notes)}</div>`;
}
// Texto por baixo do campo do credor: o saldo corrente com essa pessoa
// (recebido, devolvido, o que falta) ou uma orientação se ainda não há registos.
// Devolve: o texto da dica (string, pode levar HTML).
function credHint(){
  const t=tForm,name=(t.creditor||'').trim();
  if(!name)return t.kind==='owed'?'Não precisa de ficha: escreve o nome. Estas dívidas ficam fora da conta de exploração do imóvel.':'Escreve a quem estás a devolver o dinheiro.';
  const r=creditorBalances(t.propertyId||null).find(x=>x.creditor===name);
  if(!r)return t.kind==='owed'?'Primeira dívida a '+esc(name)+'.':'Não há dívida registada a '+esc(name)+' neste imóvel.';
  return `Recebido de ${esc(name)}: ${euro2(r.received)} · devolvido ${euro2(r.repaid)} · <b>${r.due>0.005?'em dívida '+euro2(r.due):'liquidado'}</b>`;
}
// Ao escrever o nome do credor: atualiza tForm.creditor e repinta só a dica do saldo.
// Devolve: nada — repinta a dica no DOM.
function refreshCredHint(){const e=document.getElementById('credHint');if(e){tForm.creditor=val('t_creditor');e.innerHTML=credHint()}}
/* O que o IRS pergunta a uma renda: o mês a que respeita (uma renda de agosto
   paga em setembro é de agosto), o que o inquilino reteve na fonte (o
   montante é o que entrou; a renda bruta é a soma), e — só num contrato
   declarado à AT, porque só aí ela o espera — se o recibo eletrónico já foi
   emitido. Vai logo a seguir ao contrato, porque é dele que depende.
   Devolve: string com o HTML da secção. */
function txFiscoSect(){
  const t=tForm,c=t.contractId?contract(t.contractId):null;
  /* um modelo ou uma recorrência repete a retenção, mas o mês e o recibo são
     de cada renda (não estão em TX_TPL_KEYS): mostrá-los aqui era um campo
     que não grava. Ficam para o movimento que se confirma. */
  const fixo=txModo.modo!=='rec'&&txModo.modo!=='tpl';
  return `<div class="${fixo?'row':''}">
      ${fixo?`<label>Mês a que respeita<input id="t_periodo" type="month" value="${esc(t.periodo||'')}" placeholder="AAAA-MM"></label>`:''}
      <label>Retido na fonte (€)<input id="t_retencao" type="text" inputmode="decimal" value="${t.retencao?dec(t.retencao):''}" placeholder="0"></label></div>
    <div class="hint u-mt-n6px">Se o inquilino é uma empresa que retém IRS, escreve o que ficou retido: a renda bruta é o montante mais isto.</div>
    ${fixo&&ctDeclarado(c)?`<label class="check"><input type="checkbox" id="t_recibo" ${t.recibo?'checked':''}> Recibo de renda eletrónico emitido</label>
    <div class="hint u-mt-n4px">Emite-se no Portal das Finanças quando a renda entra; marcar aqui cala o aviso.</div>`:''}`;
}
// Mudou a coluna do Anexo F escolhida à mão: guarda-a no tForm. Vazio é
// «pela categoria», e o seletor já mostra o rótulo novo — não há que repintar.
// Devolve: nada — atualiza tForm.irsCol.
function onIrsCol(){collectTx();tForm.irsCol=val('t_irscol')||''}
/* divisão entre proprietários: quotas, percentagem, valor certo ou ajuste
   Recebe: ows — os proprietários a listar (objetos com id e name, já resolvidos).
   Devolve: o HTML da secção dobrável (string). */
function splitSect(ows){
  const t=tForm,sp=t.split||{mode:'quota',parts:{}},mode=sp.mode||'quota',parts=sp.parts||{};
  const lab=(SPLIT_MODES.find(m=>m[0]===mode)||[])[1]||'';
  return fold('split','Divisão entre proprietários',`
    <label>Como se divide${sel('t_split',mode,SPLIT_MODES.map(m=>({v:m[0],label:m[1]})),'onSplitSel','rascunho')}</label>
    ${(mode==='quota'||mode==='equal')?'':`<div class="form u-g-7px">${ows.map(o=>`<div class="ownrow"><span class="avatar u-w-30px u-h-30px u-fs-11px u-fx-0-0-30px">${esc(initials(o.name))}</span>
      <span class="nm">${esc(o.name)}</span>
      <input id="t_sp_${o.id}" type="text" inputmode="decimal" class="u-w-84px u-fx-0-0-84px" value="${parts[o.id]!=null&&parts[o.id]!==''?dec(parts[o.id]):''}" placeholder="0" data-input="refreshSplit()">
      <span class="pc">${mode==='pct'?'partes':mode==='percent'?'%':'€'}</span></div>`).join('')}</div>`}
    <div class="hint" id="splitHint">${splitHint(ows)}</div>`,{icon:'split',summary:lab});
}
/* Dica por baixo da divisão entre proprietários: explica o modo escolhido, avisa quando
   as contas não batem certo (falta, excesso, percentagens fora dos 100) e mostra quanto
   calha a cada um com o montante atual. ows: os proprietários do imóvel, já resolvidos.
   Recebe: ows — os proprietários do imóvel (objetos com id e name).
   Devolve: o HTML da dica (string; '' sem imóvel escolhido). */
function splitHint(ows){
  const t=tForm,p=prop(t.propertyId);if(!p)return '';
  const mode=(t.split||{}).mode||'quota',total=Math.abs(Number(t.amount)||0);
  const intro=(t.paidBy?'':'Só entra nas contas entre proprietários se indicares quem pagou ou recebeu. ')+((SPLIT_MODES.find(m=>m[0]===mode)||[])[2]||'')+'.';
  if(!total)return intro;
  const os=ows.map(o=>o.id),c=txSplitCents(t,p,os);
  let warn='';
  if(mode==='amount'){const s2=sum(os.map(o=>Number(((t.split||{}).parts||{})[o])||0)),d=Math.round((total-s2)*100)/100;
    if(Math.abs(d)>0.005)warn=`<b class="neg">${d>0?'Faltam '+euro2(d):'Passa '+euro2(-d)}</b> · `}
  if(mode==='percent'){const s2=sum(os.map(o=>Number(((t.split||{}).parts||{})[o])||0));
    if(Math.abs(s2-100)>0.01)warn=`<b class="neg">Somam ${dec(Math.round(s2*100)/100)}%</b> · `}
  if(mode==='adjust'){const pr=(t.split||{}).parts||{},s2=sum(os.map(o=>Number(pr[o])||0));
    if(os.some(o=>Number(pr[o])<0))warn=`<b class="neg">Ajustes negativos não contam</b> · `;
    else if(s2>total+0.005)warn=`<b class="neg">Os ajustes (${euro2(s2)}) passam o total</b> · `}
  return warn+intro+'<br>'+ows.map((o,i)=>`${esc(o.name.split(' ')[0])} <b>${euro2(c[i]/100)}</b>`).join(' · ');
}
// Valida a divisão entre proprietários antes de guardar: devolve a mensagem de erro,
// ou '' se está tudo certo (quotas e partes iguais nunca falham).
// Devolve: a mensagem de erro (string) ou '' se está tudo válido.
function splitError(){
  const t=tForm,p=prop(t.propertyId),mode=(t.split||{}).mode;
  if(!p||!mode||mode==='quota'||mode==='equal')return '';
  const os=ownersOfProp(p),parts=(t.split||{}).parts||{},total=Math.abs(Number(t.amount)||0);
  const s2=sum(os.map(o=>Number(parts[o])||0));
  if(mode==='amount'&&Math.abs(s2-total)>0.005)return 'Os valores da divisão têm de somar '+euro2(total)+'.';
  if(mode==='adjust'){
    if(os.some(o=>Number(parts[o])<0))return 'Os ajustes não podem ser negativos: um ajuste é sempre um extra.';
    if(s2>total+0.005)return 'Os ajustes somam '+euro2(s2)+' e não podem passar o total ('+euro2(total)+').';
  }
  if(mode==='pct'&&!(s2>0))return 'Indica pelo menos uma quota.';
  if(mode==='percent'&&Math.abs(s2-100)>0.01)return 'As percentagens têm de somar 100 (somam '+dec(Math.round(s2*100)/100)+').';
  return '';
}
// Lê do DOM o modo e os valores da divisão entre proprietários para tForm.split.
// 'quota' é o comportamento por omissão, por isso guarda-se como null.
// Devolve: nada — escreve em tForm.split (null quando fica 'quota').
function collectSplit(){
  const t=tForm,mode=(t.split||{}).mode;
  if(document.getElementById('t_split'))t.split=Object.assign({},t.split||{},{mode:val('t_split')||'quota'});
  const m2=(t.split||{}).mode;
  if(!m2||m2==='quota'){t.split=null;return}
  if(m2==='equal'){t.split={mode:'equal',parts:{}};return}
  const p=prop(t.propertyId),parts={};
  const os=p?ownersOfProp(p):(t.groupId?txGroupOwners(t).map(o=>o.id):db.owners.map(o=>o.id));
  /* percentagens e partes leem-se pelo numTaxa («0,125» é 0,125, não 125); os
     valores certos e os ajustes são euros, e aí «1.500» são mil e quinhentos */
  const lerParte=(m2==='amount'||m2==='adjust')?num:numTaxa;
  os.forEach(o=>{const e=document.getElementById('t_sp_'+o);if(e&&String(e.value).trim()!=='')parts[o]=lerParte(e.value)});
  t.split={mode,parts};
}
/* divisão do valor pelos imóveis do grupo */
const PSPLIT_MODES=[['equal','Partes iguais','o mesmo para cada imóvel'],['value','Pelo valor de mercado','proporcional ao valor atual'],['purchase','Pelo valor de aquisição','proporcional ao que custou'],['pct','Quotas a definir','em partes: 2 e 1 → 2/3 e 1/3'],['percent','Percentagem','de cada imóvel; devem somar 100'],['amount','Valor certo','montante de cada imóvel; têm de somar o total'],['adjust','Ajuste','um extra por cima da parte igual: o total menos os extras divide-se em partes iguais por todos os imóveis e cada um soma o seu']];
// Secção "Divisão entre imóveis" dos movimentos de grupo: escolha do modo e,
// quando o modo pede valores, um campo por imóvel. Devolve o HTML do fold.
// Devolve: o HTML do fold (string).
function psplitSect(){
  const t=tForm,ps=txProps(t),sp=t.psplit||{mode:'equal',parts:{}},mode=sp.mode||'equal',parts=sp.parts||{};
  const lab=(PSPLIT_MODES.find(m=>m[0]===mode)||[])[1]||'';
  return fold('psplit','Divisão entre imóveis',`
    <label>Como se divide${sel('t_psplit',mode,PSPLIT_MODES.map(m=>({v:m[0],label:m[1]})),'onPsplitSel','rascunho')}</label>
    ${['equal','value','purchase'].indexOf(mode)>-1?'':`<div class="form u-g-7px">${ps.map(p=>`<div class="ownrow"><span class="avatar u-w-30px u-h-30px u-fs-11px u-fx-0-0-30px">${ic('building',15)}</span>
      <span class="nm">${esc(p.name)}</span>
      <input id="t_pp_${p.id}" type="text" inputmode="decimal" class="u-w-84px u-fx-0-0-84px" value="${parts[p.id]!=null&&parts[p.id]!==''?dec(parts[p.id]):''}" placeholder="0" data-input="refreshPsplit()">
      <span class="pc">${mode==='pct'?'partes':mode==='percent'?'%':'€'}</span></div>`).join('')}</div>`}
    <div class="hint" id="psplitHint">${psplitHint()}</div>`,{icon:'building',open:true,summary:lab});
}
// Dica da divisão entre imóveis: explica o modo, avisa somas que não batem certo
// e mostra quanto fica para cada imóvel do grupo.
// Devolve: o HTML da dica (string; '' com menos de dois imóveis).
function psplitHint(){
  const t=tForm,ps=txProps(t);if(ps.length<2)return '';
  const mode=(t.psplit||{}).mode||'equal',total=Math.abs(Number(t.amount)||0);
  const intro=((PSPLIT_MODES.find(m=>m[0]===mode)||[])[2]||'')+'.';
  if(!total)return intro;
  const c=psplitCents(t,ps,Math.round(total*100));
  let warn='';
  const s2=sum(ps.map(p=>Number(((t.psplit||{}).parts||{})[p.id])||0));
  if(mode==='amount'){const d=Math.round((total-s2)*100)/100;if(Math.abs(d)>0.005)warn=`<b class="neg">${d>0?'Faltam '+euro2(d):'Passa '+euro2(-d)}</b> · `}
  if(mode==='percent'&&Math.abs(s2-100)>0.01)warn=`<b class="neg">Somam ${dec(Math.round(s2*100)/100)}%</b> · `;
  if(mode==='adjust'){const pr=(t.psplit||{}).parts||{};
    if(ps.some(p=>Number(pr[p.id])<0))warn=`<b class="neg">Ajustes negativos não contam</b> · `;
    else if(s2>total+0.005)warn=`<b class="neg">Os ajustes (${euro2(s2)}) passam o total</b> · `}
  return warn+intro+'<br>'+ps.map((p,i)=>`${esc(p.name)} <b>${euro2(c[i]/100)}</b>`).join(' · ');
}
// Valida a divisão entre imóveis: devolve a mensagem de erro ou '' se ok.
// Só se aplica a movimentos de grupo com dois ou mais imóveis.
// Devolve: a mensagem de erro (string) ou '' se está tudo válido.
function psplitError(){
  const t=tForm;if(!t.groupId)return '';
  const ps=txProps(t),mode=(t.psplit||{}).mode;
  if(ps.length<2||!mode||['equal','value','purchase'].indexOf(mode)>-1)return '';
  const parts=(t.psplit||{}).parts||{},total=Math.abs(Number(t.amount)||0);
  const s2=sum(ps.map(p=>Number(parts[p.id])||0));
  if(mode==='amount'&&Math.abs(s2-total)>0.005)return 'Os valores por imóvel têm de somar '+euro2(total)+'.';
  if(mode==='adjust'){
    if(ps.some(p=>Number(parts[p.id])<0))return 'Os ajustes por imóvel não podem ser negativos: um ajuste é sempre um extra.';
    if(s2>total+0.005)return 'Os ajustes por imóvel somam '+euro2(s2)+' e não podem passar o total ('+euro2(total)+').';
  }
  if(mode==='pct'&&!(s2>0))return 'Indica pelo menos uma quota de imóvel.';
  if(mode==='percent'&&Math.abs(s2-100)>0.01)return 'As percentagens por imóvel têm de somar 100 (somam '+dec(Math.round(s2*100)/100)+').';
  return '';
}
// Lê do DOM o modo e os valores por imóvel para tForm.psplit (fora de um grupo fica null).
// Devolve: nada — escreve em tForm.psplit.
function collectPsplit(){
  const t=tForm;
  if(!t.groupId){t.psplit=null;return}
  if(document.getElementById('t_psplit'))t.psplit=Object.assign({},t.psplit||{},{mode:val('t_psplit')||'equal'});
  const mode=(t.psplit||{}).mode||'equal',parts={};
  // como na divisão entre donos: percentagens e partes pelo numTaxa, euros pelo num
  const lerParte=(mode==='amount'||mode==='adjust')?num:numTaxa;
  txProps(t).forEach(p=>{const e=document.getElementById('t_pp_'+p.id);if(e&&String(e.value).trim()!=='')parts[p.id]=lerParte(e.value)});
  t.psplit={mode,parts};
}
// Mudou o modo da divisão entre imóveis: guarda o formulário e repinta para mostrar ou esconder os campos.
// Devolve: nada — repinta o modal.
function onPsplitSel(){collectTx();tForm.psplit={mode:val('t_psplit')||'equal',parts:(tForm.psplit||{}).parts||{}};repaintTx()}
// Ao escrever num valor por imóvel: recolhe e atualiza só a dica, sem repintar o resto do modal.
// Devolve: nada — atualiza a dica no DOM.
function refreshPsplit(){collectPsplit();const e=document.getElementById('psplitHint');if(e)e.innerHTML=psplitHint()}
// Muda o modo da divisão entre proprietários e repinta; 'quota' é o defeito e guarda-se como split=null.
// Recebe: m — o modo da divisão ('equal', 'quota', 'pct', 'percent', 'amount' ou 'adjust').
// Devolve: nada — repinta o modal.
function setSplitMode(m){collectTx();tForm.split=m==='quota'?null:{mode:m,parts:(tForm.split||{}).parts||{}};repaintTx()}
// Aplica o modo escolhido no select da divisão entre proprietários.
// Devolve: nada — repinta o modal via setSplitMode.
function onSplitSel(){setSplitMode(val('t_split')||'quota')}
// Ao escrever num valor da divisão entre proprietários: recolhe e atualiza só a dica com os novos montantes.
// Devolve: nada — atualiza a dica no DOM.
function refreshSplit(){
  collectSplit();
  const e=document.getElementById('splitHint');if(!e)return;
  e.innerHTML=splitHint(ownersOfProp(prop(tForm.propertyId)||{}).map(owner).filter(Boolean));
}
/* A prestação calculada na hipoteca para este movimento: sobre o capital que
   ainda se pode abater com ele (loanAvail) e, numa edição, sem ele próprio
   contar nas prestações registadas (_paidOfs=−1).
   Recebe: t — o movimento; l — a hipoteca.
   Devolve: o objeto de loanCalc ({base, interest, stamp, principal, total, rate, n, esgotado}). */
function calculoDaPrestacao(t,l){return loanCalc(Object.assign({},l,{outstanding:loanAvail(t,l)},t._edit?{_paidOfs:-1}:{}))}
/* O montante que a distribuição reparte: o escrito, ou — numa prestação ainda
   sem montante — a prestação calculada.
   Recebe: t — o movimento; l — a hipoteca.
   Devolve: número em euros. */
function montanteDoCredito(t,l){return num(t.amount)||(t.payType==='amortizacao'?0:calculoDaPrestacao(t,l).total)}
/* A distribuição de um pagamento de crédito: quanto é juros, selo, capital e
   comissão. Uma amortização antecipada é capital e a comissão da hipoteca,
   sem juros nem selo. Uma prestação leva os juros do plano — ou os escritos à
   mão, numa edição ou depois de mexer na tabela (_splitTouched) —, o selo dos
   juros e o capital como resto, sem comissão; um capital escrito à mão que
   fica a um cêntimo e pouco do montante acerta-se nele, para a soma bater ao
   cêntimo. Só calcula: o cartão (loanHint) lê-a para pintar e o guardar
   (txGuardar) para gravar — nenhum dos dois escreve a distribuição por conta
   própria, e ela já não depende de o cartão ter sido pintado, nem da ordem.
   Recebe: t — o movimento (amount, payType, _edit, _splitTouched e, quando
   escritos à mão, interest e principal); l — a hipoteca.
   Devolve: {interest, stamp, principal, fee} em euros. */
function distribuicaoDe(t,l){
  const amt=montanteDoCredito(t,l);
  if(t.payType==='amortizacao'){const fr=amortFeeRate(l),cap=r2(amt/(1+fr));return {interest:0,stamp:0,principal:cap,fee:r2(amt-cap)}}
  const rate=l.stampTax===false?0:stampPct(),manual=!!(t._splitTouched||t._edit);
  const int=manual&&t.interest!=null?Number(t.interest):r2(calculoDaPrestacao(t,l).interest);
  const st=r2(int*rate);
  let cap=manual&&t.principal!=null?Number(t.principal):r2(amt-int-st);
  const d=r2(amt-int-st-cap);if(Math.abs(d)<=0.011&&d!==0)cap=r2(cap+d);
  return {interest:int,stamp:st,principal:cap,fee:0};
}
/* Cartão da distribuição de um pagamento de crédito: o seletor prestação/amortização e,
   conforme o tipo, capital+comissão ou juros editáveis com selo derivado e capital como resto.
   Só pinta: os números vêm do distribuicaoDe, e é o guardar que os grava.
   Devolve: o HTML do cartão (string; '' se o movimento não for de crédito). */
function loanHint(){
  const t=tForm,p=prop(t.propertyId),l=t.loanId?findLoan(p,t.loanId):null;
  if(t.kind!=='loan')return'';
  if(!l){
    if(!t.loanId&&liveLoans(p).length>1)return `<div class="hint">Escolhe a hipoteca acima: é a ela que este pagamento abate.</div>`;
    if(t.loanId)return `<div class="hint">A hipoteca deste movimento não existe neste imóvel. Escolhe outra acima, ou deixa como está.</div>`;
    /* o caminho para criar a hipoteca só se aponta com os Créditos ligados nesta conta */
    return `<div class="hint">Nenhuma hipoteca associada. Podes registar o pagamento na mesma${servicoLigado('credits')?', ou criar a hipoteca em Finanças → Créditos':''}.</div>`;
  }
  const avail=loanAvail(t,l),fr=amortFeeRate(l),amort=t.payType==='amortizacao';
  const amt=montanteDoCredito(t,l),dist=distribuicaoDe(t,l);
  const seg=`<div class="u-mb-10px"><div class="flabel">Tipo de pagamento</div>
    <div class="seg c2">
      <button type="button" class="opt ${!amort?'on':''}" data-toca="rascunho" data-click="setPayType('prestacao')"><span class="ic">${ic('bank',18)}</span><b>Prestação</b><small>juros, selo e capital</small></button>
      <button type="button" class="opt ${amort?'on':''}" data-toca="rascunho" data-click="setPayType('amortizacao')"><span class="ic">${ic('trend',18)}</span><b>Amortização</b><small>capital e comissão</small></button></div></div>`;
  if(amort){
    /* amortização antecipada: sem juros nem selo — só capital e a comissão definida na hipoteca */
    const cap=dist.principal,fee=dist.fee;
    return seg+`<div class="card u-bg-v-tint u-p-13px">
      <div class="stat u-pt-0 u-ai-center"><span>Abate ao capital</span><b class="pos" id="lh_cap">${euro2(cap)}</b></div>
      <div class="stat u-b-0 u-ai-center"><span>Comissão de amortização (${dec(r2(fr*100))}%)</span><b class="neg" id="lh_fee">${euro2(fee)}</b></div>
      <div class="hint" id="loanLeft">${cap>avail+0.011?`<b class="neg">Só faltam ${euro2(avail)} pagar — não podes amortizar mais do que isso.</b>`:`Ficam ${euro(Math.max(0,avail-Math.min(cap,avail)))} em dívida.`}</div></div>`;
  }
  /* prestação normal: juros editáveis, selo derivado, capital é o resto — sem comissão */
  const int=dist.interest,st=dist.stamp,cap=dist.principal;
  return seg+`<div class="card u-bg-v-tint u-p-13px">
    <div class="row-between u-ai-center u-mb-2px"><span class="small"><b>Distribuição do montante</b></span>
      <button class="btn sm${t._splitTouched?'':' u-d-none'} u-fx-0-0-auto u-p-6px-9px" id="lh_reset" data-toca="rascunho" data-click="onLoanReset()" title="Repor a prestação calculada na hipoteca">${ic('clock',14)} Repor</button></div>
    <div class="stat u-ai-center"><span>Juros (€)</span>
      <input class="statin" id="t_int" type="text" inputmode="decimal" value="${dec(int.toFixed(2))}" data-input="onLoanSplit('int')"></div>
    <div class="stat u-ai-center"><span>Imposto do selo (${dec(db.settings.stampPct??4)}%)</span><b id="lh_stamp">${euro2(st)}</b></div>
    <div class="stat u-b-0 u-ai-center"><span>Abate ao capital (€)</span>
      <input class="statin pos" id="t_cap" type="text" inputmode="decimal" value="${dec(Math.max(0,cap).toFixed(2))}" data-input="onLoanSplit('cap')"></div>
    <div class="hint" id="loanLeft">${loanLeftTxt(l,int,st,cap,0,amt,avail)}</div></div>`;
}
// Linha por baixo da distribuição: quanto fica em dívida depois deste pagamento,
// ou o aviso quando o capital passa o que falta ou a soma não bate com o montante.
// Recebe: l — a hipoteca (objeto); int, st, cap, fee — juros, selo, capital e comissão (números, em €);
// amt — o montante total do pagamento (€); avail — o capital que ainda falta pagar (€).
// Devolve: o texto da linha (string HTML).
function loanLeftTxt(l,int,st,cap,fee,amt,avail){
  const sum=r2(int+st+cap+(fee||0));
  if(cap>avail+0.011)return `<b class="neg">Só faltam ${euro2(avail)} pagar — não podes amortizar mais do que isso.</b>`;
  if(cap<-0.005||fee<-0.005||int<-0.005||Math.abs(sum-amt)>0.011)return `<b class="neg">A soma da distribuição dá ${euro2(r2(int+st+Math.max(0,cap)+Math.max(0,fee||0)))}, mas o montante é ${euro2(amt)}.</b>`;
  return `Ficam ${euro(Math.max(0,avail-Math.min(cap,avail)))} em dívida.`;
}
// Alterna entre prestação e amortização: deita fora a distribuição editada à mão e recalcula a sugerida.
// Recebe: v — o tipo de pagamento ('prestacao' ou 'amortizacao').
// Devolve: nada — repinta o cartão da distribuição.
function setPayType(v){
  const t=tForm;if(t.payType===v)return;
  t.payType=v;
  delete t.interest;delete t.stamp;delete t.principal;delete t.fee;delete t._splitTouched;
  refreshLoanHint();
}
/* prestação calculada na hipoteca para o movimento atual (null se não for uma prestação)
   Devolve: a prestação com selo (número em euros, arredondado a 2 casas) — ou null. */
function calcLoanTotal(){
  const t=tForm;if(!t||t.kind!=='loan'||t.payType==='amortizacao'||!t.loanId)return null;
  const p=prop(t.propertyId),l=p?findLoan(p,t.loanId):null;if(!l)return null;
  return r2(loanCalc(Object.assign({},l,{outstanding:loanAvail(t,l)},t._edit?{_paidOfs:-1}:{})).total);
}
/* Escreveu-se no campo do montante: guarda-o no tForm e repinta o que depende
   dele. Era tudo no atributo, a começar por uma atribuição, que a gramática
   das ações não tem. Faz o mesmo e pela mesma ordem.
   Recebe: v — o texto do campo.
   Devolve: nada — atualiza o tForm e repinta as dicas. */
function txMontanteEscrito(v){
  tForm.amount=num(v);
  refreshLoanHint();refreshSplit();amtResetSync();
}
// Mostra o botão "Repor" ao lado do montante só quando o que está escrito
// difere da prestação calculada na hipoteca. O estado inicial vem da mesma
// classe (u-d-none), e não de um style= — por isso é a classe que se troca.
// Devolve: nada — põe ou tira a classe u-d-none no botão.
function amtResetSync(){
  const b=document.getElementById('amt_reset');if(!b)return;
  const c=calcLoanTotal();
  b.classList.toggle('u-d-none',!(c!=null&&Math.abs((num(val('t_amount'))||0)-c)>0.011));
}
// Botão "Repor" do montante: volta a pôr a prestação calculada e refresca distribuição e divisões.
// Devolve: nada — atualiza tForm.amount e repinta as dicas.
function onAmtReset(){
  const c=calcLoanTotal();if(c==null)return;
  tForm.amount=c;tForm._aA=c;
  const e=document.getElementById('t_amount');if(e)e.value=dec(c.toFixed(2));
  refreshLoanHint();refreshSplit();amtResetSync();
}
// Botão "Repor" da distribuição: descarta os juros/capital editados à mão e volta
// ao calculado na hipoteca — incluindo o próprio montante da prestação.
// Devolve: nada — repinta o cartão da distribuição.
function onLoanReset(){
  const t=tForm,l=t.loanId?findLoan(prop(t.propertyId),t.loanId):null;
  delete t.interest;delete t.stamp;delete t.principal;delete t.fee;delete t._splitTouched;
  /* repor também o montante para a prestação calculada na hipoteca */
  if(l){const c=loanCalc(Object.assign({},l,{outstanding:loanAvail(t,l)},t._edit?{_paidOfs:-1}:{}));
    t.amount=r2(c.total);t._aA=t.amount;
    const e=document.getElementById('t_amount');if(e)e.value=dec(t.amount.toFixed(2));}
  refreshLoanHint();
}
/* editar juros ou capital numa prestação: o total mantém-se no montante e o selo deriva dos juros
   Recebe: w — o campo editado: 'int' (juros) ou 'cap' (capital).
   Devolve: nada — escreve a distribuição no tForm e atualiza campos e dica no DOM. */
function onLoanSplit(w){
  const t=tForm,amt=num(val('t_amount'))||0;
  const l=t.loanId?findLoan(prop(t.propertyId),t.loanId):null;if(!l)return;
  const avail=loanAvail(t,l),rate=l.stampTax===false?0:stampPct();
  let int,st,cap;
  const put=(id,v)=>{const e=document.getElementById(id);if(e&&document.activeElement!==e)e.value=dec(v.toFixed(2))};
  if(w==='cap'){
    cap=num(val('t_cap'));
    const i0=Math.max(0,(amt-cap)/(1+rate));st=r2(i0*rate);int=r2(amt-cap-st);
    if(int<0){int=0;st=r2(Math.max(0,amt-cap))}
    put('t_int',int);
  }else{
    int=num(val('t_int'));st=r2(int*rate);cap=r2(amt-int-st);
    put('t_cap',Math.max(0,cap));
  }
  t.interest=int;t.stamp=st;t.principal=cap;t.fee=0;t._splitTouched=true;
  const rb=document.getElementById('lh_reset');if(rb)rb.classList.remove('u-d-none');   /* o esconder inicial é a classe u-d-none, e não um style= */
  const e2=document.getElementById('lh_stamp');if(e2)e2.textContent=euro2(st);
  const e=document.getElementById('loanLeft');if(e)e.innerHTML=loanLeftTxt(l,int,st,cap,0,amt,avail);
}
// Repinta o cartão da distribuição do crédito e sincroniza o botão "Repor" do montante.
// Devolve: nada — repinta o cartão no DOM.
function refreshLoanHint(){const e=document.getElementById('loanHint');if(e)e.innerHTML=loanHint();amtResetSync()}
// Reconstrói o corpo do modal do movimento a partir do tForm — usa-se depois de qualquer mudança estrutural.
// Devolve: nada — substitui o corpo do modal no DOM.
function repaintTx(){const b=modalBodyEl();if(b)b.innerHTML=txBody()}
/* Muda o tipo do movimento (ex.: dívida recebida ↔ paga): preserva o que foi escrito à mão,
   limpa categoria/subcategoria se a árvore de categorias do novo tipo for outra,
   e acerta o título do modal quando não é modelo nem recorrência.
   Recebe: k — o novo tipo ('income', 'expense', 'loan', 'owed', 'repay' ou 'settle').
   Devolve: nada — atualiza o tForm e repinta o modal. */
function setKind(k){keepTyped();
  if(treeKey(tForm.kind)!==treeKey(k)){tForm.category='';tForm.sub=''}
  tForm.kind=k;if(k!=='settle'&&tForm.label==='Transferência entre proprietários')tForm.label='';prefill();repaintTx();
  const h=modalTop()&&modalTop().el.querySelector('.head h2');if(h)h.textContent=txTitulo()}
/* Mudou o imóvel (ou grupo, valores "g:id"): limpa tudo o que dependia dele — contrato,
   hipoteca, divisões e distribuição — e volta a sugerir valores para o novo contexto.
   Devolve: nada — atualiza o tForm e repinta o modal. */
function onPropChange(){keepTyped();
  const v=val('t_prop')||'';
  tForm.groupId=String(v).startsWith('g:')?v.slice(2):null;
  tForm.propertyId=tForm.groupId?null:(v||null);
  tForm.contractId=null;tForm.loanId=null;tForm.split=null;
  delete tForm.interest;delete tForm.stamp;delete tForm.principal;
  tForm.psplit=tForm.groupId?{mode:'equal',parts:{}}:null;
  prefill();repaintTx()}
// Mudou o contrato: volta a sugerir a renda e a descrição do contrato escolhido.
// Devolve: nada — atualiza o tForm e repinta o modal.
function onCtChange(){keepTyped();tForm.contractId=val('t_ct')||null;prefill();repaintTx()}
// Mudou a hipoteca: descarta a distribuição anterior e sugere a prestação da nova.
// Devolve: nada — atualiza o tForm e repinta o modal.
function onLoanChange(){keepTyped();tForm.loanId=val('t_loan')||null;delete tForm.interest;delete tForm.stamp;delete tForm.principal;prefill();repaintTx()}
// Mudou a categoria: limpa a subcategoria; "__new__" abre o prompt para criar uma categoria
// nova na árvore deste tipo de movimento (fica logo gravada nas definições).
// Devolve: nada — atualiza o tForm e repinta o modal (ou abre o prompt).
function onCatChange(){
  collectTx();
  const v=val('t_cat');
  if(v==='__new__'){repaintTx();return promptModal('Nova categoria','Nome','',nm=>{
    const tr=catsFor(tForm.kind);if(tr&&!tr[nm])tr[nm]=[];
    save();tForm.category=nm;tForm.sub='';repaintTx();
    toast('Categoria criada.');
  })}
  tForm.category=v;tForm.sub='';repaintTx();
}
// Mudou a subcategoria; "__new__" abre o prompt para criar uma nova dentro da categoria atual.
// Numa despesa repinta, porque a coluna do Anexo F por omissão pode depender da subcategoria.
// Devolve: nada — atualiza tForm.sub (com "__new__" abre o prompt; numa despesa repinta).
function onSubChange(){
  collectTx();
  const v=val('t_sub');
  if(v==='__new__'){repaintTx();return promptModal('Nova subcategoria','Nome','',nm=>{
    const tr=catsFor(tForm.kind)||{},l=tr[tForm.category]||(tr[tForm.category]=[]);
    if(l.indexOf(nm)<0)l.push(nm);
    save();tForm.sub=nm;repaintTx();
    toast('Subcategoria criada.');
  })}
  tForm.sub=v;
  /* numa despesa a subcategoria muda a coluna do Anexo F («Impostos / IMI»
     tem regra própria): a primeira opção do seletor tem de a dizer */
  if(tForm.kind==='expense')repaintTx();
}
/* Recolhe do DOM para o tForm tudo o que estiver presente no modal: campos base, os juros e
   o capital escritos na tabela da distribuição, quem paga/recebe, credor, divisões e
   categoria — e para o txModo os campos do planeado e do modelo. Cada campo só é lido se
   existir, porque o formulário varia com o tipo de movimento. É o passo obrigatório antes de
   guardar ou repintar — o que não passar por aqui perde-se. A distribuição que se grava não
   se decide aqui: é o distribuicaoDe, no guardar, com o que aqui se recolheu.
   Devolve: nada — escreve no tForm e no txModo. */
function collectTx(){
  const t=tForm;
  t.label=val('t_label');t.amount=num(val('t_amount'));t.date=val('t_date')||today();
  if(document.getElementById('t_prop')){const v=val('t_prop')||'';t.groupId=String(v).startsWith('g:')?v.slice(2):null;t.propertyId=t.groupId?null:(v||null)}
  if(document.getElementById('t_notes'))t.notes=richVal('t_notes');
  if(document.getElementById('t_loan'))t.loanId=val('t_loan')||null;
  /* os juros e o capital da tabela: contam como escritos à mão numa edição ou depois de lhes mexer */
  if(t.kind==='loan'&&t.loanId&&t.payType!=='amortizacao'&&document.getElementById('t_int')){t.interest=num(val('t_int'));t.principal=num(val('t_cap'))}
  if(document.getElementById('t_paid'))t.paidBy=val('t_paid')||null;
  if(document.getElementById('t_to'))t.toId=val('t_to')||null;
  if(t.kind!=='settle')t.toId=null;
  if(document.getElementById('t_creditor'))t.creditor=val('t_creditor');
  collectSplit();collectPsplit();
  if(document.getElementById('t_cat')){const v=val('t_cat');if(v!=='__new__')t.category=v}
  if(document.getElementById('t_sub')){const v=val('t_sub');if(v!=='__new__')t.sub=v}
  if(document.getElementById('t_ct'))t.contractId=val('t_ct')||null;
  /* o que o IRS pergunta: cada campo só quando está no ecrã, e no formato do
     normTx — o mês aceita 'AAAA-MM' (o input de mês) e 'MM/AAAA' (onde o
     browser o dá como texto); o resto fica vazio, e não uma data inventada */
  if(document.getElementById('t_periodo')){
    const s=String(val('t_periodo')||'').trim(),m=/^(\d{1,2})\/(\d{4})$/.exec(s);
    t.periodo=/^\d{4}-\d{2}$/.test(s)?s:(m?m[2]+'-'+m[1].padStart(2,'0'):'');
  }
  if(document.getElementById('t_retencao'))t.retencao=Math.max(0,num(val('t_retencao'))||0);
  if(document.getElementById('t_recibo'))t.recibo=chk('t_recibo');
  if(document.getElementById('t_irscol'))t.irsCol=val('t_irscol')||'';
  /* os campos do planeado e do modelo são do modo, e não do movimento */
  const m=txModo;
  if(m.modo==='rec'){
    if(document.getElementById('t_every'))m.every=val('t_every')||'month';
    if(document.getElementById('t_until'))m.until=val('t_until')||'';
    if(document.getElementById('t_recEnd'))m.recEnd=val('t_recEnd')||'';
  }
  if(m.modo==='tpl'&&document.getElementById('t_tplName'))m.tplName=val('t_tplName');
}
// Abre o seletor de etiquetas com as que ainda não estão neste movimento,
// com atalho para criar uma nova.
// Devolve: nada — abre o modal de escolha.
function addTxTag(){
  collectTx();
  const free=(db.settings.tags||[]).filter(g=>(tForm.tags||[]).indexOf(g)<0);
  pickModal('Escolher etiqueta',free.map(g=>({v:g,label:g})),
    g=>{tForm.tags.push(g.v);closeModal();repaintTx()},
    `<button type="button" class="btn u-w-100pc u-jc-center" data-toca="camada" data-click="newTagFromTx()">${ic('plus',15)} Criar etiqueta nova</button>
     <div class="hint u-mt-8px">Podes gerir a lista em Definições → Etiquetas.</div>`);
}
// Cria uma etiqueta nova a partir do modal do movimento: entra na lista global
// (Definições → Etiquetas), fica gravada, e aplica-se logo a este movimento.
// Devolve: nada — grava nas definições e repinta o modal do movimento.
function newTagFromTx(){
  closeModal();
  promptModal('Nova etiqueta','Nome','',nm=>{
    const l=db.settings.tags||(db.settings.tags=[]);
    if(l.indexOf(nm)<0)l.push(nm);
    if((tForm.tags||[]).indexOf(nm)<0)tForm.tags.push(nm);
    save();repaintTx();
    toast('Etiqueta criada e aplicada.');
  });
}
// Tira uma etiqueta do movimento e repinta o modal.
// Recebe: g — o nome da etiqueta a tirar (string).
// Devolve: nada — repinta o modal.
function delTxTag(g){collectTx();tForm.tags=(tForm.tags||[]).filter(x=>x!==g);repaintTx()}
/* Efeito do pagamento na hipoteca, na altura de guardar: valida a distribuição do movimento
   (ou recalcula-a quando não bate certo com o montante — sempre a somar o montante ao cêntimo,
   com os juros limitados ao que o montante paga), limita o capital ao que ainda se deve sem
   contar com este movimento, e deixa o capital em dívida no que sobra — a mesma conta do
   saldoEmDivida (credito.js), a partir do capital do início: numa edição, o próprio
   movimento já está nos movimentos com a distribuição antiga, e não conta. Também acerta a
   recorrência automática da hipoteca — atualiza a prestação, ou apaga-a quando o crédito
   fica liquidado. Mexe na db mas não faz save(); isso é de quem chama.
   Recebe: t — o movimento de crédito (objeto com id, amount, loanId, payType e a distribuição).
   Devolve: nada — acerta a distribuição no próprio t e o capital em dívida na hipoteca. */
function applyLoan(t){
  const p=prop(t.propertyId),l=t.loanId?findLoan(p,t.loanId):null;if(!l)return;
  if(t.loanOff)delete t.loanOff;   /* volta a ter hipoteca: a marca do delMort deixa de fazer sentido */
  fixarCapitalInicio(l,db.transactions);   /* os dados antigos: o capital do início, antes de este contar */
  const disponivel=saldoEmDivida(l,(db.transactions||[]).filter(x=>x.id!==t.id));
  /* amortização: capital + comissão da hipoteca; prestação: juros + selo + capital (sem comissão) */
  let int=Number(t.interest),st=Number(t.stamp),cap=Number(t.principal),fee=Number(t.fee||0);
  if(t.payType==='amortizacao'){
    const fr=amortFeeRate(l);
    if(!(isFinite(cap)&&isFinite(fee)&&cap>=0&&fee>=0&&Math.abs(cap+fee-t.amount)<=0.011)){cap=r2(t.amount/(1+fr));fee=r2(t.amount-cap)}
    int=0;st=0;
  }else if(!(isFinite(int)&&isFinite(st)&&isFinite(cap)&&int>=0&&st>=0&&cap>=0&&Math.abs(int+st+cap+(fee>0?fee:0)-t.amount)<=0.011)){
    const c=loanCalc(Object.assign({},l,{outstanding:disponivel})),sr=l.stampTax===false?0:stampPct();
    int=r2(Math.min(c.interest,t.amount/(1+sr)));st=r2(int*sr);fee=0;cap=Math.max(0,r2(t.amount-int-st));
    int=r2(int+r2(t.amount-int-st-cap));   /* os cêntimos do arredondamento vão para os juros: a soma bate com o montante */
  }
  cap=Math.max(0,Math.min(disponivel,cap));
  t.interest=r2(int);t.stamp=r2(st);t.principal=r2(cap);t.fee=r2(fee);
  l.outstanding=Math.max(0,r2(disponivel-cap));
  /* recorrência automática desta hipoteca: acompanha a nova prestação e desaparece quando o crédito acaba */
  const ar=servicoLigado('recurring')?loanRecOf(l):null;
  if(ar){if(!(l.outstanding>0))db.recurring=db.recurring.filter(x=>x.id!==ar.id);
    else ar.tx.amount=Math.round(loanCalc(l).total*100)/100}
}
/* Apaga o movimento e, se era um pagamento de crédito, a hipoteca volta a derivar o
   capital em dívida sem ele (o capital dele volta) e a recorrência dela sincroniza-se.
   O toast traz "Anular", que desfaz as duas coisas.
   Recebe: id — o id do movimento a apagar (string).
   Devolve: nada — grava e re-renderiza. */
function delTx(id){
  /* sem confirmação, com Anular: é a eliminação mais frequente da app, e a
     pergunta constante ensinava o dedo a confirmar sem ler */
  const t=db.transactions.find(x=>x.id===id);if(!t)return;
  const recusa=motivoRecusa(t.propertyId,'tx.add',t,true);if(recusa)return toast(recusa);
  const copia=JSON.parse(JSON.stringify(t));
  const l=t.kind==='loan'&&t.loanId?findLoan(prop(t.propertyId),t.loanId):null;
  if(l)fixarCapitalInicio(l,db.transactions);   /* os dados antigos: antes de o movimento sair */
  const capital=l?l.capitalInicio:null;
  db.transactions=db.transactions.filter(x=>x.id!==id);
  if(l){acertarCapital(l);if(servicoLigado('recurring'))syncLoanRec(prop(t.propertyId),l)}
  save();closeAllModals();render();
  comDesfazer('Movimento apagado.',()=>{
    db.transactions.push(copia);
    /* volta a procurar a hipoteca: um sync entretanto pode ter trocado os objetos da db */
    const l2=copia.kind==='loan'&&copia.loanId?findLoan(prop(copia.propertyId),copia.loanId):null;
    if(l2){if(l2.capitalInicio==null)l2.capitalInicio=capital;acertarCapital(l2);if(servicoLigado('recurring'))syncLoanRec(prop(copia.propertyId),l2)}
  });
}
