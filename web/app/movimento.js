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
   o resto é o modo (txModo); diaPerguntado é o dia em que a renda entrou, já
   perguntado por quem abriu (planeados.js:confirmRec), para o Guardar não o
   voltar a perguntar (txPedeODia).
   Devolve: nada — abre o modal do movimento e liga o guardar. */
function txModal(o){
  if(arguments.length>1)throw new Error('txModal: passa um objeto ({id, kind, propId, ctId, preset…}); a forma por posições saiu');
  if(typeof o==='string')o={id:o};
  else if(!o||typeof o!=='object')o={};
  const id=o.id||null;
  foldState={};txMemoDoDestino={};
  /* Quem não pode alterar recebe a FICHA, e não este formulário com os campos
     apagados. E antes do openModal: não se decora uma janela já aberta,
     escolhe-se qual é a janela a abrir. */
  const _t=id?(db.transactions||[]).find(x=>x.id===id):null;
  if(id&&!_t)return;
  /* uma parte de um lote abre o LOTE — e só com ele inteiro nesta base e cada
     parte dele ao meu alcance; senão a ficha, que diz porquê */
  if(_t&&(!podeEditar(_t.propertyId,'tx.add',_t)||recusaDoLote(_t)))return txView(id);
  const modo=['confirmar','rec','tpl'].indexOf(o.modo)>-1?o.modo:'tx';
  txModo={modo,recId:o.recId||null,tplId:o.tplId||null,alsoTx:!!o.alsoTx,every:o.every||'month',until:o.until||'',recEnd:o.recEnd||'',tplName:o.tplName||'',
    diaPerguntado:/^\d{4}-\d{2}-\d{2}$/.test(String(o.diaPerguntado||''))?String(o.diaPerguntado):''};
  /* sem imóvel escolhido: com um só imóvel onde posso adicionar fica esse; quem não
     é dono de nenhum não tem «Sem imóvel» e fica com o primeiro permitido —
     senão o seletor mostrava o primeiro e o movimento gravava-se sem imóvel */
  const auto=(db.properties.length===1||!podeSemImovel())?((casasComo('tx.add')[0]||{}).id||null):null;
  tForm=_t?normTx(JSON.parse(JSON.stringify(_t.lote?movimentoDoLote(_t):_t))):
    normTx(Object.assign({kind:o.kind||'income',date:today(),amount:'',propertyId:o.propId||auto,contractId:o.ctId||null,split:null},o.preset||{}));
  if(tForm.contractId&&!tForm.propertyId){const c=contract(tForm.contractId);if(c)tForm.propertyId=c.propertyId}
  /* um preset sem imóvel (modelo) também; um de «Todos os imóveis» é dos meus
     imóveis, e quem não é dono de nenhum não o tem: fica no primeiro permitido */
  if(!id&&!tForm.propertyId&&!tForm.groupId&&!podeSemImovel()){tForm.propertyId=auto;tForm.todos=false;tForm.psplit=null}
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
   no formulário — pintar o cartão não a escreve. Pede, pela ordem do
   formulário, o imóvel e o contrato de uma receita nova quando é preciso
   escolhê-los (txPedeImovel, txPedeContrato) e a resposta da nota de IMI
   (txPartePorResponder). Uma renda de outro ano com a data de hoje pergunta o
   dia em que entrou (txPedeODia); uma renda abaixo da renda desse mês, ainda
   sem resposta, pergunta porquê antes de gravar (txRendaAbaixo,
   txPerguntarRendaAbaixo).
   Recebe: id — o id do movimento em edição (null num novo).
   Devolve: nada — grava e fecha, ou diz o que falta (ou abre a pergunta). */
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
  /* pela ordem do formulário: o montante vem primeiro, e gravar vazio marca-o a ele.
     Num modelo só (sem registar) pode ficar vazio: grava-se 0, e o que depende do
     total (a divisão por valores, a distribuição da prestação) espera pelo montante
     que se escrever ao usar o modelo */
  const semMontante=txMontanteOpcional()&&!tForm.amount;
  if(semMontante)tForm.amount=0;
  else if(!(tForm.amount>0))return falhaCampo('t_amount','Indica um montante.');
  if(!tForm.label.trim())return falhaCampo('t_label','Escreve uma descrição.');
  /* uma receita nova numa conta com contratos em vigor: o imóvel escolhe-se, ou
     «Sem imóvel» de propósito — sem imóvel, uma renda não ia a linha nenhuma (N027) */
  if(txPedeImovel(tForm)&&!tForm.propertyId&&!tForm.groupId&&!tForm.todos&&!tForm._semImovel)
    return falhaCampo('t_prop','Escolhe o imóvel desta receita, ou «Sem imóvel» se não é de nenhum.');
  /* num imóvel com mais de um contrato em vigor (quartos), o contrato escolhe-se, ou
     «Não é de nenhum contrato» de propósito: uma renda é sempre de um contrato (N083) */
  if(txPedeContrato(tForm)&&!tForm.contractId&&!tForm._semContrato)
    return falhaCampo('t_ct','Escolhe o contrato desta receita, ou «Não é de nenhum contrato».');
  /* uma renda em atraso é de outro mês, e é o mês que a leva ao ano certo (o quadro 8): sem ele não se grava (D54) */
  if(txPedeMesDaRenda(tForm)&&!tForm.periodo)return falhaCampo('t_periodo','Indica o mês a que a renda em atraso respeita.');
  const compra=txDataAntesDaCompra(id);
  if(compra)return falhaCampo('t_date','O imóvel foi comprado a '+compra+': uma receita não pode ser de antes.');
  /* o NIF de quem paga uma cedência (natureza 02) vai ao Anexo F: um erro de dedo fica à vista (N076) */
  if(tForm.kind==='income'&&String(tForm.pagadorNif||'')&&nifValido(tForm.pagadorNif)===false)
    return falhaCampo('t_pagadorNif','Este NIF não bate certo: confere os dígitos.');
  /* a nota de IMI de uma casa com mais de um dono: o IMI do prédio ou a minha nota, sem omissão (N041) */
  if(txPartePorResponder(tForm))return falhaCampo('t_parte','Diz se é o IMI do prédio todo ou a tua nota de IMI.');
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
    /* sem montante não há o que distribuir: o modelo não leva distribuição (nem a de
       um montante que já teve), e o movimento que nascer dele calcula-a com o seu */
    if(semMontante)['interest','stamp','principal','fee'].forEach(k=>{delete tForm[k]});
    else{
      Object.assign(tForm,distribuicaoDe(tForm,lV));
      if(tForm.payType!=='amortizacao'){
        if(Number(tForm.interest)<0||Number(tForm.stamp)<0||Number(tForm.principal)<0)return toast('Juros e selo ultrapassam o montante: baixa os juros na tabela da distribuição.');
        const s=r2(Number(tForm.interest||0)+Number(tForm.stamp||0)+Number(tForm.principal||0));
        if(Math.abs(s-tForm.amount)>0.011)return toast('Juros, selo e capital têm de somar o montante ('+euro2(tForm.amount)+').');
      }
      const av=loanAvail(tForm,lV);
      if(Number(tForm.principal)>av+0.011)return toast('Só faltam '+euro2(av)+' pagar nesta hipoteca — não podes amortizar mais do que isso.');
    }
    if(!tForm._edit&&!(Number(lV.outstanding)>0))return toast('Esta hipoteca já está paga: não é possível associar novos pagamentos.');
  }
  if(planeado)return txGuardarPlaneado();
  if(m.modo==='tpl')return txGuardarModelo();
  /* a renda de dezembro confirmada em janeiro com a data de hoje: pergunta o dia
     em que entrou, que é o que decide o ano do IRS (N026, D22) */
  if(txPedeODia(id))return txPerguntarDia();
  /* uma renda abaixo da do planeado desse mês pergunta porquê, uma vez; a que
     já respondeu «Pagamento parcial» grava-se assim, e a que deixou de estar
     abaixo deixa de ser parcial (D112–D115) */
  const abaixo=txRendaAbaixo(id);
  if(abaixo&&!tForm.parcial)return txPerguntarRendaAbaixo(id,abaixo);
  if(!abaixo)tForm.parcial=false;
  return txGuardarMovimento(id);
}
/* A data de uma RECEITA do formulário é antes da compra da casa
   (imovel.js:antesDaCompra)? Só as receitas (kind 'income': as rendas, as
   cauções): antes de a casa ser minha ninguém me pagou renda dela. As
   despesas, as prestações e os outros tipos entram com qualquer data — o
   sinal do contrato-promessa, o IMT, as obras antes da escritura (decisão do
   Martinho, 2026-10-29: «Despesas podem»). Só se confere o que tem data e é
   de UMA casa: um planeado (a data é a próxima ocorrência, não um facto) e um
   modelo que não regista o movimento ficam de fora; um movimento sem imóvel
   não tem compra; o de um grupo ou de «Todos os imóveis» também não —
   «Todos» já só parte pelos imóveis comprados nessa data
   (saldos.js:imoveisDeTodos), e num grupo a compra de uma casa não diz nada
   da data do movimento inteiro. E só a data nova ou mudada (ou a casa ou o
   tipo trocados): uma receita antiga que já estava antes da compra grava-se
   quando se mexe noutro campo. Sem os Imóveis ligados não há a regra.
   Recebe: id — o id do movimento em edição (null num novo).
   Devolve: a data de compra em DD/MM/AAAA quando a data é antes dela, ou ''. */
function txDataAntesDaCompra(id){
  const m=txModo,t=tForm;
  if(!servicoLigado('properties')||m.modo==='rec'||(m.modo==='tpl'&&!m.alsoTx))return '';
  if(t.kind!=='income'||!t.propertyId||t.groupId||t.todos)return '';
  const old=id?(db.transactions||[]).find(x=>x.id===id):null;
  if(old&&old.date===t.date&&old.propertyId===t.propertyId&&old.kind===t.kind)return '';
  return antesDaCompra(t.propertyId,t.date);
}
/* O min do campo da data: a compra da casa, nos mesmos movimentos que o
   txDataAntesDaCompra confere (receitas de uma casa só). Mudar o tipo
   repinta o formulário (setKind), e o min vai e vem com ele; o guardar
   confere na mesma.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: ' min="AAAA-MM-DD"' (texto) ou ''. */
function txMinDaData(t){
  if(!servicoLigado('properties')||t.kind!=='income'||!t.propertyId||t.groupId||t.todos)return '';
  return minDaCompra(t.propertyId,t.date);
}
/* O imóvel de uma receita nova escolhe-se, em vez de ficar «Sem imóvel»
   calado (N027)? Numa receita nova registada pelo formulário (o modo 'tx'),
   de quem pode registar sem imóvel, numa conta com algum contrato em vigor
   num imóvel onde pode adicionar: aí uma renda sem imóvel não ia a linha
   nenhuma da Declaração. O seletor abre em «— escolhe o imóvel —», com
   «Sem imóvel» como escolha (t._semImovel); com um imóvel só, ele já vem
   escolhido (txModal). Alterar um movimento não pergunta.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: true ou false. */
function txPedeImovel(t){
  if(!t||t.kind!=='income'||t._edit||txModo.modo!=='tx'||!podeSemImovel()||!servicoLigado('contracts'))return false;
  return casasComo('tx.add').some(p=>activeContracts(p.id).length>0);
}
/* O contrato de uma receita nova escolhe-se (N083)? Num imóvel com mais de um
   contrato em vigor (os quartos, a loja e a casa no mesmo artigo), numa
   receita nova do formulário: uma renda é sempre de um contrato, e «Sem
   contrato» à cabeça gravava-a fora do quadro. O seletor abre em «— escolhe
   o contrato —», com «Não é de nenhum contrato» como escolha (t._semContrato).
   Recebe: t — o movimento do formulário (tForm).
   Devolve: true ou false. */
function txPedeContrato(t){
  if(!t||t.kind!=='income'||t._edit||txModo.modo!=='tx'||!t.propertyId||!servicoLigado('contracts'))return false;
  return activeContracts(t.propertyId).length>1;
}
/* A nota de IMI de uma casa com mais de um dono está por responder (N041,
   D9 c)? Numa despesa nova de IMI (pelo id) onde a pergunta aparece
   (txNotaPropriaAplica): é o IMI do prédio todo, ou a minha nota? Sem
   omissão — na compropriedade cada dono recebe a sua nota, já pela quota; no
   bem comum do casal a nota é uma só, do prédio. Um planeado que já diz «a
   minha nota» conta como respondido; alterar, ou guardar um planeado ou um
   modelo, não pergunta.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: true quando falta a resposta. */
function txPartePorResponder(t){
  if(!t||t._edit||t._parteRespondida||t.notaPropria===true||txModo.modo==='rec'||(txModo.modo==='tpl'&&!txModo.alsoTx))return false;
  return txCatIrsId(t,true)==='impostos/imi'&&txParteVisivel(t);
}
/* O Guardar pergunta o dia em que a renda entrou (N026)? A regra do Confirmar
   rápido (planeados.js:recPedeODia, D22) no formulário: numa renda ou numa
   caução nova (o papel do irs-papeis.js:irsReceitaDe) com o mês a que respeita
   de outro ano que a data, quando a data é ainda a de hoje — a que o
   formulário traz — e veio de um planeado: a confirmar, ou registada com o
   mês sugerido pelo planeado (txSugereMesDaRenda). A renda de dezembro
   confirmada em janeiro entrou num dos dois anos, e cada um é uma Declaração.
   Não volta a perguntar o dia já respondido (t._diaRespondido), nem o que quem
   abriu o formulário já perguntou (txModo.diaPerguntado), a não ser que a
   data tenha mudado.
   Recebe: id — o id do movimento em edição (null num novo).
   Devolve: true ou false. */
function txPedeODia(id){
  const t=tForm,m=txModo,d=String(t.date||''),p=String(t.periodo||'');
  if(id||t._edit||t._diaRespondido||t.kind!=='income'||!/^\d{4}-\d{2}$/.test(p)||!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;
  if(d!==today()||p.slice(0,4)===d.slice(0,4)||(m.diaPerguntado&&d===m.diaPerguntado))return false;
  if(!(m.modo==='confirmar'||(m.modo==='tx'&&!!t._aP&&p===t._aP)))return false;
  const papel=irsReceitaDe(t).papel;
  return papel==='renda'||papel==='caucao';
}
/* A pergunta do dia em que a renda entrou, por cima do formulário (a folha do
   planeados.js:recPerguntarDia): só o dia, por preencher — um valor já escrito
   confirmava-se sem ninguém o ler. O mês a que respeita fica o que está.
   Só numa receita nova (txPedeODia): o Guardar que se segue é de um novo.
   Devolve: nada — abre a folha. */
function txPerguntarDia(){
  const t=tForm;
  openModal('Em que dia entrou?',
    `<div class="form"><div class="hint u-fs-14px"><b>${esc(t.label||'Esta renda')}</b>, de ${esc(mesPt(t.periodo))}, conta no IRS do ano em que a recebeste, e não no do mês a que respeita. Indica o dia em que entrou.</div>
    <label>Dia em que entrou <span class="req">*</span><input id="tx_dia" type="date" value="" max="${today()}"></label></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>`+
    `<button class="btn primary" data-toca="dados" data-click="txConfirmarDia()">Confirmar</button>`);
}
/* O «Confirmar» da pergunta do dia (txPerguntarDia): o dia é obrigatório e não
   passa de hoje (a compra da casa confere-a o Guardar); fecha a folha, põe o
   dia no formulário e guarda outra vez.
   Devolve: nada — guarda, ou diz o erro junto ao campo. */
function txConfirmarDia(){
  const dia=String(val('tx_dia')||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))return falhaCampo('tx_dia','Indica o dia em que a renda entrou.');
  if(dia>today())return falhaCampo('tx_dia','O dia em que entrou não pode ser depois de hoje.');
  closeModal();
  tForm.date=dia;tForm._diaRespondido=true;
  repaintTx();
  txGuardar(null);
}
/* Se o montante do formulário aberto pode ficar vazio: só num modelo que se
   guarda sozinho (o modo 'tpl' sem alsoTx). Com alsoTx regista-se também o
   movimento, e um movimento leva sempre montante; registar, confirmar e os
   planeados também.
   Recebe: nada (lê o txModo).
   Devolve: true ou false. */
function txMontanteOpcional(){return txModo.modo==='tpl'&&!txModo.alsoTx}
/* Guardar no modo 'rec': só o planeado muda (ou nasce); não cria movimentos.
   O txGuardar já validou.
   Devolve: nada — grava, fecha e redesenha. */
function txGuardarPlaneado(){
  const m=txModo,every=m.every||'month',recEnd=m.recEnd||'';
  let until=m.until||'';if(until&&until<tForm.date)until='';
  let novo=null;
  if(!m.recId){db.recurring=db.recurring||[];novo=normRec({name:tForm.label,every,next:tForm.date,until,end:recEnd,tx:txSnapshot(tForm)});db.recurring.push(novo)}
  else{const r=(db.recurring||[]).find(x=>x.id===m.recId);if(r){r.tx=txSnapshot(tForm);r.name=tForm.label;r.every=every;r.next=tForm.date;r.until=until;r.end=recEnd;
    if(r.tx.loanId)delete r.loanOff}}   /* escolheu a hipoteca à mão: a marca do delMort deixa de fazer sentido */
  save();closeModal();buildNav();render();
  if(!novo)return toast('Movimento recorrente atualizado.');
  /* a ficha do planeado é dos Planeados: o chamarServico guarda-a, e o avisoComVer
     nem mostra o «Ver» com o separador deles desligado */
  const rid=novo.id;
  avisoComVer('Movimento recorrente adicionado.','recurring',()=>chamarServico('recurring','recView',rid));
}
/* Guardar no modo 'tpl': o modelo muda (ou nasce) e, com alsoTx, regista-se
   também o movimento — o de um grupo ou de «Todos os imóveis» partido por
   imóvel (registarMolde). O modelo guarda o molde (grupo ou «Todos», sem
   imóvel); é o movimento que se parte. O txGuardar já validou; o que só se
   sabe ao partir (um grupo sem imóveis) recusa antes de gravar o que quer
   que seja.
   Devolve: nada — grava, fecha e redesenha. */
function txGuardarModelo(){
  const m=txModo,name=String(m.tplName||'').trim()||tForm.label;
  let novos=null;
  if(m.alsoTx){const tx=normTx(txSnapshot(tForm));tx.date=tForm.date||today();
    const r=registarMolde(tx);if(r.erro)return toast(r.erro);novos=r.partes}
  let novo=null;
  if(!m.tplId){db.templates=db.templates||[];novo=normTpl({name,tx:txSnapshot(tForm)});db.templates.push(novo)}
  else{const x=(db.templates||[]).find(y=>y.id===m.tplId);if(x){x.name=name;x.tx=txSnapshot(tForm)}}
  if(novos)novos.forEach(tx=>{if(tx.kind==='loan')applyLoan(tx);db.transactions.push(tx)});
  save();closeModal();buildNav();render();
  if(!novo)return toast('Modelo atualizado.');
  /* o «Ver» abre o modelo, que é o que se criou; os modelos vivem nos Planeados */
  const tid=novo.id;
  avisoComVer(m.alsoTx?'Modelo adicionado e movimento registado.':'Modelo adicionado.','recurring',()=>chamarServico('recurring','tplView',tid));
}
/* Guardar nos modos 'tx' e 'confirmar': o movimento entra (ou substitui o que
   se editou) e, confirmando um planeado, este avança. Um pagamento de crédito
   abate na hipoteca pelo applyLoan; a hipoteca de onde um movimento editado
   saiu (outra, ou já não é pagamento de crédito) volta a derivar o capital
   em dívida. O txGuardar já validou.
   Um movimento de um grupo ou de «Todos os imóveis» entra partido por imóvel
   (partirMovimento), com o id do formulário como id do lote. O id do
   formulário é também o do lote que se edita (movimentoDoLote): as partes
   velhas saem todas no mesmo passo em que as novas entram (trocarLote) — um
   lote que passa a um imóvel só, ou a «Sem imóvel», fica um movimento normal
   com esse id, e um normal que passa a grupo fica o lote dele. O que só se
   sabe ao partir (um grupo sem imóveis, um imóvel onde não posso) recusa
   antes de mexer na base. O novo (também o que nasce de confirmar um
   planeado) leva o «Ver» no aviso (componentes.js:avisoComVer). Uma renda
   paga só em parte (t.parcial) não avança o planeado que se confirma: o resto
   continua por confirmar (D115).
   Recebe: id — o id do movimento em edição (null num novo; numa parte de um
   lote, o dessa parte).
   Devolve: nada — grava, fecha e redesenha. */
function txGuardarMovimento(id){
  const recId=txModo.modo==='confirmar'?txModo.recId:null;
  const old=id?db.transactions.find(x=>x.id===id):null;
  const velhas=partesDoLote(tForm.id),recusa=velhas.length?recusaDoLote(velhas[0]):'';
  if(recusa)return toast(recusa);
  /* novo: nem o que se editou, nem um lote que se refaz — leva o «Ver» no aviso */
  const novo=!old&&!velhas.length;
  let novos=null;
  if(ehDeVariosImoveis(tForm)){const r=partirMovimento(tForm);if(r.erro)return toast(r.erro);novos=r.partes}
  /* as hipotecas tocadas ficam com o capital do início gravado ANTES de os movimentos mudarem */
  const tocadas=[old&&old.kind==='loan'?old.loanId:null,tForm.kind==='loan'?tForm.loanId:null].filter(Boolean);
  tocadas.forEach(lid=>{const x=anyLoan(lid);if(x)fixarCapitalInicio(x.l,db.transactions)});
  if(tForm.kind==='loan')applyLoan(tForm);
  Object.keys(tForm).forEach(k=>{if(k[0]==='_')delete tForm[k]});
  if(novos||velhas.length)trocarLote(tForm.id,novos||[tForm]);
  else{const i=db.transactions.findIndex(x=>x.id===tForm.id);
    if(i<0)db.transactions.push(tForm);else db.transactions[i]=tForm}
  tocadas.forEach(lid=>{const x=anyLoan(lid);if(x)acertarCapital(x.l)});
  /* um pagamento parcial não avança o planeado: o resto da renda fica por confirmar (D115) */
  const parcial=!!tForm.parcial;
  if(recId&&!parcial&&servicoLigado('recurring')){const r=(db.recurring||[]).find(x=>x.id===recId);if(r)recAdvance(r)}
  save();closeModal();buildNav();render();refreshDetail();
  if(!novo)return toast('Movimento guardado.');
  /* de vários imóveis, a ficha da primeira parte é a do lote inteiro (txFicha) */
  const alvo=novos&&novos.length?novos[0].id:tForm.id;
  avisoComVer(parcial?'Pagamento parcial registado: o resto da renda fica em dívida.':recId?'Movimento confirmado.':'Movimento adicionado.','transactions',()=>txView(alvo));
}
/* ---- a renda que entra abaixo da do planeado (D112–D115; decisão do
   Martinho: sem campo «Descontado», uma pergunta com duas saídas) ---- */
/* A pergunta aberta da renda abaixo: o movimento em edição, a renda do mês, o
   que falta, o imóvel e o mês — o que as escolhas (txRendaAbaixoEscolha)
   precisam depois de a folha abrir. null sem pergunta aberta. */
let txAbaixo=null;
/* Esta renda fica abaixo da renda desse mês? Só numa renda (o papel do
   irs-papeis.js:irsReceitaDe) ligada a um contrato. A renda do mês é a do
   planeado da renda com a ocorrência no mês a que ela respeita
   (planeados.js:recDaRendaNoMes — o que confirmo, ou o do contrato: o
   montante dele mais a retenção). No mês corrente e no anterior conta também
   a renda do contrato (txRendaDoContratoNoMes), que aí é a que está em vigor
   — com planeado, a maior das duas (o planeado escrito com o que a gestora
   transfere, abaixo da renda); sem planeado nesse mês (os Planeados
   desligados, a renda automática desligada no contrato, um contrato
   terminado), só ela (N080). Num mês mais antigo, sem planeado nesse mês, não
   pergunta: a renda de hoje pode já ter a atualização. Contam as outras
   rendas do mesmo contrato e mês já registadas (um pagamento parcial e o
   resto).
   Recebe: id — o id do movimento em edição (null num novo).
   Devolve: null, ou {renda, ja, falta, mes} — a renda do mês, o que as outras
   rendas desse mês já somam, o que falta (euros) e o mês ('AAAA-MM'). */
function txRendaAbaixo(id){
  const t=tForm;
  if(t.kind!=='income'||!t.contractId)return null;
  if(irsReceitaDe(t).papel!=='renda')return null;
  const c=contract(t.contractId),mes=mesDaRenda(t);
  if(!c||!/^\d{4}-\d{2}$/.test(mes))return null;
  const r=servicoLigado('recurring')?recDaRendaNoMes(c,mes,txModo.modo==='confirmar'?txModo.recId:null):null;
  let renda=r?r2((Number(r.tx.amount)||0)+(Number(r.tx.retencao)||0)):0;
  if(txMesRecente(mes))renda=Math.max(renda,txRendaDoContratoNoMes(c,mes));
  if(!(renda>0))return null;
  const outras=(db.transactions||[]).filter(x=>x.id!==id&&x.id!==t.id&&x.contractId===c.id&&ehRenda(x)&&mesDaRenda(x)===mes);
  const ja=r2(sum(outras.map(rendaBruta))),falta=r2(renda-ja-rendaBruta(t));
  return falta>0.005?{renda,ja,falta,mes}:null;
}
/* O mês é o corrente ou o anterior (pelo dia de hoje)?
   Recebe: mes — 'AAAA-MM'.
   Devolve: true ou false. */
function txMesRecente(mes){
  const h=today(),y=Number(h.slice(0,4)),m=Number(h.slice(5,7));
  const ant=m===1?(y-1)+'-12':y+'-'+String(m-1).padStart(2,'0');
  return mes===h.slice(0,7)||mes===ant;
}
/* A renda do contrato em vigor num mês, para comparar uma renda sem planeado
   nesse mês (N080): a do planeados.js:recRendaDoContrato, com os Planeados
   ligados; sem eles, o c.rent quando não há atualização anual registada
   depois desse mês — com o c.increase, o aniversário do início deste ano já
   passado e o mês antes dele, a renda desse mês era outra, e não se sabe.
   Recebe: c — o contrato; mes — 'AAAA-MM'.
   Devolve: euros (a renda bruta), ou 0 quando não se sabe. */
function txRendaDoContratoNoMes(c,mes){
  if(!c||!/^\d{4}-\d{2}$/.test(String(mes||'')))return 0;
  if(servicoLigado('recurring'))return Math.max(0,Number(recRendaDoContrato(c,mes))||0);
  const renda=Number(c.rent)||0,ini=String(c.start||'');
  if(!(renda>0)||(/^\d{4}-\d{2}/.test(ini)&&mes<ini.slice(0,7)))return 0;
  if(c.increase!=null&&c.increase!==''&&/^\d{4}-\d{2}/.test(ini)){
    const h=today(),aniv=h.slice(0,4)+ini.slice(4,7);
    if(aniv<=h.slice(0,7)&&ini.slice(0,7)<aniv&&mes<aniv)return 0;
  }
  return renda;
}
/* Os descontos que a pergunta da renda abaixo conhece: o rótulo e a
   explicação da escolha, o ícone, a descrição da despesa, a categoria
   proposta (pelo id do IRS, ou pelo nome de origem: só se existir nesta
   conta) e a coluna do Anexo F que a despesa tem de ter — fixada no
   movimento quando a categoria não a dá. O encargo do imóvel escolhe-se
   depois, de ENCARGOS_DO_INQUILINO. */
const TX_DESCONTOS_RENDA={
  comissao:{label:'Comissão da gestora',sub:'A gestora tirou a comissão antes de te transferir a renda.',icon:'carteira',
    desc:'Comissão da gestora',cat:['Gestão e mediação','Gestão do imóvel'],col:'outros'},
  conservacao:{label:'Obra de reparação paga pelo inquilino',sub:'Conservação ou manutenção: deduz-se com a fatura em teu nome.',icon:'gear',
    desc:'Obra paga pelo inquilino',cat:['Manutenção e reparações',''],col:'conservacao'},
  melhoria:{label:'Obra de melhoria paga pelo inquilino',sub:'Uma beneficiação (cozinha nova, ar condicionado): não se deduz.',icon:'up',
    desc:'Obra de melhoria paga pelo inquilino',cat:['Obras e benfeitorias','Remodelação'],col:'nao'},
  condominio:{desc:'Condomínio pago pelo inquilino',cat:['Condomínio','Quota mensal'],col:'condominio'},
  imi:{desc:'IMI pago pelo inquilino',catId:'impostos/imi',col:'imi'},
  seguro:{desc:'Seguro pago pelo inquilino',cat:['Seguros','Multirriscos'],col:''},
  consumos:{desc:'Água, luz e gás pagos pelo inquilino',cat:['Água, luz e gás',''],col:''},
  outro:{label:'Outro desconto',sub:'Escolhes a categoria da despesa.',icon:'dots',desc:'Desconto na renda',cat:null,col:''}
};
/* A pergunta «Entrou menos do que a renda: porquê?» (txRendaAbaixo), por
   cima do formulário, com as duas saídas da decisão do Martinho: pagamento
   parcial — grava a renda como está, com t.parcial, e o resto fica em dívida
   (o planeado não avança) — ou um desconto — a comissão da gestora, uma obra
   ou um encargo pago pelo inquilino: regista a renda inteira e propõe a
   despesa do desconto (txRendaAbaixoDesconto). O IRS conta a renda do recibo,
   antes da retenção, da comissão e de descontos; a despesa deduz-se pela
   coluna dela, uma vez. «Voltar» devolve ao formulário, para corrigir o
   montante. A retenção na fonte é uma terceira saída (N081): à cabeça quando
   é a razão provável (txRetencaoProvavel), no fim nos outros casos, e fora
   quando o que falta fica abaixo do mínimo de uma retenção.
   Recebe: id — o id do movimento em edição (null num novo); a — o que o
   txRendaAbaixo devolveu.
   Devolve: nada — abre a folha da escolha. */
function txPerguntarRendaAbaixo(id,a){
  txAbaixo={id:id||null,falta:a.falta,renda:a.renda,mes:a.mes,pid:tForm.propertyId,camada:modalTop()};
  const D=TX_DESCONTOS_RENDA,f=euro2(a.falta),rp=txRetencaoProvavel(tForm,a);
  const ret=rp.oferece?[{v:'retencao',label:'O inquilino reteve IRS na fonte',sub:'Os '+f+' são o IRS que ele reteve e entregou à AT por ti: ficam no retido, e a renda conta inteira. Se o recibo diz «Sem retenção», não é isto.',icon:'recibo'}]:[];
  const c=contract(tForm.contractId),comPlaneado=!!c&&servicoLigado('recurring')&&!!ctRecOf(c);
  const opts=(rp.cabeca?ret:[]).concat([{v:'parcial',label:'Pagamento parcial',sub:'Faltam '+f+': ficam em dívida'+(comPlaneado?', e o planeado continua a pedir esta renda.':'.'),icon:'clock'}])
    .concat(['comissao','conservacao','melhoria'].map(k=>({v:k,label:D[k].label,sub:D[k].sub,icon:D[k].icon})))
    .concat([{v:'encargo',label:'Encargo do imóvel pago pelo inquilino',sub:'O condomínio, o IMI, o seguro ou a água, luz e gás.',icon:'building'},
      {v:'outro',label:D.outro.label,sub:D.outro.sub,icon:D.outro.icon}])
    .concat(rp.cabeca?[]:ret);
  pickModal('Entrou menos do que a renda: porquê?',opts,txRendaAbaixoEscolha,
    `<div class="hint u-fs-14px">A renda de ${esc(mesPt(a.mes))} é ${euro2(a.renda)}, e faltam ${f}. O IRS conta a renda do recibo, antes da retenção, da comissão e de descontos: num desconto registas a renda inteira e o desconto como despesa.</div>`);
}
/* A retenção na fonte explica o que falta (N081)? Só retém quem tem, ou deve
   ter, contabilidade organizada (CIRS art. 101.º n.º 1): a saída vai à cabeça
   quando um inquilino do contrato retém (txInquilinoRetem) ou quando o que
   falta é uma das taxas certas da renda do mês, com um euro de folga — as do
   bloco `retencao` da versão do ano, lidas pelo fisco-avisos.js:
   fiscoAvRetencaoCerta (os 25 %, e os 10 % das rendas moderadas quando o
   contrato cabe nelas); sem a Declaração ligada, a taxa geral da versão. Não
   se oferece quando o que falta fica abaixo do mínimo de uma retenção
   (art. 101.º-B n.º 1 d)): aí o inquilino não retém.
   Recebe: t — a renda do formulário (tForm); a — o que o txRendaAbaixo devolveu ({renda, falta}).
   Devolve: {oferece, cabeca} — true/false cada um. */
function txRetencaoProvavel(t,a){
  const c=t.contractId?contract(t.contractId):null,ano=anoIrs(String(t.date||'').slice(0,4)),d=String(t.date||'');
  const R=(irsAno(ano)||{}).retencao;
  let certa=null;
  if(c&&servicoLigado('fisco'))certa=fiscoAvRetencaoCerta(c,t,ano);
  else if(R&&typeof R==='object'&&Number(R.taxa)>0)certa={taxas:[Number(R.taxa)],minimo:Number(R.minimo)>0&&(!R.minimoDesde||d>=String(R.minimoDesde))?Number(R.minimo):0};
  const falta=Number(a&&a.falta)||0,renda=Number(a&&a.renda)||0;
  if(certa&&certa.minimo&&falta<certa.minimo-0.005)return {oferece:false,cabeca:false};
  const bate=!!certa&&renda>0&&(certa.taxas||[]).some(k=>Math.abs(falta-renda*Number(k)/100)<=1);
  return {oferece:true,cabeca:txInquilinoRetem(c)||bate};
}
/* Algum inquilino do contrato retém IRS na fonte? A ficha diz «Retém IRS na
   fonte», ou o NIF é de pessoa coletiva (irs-papeis.js:nifColetivo — um
   sinal, nunca o critério legal) sem o «confirmei: não retém» (retemVisto).
   Recebe: c — o contrato (aguenta null).
   Devolve: true ou false. */
function txInquilinoRetem(c){
  return !!c&&ctTenants(c).some(p=>p&&(p.retem===true||(nifColetivo(p.nif)&&p.retemVisto!==true)));
}
/* Uma escolha da pergunta da renda abaixo: o pagamento parcial grava já; a
   retenção na fonte grava a renda com o que falta no retido (N081); o
   encargo do imóvel pergunta qual (ENCARGOS_DO_INQUILINO); o resto é um
   desconto (txRendaAbaixoDesconto).
   Recebe: o — a opção escolhida ({v}).
   Devolve: nada. */
function txRendaAbaixoEscolha(o){
  const a=txAbaixo;if(!a||!o)return;
  if(o.v==='parcial'){txRendaAbaixoFecha();txAbaixo=null;tForm.parcial=true;return txGuardarMovimento(a.id)}
  /* a retenção: o montante fica o que entrou, e o que falta vai ao retido (N081) */
  if(o.v==='retencao'){txRendaAbaixoFecha();txAbaixo=null;tForm.retencao=r2((Number(tForm.retencao)||0)+a.falta);tForm.parcial=false;return txGuardarMovimento(a.id)}
  if(o.v!=='encargo')return txRendaAbaixoDesconto(o.v,false);
  /* a escolha seguinte fica no lugar desta (o pickModal guarda uma escolha de
     cada vez): o «Voltar» dela devolve ao formulário */
  txRendaAbaixoFecha();
  pickModal('Que encargo pagou o inquilino?',ENCARGOS_DO_INQUILINO.map(e=>({v:e.id,label:e.nome,icon:'building'})),txRendaAbaixoEncargo);
}
/* O encargo que o inquilino pagou e descontou na renda: com o planeado desse
   encargo no mesmo mês (planeados.js:recDoEncargoNoMes), oferece saltá-lo —
   confirmá-lo também deduzia o mesmo dinheiro duas vezes (D114); sem ele,
   segue para o desconto.
   Recebe: o — a opção escolhida ({v: o id do encargo, label}).
   Devolve: nada. */
function txRendaAbaixoEncargo(o){
  const a=txAbaixo;if(!a||!o)return;
  const r=servicoLigado('recurring')?recDoEncargoNoMes(a.pid,o.v,a.mes):null;
  if(!r)return txRendaAbaixoDesconto(o.v,false);
  txRendaAbaixoFecha();
  pickModal(String(o.label||'')+' de '+mesPt(a.mes)+': está nos planeados',[
    {v:'saltar',label:'Saltar o planeado deste mês',sub:'O inquilino pagou este encargo: confirmá-lo também deduzia o mesmo dinheiro duas vezes.',icon:'check'},
    {v:'manter',label:'Manter o planeado',sub:'Se este mês também pagaste tu este encargo.',icon:'repetir'}],
    x=>txRendaAbaixoDesconto(o.v,x.v==='saltar'?r.id:false));
}
/* Fecha as folhas da pergunta, até ao formulário do movimento que a abriu.
   Devolve: nada. */
function txRendaAbaixoFecha(){
  const a=txAbaixo;if(!a)return;
  let guarda=0;
  while(guarda++<10&&modalStack.length&&modalTop()!==a.camada)closeModal();
}
/* O desconto: a renda grava-se inteira (o montante sobe o que faltava; o
   IRS conta a renda do recibo) e abre-se a despesa do desconto, já com o
   valor, o dia, o imóvel, a descrição e a categoria (TX_DESCONTOS_RENDA; a
   coluna do Anexo F fixa-se no movimento quando a categoria desta conta não
   a dá) — para a pessoa conferir e guardar. Num encargo com o planeado do
   mesmo mês, salta-o antes (planeados.js:recSaltarEncargo).
   Recebe: k — a chave do desconto (TX_DESCONTOS_RENDA, ou o id do encargo);
   saltar — o id do planeado do encargo a saltar, ou false.
   Devolve: nada — grava a renda e abre o formulário da despesa. */
function txRendaAbaixoDesconto(k,saltar){
  const a=txAbaixo,d=TX_DESCONTOS_RENDA[k];if(!a||!d)return;
  txRendaAbaixoFecha();txAbaixo=null;
  tForm.amount=r2((Number(tForm.amount)||0)+a.falta);tForm.parcial=false;
  const pid=a.pid,date=tForm.date||today();
  txGuardarMovimento(a.id);
  if(saltar&&servicoLigado('recurring')){recSaltarEncargo(saltar);save();buildNav();render()}
  const preset={label:d.desc+' · '+mesPt(a.mes),amount:a.falta,date};
  const cat=d.catId?txCatDoId('expense',d.catId):d.cat?txCatNome(d.cat[0],d.cat[1]):null;
  if(cat){preset.category=cat.category;preset.sub=cat.sub}
  if(d.col&&irsColunaDe(Object.assign({kind:'expense'},preset)).col!==d.col)preset.irsCol=d.col;
  txModal({kind:'expense',propId:pid,preset});
  toast(saltar?'Renda registada inteira, e o planeado deste mês saltou. Confere a despesa do desconto e guarda.':'Renda registada inteira. Confere a despesa do desconto e guarda.');
}
/* Uma categoria das despesas pelo nome, só se existir nesta conta (a árvore
   de cada um pode não a ter): a subcategoria só se for dela.
   Recebe: c — o nome da categoria; s — o da subcategoria ('' sem ela).
   Devolve: {category, sub}, ou null quando a categoria não existe. */
function txCatNome(c,s){
  const arv=catsFor('expense')||{};
  if(!(c in arv))return null;
  return {category:c,sub:s&&(arv[c]||[]).indexOf(s)>-1?s:''};
}
/* Afina o tForm depois de mudar o imóvel ou o tipo: limpa quem paga/recebe se já não for dono,
   escolhe a hipoteca viva por defeito e, se o montante ainda estiver vazio, sugere valor e
   descrição a partir da renda do contrato ou da prestação da hipoteca (menos ao alterar um
   modelo guardado, que pode ter ficado sem montante de propósito). Numa renda sugerida
   com a descrição ainda por escrever, liga também o contrato (o único em vigor no imóvel)
   e a categoria Rendas › Renda mensal (txSugereContratoDaRenda, D05); e numa renda nova
   com contrato sugere o mês a que respeita (txSugereMesDaRenda, D54). As sugestões ficam
   marcadas em _aA/_aL/_aC/_aCat/_aSub/_aP para o keepTyped as distinguir do que o
   utilizador escreveu.
   Devolve: nada — só mexe no tForm; quem chama repinta depois. */
function prefill(){
  const p=prop(tForm.propertyId);
  const ows=p?ownersOfProp(p).slice():((tForm.groupId||tForm.todos)?txGroupOwners(tForm).map(o=>o.id):donosGlobais().map(o=>o.id));
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
  /* um modelo guardado sem montante ficou assim de propósito: alterá-lo não o volta a sugerir */
  if(!tForm.amount&&!(txMontanteOpcional()&&txModo.tplId)){
    /* a descrição em branco é a que ainda se pode sugerir: a escrita à mão fica */
    const livre=!tForm.label;
    const set=(a,l)=>{tForm.amount=Math.round(a*100)/100;tForm._aA=tForm.amount;if(!tForm.label){tForm.label=l;tForm._aL=l}};
    if(tForm.kind==='income'&&p){
      const c=tForm.contractId?contract(tForm.contractId):null;
      if(c){set(c.rent,'Renda '+ctName(c));if(livre)txSugereCategoriaDaRenda()}
      else{const ac=activeContracts(p.id);if(ac.length===1){set(ac[0].rent,'Renda '+ctName(ac[0]));if(livre)txSugereContratoDaRenda(ac[0])}}
    }
    if(tForm.kind==='loan'&&p){
      const l=tForm.loanId?findLoan(p,tForm.loanId):null;
      if(l)set(loanCalc(l).total,'Prestação '+(l.name?l.name+' · ':'')+p.name);
    }
  }
  /* o contrato escolhido à mão numa receita sem categoria traz a categoria da
     renda, mesmo com o montante já escrito (N083: os quartos) */
  if(tForm.kind==='income'&&tForm.contractId&&tForm._ctEscolhido&&!tForm.category&&servicoLigado('contracts'))txSugereCategoriaDaRenda();
  /* o mês a que a renda respeita, depois do contrato (que pode ter vindo da sugestão de cima) */
  txSugereMesDaRenda();
}
/* A sugestão do «+» numa receita de um imóvel com um só contrato em vigor: a
   renda e a descrição dele vinham sem o contrato nem a categoria, e a receita
   gravada assim não era renda para a Declaração (D05). O contrato e a
   categoria Rendas › Renda mensal entram juntos, como sugestão marcada (_aC,
   e a da categoria em txSugereCategoriaDaRenda) — o keepTyped desfá-la como
   desfaz a renda sugerida, e ela só volta quando a descrição e o montante
   ainda são os sugeridos. Só com os Contratos ligados: sem eles o seletor
   não está no formulário, e o contrato gravava-se escondido. E só sem
   categoria ou nas Rendas: um contrato ligado muda o papel de outras
   receitas (um reembolso do condomínio com contrato é renda — Q7).
   Recebe: c — o contrato em vigor.
   Devolve: nada — mexe no tForm. */
function txSugereContratoDaRenda(c){
  if(!c||tForm.contractId||tForm._ctEscolhido||!servicoLigado('contracts'))return;
  if(tForm.category&&txCatIrsId(tForm)!=='rendas')return;
  tForm.contractId=c.id;tForm._aC=c.id;
  txSugereCategoriaDaRenda();
}
/* A categoria de uma renda sugerida: Rendas › Renda mensal, achadas pelo id
   (dados.js:catIrsId — o nome pode ser outro nesta conta), e só onde a
   pessoa ainda não escolheu: sem categoria, as duas; em Rendas sem
   subcategoria, só a Renda mensal. Num contrato que já tinha acabado na data
   da receita (txContratoAcabou: a renda que o ex-inquilino paga depois do
   fim, N025), a sugestão é a Renda em atraso — o mês a que respeita fica
   obrigatório, e quem o sabe é a pessoa. Uma conta sem elas fica sem
   sugestão. Marca o que sugeriu em _aCat e _aSub (para o keepTyped).
   Devolve: nada — mexe no tForm. */
function txSugereCategoriaDaRenda(){
  const t=tForm;if(t.kind!=='income')return;
  const c=t.contractId?contract(t.contractId):null;
  const r=txCatDoId('income',txContratoAcabou(c,t.date)?'rendas/renda-em-atraso':'rendas/renda-mensal')||txCatDoId('income','rendas/renda-mensal');
  if(!r)return;
  if(!t.category){t.category=r.category;t.sub=r.sub;t._aCat=r.category;t._aSub=r.sub;return}
  if(t.category===r.category&&!t.sub){t.sub=r.sub;t._aSub=r.sub}
}
/* O último dia em que um contrato esteve em vigor, para o seletor do contrato
   de uma receita: o da cessação (irs.js:irsCessacao, que o «Terminar» grava),
   e num terminado sem ela o c.end (o «Terminar» antigo escrevia lá o dia).
   Num contrato que continua (mesmo com o termo passado sem «Renovar…»), ''.
   Recebe: c — o contrato (aguenta null).
   Devolve: 'AAAA-MM-DD', ou ''. */
function txFimDoContrato(c){
  if(!c)return '';
  const x=irsCessacao(c).data;if(x)return x;
  return c.active===false?String(c.end||''):'';
}
/* O contrato já tinha acabado nesta data? O dia de fim real
   (txFimDoContrato) antes da data — ou um terminado sem data nenhuma.
   Recebe: c — o contrato (aguenta null); data — 'AAAA-MM-DD' (vazio: hoje).
   Devolve: true ou false. */
function txContratoAcabou(c,data){
  if(!c)return false;
  const d=/^\d{4}-\d{2}-\d{2}$/.test(String(data||''))?String(data):today(),f=txFimDoContrato(c);
  return f?f<d:c.active===false;
}
/* O nome que uma categoria do IRS tem nesta conta, pelo id fixo dela
   (dados.js:catIrsId, CATS_DO_IRS): a categoria e a subcategoria da árvore
   do tipo cujo id é este.
   Recebe: kind — o tipo do movimento ('income' ou 'expense'); id — o id
   ('rendas', 'rendas/renda-mensal', 'impostos/imi'…).
   Devolve: {category, sub} — sub '' num id de categoria —, ou null quando a
   conta não a tem (removida, ou renomeada antes de o id existir). */
function txCatDoId(kind,id){
  const arv=catsFor(kind)||{},sub=String(id||'').indexOf('/')>-1;
  for(const c of Object.keys(arv)){
    if(!sub){if(catIrsId(kind,c)===id)return {category:c,sub:''};continue}
    const s=(arv[c]||[]).find(x=>catIrsId(kind,c,x)===id);
    if(s)return {category:c,sub:s};
  }
  return null;
}
/* O mês a que respeita uma renda nova, sugerido (D54). Era sempre o mês da
   data, e a renda de dezembro paga em janeiro saía como a de janeiro: ficava
   fora das rendas de anos anteriores (quadro 8) e o planeado dava janeiro por
   pago. Passa a ser o do planeado da renda ainda por confirmar mais antigo do
   contrato (planeados.js:ctRecOf — o cursor dele, já vencido, e ainda sem
   renda lançada); sem ele fica em branco, que é o da data. Numa «Renda em
   atraso» não se sugere nada: o mês é obrigatório, e quem o sabe é a pessoa.
   A renda paga antes do dia previsto (N146: a de dezembro paga a 28 de
   novembro, o regime supletivo do Código Civil): com o mês da data já pago
   (rendaJaLancada) e o planeado a vencer nos 31 dias depois da data, o mês é
   o do planeado (marcado também em _aPAdiantada, para a dica o dizer) — senão
   ficava a segunda renda do mês da data, e o mês certo continuava por pagar.
   Só numa renda nova com contrato, e nunca por cima do que lá está; marca o
   que sugeriu em _aP (o keepTyped e a troca para «Renda em atraso» desfazem-no).
   Devolve: nada — mexe no tForm. */
function txSugereMesDaRenda(){
  const t=tForm;
  if(t.kind!=='income'||t._edit||!t.contractId||t.periodo||txModo.modo==='rec'||txModo.modo==='tpl'||txRendaEmAtraso(t))return;
  const c=contract(t.contractId);
  if(!c||!servicoLigado('recurring'))return;
  const r=ctRecOf(c);
  if(!r||r.muted||!/^\d{4}-\d{2}-\d{2}$/.test(String(r.next||'')))return;
  if(rendaJaLancada(c,r.next))return;
  if(r.next<=today()){t.periodo=r.next.slice(0,7);t._aP=t.periodo;return}
  const d=/^\d{4}-\d{2}-\d{2}$/.test(String(t.date||''))?t.date:today();
  if(r.next.slice(0,7)<=d.slice(0,7)||!rendaJaLancada(c,d))return;
  const dias=(Date.UTC(+r.next.slice(0,4),+r.next.slice(5,7)-1,+r.next.slice(8,10))-Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)))/864e5;
  if(dias>31)return;
  t.periodo=r.next.slice(0,7);t._aP=t.periodo;t._aPAdiantada=true;
}
/* É uma «Renda em atraso» (Rendas › Renda em atraso, pelo id do movimento:
   dados.js:txCatIrsId — a marca, a árvore, o nome de origem; N006)?
   Recebe: t — o movimento.
   Devolve: true ou false. */
function txRendaEmAtraso(t){return !!t&&t.kind==='income'&&!!t.sub&&txCatIrsId(t,true)==='rendas/renda-em-atraso'}
/* O mês a que a renda respeita é obrigatório neste formulário? Numa «Renda em
   atraso» registada ou confirmada (D54); num planeado ou num modelo o campo
   nem está, porque o mês é de cada renda.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: true ou false. */
function txPedeMesDaRenda(t){return txModo.modo!=='rec'&&txModo.modo!=='tpl'&&txRendaEmAtraso(t)}
/* Antes de repintar por causa de uma mudança: guarda o que está no DOM e
   esvazia o que ainda é sugestão automática — a descrição, o montante, o mês
   da renda, e o contrato e a categoria que vieram com a renda sugerida (D05).
   O que foi escrito ou escolhido à mão fica. O contrato e a categoria só
   voltam a sugerir-se com a descrição e o montante também por sugerir: quem
   mudou um deles já não está a registar a renda sugerida.
   Devolve: nada — só mexe no tForm. */
function keepTyped(){
  collectTx();const t=tForm;
  if(t.label===t._aL)t.label='';
  if(t.amount===t._aA)t.amount='';
  if(t._aP&&t.periodo===t._aP)t.periodo='';
  if(t._aC&&t.contractId===t._aC)t.contractId=null;
  /* a subcategoria sugerida sai; a categoria só com ela (uma subcategoria escolhida à mão não fica sem a sua) */
  if(t._aSub&&t.sub===t._aSub){t.sub='';if(t._aCat&&t.category===t._aCat)t.category=''}
  ['_aP','_aPAdiantada','_aC','_aCat','_aSub'].forEach(k=>{delete t[k]});
}
/* O corpo da ficha de um movimento: o que se sabe sobre ele, para ler.

   Pela ordem da pergunta que traz alguém aqui — vi esta linha na lista: o
   que foi, de quanto, quando, de que imóvel, quem pagou, e quanto disto é
   meu. O resto (a hipoteca, a dívida a terceiros, a categoria) só aparece
   quando é deste movimento.
   Uma parte de um lote mostra o lote: o montante é o total, o imóvel é o grupo
   (ou «Todos os imóveis») e por quantos se dividiu, e a divisão entre imóveis
   lista as partes que estão nesta base — com as que não vejo contadas, e a
   nota a dizer porque não o posso alterar.
   Recebe: id — o id do movimento.
   Devolve: o HTML do corpo, ou vazio se o movimento já não existir. */
function txFicha(id){
  const t=(db.transactions||[]).find(x=>x.id===id);if(!t)return '';
  const lote=t.lote||null,partes=lote?partesDoLote(lote.id):[],completo=!lote||loteCompleto(t);
  const montante=lote?Number(lote.total)||0:t.amount;
  /* a retenção de um lote é a soma das partes, e só se sabe com ele inteiro */
  const retido=lote?(completo?r2(sum(partes.map(x=>Number(x.retencao)||0))):0):(Number(t.retencao)||0);
  const K=KIND[t.kind]||KIND.expense,p=lote?null:prop(t.propertyId);
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
     o espera, e nas receitas que o pedem: a renda, a caução e o reembolso do
     inquilino (irs-papeis.js:irsReceitaDe, as mesmas que o resumo conta nos
     recibos por emitir; prazos.js:pzPedeRecibo — não na categoria B nem num
     arrendamento rural) e a cedência de uso (txPedeRecibo, N077). E o papel
     dela na Declaração, numa linha «Anexo F»
     (txAnexoFDaReceita, N144). Numa despesa: a coluna do Anexo F, e de onde
     veio a decisão — ou o que a Declaração lhe faz, quando a deixa de fora ou
     a leva às obras dos 24 meses (txAnexoFDaDespesa, N113); só quando a
     despesa toca um imóvel arrendado (txAnexoFAplica, N064). */
  const papelIrs=t.kind==='income'?irsReceitaDe(t).papel:'';
  const renda=t.kind==='income',recibo=txPedeRecibo(t);
  const anexoF=t.kind==='expense'?(txAnexoFAplica(t)?txAnexoFDaDespesa(t):''):renda?txAnexoFDaReceita(t):'';
  /* a divisão própria não muda o IRS: lá conta a quota de cada um no imóvel (D95);
     «só a minha parte» já não é cortada pela quota, e a frase não se diz */
  const divisaoPropria=verDivisao&&(t.kind==='income'||t.kind==='expense')&&!!(t.split&&t.split.mode&&t.split.mode!=='quota')&&t.notaPropria!==true;
  return ficha([
    {tipo:'nota',valor:esc(lote?recusaDoLote(t):motivoRecusa(t.propertyId,'tx.add',t))},
    /* a cor do valor é a da lista (txTomDoTipo): a prestação roxa, a dívida em
       cobalto — o K.color dava-lhes o âmbar, que é só para aviso */
    {rotulo:'Montante',valor:`<span class="${txTomDoTipo(t.kind).valor}">${K.sign}${euro2(montante)}</span>`},
    {rotulo:'Tipo',valor:esc(K.short)+(t.kind==='loan'?(t.payType==='amortizacao'?' · amortização':' · prestação'):'')},
    {rotulo:'Data',valor:dPT(t.date)},
    /* sem imóvel: um acerto é de todos os imóveis; o resto é um movimento avulso,
       que conta nos totais e não na avaliação de nenhum — a mesma regra do seletor */
    {rotulo:'Imóvel',valor:lote?ondeDoLote(t):t.propertyId?esc(propName(t.propertyId)):(t.groupId?esc('Grupo '+((grp(t.groupId)||{}).name||'')):((t.todos||t.kind==='settle')?'Todos os imóveis':'Sem imóvel'))},
    ct&&pode(t.propertyId,'contract.view')?{rotulo:'Contrato',valor:esc(ctName(ct))}:null,
    renda&&ehRenda(t)&&t.periodo?{rotulo:'Mês da renda',valor:esc(mesPt(t.periodo))}:null,
    renda&&retido>0?{rotulo:'Retido na fonte',valor:euro2(retido)}:null,
    renda&&retido>0?{rotulo:'Renda bruta',valor:euro2(r2((Number(montante)||0)+retido))}:null,
    renda&&t.parcial?{rotulo:'Pagamento',valor:'Parcial: o resto fica em dívida'}:null,
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
    divisaoPropria?{tipo:'nota',valor:esc(TX_IRS_QUOTA)}:null,
    /* um lote: as partes que estão nesta base, pela ordem dos imóveis, e as
       que não vejo (de imóveis que não tenho) só contadas */
    lote?{tipo:'bloco',rotulo:'Divisão entre imóveis',valor:(function(){
      const falta=Math.max(0,(Number(lote.n)||0)-partes.length);
      return esc(modo(PSPLIT_MODES,lote.modo,'equal'))+'<br>'+
        partes.map(x=>esc(propName(x.propertyId))+' · '+euro2(x.amount)).join('<br>')+
        (falta?'<br>e mais '+falta+(falta===1?' imóvel que não vês':' imóveis que não vês'):'');
    })()}:null,
    /* um movimento de grupo antigo (por partir), ou um de «Todos» que não se partiu:
       a divisão feita agora, pelos imóveis de hoje */
    !lote&&(t.groupId||t.todos)&&txProps(t).length>1?{tipo:'bloco',rotulo:'Divisão entre imóveis',valor:(function(){
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
    anexoF?{rotulo:'Anexo F',valor:anexoF}:null,
    renda&&String(t.pagadorNif||'')?{rotulo:'NIF de quem paga',valor:esc(t.pagadorNif)}:null,
    renda&&String(t.cedenciaNumero||'')?{rotulo:'N.º da cedência',valor:esc(t.cedenciaNumero)}:null,
    t.kind==='expense'&&t.notaPropria?(txCatIrsId(t,true)==='impostos/imi'
      ?{rotulo:'Nota de IMI',valor:'A minha nota: conta inteira para quem a pagou'}
      :{rotulo:'Parte',valor:'Só a minha parte: conta inteira para quem a pagou'}):null,
    (t.tags||[]).length?{rotulo:'Etiquetas',valor:(t.tags||[]).map(esc).join(' · ')}:null,
    /* a caução não entra nos totais da app, mas no IRS é renda do ano em que se recebe (N144, D03) */
    !countsInTotals(t)?{tipo:'nota',valor:papelIrs==='caucao'
      ?'Não entra nos totais nem no resultado: é dinheiro que se devolve. No IRS conta como renda do ano em que a recebes.'
      :isPassivo(t)
      ?'Não entra nos totais nem no resultado: é dinheiro que se devolve — uma caução ou um empréstimo recebido.'
      :'Não entra nos totais nem no resultado.'}:null,
    {tipo:'lista',rotulo:'Anexos',valor:txAnexosDaFicha(t)},
    String(t.notes||'').trim()?{tipo:'bloco',rotulo:'Comentários',valor:rich(t.notes)}:null,
  ]);
}
/* O papel de uma receita na Declaração, para a linha «Anexo F» da ficha
   (N144), pelo irs-papeis.js:irsReceitaDe: a renda (na linha do contrato, ou
   sem contrato e fora das linhas), a caução (renda do ano em que se recebe,
   OC 20256/2023), a indemnização e as outras receitas prediais (com a
   natureza da versão do ano), o reembolso que abate a um gasto, o que não se
   declara e o que está por classificar. Só com a Declaração ligada.
   Recebe: t — a receita.
   Devolve: o HTML do valor (já escapado), ou ''. */
function txAnexoFDaReceita(t){
  if(!t||t.kind!=='income'||!servicoLigado('fisco'))return '';
  const r=irsReceitaDe(t),n=r.natureza?'natureza '+r.natureza:'';
  /* a ficha já põe o valor a negrito: o papel e, pequeno, o que lhe acontece */
  const linha=(a,b)=>esc(a)+(b?' <span class="small u-fw-400">'+esc(b)+'</span>':'');
  if(r.papel==='renda')return t.contractId?linha('Renda','na linha do contrato'):linha('Renda sem contrato','liga-a ao contrato: sem ele não vai a nenhuma linha do quadro');
  if(r.papel==='caucao')return linha('Caução','conta como renda do ano em que a recebes');
  if(r.papel==='indemnizacao')return linha('Indemnização que compensa rendas',n);
  if(r.papel==='outra')return linha('Outras receitas prediais',n);
  if(r.papel==='reembolsoGasto')return linha('Reembolso de um gasto','abate a esse gasto, e não é renda');
  if(r.papel==='fora')return linha('Não se declara','');
  if(r.papel==='porClassificar')return linha('Por classificar','a Declaração não a conta: se é uma renda, escolhe a categoria Rendas e o contrato');
  return '';
}
/* O que a Declaração faz a uma despesa, para a linha «Anexo F» da ficha
   (N113): a coluna e de onde veio a decisão; e, quando a Declaração a deixa
   de fora (sem contrato em vigor nesse dia, um imóvel sem rendas no ano) ou a
   leva às obras dos 24 meses de um contrato, o que lhe faz — pela função
   única do resumo (fisco-resumo.js:fiscoDespesaNaDeclaracao), a mesma do CSV
   e da Declaração. O AIMI vai ao quadro dele.
   Recebe: t — a despesa.
   Devolve: o HTML do valor (já escapado), ou ''. */
function txAnexoFDaDespesa(t){
  const col=irsColunaDe(t);
  const quadroAimi=((irsAno(anoIrs(String(t.date||'').slice(0,4)))||{}).quadros||{}).aimi;
  const origem=({movimento:'escolhida neste movimento',sub:'pela subcategoria',categoria:'pela categoria',
    omissao:'sem regra: escolhe a coluna',lei:'fixo por lei: vai ao '+(quadroAimi?'quadro '+quadroAimi:'quadro do AIMI'),excluido:'não conta: categoria fora dos totais'}[col.origem]||'');
  /* «a confirmar» pela categoria: não conta até se escolher a coluna (D61, D07) */
  const origemTxt=col.col==='confirmar'&&(col.origem==='categoria'||col.origem==='sub')?origem+': escolhe a coluna':origem;
  const x=txDestinoDaDespesa(t);
  if(x&&x.motivo&&['nao','confirmar'].indexOf(x.motivo)<0){
    /* a ficha já põe o valor a negrito: o nome do destino e, pequeno, porquê */
    const nome=x.conta?(irsColunaNome(x.col)||(x.col==='obras24'?'Obras antes do arrendamento':'')):'Fora da Declaração';
    const porque=String(x.texto||'').replace(/^Fora da Declaração:\s*/,'');
    return esc(nome)+(porque?' <span class="small u-fw-400">'+esc(porque)+'</span>':'');
  }
  return esc(irsColunaNome(col.col))+(origemTxt?' <span class="small u-fw-400">'+esc(origemTxt)+'</span>':'');
}
/* O que a Declaração faz a esta despesa (fisco-resumo.js:fiscoDespesaNaDeclaracao,
   N113), lido com cuidado: só com a Declaração ligada, e um erro dela não
   parte a ficha nem o formulário. Serve também o tForm, que ainda não está
   na base (uma cópia normalizada).
   Recebe: t — a despesa.
   Devolve: {col, origem, conta, motivo, contrato, parte, ano, data, texto} ou null. */
function txDestinoDaDespesa(t,memo){
  if(!t||t.kind!=='expense'||!servicoLigado('fisco'))return null;
  try{const x=fiscoDespesaNaDeclaracao(normTx(JSON.parse(JSON.stringify(t))),memo||undefined);return x&&typeof x==='object'?x:null}catch(e){return null}
}
/* O que o resumo guarda por ano para a função da despesa (os imóveis com
   linha), enquanto o formulário está aberto: a despesa do formulário ainda
   não está na base e não o muda, e cada repintura refazia o resumo do ano.
   Nasce vazio a cada txModal, e esvazia-se quando a base muda por baixo (um
   envio da nuvem, outra base): txMemoDaBase. */
let txMemoDoDestino={};
/* O memo do txMemoDoDestino para a base de agora: o mesmo enquanto a base, os
   movimentos e os contratos são os mesmos; senão, um novo.
   Devolve: o objeto do memo. */
function txMemoDaBase(){
  const m=txMemoDoDestino,k=[(db.transactions||[]).length,(db.contracts||[]).length].join(':');
  if(!m||m._db!==db||m._k!==k){txMemoDoDestino={};Object.defineProperty(txMemoDoDestino,'_db',{value:db});Object.defineProperty(txMemoDoDestino,'_k',{value:k})}
  return txMemoDoDestino;
}
/* A coluna do Anexo F diz-se nesta despesa (N064)? Só quando a despesa toca um
   imóvel que é de arrendamento nessa altura: que não é de uso próprio, ou que
   teve contrato no ano da despesa (ou começa um nos dois anos seguintes — as
   obras dos 24 meses) ou rendas nesse ano; o destino de hoje não decide
   (nota do verificador da lei). Sem imóvel, ou com a Declaração desligada,
   nada — a não ser que a despesa já tenha a coluna escolhida, que nunca fica
   escondida. O AIMI tem sempre a frase dele.
   Recebe: t — a despesa (do formulário ou da base).
   Devolve: true ou false. */
function txAnexoFAplica(t){
  if(!t||t.kind!=='expense')return false;
  if(t.irsCol||irsColunaDe(Object.assign({},t,{irsCol:''})).origem==='lei')return true;
  if(!servicoLigado('fisco'))return false;
  const ps=t.propertyId?[prop(t.propertyId)].filter(Boolean):(t.groupId||t.todos)?txProps(t):[];
  if(!ps.length)return false;
  const d=/^\d{4}-\d{2}-\d{2}$/.test(String(t.date||''))?t.date:today(),Y=Number(d.slice(0,4));
  return ps.some(p=>p.use!=='proprio'||txArrendadoNoAno(p.id,Y));
}
/* O imóvel esteve arrendado num ano, para os gastos? Um contrato que viveu
   nesse ano (do início ao fim real, txFimDoContrato) ou que começa nos dois
   anos seguintes (as obras dos 24 meses), ou rendas registadas nesse ano.
   Recebe: pid — o id do imóvel; Y — o ano (número).
   Devolve: true ou false. */
function txArrendadoNoAno(pid,Y){
  const ini=Y+'-01-01',ate=(Y+2)+'-12-31';
  if((db.contracts||[]).some(c=>c&&c.propertyId===pid&&c.start&&c.start<=ate&&(!txFimDoContrato(c)||txFimDoContrato(c)>=ini)))return true;
  return (db.transactions||[]).some(x=>x&&x.propertyId===pid&&String(x.date||'').startsWith(String(Y))&&ehRenda(x));
}
/* Os anexos na ficha de um movimento: uma linha por ficheiro, com o nome, e
   tocar abre-o (componentes.js:openMeta — uma imagem numa janela, um PDF
   descarrega), como a lista dos anexos do contrato (contrato.js:ctVerAnexos),
   e pela mesma ordem do formulário. Numa parte de um lote são os do lote
   (cada parte leva a mesma lista). Só com «Ver fotos e documentos» no imóvel:
   o servidor não dava o ficheiro a mais ninguém, e o nome sem o ficheiro é
   uma linha que rebenta ao toque. Juntar e remover é no «Editar».
   Recebe: t — o movimento.
   Devolve: o HTML da lista (.ct-lista-anexos), ou '' sem anexos (a ficha não mostra o bloco). */
function txAnexosDaFicha(t){
  const fs=pode(t.propertyId,'file.view')?(t.files||[]):[];
  if(!fs.length)return '';
  return `<div class="ct-lista-anexos mov-anexos-lista">${fs.map(f=>`<button type="button" class="ct-anexo" data-toca="camada" data-click="openMeta('${jsq(f.id)}')">${ic('clip',18)}<span>${esc(f.name||'ficheiro')}</span>${ic('chevR',16)}</button>`).join('')}</div>`;
}
/* Uma despesa nova já preenchida, para um aviso a abrir com um toque (N134: o
   imposto do selo do primeiro ano de um contrato). A ação só passa textos — um
   objeto fica fora da gramática —, e é esta que monta o preset do txModal. A
   categoria vem pelo id do IRS, com o nome que esta conta lhe dá (txCatDoId);
   uma conta que não a tem fica sem categoria.
   Recebe: pid — o id do imóvel ('' sem imóvel); catId — o id do IRS
   ('impostos/imposto-do-selo'…) ou ''; valor — o montante (número ou texto;
   '' sem sugestão); data — 'AAAA-MM-DD' ('' é hoje); label — a descrição ('' sem ela).
   Devolve: nada — abre o formulário (ou diz porque não pode). */
function txNovaDespesaCom(pid,catId,valor,data,label){
  const id=pid&&prop(pid)?String(pid):null;
  if(id&&!pode(id,'tx.add'))return toast(fraseSemPerm('tx.add'));
  const preset={},cat=catId?txCatDoId('expense',String(catId)):null,v=num(valor);
  if(cat){preset.category=cat.category;preset.sub=cat.sub}
  if(v>0)preset.amount=r2(v);
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(data||'')))preset.date=String(data);
  if(String(label||'').trim())preset.label=String(label).trim();
  txModal({kind:'expense',propId:id,preset});
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
  /* uma parte de um lote edita-se e apaga-se com o lote inteiro (recusaDoLote) */
  const ok=podeEditar(t.propertyId,'tx.add',t)&&!recusaDoLote(t);
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

/* As opções do seletor do imóvel no formulário do movimento. Quem pode
   registar sem imóvel (podeSemImovel: quem é dono de algum) tem à cabeça
   «Sem imóvel» ('') — num acerto, «Todos os imóveis», que é o que um acerto
   sem imóvel é — e, numa receita ou despesa com dois ou mais imóveis meus
   (imoveisDeTodos à data do movimento; num planeado ou modelo, sem data),
   «Todos os imóveis» ('*'). Depois os imóveis onde posso adicionar
   (propOptsPara) e, numa receita ou despesa, os grupos ('g:<id>'): só estas
   se dividem por vários imóveis. O que o movimento já tem escolhido aparece
   sempre — um grupo que não está nesta conta (apagado, ou de outra pessoa),
   «Todos» num molde de quem já só tem um imóvel —, para o seletor não
   mostrar uma coisa e gravar outra. Quem só
   colabora não ganha nenhuma opção nova. Um imóvel vendido antes da data do
   movimento não aparece (txVendidoNaData, D33). Numa receita nova de uma
   conta com contratos em vigor (txPedeImovel, N027), a primeira opção é «—
   escolhe o imóvel —» e «Sem imóvel» ('__sem__') é uma escolha.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: array de {v, label}, com {div:true} antes dos grupos, para o sel(). */
function opcoesDoImovel(t){
  const settle=t.kind==='settle',deLote=t.kind==='income'||t.kind==='expense',meu=podeSemImovel();
  const planeado=txModo.modo==='rec',molde=planeado||txModo.modo==='tpl';
  const todos=!!t.todos||(meu&&deLote&&imoveisDeTodos(molde?'':t.date).length>1);
  const gs=meu&&deLote?gOpts('prop'):[];
  if(t.groupId&&!gs.some(o=>o.v==='g:'+t.groupId)){const g=grp(t.groupId);gs.push({v:'g:'+t.groupId,label:g?'Grupo · '+g.name:'Grupo que não está nesta conta'})}
  /* os vendidos antes da data do movimento saem (D33); o já escolhido fica sempre */
  const casas=propOptsPara(planeado?'rec.add':'tx.add',t.propertyId).filter(o=>o.v===t.propertyId||!txVendidoNaData(prop(o.v),t));
  const sem=txPedeImovel(t)?[{v:'',label:'— escolhe o imóvel —'},{v:'__sem__',label:'Sem imóvel'}]:[{v:'',label:settle?'Todos os imóveis':'Sem imóvel'}];
  return (meu?sem:[])
    .concat(todos&&!settle?[{v:'*',label:'Todos os imóveis'}]:[])
    .concat(casas)
    .concat(gdiv(gs));
}
/* O imóvel já estava vendido na data deste movimento? Sai do seletor do
   imóvel (D33): um imóvel vendido sai das listas do dia a dia. Numa data
   antes da venda continua lá — as rendas e as despesas desses meses ainda se
   registam, e contam na Declaração desse ano —, e no próprio dia da venda
   também. Num planeado ou num modelo, que não têm a data de um facto, conta
   hoje (dados.js:imovelVendido).
   Recebe: p — o imóvel (aguenta null); t — o movimento do formulário (tForm).
   Devolve: true quando sai do seletor. */
function txVendidoNaData(p,t){
  const v=p&&typeof p.vendido==='string'?p.vendido:'';
  if(!v)return false;
  if(txModo.modo==='rec'||txModo.modo==='tpl')return imovelVendido(p);
  const d=/^\d{4}-\d{2}-\d{2}$/.test(String(t&&t.date||''))?t.date:today();
  return v<d;
}
/* Os contratos que o seletor de uma receita oferece (N025): os que ainda não
   acabaram (ctVivo — a caução e as rendas antecipadas recebem-se antes do
   início), os que continuam depois do termo sem a renovação registada (o
   ctEstado dá-os por terminados, e não acabaram), os que acabaram desde o
   início do ano antes do anterior ao da data — a renda em atraso paga depois
   do fim, a indemnização pela ocupação, o seguro de renda —, e sempre o já
   ligado. Primeiro os vivos, depois os outros, do que acabou mais tarde para
   o que acabou mais cedo. Só com os Contratos ligados e um imóvel escolhido.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: os contratos (array). */
function txContratosDaReceita(t){
  if(!servicoLigado('contracts')||!t||!t.propertyId)return [];
  const d=/^\d{4}-\d{2}-\d{2}$/.test(String(t.date||''))?t.date:today(),desde=(Number(d.slice(0,4))-2)+'-01-01';
  const fim=c=>txFimDoContrato(c);
  const cs=contractsOf(t.propertyId).filter(c=>c.id===t.contractId||ctVivo(c)||c.active!==false||!fim(c)||fim(c)>=desde);
  const vivo=c=>ctVivo(c)||c.active!==false;
  return cs.filter(vivo).concat(cs.filter(c=>!vivo(c)).sort((a,b)=>String(fim(b)).localeCompare(String(fim(a)))));
}
/* As opções do seletor do contrato de uma receita: «Sem contrato» à cabeça
   (era «Todos os contratos», que não dizia que a receita ficava fora do
   quadro); num imóvel com mais de um contrato em vigor (txPedeContrato, N083)
   «— escolhe o contrato —», com «Não é de nenhum contrato» ('__nenhum__')
   como escolha. Cada contrato diz se começa depois, se já terminou (e
   quando: N025) ou se o termo passou sem a renovação registada.
   Recebe: t — o movimento do formulário (tForm); acs — os contratos (txContratosDaReceita).
   Devolve: array de {v, label} para o sel(). */
function txOpcoesDoContrato(t,acs){
  const pede=txPedeContrato(t);
  const rot=c=>{
    const e=ctEstado(c),f=txFimDoContrato(c);
    if(e==='futuro'&&c.start)return ctName(c)+' · começa a '+dPT(c.start);
    if(e!=='terminado')return ctName(c);
    if(c.active===false)return ctName(c)+(f?' · terminou a '+dPT(f):' · terminado');
    return ctName(c)+(c.end?' · termo a '+dPT(c.end):'');
  };
  return [{v:'',label:pede?'— escolhe o contrato —':'Sem contrato'}]
    .concat(acs.map(c=>({v:c.id,label:rot(c)})))
    .concat(pede?[{v:'__nenhum__',label:'Não é de nenhum contrato'}]:[]);
}
/* O que é a subcategoria de uma receita, por baixo dela (N143), pelo id:
   numa Indemnização, que só a que compensa rendas não recebidas vai ao Anexo
   F (CIRS art. 8.º n.º 2 g)) e que a de danos não é renda; nas Outras
   receitas prediais, o que são (a cedência de uso que não é arrendamento,
   art. 8.º n.º 2 d) e e)); com a natureza da versão do ano
   (irs.js:irsNaturezasDoAno). Num reembolso do condomínio, o que o contrato
   ligado muda (com ele é o inquilino, e é renda; sem ele abate ao gasto).
   Recebe: t — o movimento do formulário (tForm), uma receita.
   Devolve: o HTML da dica, ou ''. */
function txDicaDaReceita(t){
  if(!t||t.kind!=='income')return '';
  const sid=txCatIrsId(t,true),n=irsNaturezasDoAno(anoIrs(String(t.date||'').slice(0,4)))||{};
  let s='';
  if(sid==='rendas/indemnizacao')s='Só o que compensa rendas que não recebeste (a mora, a ocupação depois do fim do contrato, o seguro de renda) vai ao Anexo F'+(n.indemnizacao?', com a natureza '+n.indemnizacao:'')+'. Uma indemnização por danos no imóvel ou no recheio não é renda: abate à despesa da reparação. O que ficou da caução para pagar danos já contou como renda no ano em que a recebeste.';
  else if(sid==='rendas/outras-receitas-prediais')s='A cedência de uso do imóvel, ou de parte dele, que não é arrendamento: a publicidade, uma antena, as partes comuns. Vai ao Anexo F'+(n.outras?' com a natureza '+n.outras:'')+', na linha de quem te paga.';
  else if(sid==='reembolsos/condominio')s=t.contractId?'Com contrato: é o inquilino a reembolsar-te o condomínio, e conta como renda.':'Sem contrato: é o condomínio a devolver-te, e abate ao gasto do condomínio. Se é o inquilino a reembolsar-te, liga-o ao contrato: conta como renda.';
  return s?`<div class="hint u-mt-n6px">${esc(s)}</div>`:'';
}
/* A dica por baixo de «Todos os imóveis»: por quantos imóveis se divide, os
   que eram meus na data do movimento (imoveisDeTodos). Num planeado ou num
   modelo a data é a de cada movimento que dele se registar.
   Recebe: t — o movimento do formulário (tForm), com todos.
   Devolve: o texto da dica (por escapar). */
function dicaDeTodos(t){
  if(txModo.modo==='rec'||txModo.modo==='tpl')return 'Divide-se pelos imóveis que tiveres na data de cada movimento.';
  const n=imoveisDeTodos(t.date).length;
  if(n>1)return 'Divide-se pelos '+n+' imóveis que tinhas nesta data.';
  return n?'Nesta data só tinhas um imóvel: o movimento fica nele.':'Nesta data ainda não tinhas imóveis: muda a data, ou escolhe «Sem imóvel».';
}
/* Mudou a data do movimento. Com «Todos os imóveis», os imóveis da divisão
   são os dessa data: a dica, a divisão entre imóveis e quem pagou mudam com
   ela, e o formulário repinta-se com o que já está escrito. Com um imóvel
   vendido entre os meus, o seletor do imóvel depende da data
   (txVendidoNaData, D33): repinta-se também. Numa despesa também: a coluna
   do Anexo F depende da data — se se diz (txAnexoFAplica), a opção das obras
   dos 24 meses e a dica (txDicaDaColunaHtml, D65). De resto nada muda.
   Devolve: nada — repinta o modal, ou só a dica. */
function txDataMudou(){
  collectTx();
  if(tForm.todos){prefill();return repaintTx()}
  if(tForm.kind==='expense'||(db.properties||[]).some(p=>p&&p.vendido))return repaintTx();
  txRefazDicaDaColuna();
}
/* A frase da quota numa divisão própria (D95): os Saldos seguem a divisão e
   quem pagou, a Declaração segue a quota de cada um no imóvel. Vai na ficha
   do movimento e por baixo da divisão no formulário. Sem artigo: o art. 19.º
   do CIRS é o das rendas, e nos gastos a regra é a dos gastos suportados
   (art. 41.º), que a AT imputa pela quota-parte (N115). */
const TX_IRS_QUOTA='Para o IRS, a app conta a quota de cada dono no imóvel, e não quem pagou nem a divisão escolhida aqui.';
const SPLIT_MODES=[['equal','Partes iguais','o mesmo para cada proprietário'],['quota','Quotas do imóvel','pela quota-parte de cada um'],['pct','Quotas a definir','em partes: quem tem 2 paga o dobro de quem tem 1 (2 e 1 → 2/3 e 1/3)'],['percent','Percentagem','percentagem de cada um; devem somar 100'],['amount','Valor certo','montante de cada um; têm de somar o total'],['adjust','Ajuste','um extra por cima da parte igual: tira-se ao total o extra de cada um, o resto divide-se em partes iguais por todos e cada um soma o seu (15 € com 5 de extra para um de dois → 10 € e 5 €)']];
/* Monta o HTML do formulário do movimento a partir do tForm. Os campos variam com o tipo
   (contrato nas rendas, hipoteca e distribuição nos créditos, credor nas dívidas a terceiros,
   quem paga/recebe nos acertos) e com o contexto (modelo, recorrência, grupo de imóveis).
   Só devolve a string; quem a põe no DOM é o openModal ou o repaintTx.
   Devolve: o HTML do formulário (string). */
function txBody(){
  /* os contratos de uma receita (txContratosDaReceita): os que ainda não
     acabaram — a caução e as rendas antecipadas recebem-se antes do início —,
     os que acabaram há pouco — a renda em atraso e a indemnização chegam
     depois do fim (N025) — e sempre o já ligado */
  const t=tForm,p=prop(t.propertyId),acs=t.kind==='income'?txContratosDaReceita(t):[];
  const lns=liveLoans(p);
  const curLoan=t.kind==='loan'&&t.loanId?findLoan(p,t.loanId):null;
  /* com várias vivas e nenhuma escolhida, a primeira opção pede a escolha; uma hipoteca que não
     existe neste imóvel (dados importados) aparece como desconhecida em vez de fingir ser a primeira */
  const lnOpts=(!t.loanId&&lns.length>1?[{v:'',label:'— escolhe a hipoteca —'}]:[])
    .concat(lns.map(l=>({v:l.id,label:loanName(l)+' · '+euro(l.outstanding)})))
    .concat(curLoan&&!(Number(curLoan.outstanding)>0)?[{v:curLoan.id,label:loanName(curLoan)+' · liquidada'}]:[])
    .concat(t.kind==='loan'&&t.loanId&&!curLoan?[{v:t.loanId,label:'Hipoteca desconhecida (outro imóvel)'}]:[]);
  /* sem imóvel, a despesa pode na mesma ser paga por alguém; num grupo (ou em «Todos»), pelos donos dos imóveis dele */
  const ows=(p?ownersOfProp(p).map(owner):((t.groupId||t.todos)?txGroupOwners(t):donosGlobais())).filter(Boolean);
  if(t.kind==='settle')[t.paidBy,t.toId].forEach(o=>{const x=o&&owner(o);if(x&&!ows.some(y=>y.id===o))ows.push(x)});
  const cs=catsFor(t.kind)||{},subs=(cs[t.category]||[]).slice();
  if(t.sub&&subs.indexOf(t.sub)<0)subs.unshift(t.sub);
  /* «Crédito à habitação» é dos pagamentos de crédito: uma despesa assim classificada contava como despesa e não abatia nada */
  const catKeys=Object.keys(cs).filter(c=>!(t.kind==='expense'&&c==='Crédito à habitação'));if(t.category&&catKeys.indexOf(t.category)<0)catKeys.unshift(t.category);
  const credit=t.kind==='owed'||t.kind==='repay',settle=t.kind==='settle';
  const owOpts=[{v:'',label:'Todos os proprietários'}].concat(ows.map(o=>({v:o.id,label:rotuloDoDono(o,ows.length)})));
  const planeado=txModo.modo==='rec',modelo=txModo.modo==='tpl',tom=txTomDoTipo(t.kind),montanteOpc=txMontanteOpcional();
  const repor=calcLoanTotal()!=null&&Math.abs((num(t.amount)||0)-calcLoanTotal())>0.011;
  const pedeImovel=txPedeImovel(t);
  const imovel=`<label>Imóvel${podeSemImovel()&&!pedeImovel?'':' <span class="req">*</span>'}${sel('t_prop',t.propertyId||(t.groupId?'g:'+t.groupId:(t.todos?'*':(t._semImovel&&pedeImovel?'__sem__':''))),opcoesDoImovel(t),'onPropChange','rascunho')}</label>`;
  /* O formulário do canvas (M-Novo movimento): o tipo num segmentado, o
     montante grande, e os campos em grupos — o que foi (montante, descrição,
     data, imóvel, quem pagou), como se classifica (categoria, coluna do Anexo
     F, etiquetas), como se divide —, e os comentários. O que se grava é o de
     sempre: os mesmos ids, lidos pelo collectTx. */
  return `<div class="form mov-form">
    ${modelo?`<label>Nome do modelo (opcional)<input id="t_tplName" value="${esc(txModo.tplName||'')}" placeholder="Ex: Renda mensal T2" autocomplete="off"></label>
    <div class="hint u-mt-n6px">Em branco, o modelo fica com o nome da descrição.</div>`:''}
    ${txTipoSegm(t)}
    ${credit?`<div class="seg c2">${[['owed','users','Recebida','alguém me emprestou'],['repay','down','Paga','devolvo a essa pessoa']].map(([k,i,l,sb])=>`<button type="button" class="opt ${t.kind===k?'on':''}" aria-pressed="${t.kind===k}" data-toca="rascunho" data-click="setKind('${k}')"><span class="ic">${ic(i,18)}</span><b>${l}</b><small>${sb}</small></button>`).join('')}</div>`:''}
    <div class="sect mov-grp">
      <label>Montante (€)${montanteOpc?'':' <span class="req">*</span>'}<div class="mov-montante">
        <span class="mov-montante-campo ${tom.valor}"><input id="t_amount" type="text" inputmode="decimal" class="disp" value="${txMontanteNoCampo(t.amount)}" ${montanteOpc?'placeholder="Opcional"':`placeholder="Ex: ${t.kind==='income'?'900':t.kind==='loan'?'650':t.kind==='settle'?'250':t.kind==='owed'||t.kind==='repay'?'5000':'80'}"`} data-input="txMontanteEscrito(this.value)" autocomplete="off"><span class="disp mov-euro" aria-hidden="true">€</span></span>
        <button type="button" class="btn sm primary${repor?'':' u-d-none'} mov-repor" id="amt_reset" title="Repor a prestação calculada" data-toca="rascunho" data-click="onAmtReset()">Repor</button></div></label>
      ${montanteOpc?'<div class="hint u-mt-n6px">Em branco, escreves o montante quando usares o modelo.</div>':''}
      <label>Descrição <span class="req">*</span><input id="t_label" value="${esc(t.label)}" placeholder="Ex: ${t.kind==='income'?'Renda de agosto':t.kind==='loan'?'Prestação de agosto':t.kind==='owed'?'Empréstimo para obras':t.kind==='repay'?'Devolução de parte do empréstimo':t.kind==='settle'?'Acerto entre proprietários':'Condomínio'}" autocomplete="off"></label>
      ${planeado?imovel:`<div class="mov-par"><label>Data<input id="t_date" type="date" value="${esc(t.date)}" data-change="txDataMudou()"${txMinDaData(t)}></label>${imovel}</div>`}
      ${(!settle&&!t.propertyId&&!t.groupId&&!t.todos&&podeSemImovel())?(pedeImovel&&!t._semImovel
        ?'<div class="hint u-mt-n6px">Uma renda sem imóvel não entra na Declaração: escolhe o imóvel, e o contrato. «Sem imóvel» é para o que não é de nenhum.</div>'
        :'<div class="hint u-mt-n6px">Conta nos totais, mas não na avaliação de nenhum imóvel.</div>'):''}
      ${t.todos&&!t.propertyId?`<div class="hint u-mt-n6px">${esc(dicaDeTodos(t))}</div>`:''}
      ${t.kind==='income'&&acs.length?`<label>Contrato${txPedeContrato(t)?' <span class="req">*</span>':''}${sel('t_ct',t.contractId||(t._semContrato&&txPedeContrato(t)?'__nenhum__':''),txOpcoesDoContrato(t,acs),'onCtChange','rascunho')}</label>`:''}
      ${t.kind==='income'&&(t.contractId||txCatIrsId(t)==='rendas')?txFiscoSect():''}
      ${t.kind==='loan'&&lnOpts.length?`<label>Hipoteca${lns.length?' <span class="req">*</span>':''}${sel('t_loan',t.loanId||'',lnOpts,'onLoanChange','rascunho')}</label>`:''}
      ${t.kind==='loan'?`<div id="loanHint">${loanHint()}</div>`:''}
      ${credit?`<label>${t.kind==='owed'?'De quem recebo':'A quem pago'} (opcional)<input id="t_creditor" value="${esc(t.creditor||'')}" placeholder="Ex: Pai" autocomplete="off" list="creditorList" data-input="refreshCredHint()">
          <datalist id="creditorList">${knownCreditors().map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label>
        <div class="hint" id="credHint">${credHint()}</div>`:''}
      ${settle?(ows.length>1?`<div class="row">
          <label>Quem paga <span class="req">*</span>${sel('t_paid',t.paidBy||'',owOpts,'','rascunho')}</label>
          <label>Quem recebe <span class="req">*</span>${sel('t_to',t.toId||'',owOpts,'','rascunho')}</label></div>
        <div class="hint">Transferência entre proprietários deste imóvel: acerta as contas entre donos e não conta como receita nem despesa.</div>`
        :`<div class="hint">Escolhe um imóvel com pelo menos dois proprietários.</div>`)
      :(ows.length?txPagoPorHtml(t,ows):'')}
    </div>
    ${settle?'':`<div class="sect mov-grp" id="fold_cat">
      <div class="${subs.length||t.category?'row':''}">
        <label>Categoria${sel('t_cat',t.category,[{v:'',label:'— sem categoria —'}].concat(catKeys.map(c=>({v:c,label:c}))).concat([{v:'__new__',label:'+ Criar categoria…'}]),'onCatChange','rascunho')}</label>
        ${subs.length||t.category?`<label>Subcategoria${sel('t_sub',t.sub,[{v:'',label:irsSubDecide(t.kind,t.category)?'— escolhe —':'— indiferente —'}].concat(subs.map(x=>({v:x,label:x}))).concat([{v:'__new__',label:'+ Criar subcategoria…'}]),'onSubChange','rascunho')}</label>`:''}</div>
      ${t.kind==='income'?txDicaDaReceita(t):''}
      ${t.kind==='expense'&&txAnexoFAplica(t)?txColunaHtml(t):''}
      ${t.kind==='expense'&&txParteVisivel(t)?txParteHtml(t):''}
      <div class="mov-etiquetas"><div class="flabel">Etiquetas</div>${tagField((t.tags||[]).map(g=>({id:g,label:g})),'Adicionar','addTxTag()','delTxTag','')}</div>
    </div>`}
    ${(!settle&&(t.groupId||t.todos)&&txProps(t).length>1)?psplitSect():''}
    ${(!settle&&!credit&&ows.length>1)?splitSect(ows):''}
    ${credit&&ows.length>1?`<div class="hint">Dívidas a terceiros não entram nas contas entre proprietários: ficam com quem as recebe ou paga.</div>`:''}
    ${planeado&&servicoLigado('recurring')?recSect():''}
    ${txAnexosSect(t)}
    ${richEditor('Comentários','t_notes',t.notes,'Opcional')}</div>`;
}
/* Os anexos do movimento, num grupo do formulário antes dos Comentários: a
   fatura, o recibo, o comprovativo — imagens e PDF (o accept do input) —,
   pelo bloco de ficheiros da casa (componentes.js:fileBlock), como os do
   contrato. Em todos os tipos e nos divididos (o anexo vai com o movimento
   inteiro: cada parte leva a mesma lista); nos modelos e nos planeados não —
   uma fatura é de um movimento, e não de um molde (dados.js:TX_TPL_KEYS). Só
   a quem pode juntar anexos onde o movimento fica (txPodeJuntarAnexos): sem
   isso o servidor recusava a gravação inteira. A dica por baixo é a do
   txDicaDosAnexos, num span com id, para a coluna do Anexo F a trocar sem
   repintar (onIrsCol).
   Recebe: t — o movimento do formulário (tForm).
   Devolve: o HTML do grupo (texto), ou '' onde não há anexos. */
function txAnexosSect(t){
  if(txModo.modo==='rec'||txModo.modo==='tpl'||!txPodeJuntarAnexos(t))return '';
  const fs=t.files||[];
  return `<div class="sect mov-grp mov-anexos" id="t_anexos">
    <div class="mov-grp-cab"><b>Anexos</b>${fs.length?`<span class="small">${fs.length===1?'1 ficheiro':fs.length+' ficheiros'}</span>`:''}</div>
    ${fileBlock('',fs,'t_filein','txAddFiles','txDelFile',{accept:'image/*,application/pdf',hint:`<span id="t_anexosDica">${esc(txDicaDosAnexos(t))}</span>`})}</div>`;
}
/* Posso juntar anexos a este movimento? Num imóvel, com «Adicionar fotos e
   documentos» nele (o dono e os comproprietários podem sempre); num grupo ou
   em «Todos os imóveis», em cada um dos imóveis por onde se divide — cada
   parte grava-se no seu, e o servidor recusa a de um imóvel onde não posso
   (worker/src/files.js:regraDosAnexos); sem imóvel o movimento é meu.
   Recebe: t — o movimento do formulário.
   Devolve: true/false. */
function txPodeJuntarAnexos(t){
  if(t.propertyId)return pode(t.propertyId,'file.add');
  if(t.groupId||t.todos)return txProps(t).every(p=>pode(p.id,'file.add'));
  return true;
}
/* A dica do bloco dos anexos. Numa despesa que conta no Anexo F (a coluna
   dela não é «Não dedutível», nem a categoria está fora dos totais:
   irs-papeis.js:irsColunaDe), pede a fatura, que é o que as Finanças pedem para ver
   a despesa; no resto, diz o que se junta. Só uma dica: sem avisos «A
   tratar» nem selos na lista (decisão do Martinho, 2026-11-13).
   Recebe: t — o movimento do formulário (com a categoria, a subcategoria e a irsCol).
   Devolve: o texto da dica (por escapar). */
function txDicaDosAnexos(t){
  return t.kind==='expense'&&irsColunaDe(t).col!=='nao'
    ?'Junta a fatura: é o que as Finanças pedem se quiserem ver esta despesa.'
    :'Recibos, faturas ou comprovativos, em imagem ou PDF.';
}
/* Escolheram-se ficheiros no bloco dos anexos: o conteúdo vai para o
   IndexedDB (anexos.js:takeFiles, que a nuvem também sobe) e os metadados
   juntam-se ao tForm.files — como o contrato.js:ctAddFiles. Se, entretanto,
   o formulário deu lugar a outro movimento, não se mexe no novo; a janela só
   se repinta se o formulário estiver à vista (por cima pode estar a escolha
   de uma etiqueta, que o repinta ao fechar).
   Recebe: input — o <input type="file"> do bloco.
   Devolve: a promessa que resolve depois de os juntar (para quem a quiser esperar). */
function txAddFiles(input){
  collectTx();
  const alvo=tForm;
  return takeFiles(input).then(ms=>{
    if(!ms.length||tForm!==alvo)return;
    tForm.files=(tForm.files||[]).concat(ms);
    const b=modalBodyEl();
    if(b&&typeof b.querySelector==='function'&&b.querySelector('.mov-form'))repaintTx();
    toast(ms.length===1?'Anexo adicionado.':ms.length+' anexos adicionados.');
  });
}
/* Remove um anexo do movimento e apaga logo o ficheiro (daqui e do
   servidor), como o contrato.js:ctDelFile — a pergunta do
   componentes.js:delFileConfirm já disse que não há como desfazer. Num
   dividido, sai de todas as partes ao gravar.
   Recebe: fid — o id do anexo.
   Devolve: nada — repinta o formulário. */
function txDelFile(fid){collectTx();tForm.files=(tForm.files||[]).filter(f=>f.id!==fid);idbDel(fid).catch(()=>{});repaintTx()}
/* O tipo do movimento num segmentado, no cimo do formulário (o canvas):
   Receita, Despesa, Crédito, Dívida e Transferência. Mudar de tipo passa pelo
   setKind, como já passava trocar entre dívida recebida e paga; a dívida
   recebida ou paga escolhe-se logo a seguir.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: o HTML do segmentado (texto). */
function txTipoSegm(t){
  const ops=[['income','Receita',''],['expense','Despesa',''],['loan','Crédito','Pagamento de crédito'],['owed','Dívida',''],['settle','Transf.','Transferência entre proprietários']];
  const atual=t.kind==='repay'?'owed':t.kind;
  return `<div class="segm mov-tipo-segm" role="radiogroup" aria-label="Tipo de movimento">${ops.map(([k,l,a])=>{const on=atual===k;
    return `<button type="button" role="radio" aria-checked="${on}"${on?` class="on ${txTomDoTipo(k).valor}"`:''}${a?` aria-label="${a}" title="${a}"`:''} data-toca="rascunho" data-click="txMudaTipo('${k}')">${l}</button>`}).join('')}</div>`;
}
/* Um toque no segmentado do tipo. A «Dívida» já escolhida (recebida ou paga)
   fica como está; o resto passa pelo setKind.
   Recebe: k — o tipo tocado ('income', 'expense', 'loan', 'owed' ou 'settle').
   Devolve: nada — muda o tipo e repinta o formulário (ou nada, se já era esse). */
function txMudaTipo(k){
  if(k===tForm.kind||(k==='owed'&&tForm.kind==='repay'))return;
  setKind(k);
}
/* «Pago por» (ou «Recebido por»): «Todos» e um chip por proprietário, com o
   nome inteiro, numa fila que parte para a linha seguinte quando não cabe
   (estilos.css:.pago-por). Foi um segmentado de botões iguais e os nomes
   saíam cortados («Martinho (e…»); dos quatro desenhos que o Martinho viu,
   escolheu os chips. Servem de um a quantos donos houver, sem trocar de
   componente a partir do terceiro. O valor vive no #t_paid, que o collectTx
   lê como antes.
   Recebe: t — o movimento do formulário; ows — os proprietários à escolha.
   Devolve: o HTML do campo (texto). */
function txPagoPorHtml(t,ows){
  const rot=isIn(t.kind)?'Recebido por':'Pago por';
  const ops=[{v:'',rotulo:'Todos',nome:'Todos os proprietários'}].concat(ows.map(o=>{const n=rotuloDoDono(o,ows.length);return {v:o.id,rotulo:n,nome:n}}));
  return `<div class="mov-campo"><span class="flabel" id="t_paidL">${rot}</span><input type="hidden" id="t_paid" value="${esc(t.paidBy||'')}">
    <div class="chips-fila pago-por" role="radiogroup" aria-labelledby="t_paidL">${ops.map(o=>{const on=(t.paidBy||'')===o.v;
      return `<button type="button" role="radio" aria-checked="${on}" class="chip${on?' on':''}" data-v="${esc(o.v)}" title="${esc(o.nome)}"${o.nome!==o.rotulo?` aria-label="${esc(o.nome)}"`:''} data-toca="rascunho" data-click="txPagoPor('${jsq(o.v)}')">${ic('check',14)}<span>${esc(o.rotulo)}</span></button>`}).join('')}</div></div>`;
}
/* Um toque num chip de quem pagou: escreve no #t_paid e no tForm, acende o
   chip tocado e refaz a dica da divisão, que diz se há quem pagou. Não
   repinta o formulário: o resto não depende disto.
   Recebe: v — o id do proprietário, ou '' para «Todos».
   Devolve: nada — mexe no campo, no tForm e nos chips. */
function txPagoPor(v){
  const h=document.getElementById('t_paid');if(h)h.value=v||'';
  tForm.paidBy=v||null;
  const g=h&&h.parentNode&&h.parentNode.querySelector?h.parentNode.querySelector('.pago-por'):null;
  if(g)[].slice.call(g.querySelectorAll('[role="radio"]')).forEach(b=>{const on=(b.getAttribute('data-v')||'')===(v||'');
    b.setAttribute('aria-checked',on?'true':'false');b.classList.toggle('on',on)});
  refreshSplit();
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
   montante é a renda do recibo menos o retido; a renda bruta é a soma), e — só num contrato
   declarado à AT, porque só aí ela o espera — se o recibo eletrónico já foi
   emitido. Vai logo a seguir ao contrato, porque é dele que depende.
   Numa «Renda em atraso» o mês é obrigatório (D54), com o asterisco; o mês
   sugerido pelo planeado, quando não é o da data, diz de onde veio (e, numa
   renda paga antes do dia, que o mês da data já tinha renda: N146); a data
   é o dia em que a renda entrou, que decide o ano do IRS (N026).
   O «Retido na fonte» só aparece quando conta (txRetencaoAberta, N016 —
   maqueta 2 do D8): só retém quem tem contabilidade organizada, e um valor
   escrito ali por engano (a comissão da gestora) abatia ao imposto. Nos
   outros casos fica a ligação «O inquilino reteve IRS?», sempre à vista (um
   empresário em nome individual retém com um NIF de pessoa), que o abre. Por
   baixo do campo, a conta do que entrou quando o montante ficou na renda do
   contrato (txDicaDaRetencao, D23), num span que se refaz a cada tecla, e
   que no retido só entra o IRS que o inquilino entregou à AT (D116). Numa
   cedência de uso (natureza 02), quem paga e o n.º da cedência
   (txCedenciaHtml, N076). Numa renda paga só em parte (t.parcial), que o
   resto fica em dívida.
   Devolve: string com o HTML da secção. */
function txFiscoSect(){
  const t=tForm,c=t.contractId?contract(t.contractId):null;
  /* um modelo ou uma recorrência repete a retenção, mas o mês e o recibo são
     de cada renda (não estão em TX_TPL_KEYS): mostrá-los aqui era um campo
     que não grava. Ficam para o movimento que se confirma. */
  const fixo=txModo.modo!=='rec'&&txModo.modo!=='tpl',atraso=txPedeMesDaRenda(t);
  const ret=txDicaDaRetencao(t),abre=txRetencaoAberta(t),outra=irsReceitaDe(t).papel==='outra';
  /* o mês sugerido pelo planeado (txSugereMesDaRenda) que não é o da data diz de onde veio */
  const doPlaneado=fixo&&!atraso&&!!t._aP&&t.periodo===t._aP&&t.periodo!==String(t.date||'').slice(0,7);
  const dicaMes=!fixo?'':atraso?'Numa renda em atraso, o mês a que respeita é o que a leva ao ano certo. '
    :(doPlaneado?(t._aPAdiantada?'O mês da data já tem a renda deste contrato: esta fica como a de '+mesPt(t.periodo)+'. Corrige-o se for outra. '
      :'O mês é o da renda mais antiga por confirmar deste contrato: corrige-o se esta renda é de outro. '):'')+'Mês em branco: o da data. ';
  const dicaData=fixo?'A data é o dia em que a renda entrou: é ela que decide o ano do IRS. ':'';
  const dicaRet=abre?'O montante é a renda do recibo menos o retido na fonte. No retido entra só o IRS que '+(outra?'quem te paga':'o inquilino')+' reteve e entregou à AT por ti (vem no recibo).':'';
  return `<div class="${fixo&&abre?'row':''}">
      ${fixo?`<label>Mês a que respeita${atraso?' <span class="req">*</span>':' (opcional)'}<input id="t_periodo" type="month" value="${esc(t.periodo||'')}" placeholder="Ex: 2026-08"></label>`:''}
      ${abre?`<label>Retido na fonte (€)<input id="t_retencao" type="text" inputmode="decimal" value="${t.retencao?dec(t.retencao):''}" placeholder="Opcional" data-input="txRetencaoEscrita()" autocomplete="off"></label>`:''}</div>
    ${dicaMes||dicaData||dicaRet?`<div class="hint u-mt-n6px">${esc(dicaMes+dicaData+dicaRet)}</div>`:''}
    ${abre?`<div class="hint u-mt-n6px" id="t_retDica"${ret?'':' hidden'}><span class="amber">${esc(ret)}</span></div>`
      :`<div><button type="button" class="ct-ligacao" data-toca="rascunho" data-click="txAbrirRetencao()">${outra?'Quem te paga reteve IRS?':'O inquilino reteve IRS?'}</button></div>`}
    ${txCedenciaHtml(t)}
    ${fixo&&t.parcial?`<div class="hint u-mt-n6px">Pagamento parcial: o resto da renda fica em dívida${c&&servicoLigado('recurring')&&ctRecOf(c)?', e o planeado continua a pedi-lo':''}.</div>`:''}
    ${fixo&&txPedeRecibo(t)?txReciboLinha(!!t.recibo):''}`;
}
/* Esta receita pede o recibo de renda eletrónico (CIRS art. 115.º n.º 5 a))?
   A renda, a caução e o reembolso do inquilino (os papéis do irs-papeis.js:
   irsReceitaDe que o resumo conta nos recibos por emitir) num contrato que o
   pede (prazos.js:pzPedeRecibo: declarado, não na categoria B nem num
   arrendamento rural, num imóvel em Portugal); e a cedência de uso que não é
   arrendamento (natureza 02, N077), que pede recibo também, com as mesmas
   exceções — o contrato a que esteja ligada não tem de estar declarado, e sem
   contrato basta o imóvel ser em Portugal. A indemnização não pede recibo.
   Recebe: t — o movimento (do formulário ou da base).
   Devolve: true ou false. */
function txPedeRecibo(t){
  if(!t||t.kind!=='income')return false;
  const papel=irsReceitaDe(t).papel,c=t.contractId?contract(t.contractId):null;
  if(papel==='renda'||papel==='caucao')return !!c&&pzPedeRecibo(c);
  if(papel!=='outra')return false;
  const pid=(c&&c.propertyId)||t.propertyId;
  return !!pid&&!pzForaDePortugal(pid)&&!(c&&(pzCategoriaB(c)||pzArrendamentoRural(c)));
}
/* O «Retido na fonte» está à vista (N016, maqueta 2 do D8)? Quando o movimento
   já tem retenção (um campo com valor nunca fica escondido), quando a pessoa
   tocou em «O inquilino reteve IRS?» (t._retAberta), quando um inquilino do
   contrato retém ou tem NIF de pessoa coletiva (txInquilinoRetem), quando o
   contrato é não habitacional (o inquilino é quase sempre uma empresa —
   irs.js:irsFinalidade), quando o planeado da renda já tem retenção (o que se
   confirma, o que se edita, ou o do contrato) e, numa cedência de uso, quando
   quem paga tem NIF de pessoa coletiva.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: true ou false. */
function txRetencaoAberta(t){
  if(!t||Number(t.retencao)>0||t._retAberta)return true;
  const c=t.contractId?contract(t.contractId):null;
  if(nifColetivo(t.pagadorNif))return true;
  if(!c)return false;
  if(txInquilinoRetem(c)||irsFinalidade(c)==='nh')return true;
  const m=txModo,rid=(m.modo==='confirmar'||m.modo==='rec')&&m.recId?m.recId:null;
  const r=rid?(db.recurring||[]).find(x=>x.id===rid):(servicoLigado('recurring')?ctRecOf(c):null);
  return !!(r&&r.tx&&Number(r.tx.retencao)>0);
}
/* A ligação «O inquilino reteve IRS?»: abre o «Retido na fonte» (t._retAberta)
   e repinta, com o que já está escrito.
   Devolve: nada — repinta o formulário. */
function txAbrirRetencao(){
  collectTx();tForm._retAberta=true;repaintTx();
  const e=document.getElementById('t_retencao');if(e)try{e.focus()}catch(x){}
}
/* Quem paga uma cedência de uso que não é arrendamento (natureza 02: a
   publicidade, a antena, as partes comuns — N076, D12): o NIF dele e o n.º do
   contrato dessa cedência, ambos opcionais, que a linha 02 da Declaração usa
   no lugar do inquilino e do contrato de arrendamento. Só numa receita das
   Outras receitas prediais (pelo id), ou numa que já os tem — um campo com
   valor nunca fica escondido.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: o HTML (texto), ou ''. */
function txCedenciaHtml(t){
  if(!t||t.kind!=='income')return '';
  const tem=String(t.pagadorNif||'')||String(t.cedenciaNumero||'');
  if(irsReceitaDe(t).papel!=='outra'&&!tem)return '';
  return `<div class="row">
      <label>NIF de quem paga<input id="t_pagadorNif" type="text" inputmode="numeric" maxlength="11" value="${esc(t.pagadorNif||'')}" placeholder="Opcional" autocomplete="off"></label>
      <label>N.º da cedência<input id="t_cedenciaNumero" type="text" maxlength="40" value="${esc(t.cedenciaNumero||'')}" placeholder="Opcional" autocomplete="off"></label></div>
    <div class="hint u-mt-n6px">Quem te paga esta cedência (o operador, a agência, o condomínio) e o n.º do contrato dela, se o tiver: vão à linha da Declaração no lugar do inquilino e do contrato de arrendamento.</div>`;
}
/* A conta da retenção, por baixo do campo (D23): o montante é o que entrou,
   e a renda ilíquida é o montante mais o retido. Quem escreve a retenção e
   deixa o montante na renda do contrato declara a renda mais o retido — com
   250 € retidos numa renda de 1 000 €, o montante é 750 €. E um retido maior
   do que o que entrou não é uma retenção de 25 % nem de 10 %.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: o texto do aviso (por escapar), ou '' quando não há nada a dizer. */
function txDicaDaRetencao(t){
  const ret=Number(t.retencao)||0,amt=Number(t.amount)||0;
  if(!(ret>0)||!(amt>0))return '';
  const c=t.contractId?contract(t.contractId):null,renda=c?Number(c.rent)||0:0;
  if(renda>0&&Math.abs(amt-renda)<0.005&&ret<renda)return 'O montante é o que entrou: com '+euro2(ret)+' retidos, entraram '+euro2(r2(renda-ret))+'.';
  if(ret>amt+0.005)return 'O retido ('+euro2(ret)+') passa o que entrou ('+euro2(amt)+'): confirma no recibo.';
  return '';
}
/* Escreveu-se no campo do retido: guarda-o no tForm e refaz a conta de baixo
   (txDicaDaRetencao), sem repintar o formulário.
   Devolve: nada — mexe no tForm e no #t_retDica. */
function txRetencaoEscrita(){
  tForm.retencao=Math.max(0,num(val('t_retencao'))||0);
  txRefazDicaDaRetencao();
}
/* Refaz o aviso da retenção no ecrã, pelo que está no tForm: o montante e o
   retido mudam-no, cada um no seu campo.
   Devolve: nada — escreve no #t_retDica (e esconde-o vazio). */
function txRefazDicaDaRetencao(){
  const e=document.getElementById('t_retDica');if(!e)return;
  const s=txDicaDaRetencao(tForm);
  e.innerHTML=s?'<span class="amber">'+esc(s)+'</span>':'';e.hidden=!s;
}
/* O recibo eletrónico da renda, no formulário: a linha de interruptor da
   casa (a do formulário do contrato, contrato.js:ctInterruptor), num cartão
   com borda que se toca inteiro. Era uma caixa de marcar pequena, perdida
   entre as dicas (KAN-134). Ligado, a borda passa a cobalto: a cor da frente
   é o que resiste ao escuro forçado do Samsung. O collectTx lê-a como sempre
   (chk('t_recibo')).
   Recebe: on — se o recibo já foi emitido.
   Devolve: o HTML da linha. */
function txReciboLinha(on){
  return `<label class="ct-sw-linha mov-recibo"><span class="ct-sw-txt"><b>Recibo eletrónico emitido</b><span class="small">Emite-se no Portal das Finanças quando a renda entra; ligado, o aviso cala-se.</span></span><input type="checkbox" role="switch" class="ct-sw" id="t_recibo"${on?' checked':''}></label>`;
}
/* A coluna do Anexo F de uma despesa, no formulário (N064, maqueta 3 do D8),
   só onde ela conta (txAnexoFAplica). Onde a categoria (ou a subcategoria)
   decide, uma linha de leitura — «Conta no Anexo F como Condomínio (pela
   categoria)» — com «Mudar», que abre o seletor (txMudarColuna). O seletor
   está aberto quando é preciso escolher: a categoria deixa a despesa «a
   confirmar» ou não tem regra (não conta até a pessoa escolher, D61, D07), ou
   o movimento já tem a coluna escolhida à mão; a primeira opção diz o que a
   categoria dá («Pela categoria: …»). A opção das obras dos 24 meses só num
   dia sem contrato em vigor no imóvel (CIRS art. 41.º n.º 7), ou já
   escolhida. O AIMI não tem coluna: a lei tira-o dos gastos e ele vai ao
   quadro do AIMI (irs-papeis.js:irsColunaDe, origem 'lei'; D66); uma
   categoria «Fora dos totais» não conta (D19), e a linha di-lo em vez de
   «Não dedutível», que parecia a lei a recusá-la (N042). Uma despesa com a
   coluna escrita «a confirmar» (a subcategoria que a dava foi apagada, N043)
   tem essa opção no seletor: sem ela, abrir e gravar o formulário apagava-a.
   A dica por baixo é a do txDicaDaColunaHtml, num div com id que se refaz
   sem repintar.
   Recebe: t — o movimento do formulário (tForm), uma despesa.
   Devolve: o HTML (texto). */
function txColunaHtml(t){
  const pela=irsColunaDe(Object.assign({},t,{irsCol:''}));
  if(pela.origem==='lei')return `<div class="mov-campo"><span class="flabel">Anexo F</span><div class="hint">${esc(txFraseDoAimi(t))}</div></div>`;
  const dica=`<div class="hint u-mt-n6px" id="t_irsDica">${txDicaDaColunaHtml(t)}</div>`;
  if(pela.origem==='excluido')return `<div class="mov-campo mov-anexof"><span class="flabel">Anexo F</span><p class="mov-anexof-linha u-m-0">${esc('Fora dos totais: não conta no Anexo F.')}</p>${dica}</div>`;
  if(!txColunaAberta(t)){
    const de=pela.origem==='sub'?'pela subcategoria':'pela categoria';
    const diz=pela.col==='nao'?'<b>Não dedutível</b>: não conta no Anexo F ('+esc(de)+')':'Conta no Anexo F como <b>'+esc(irsColunaNome(pela.col))+'</b> ('+esc(de)+')';
    return `<div class="mov-campo mov-anexof"><span class="flabel">Anexo F</span>
      <p class="mov-anexof-linha u-d-flex u-ai-center u-fxw-wrap u-g-8px u-m-0"><span>${diz}</span><button type="button" class="ct-ligacao" data-toca="rascunho" data-click="txMudarColuna()">Mudar</button></p>${dica}</div>`;
  }
  const primeira=pela.col==='confirmar'?'Pela categoria: a confirmar — escolhe a coluna':'Pela categoria: '+irsColunaNome(pela.col);
  const escrita=t.irsCol==='confirmar'?[{v:'confirmar',label:'A confirmar — escolhe a coluna'}]:[];
  /* as obras dos 24 meses são de antes de um arrendamento: num dia com contrato em vigor não se oferecem */
  const d=String(t.date||''),comContrato=t.irsCol!=='obras24'&&!!t.propertyId&&servicoLigado('fisco')&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&fiscoHaviaContrato(t.propertyId,d);
  const cols=IRS_COLUNAS.filter(x=>!(comContrato&&x[0]==='obras24'));
  return `<label>Coluna no Anexo F${sel('t_irscol',t.irsCol||'',[{v:'',label:primeira}].concat(escrita,cols.map(x=>({v:x[0],label:x[1]}))),'onIrsCol','rascunho')}</label>
      ${dica}`;
}
/* O seletor da coluna do Anexo F está aberto (N064)? Quando é preciso
   escolher — a regra da categoria é «a confirmar», ou não há regra — ou a
   despesa já tem a coluna escolhida à mão (um campo com valor nunca fica
   escondido), ou a pessoa tocou em «Mudar» (t._colAberta).
   Recebe: t — o movimento do formulário (tForm), uma despesa.
   Devolve: true ou false. */
function txColunaAberta(t){
  return !!t.irsCol||!!t._colAberta||irsColunaDe(Object.assign({},t,{irsCol:''})).col==='confirmar';
}
/* O «Mudar» da linha da coluna do Anexo F: abre o seletor e repinta, com o
   que já está escrito.
   Devolve: nada — repinta o formulário. */
function txMudarColuna(){collectTx();tForm._colAberta=true;repaintTx()}
/* A frase do AIMI no formulário e na ficha: não é um gasto do Anexo F e vai
   ao quadro dele, com o n.º do quadro da versão do ano da despesa
   (irs.js:irsAno, quadros.aimi).
   Recebe: t — o movimento (a data dá o ano).
   Devolve: o texto (por escapar). */
function txFraseDoAimi(t){
  const q=((irsAno(anoIrs(String((t&&t.date)||'').slice(0,4)))||{}).quadros||{}).aimi;
  return 'O AIMI não entra nos gastos do Anexo F: vai ao '+(q?'quadro '+q:'quadro do AIMI')+'.';
}
/* A dica por baixo da coluna do Anexo F. Com o seletor aberto, a regra geral
   do art. 41.º. Numa despesa que a categoria deixa a confirmar, que não conta
   até se escolher — e, quando é a subcategoria que decide (irs-papeis.js:
   irsSubDecide: nos Impostos, nos Seguros), que é ela que se escolhe (N133);
   a nota da regra (dados.js:IRS_MAPA_NOTAS) nas que a têm, também nas que
   decidem (o fundo de reserva do condomínio). E, a âmbar, o que a Declaração
   faz à despesa quando não é só a coluna (txFraseDoDestino): paga sem
   contrato em vigor, conta por a coluna ter sido escolhida (D65) ou não
   conta; ou vai às obras dos 24 meses de um contrato, por confirmar (N112).
   Recebe: t — o movimento do formulário (tForm), uma despesa.
   Devolve: o HTML da dica (texto). */
function txDicaDaColunaHtml(t){
  const out=[],pela=irsColunaDe(Object.assign({},t,{irsCol:''}));
  const cat=String(t.category||'').trim(),sub=String(t.sub||'').trim();
  const nota=(sub&&IRS_MAPA_NOTAS[cat+' / '+sub])||IRS_MAPA_NOTAS[cat]||'';
  if(txColunaAberta(t))out.push(esc('Só o que pagaste para obter a renda entra. Juros, mobiliário, eletrodomésticos e obras que acrescentam valor ficam de fora.'));
  if(!t.irsCol&&pela.col==='confirmar'){
    if(!sub&&irsSubDecide('expense',cat))out.push(esc('A subcategoria decide a coluna do Anexo F: escolhe-a, ou escolhe a coluna. Até lá, não conta na Declaração.'));
    else out.push(esc((nota?nota+' ':'')+'Até escolheres a coluna (ou «Não dedutível»), não conta na Declaração.'));
  }else if(!t.irsCol&&nota&&pela.origem!=='excluido')out.push(esc(nota));
  const fora=txFraseDoDestino(t);
  if(fora)out.push('<span class="amber">'+esc(fora)+'</span>');
  return out.join(' ');
}
/* O que a Declaração faz a uma despesa do formulário, quando não é só a
   coluna (N112, N113): pela função única do resumo (txDestinoDaDespesa) — as
   obras dos 24 meses de um contrato (contam no ano do início dele, com a
   resposta «o imóvel esteve só à espera de inquilino»), a coluna escolhida
   que a faz contar sem contrato em vigor (D65), ou a falta de contrato que a
   deixa de fora. Sem a função (a Declaração desligada, ou uma versão sem
   ela), as mesmas contas daqui: fisco-resumo.js:fiscoObra24De e
   txContaForaDoContrato.
   Recebe: t — o movimento do formulário (tForm), uma despesa.
   Devolve: a frase (por escapar), ou ''. */
function txFraseDoDestino(t){
  const D65='Esta despesa é de uma altura sem contrato: com a coluna escolhida, conta na Declaração.';
  const obras=c=>'Vai às obras antes do arrendamento'+(c?' do contrato '+ctName(c)+(c.start?', na Declaração de '+String(c.start).slice(0,4):''):'')+': conta se responderes, no contrato, que o imóvel esteve só à espera de inquilino.';
  if(!t||t.kind!=='expense'||!servicoLigado('fisco'))return '';
  const x=txDestinoDaDespesa(t,txMemoDaBase());
  if(x){
    if(x.motivo==='obras24')return obras(x.contrato&&x.contrato.id?contract(x.contrato.id):null);
    if(x.motivo==='porEscolha')return D65;
    if(x.motivo==='semContrato')return 'Esta despesa é de uma altura sem contrato: não conta na Declaração.';
    return '';
  }
  const o=fiscoObra24De(t,irsColunaDe(t).col),k=Object.keys(o);
  if(k.length)return obras((o[k[0]]||[])[0]||null);
  return txContaForaDoContrato(t)?D65:'';
}
/* A coluna escolhida à mão faz contar uma despesa paga sem contrato em vigor
   no imóvel (decisão de 2026-10-08: a escolha do movimento manda sobre a regra
   do período arrendado), e o seletor não o dizia (D65). É assim quando: a
   coluna é escolhida neste movimento e é de uma das que só contam no período
   arrendado (não o IMI nem o selo, fisco-resumo.js:FISCO_SEM_PERIODO; nem as
   obras dos 24 meses, nem «Não dedutível»), a despesa é de um imóvel, nenhum
   contrato dele estava em vigor na data (fisco-resumo.js:fiscoHaviaContrato,
   o mesmo que a Declaração usa) e algum viveu nesse ano — sem nenhum, o
   imóvel não tem linha na Declaração desse ano e a despesa não conta. Uma
   obra dos 24 meses de um contrato (fisco-resumo.js:fiscoObra24De) não conta
   por ter a coluna: vai às obras dele, por confirmar (N112). Sem a
   Declaração ligada nesta conta não há o que dizer (nem o código dela).
   Recebe: t — o movimento do formulário (tForm).
   Devolve: true ou false. */
function txContaForaDoContrato(t){
  if(!t||t.kind!=='expense'||!t.irsCol||['nao','obras24'].indexOf(t.irsCol)>-1||!t.propertyId)return false;
  if(!servicoLigado('fisco')||FISCO_SEM_PERIODO[t.irsCol])return false;
  const d=String(t.date||'');
  if(!servicoLigado('contracts')||!/^\d{4}-\d{2}-\d{2}$/.test(d)||irsColunaDe(t).origem!=='movimento')return false;
  const Y=d.slice(0,4),fim=c=>String(irsFimReal(c)||'');
  const doAno=(db.contracts||[]).some(c=>c.propertyId===t.propertyId&&c.start&&c.start.slice(0,4)<=Y&&(!fim(c)||fim(c).slice(0,4)>=Y));
  if(!doAno||Object.keys(fiscoObra24De(t,t.irsCol)).length)return false;
  return !fiscoHaviaContrato(t.propertyId,d);
}
/* A pergunta da parte (N041, D9 c), numa despesa de um imóvel com mais de um
   dono (txParteVisivel): «É o total da casa» — a Declaração conta a
   quota de cada dono — ou «É só a minha parte» — conta inteira para quem a
   pagou, sem a cortar outra vez pela quota (t.notaPropria, D32). Quem tem
   donos fora da app regista naturalmente o que pagou, e a Declaração cortava-o
   em silêncio. No IMI as escolhas dizem a nota: na compropriedade cada dono
   recebe a sua, já pela quota; no bem comum do casal é uma só, do prédio — e
   numa despesa nova a resposta é obrigatória (txPartePorResponder), sem
   nenhuma escolhida. Nas outras despesas a omissão é «o total da casa», à
   vista. Dois botões que se tocam (txParte) e um campo escondido com a
   resposta ('1', '0', ou '' por responder), que o collectTx lê.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: o HTML (texto). */
function txParteHtml(t){
  const imi=txCatIrsId(t,true)==='impostos/imi',porResponder=txPartePorResponder(t),minha=t.notaPropria===true;
  const p=prop(t.propertyId),d=/^\d{4}-\d{2}-\d{2}$/.test(String(t.date||''))?t.date:today();
  const q=p?Number(quotasFiscais(p,d)[t.paidBy||meuId()])||0:0,pct=q>0&&q<1?' (a tua é '+dec(Math.round(q*1000)/10)+' %)':'';
  const ops=imi?[[0,'É o IMI do prédio todo','repartido pela quota de cada dono'+pct],[1,'É a minha nota de IMI','a que as Finanças te mandaram, já pela tua quota: conta inteira para quem a pagou']]
    :[[0,'É o total da casa','a Declaração conta a quota de cada dono'+pct],[1,'É só a minha parte','conta inteira para quem a pagou, sem a cortar pela quota']];
  const v=porResponder?'':minha?'1':'0';
  return `<div class="mov-campo"><span class="flabel" id="t_parteL">${imi?'Esta nota de IMI':'Este valor'}${imi&&!t._edit?' <span class="req">*</span>':''}</span><input type="hidden" id="t_notaPropria" value="${v}">
    <div class="seg c2" id="t_parte" role="radiogroup" aria-labelledby="t_parteL">${ops.map(([k,l,sb])=>{const on=v===String(k);
      return `<button type="button" class="opt${on?' on':''}" role="radio" aria-checked="${on}" data-toca="rascunho" data-click="txParte(${k})"><b>${esc(l)}</b><small>${esc(sb)}</small></button>`}).join('')}</div></div>`;
}
/* Um toque na pergunta da parte (txParteHtml): grava a resposta no tForm e
   repinta (as dicas da divisão dependem dela).
   Recebe: k — 1 (só a minha parte, ou a minha nota de IMI) ou 0 (o total da casa).
   Devolve: nada — repinta o formulário. */
function txParte(k){collectTx();tForm.notaPropria=k===1;tForm._parteRespondida=true;repaintTx()}
/* A pergunta da parte faz sentido neste movimento (N041)? Uma despesa de um
   imóvel com mais de um dono na data — os donos com conta e os de fora da app
   (saldos.js:quotasFiscais, quotasForaNaData). Num grupo, em «Todos os
   imóveis» ou sem imóvel não há parte de ninguém. Era só o IMI (D32).
   Recebe: t — o movimento do formulário (tForm).
   Devolve: true ou false. */
function txNotaPropriaAplica(t){
  if(!t||t.kind!=='expense'||!t.propertyId||t.groupId||t.todos)return false;
  const p=prop(t.propertyId);if(!p)return false;
  const d=/^\d{4}-\d{2}-\d{2}$/.test(String(t.date||''))?t.date:today();
  const q=quotasFiscais(p,d);
  const n=Object.keys(q).filter(o=>Number(q[o])>0).length;
  const fora=quotasForaNaData(p,d).length;
  return n+fora>1;
}
/* A pergunta da parte está à vista? Onde faz sentido (txNotaPropriaAplica) e
   onde a coluna do Anexo F conta (txAnexoFAplica: um imóvel arrendado nessa
   altura, com a Declaração ligada), menos no AIMI, que não é gasto; e sempre
   que a despesa já diz «só a minha parte» — uma resposta nunca fica escondida.
   Recebe: t — o movimento do formulário (tForm).
   Devolve: true ou false. */
function txParteVisivel(t){
  if(!txNotaPropriaAplica(t))return false;
  if(t.notaPropria===true)return true;
  return txAnexoFAplica(t)&&irsColunaDe(Object.assign({},t,{irsCol:''})).origem!=='lei';
}
/* Mudou a coluna do Anexo F escolhida à mão: guarda-a no tForm. Vazio é
   «pela categoria», e o seletor já mostra o rótulo novo — não há que
   repintar. Mudam com ela a dica dos anexos (txDicaDosAnexos: a fatura deixa
   de se pedir numa despesa «Não dedutível», e volta a pedir-se ao contrário)
   e a da coluna (txDicaDaColunaHtml: o «a confirmar» e a despesa sem
   contrato que passa a contar).
   Devolve: nada — atualiza tForm.irsCol e o texto das dicas. */
function onIrsCol(){
  collectTx();tForm.irsCol=val('t_irscol')||'';
  const d=document.getElementById('t_anexosDica');if(d)d.textContent=txDicaDosAnexos(tForm);
  txRefazDicaDaColuna();
}
/* Refaz a dica da coluna do Anexo F no ecrã, pelo tForm (a coluna e a data mudam-na).
   Devolve: nada — escreve no #t_irsDica. */
function txRefazDicaDaColuna(){
  const e=document.getElementById('t_irsDica');if(e&&tForm.kind==='expense')e.innerHTML=txDicaDaColunaHtml(tForm);
}
/* O exemplo de uma parte da divisão (entre proprietários ou entre imóveis),
   pelo modo: em branco a parte conta 0, e o exemplo mostra o que se escreve
   ali — partes, percentagem ou euros.
   Recebe: mode — o modo da divisão ('pct', 'percent', 'amount' ou 'adjust').
   Devolve: o exemplo (texto), sem o «Ex: », que é o placeholder que o põe. */
function exemploDaParte(mode){return mode==='pct'?'1':mode==='percent'?'50':mode==='adjust'?'5':'100'}
/* A divisão entre proprietários, num grupo do formulário (o canvas): o
   título com quantos donos são, «Como se divide» (quotas, partes iguais,
   percentagem, valor certo, ajuste) e, nos modos que o pedem, um campo por
   dono; por baixo, as partes e se a soma bate certo (splitHint) e, numa
   receita ou despesa com divisão própria, que o IRS segue a quota (TX_IRS_QUOTA, D95).
   Recebe: ows — os proprietários a listar (objetos com id e name, já resolvidos).
   Devolve: o HTML do grupo (string). */
function splitSect(ows){
  const t=tForm,sp=t.split||{mode:'quota',parts:{}},mode=sp.mode||'quota',parts=sp.parts||{};
  return `<div class="sect mov-grp mov-divisao" id="fold_split">
    <div class="mov-grp-cab"><b>Divisão entre proprietários</b><span class="small">${ows.length} donos</span></div>
    <label class="mov-rot-fraco">Como se divide${sel('t_split',mode,SPLIT_MODES.map(m=>({v:m[0],label:m[1]})),'onSplitSel','rascunho')}</label>
    ${(mode==='quota'||mode==='equal')?'':`<div class="form u-g-7px">${ows.map(o=>`<div class="ownrow"><span class="avatar u-w-30px u-h-30px u-fs-11px u-fx-0-0-30px">${esc(initials(o.name))}</span>
      <span class="nm">${esc(rotuloDoDono(o,ows.length))}</span>
      <input id="t_sp_${o.id}" type="text" inputmode="decimal" class="u-w-84px u-fx-0-0-84px" value="${parts[o.id]!=null&&parts[o.id]!==''?dec(parts[o.id]):''}" placeholder="Ex: ${exemploDaParte(mode)}" aria-label="Parte de ${esc(o.name)}" data-input="refreshSplit()" autocomplete="off">
      <span class="pc">${mode==='pct'?'partes':mode==='percent'?'%':'€'}</span></div>`).join('')}</div>`}
    <div id="splitHint" class="mov-divisao-dica" aria-live="polite">${splitHint(ows)}</div>
    ${mode!=='quota'&&(t.kind==='income'||t.kind==='expense')&&t.notaPropria!==true?`<div class="hint">${esc(TX_IRS_QUOTA)}</div>`:''}</div>`;
}
/* As partes de uma divisão, como o canvas as mostra: cada uma com o nome, a
   percentagem do total e o valor; a barra das proporções; e, por baixo, «Soma
   X — bate certo», ou o aviso do que não bate.
   Recebe: linhas — [{nome, cents}] (o nome por escapar, os cêntimos de cada
   parte); total — o total em cêntimos; aviso — o texto do que não bate certo
   (por escapar), ou '' quando bate.
   Devolve: o HTML (string). */
function partesDaDivisaoHtml(linhas,total,aviso){
  const soma=sum(linhas.map(l=>l.cents||0));
  const pct=l=>total?Math.round((l.cents||0)/total*1000)/10:0;
  /* .mov-pfila, e não .mov-parte: essa é a frase da parte na linha da lista
     (lista-movimentos.js:txLinhaHtml), e a regra desta fila (flex, 14,5px)
     caía-lhe em cima e cortava-a sem reticências */
  const linha=l=>`<div class="mov-pfila"><span class="mov-pnome">${esc(l.nome)}</span><span class="small">${dec(pct(l))}%</span><b>${euro2((l.cents||0)/100)}</b></div>`;
  const barra=`<div class="mov-pbarra" aria-hidden="true">${linhas.map(l=>`<span data-largura="${Math.max(0,Math.min(100,pct(l))).toFixed(1)}"></span>`).join('')}</div>`;
  /* com duas partes a barra fica entre elas, como no canvas; com mais, por baixo */
  const corpo=linhas.length===2?linha(linhas[0])+barra+linha(linhas[1]):linhas.map(linha).join('')+barra;
  return `<div class="mov-partes">${corpo}</div>`+
    (aviso?`<p class="mov-soma perigo">${ic('aviso',16)}<span>${esc(aviso)}</span></p>`:`<p class="mov-soma">${ic('check',16)}<span>Soma ${euro2(soma/100)} — bate certo.</span></p>`);
}
/* A descrição de um modo de divisão como frase: com maiúscula e ponto final
   («Pela quota-parte de cada um.»). As descrições dos modos (SPLIT_MODES,
   dados.js:PSPLIT_MODES) são fragmentos em minúscula, e abriam a dica assim.
   Recebe: modos — a lista dos modos ([valor, rótulo, descrição]); mode — o
   valor do modo escolhido.
   Devolve: a frase (texto, por escapar; '' se o modo não tiver descrição). */
function txFraseDoModo(modos,mode){
  const s=String((modos.find(m=>m[0]===mode)||[])[2]||'');
  return s?s.charAt(0).toUpperCase()+s.slice(1)+'.':'';
}
/* Dica por baixo da divisão entre proprietários: explica o modo escolhido e,
   com o montante escrito, mostra quanto calha a cada um (pelo primeiro nome)
   e se a soma bate certo — ou o que falta, o que passa, as percentagens fora
   dos 100. ows: os proprietários do imóvel, já resolvidos.
   Recebe: ows — os proprietários do imóvel (objetos com id e name).
   Devolve: o HTML da dica (string; '' sem imóvel escolhido). */
function splitHint(ows){
  const t=tForm,p=prop(t.propertyId);if(!p)return '';
  const mode=(t.split||{}).mode||'quota',total=Math.abs(Number(t.amount)||0);
  /* o modo primeiro, numa frase sua (as descrições do SPLIT_MODES são
     fragmentos em minúscula), e depois a condição: juntas davam «… recebeu.
     pela quota-parte de cada um.» */
  const intro=`<div class="hint">${txFraseDoModo(SPLIT_MODES,mode)+(t.paidBy?'':' Só entra nas contas entre proprietários se indicares quem pagou ou recebeu.')}</div>`;
  if(!total)return intro;
  const os=ows.map(o=>o.id),c=txSplitCents(t,p,os),pr=(t.split||{}).parts||{};
  const s2=sum(os.map(o=>Number(pr[o])||0));
  let aviso='';
  if(mode==='amount'){const d=Math.round((total-s2)*100)/100;
    if(Math.abs(d)>0.005)aviso=d>0?'Faltam '+euro2(d)+': os valores têm de somar '+euro2(total)+'.':'Passam '+euro2(-d)+' do total ('+euro2(total)+').'}
  if(mode==='percent'&&Math.abs(s2-100)>0.01)aviso='As percentagens somam '+dec(Math.round(s2*100)/100)+'%: têm de somar 100.';
  if(mode==='adjust'){
    if(os.some(o=>Number(pr[o])<0))aviso='Ajustes negativos não contam: um ajuste é sempre um extra.';
    else if(s2>total+0.005)aviso='Os ajustes ('+euro2(s2)+') passam o total.'}
  return intro+partesDaDivisaoHtml(ows.map((o,i)=>({nome:String(o.name||'').split(' ')[0],cents:c[i]})),Math.round(total*100),aviso);
}
// Valida a divisão entre proprietários antes de guardar: devolve a mensagem de erro,
// ou '' se está tudo certo (quotas e partes iguais nunca falham). Num modelo sem
// montante não há total com que comparar os valores e os ajustes: essa soma confere-se
// no movimento que nascer dele; as percentagens e as quotas conferem-se já.
// Devolve: a mensagem de erro (string) ou '' se está tudo válido.
function splitError(){
  const t=tForm,p=prop(t.propertyId),mode=(t.split||{}).mode;
  if(!p||!mode||mode==='quota'||mode==='equal')return '';
  const os=ownersOfProp(p),parts=(t.split||{}).parts||{},total=Math.abs(Number(t.amount)||0);
  const s2=sum(os.map(o=>Number(parts[o])||0)),semTotal=!total&&txMontanteOpcional();
  if(mode==='amount'&&!semTotal&&Math.abs(s2-total)>0.005)return 'Os valores da divisão têm de somar '+euro2(total)+'.';
  if(mode==='adjust'){
    if(os.some(o=>Number(parts[o])<0))return 'Os ajustes não podem ser negativos: um ajuste é sempre um extra.';
    if(!semTotal&&s2>total+0.005)return 'Os ajustes somam '+euro2(s2)+' e não podem passar o total ('+euro2(total)+').';
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
  const os=p?ownersOfProp(p):((t.groupId||t.todos)?txGroupOwners(t).map(o=>o.id):db.owners.map(o=>o.id));
  /* percentagens e partes leem-se pelo numTaxa («0,125» é 0,125, não 125); os
     valores certos e os ajustes são euros, e aí «1.500» são mil e quinhentos */
  const lerParte=(m2==='amount'||m2==='adjust')?num:numTaxa;
  os.forEach(o=>{const e=document.getElementById('t_sp_'+o);if(e&&String(e.value).trim()!=='')parts[o]=lerParte(e.value)});
  t.split={mode,parts};
}
/* a divisão do valor pelos imóveis (de um grupo, ou de «Todos os imóveis»): os
   modos (PSPLIT_MODES) vivem no dados.js, porque o normTx só aceita um deles */
/* A divisão entre imóveis (de um grupo, ou de «Todos os imóveis»), num grupo
   do formulário como a dos donos: o título com quantos imóveis são, «Como se
   divide» e, nos modos que o pedem, um campo por imóvel; por baixo, as partes
   e se a soma bate certo (psplitHint). Entre frações do mesmo prédio, a frase
   da permilagem (saldos.js:psplitFrasePermilagem, N114): os encargos comuns
   repartem-se por ela.
   Devolve: o HTML do grupo (string). */
function psplitSect(){
  const t=tForm,ps=txProps(t),sp=t.psplit||{mode:'equal',parts:{}},mode=sp.mode||'equal',parts=sp.parts||{};
  const perm=psplitFrasePermilagem(ps);
  return `<div class="sect mov-grp mov-divisao" id="fold_psplit">
    <div class="mov-grp-cab"><b>Divisão entre imóveis</b><span class="small">${ps.length} imóveis</span></div>
    <label class="mov-rot-fraco">Como se divide${sel('t_psplit',mode,PSPLIT_MODES.map(m=>({v:m[0],label:m[1]})),'onPsplitSel','rascunho')}</label>
    ${perm?`<div class="hint u-mt-n6px">${esc(perm)}</div>`:''}
    ${['equal','value','purchase'].indexOf(mode)>-1?'':`<div class="form u-g-7px">${ps.map(p=>`<div class="ownrow"><span class="avatar u-w-30px u-h-30px u-fs-11px u-fx-0-0-30px">${ic('building',15)}</span>
      <span class="nm">${esc(p.name)}</span>
      <input id="t_pp_${p.id}" type="text" inputmode="decimal" class="u-w-84px u-fx-0-0-84px" value="${parts[p.id]!=null&&parts[p.id]!==''?dec(parts[p.id]):''}" placeholder="Ex: ${exemploDaParte(mode)}" aria-label="Parte de ${esc(p.name)}" data-input="refreshPsplit()" autocomplete="off">
      <span class="pc">${mode==='pct'?'partes':mode==='percent'?'%':'€'}</span></div>`).join('')}</div>`}
    <div id="psplitHint" class="mov-divisao-dica" aria-live="polite">${psplitHint()}</div></div>`;
}
// Dica da divisão entre imóveis: explica o modo e, com o montante escrito, mostra
// quanto fica para cada imóvel e se a soma bate certo (ou o que não bate).
// Devolve: o HTML da dica (string; '' com menos de dois imóveis).
function psplitHint(){
  const t=tForm,ps=txProps(t);if(ps.length<2)return '';
  const mode=(t.psplit||{}).mode||'equal',total=Math.abs(Number(t.amount)||0);
  const intro=`<div class="hint">${txFraseDoModo(PSPLIT_MODES,mode)}</div>`;
  if(!total)return intro;
  const c=psplitCents(t,ps,Math.round(total*100)),pr=(t.psplit||{}).parts||{};
  const s2=sum(ps.map(p=>Number(pr[p.id])||0));
  let aviso='';
  if(mode==='amount'){const d=Math.round((total-s2)*100)/100;
    if(Math.abs(d)>0.005)aviso=d>0?'Faltam '+euro2(d)+': os valores têm de somar '+euro2(total)+'.':'Passam '+euro2(-d)+' do total ('+euro2(total)+').'}
  if(mode==='percent'&&Math.abs(s2-100)>0.01)aviso='As percentagens somam '+dec(Math.round(s2*100)/100)+'%: têm de somar 100.';
  if(mode==='adjust'){
    if(ps.some(p=>Number(pr[p.id])<0))aviso='Ajustes negativos não contam: um ajuste é sempre um extra.';
    else if(s2>total+0.005)aviso='Os ajustes ('+euro2(s2)+') passam o total.'}
  return intro+partesDaDivisaoHtml(ps.map((p,i)=>({nome:p.name,cents:c[i]})),Math.round(total*100),aviso);
}
// Valida a divisão entre imóveis: devolve a mensagem de erro ou '' se ok.
// Só se aplica a movimentos de grupo (ou de «Todos os imóveis») com dois ou mais imóveis.
// Num modelo sem montante, os valores e os ajustes por imóvel não se comparam com o
// total (confere-os o movimento que nascer dele); as percentagens e as quotas, sim.
// Devolve: a mensagem de erro (string) ou '' se está tudo válido.
function psplitError(){
  const t=tForm;if(!t.groupId&&!t.todos)return '';
  const ps=txProps(t),mode=(t.psplit||{}).mode;
  if(ps.length<2||!mode||['equal','value','purchase'].indexOf(mode)>-1)return '';
  const parts=(t.psplit||{}).parts||{},total=Math.abs(Number(t.amount)||0);
  const s2=sum(ps.map(p=>Number(parts[p.id])||0)),semTotal=!total&&txMontanteOpcional();
  if(mode==='amount'&&!semTotal&&Math.abs(s2-total)>0.005)return 'Os valores por imóvel têm de somar '+euro2(total)+'.';
  if(mode==='adjust'){
    if(ps.some(p=>Number(parts[p.id])<0))return 'Os ajustes por imóvel não podem ser negativos: um ajuste é sempre um extra.';
    if(!semTotal&&s2>total+0.005)return 'Os ajustes por imóvel somam '+euro2(s2)+' e não podem passar o total ('+euro2(total)+').';
  }
  if(mode==='pct'&&!(s2>0))return 'Indica pelo menos uma quota de imóvel.';
  if(mode==='percent'&&Math.abs(s2-100)>0.01)return 'As percentagens por imóvel têm de somar 100 (somam '+dec(Math.round(s2*100)/100)+').';
  return '';
}
// Lê do DOM o modo e os valores por imóvel para tForm.psplit (fora de um grupo ou de «Todos» fica null).
// Devolve: nada — escreve em tForm.psplit.
function collectPsplit(){
  const t=tForm;
  if(!t.groupId&&!t.todos){t.psplit=null;return}
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
    return `<div class="hint">Nenhuma hipoteca associada. Podes registar o pagamento na mesma${servicoLigado('credits')?', ou criar a hipoteca em Dinheiro → Créditos':''}.</div>`;
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
      <div class="hint" id="loanLeft">${cap>avail+0.011?`<b class="perigo">Só faltam ${euro2(avail)} pagar — não podes amortizar mais do que isso.</b>`:`Ficam ${euro(Math.max(0,avail-Math.min(cap,avail)))} em dívida.`}</div></div>`;
  }
  /* prestação normal: juros editáveis, selo derivado, capital é o resto — sem comissão */
  const int=dist.interest,st=dist.stamp,cap=dist.principal;
  return seg+`<div class="card u-bg-v-tint u-p-13px">
    <div class="row-between u-ai-center u-mb-2px"><span class="small"><b>Distribuição do montante</b></span>
      <button class="btn sm${t._splitTouched?'':' u-d-none'} u-fx-0-0-auto u-p-6px-9px" id="lh_reset" data-toca="rascunho" data-click="onLoanReset()" title="Repor a prestação calculada na hipoteca">${ic('clock',14)} Repor</button></div>
    <div class="stat u-ai-center"><span>Juros (€)</span>
      <input class="statin" id="t_int" type="text" inputmode="decimal" value="${dec(int.toFixed(2))}" data-input="onLoanSplit('int')" autocomplete="off"></div>
    <div class="stat u-ai-center"><span>Imposto do selo (${dec(db.settings.stampPct??4)}%)</span><b id="lh_stamp">${euro2(st)}</b></div>
    <div class="stat u-b-0 u-ai-center"><span>Abate ao capital (€)</span>
      <input class="statin pos" id="t_cap" type="text" inputmode="decimal" value="${dec(Math.max(0,cap).toFixed(2))}" data-input="onLoanSplit('cap')" autocomplete="off"></div>
    <div class="hint" id="loanLeft">${loanLeftTxt(l,int,st,cap,0,amt,avail)}</div></div>`;
}
// Linha por baixo da distribuição: quanto fica em dívida depois deste pagamento,
// ou o aviso quando o capital passa o que falta ou a soma não bate com o montante.
// Recebe: l — a hipoteca (objeto); int, st, cap, fee — juros, selo, capital e comissão (números, em €);
// amt — o montante total do pagamento (€); avail — o capital que ainda falta pagar (€).
// Devolve: o texto da linha (string HTML).
function loanLeftTxt(l,int,st,cap,fee,amt,avail){
  const sum=r2(int+st+cap+(fee||0));
  if(cap>avail+0.011)return `<b class="perigo">Só faltam ${euro2(avail)} pagar — não podes amortizar mais do que isso.</b>`;
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
   das ações não tem. Faz o mesmo e pela mesma ordem, e refaz o aviso da
   retenção (txRefazDicaDaRetencao), que depende do montante.
   Recebe: v — o texto do campo.
   Devolve: nada — atualiza o tForm e repinta as dicas. */
function txMontanteEscrito(v){
  tForm.amount=num(v);
  refreshLoanHint();refreshSplit();amtResetSync();txRefazDicaDaRetencao();
}
/* O montante como se escreve no campo: com vírgula e dois decimais
   («223,61», «320,00»), como o «Repor» o escreve e como o canvas o mostra.
   Ia o número em bruto, e editar um movimento mostrava «223.61».
   Recebe: v — o montante (número, ou vazio).
   Devolve: o texto do campo ('' sem montante, para se ver o exemplo). */
function txMontanteNoCampo(v){
  const n=Number(v);
  return n>0?dec(n.toFixed(2)):'';
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
function repaintTx(){const b=modalBodyEl();if(!b)return;b.innerHTML=txBody();marcarDatasVazias(b)}
/* Muda o tipo do movimento (ex.: dívida recebida ↔ paga): preserva o que foi escrito à mão,
   limpa categoria/subcategoria se a árvore de categorias do novo tipo for outra,
   e acerta o título do modal quando não é modelo nem recorrência.
   Recebe: k — o novo tipo ('income', 'expense', 'loan', 'owed', 'repay' ou 'settle').
   Devolve: nada — atualiza o tForm e repinta o modal. */
function setKind(k){keepTyped();
  if(treeKey(tForm.kind)!==treeKey(k)){tForm.category='';tForm.sub=''}
  limparDoTipo(tForm.kind,k);
  tForm.kind=k;if(k!=='settle'&&tForm.label==='Transferência entre proprietários')tForm.label='';prefill();repaintTx();
  const h=modalTop()&&modalTop().el.querySelector('.head h2');if(h)h.textContent=txTitulo()}
/* Ao trocar de tipo no segmentado, o que só o tipo antigo tinha sai do
   formulário — senão gravava-se escondido: a hipoteca e a distribuição de um
   pagamento de crédito, o contrato e o que o IRS pergunta a uma renda, a
   coluna do Anexo F de uma despesa, a pessoa de uma dívida a terceiros, a
   divisão entre donos num acerto (que não a tem). E só uma receita ou uma
   despesa se dividem por vários imóveis: noutro tipo, um grupo ou «Todos os
   imóveis» volta ao imóvel por omissão, o do txModal. Entre dívida recebida e
   paga não muda nada.
   Recebe: de — o tipo que estava; para — o tipo novo.
   Devolve: nada — só mexe no tForm. */
function limparDoTipo(de,para){
  const t=tForm,divida=k=>k==='owed'||k==='repay';
  if(de===para)return;
  if(de==='loan'&&para!=='loan'){t.loanId=null;t.payType='prestacao';['interest','stamp','principal','fee','_splitTouched'].forEach(x=>{delete t[x]})}
  if(de==='income'&&para!=='income'){t.contractId=null;t.periodo='';t.recibo=false;t.retencao=0;delete t.pagadorNif;delete t.cedenciaNumero}
  if(de==='expense'&&para!=='expense')t.irsCol='';
  if(divida(de)&&!divida(para))t.creditor='';
  if(para==='settle')t.split=null;
  if(para!=='income'&&para!=='expense'&&(t.groupId||t.todos)){
    t.groupId=null;t.todos=false;t.psplit=null;
    t.propertyId=(db.properties.length===1||!podeSemImovel())?((casasComo('tx.add')[0]||{}).id||null):null;
  }
}
/* Mudou o imóvel (ou grupo, valores "g:id", ou «Todos os imóveis», '*'): limpa tudo o que
   dependia dele — contrato, hipoteca, divisões e distribuição — e volta a sugerir valores
   para o novo contexto.
   Devolve: nada — atualiza o tForm e repinta o modal. */
function onPropChange(){keepTyped();
  const w=val('t_prop')||'',v=w==='__sem__'?'':w;
  tForm._semImovel=w==='__sem__';
  tForm.groupId=String(v).startsWith('g:')?v.slice(2):null;
  tForm.todos=v==='*';
  tForm.propertyId=(tForm.groupId||tForm.todos)?null:(v||null);
  tForm.contractId=null;tForm.loanId=null;tForm.split=null;delete tForm._ctEscolhido;delete tForm._semContrato;
  delete tForm.interest;delete tForm.stamp;delete tForm.principal;
  tForm.psplit=(tForm.groupId||tForm.todos)?{mode:'equal',parts:{}}:null;
  prefill();repaintTx()}
/* Mudou o contrato: volta a sugerir a renda e a descrição do contrato
   escolhido, e numa receita sem categoria a da renda (N083). A escolha é da
   pessoa (_ctEscolhido): «Sem contrato» escolhido à mão não volta a ganhar o
   contrato sugerido (D05); «Não é de nenhum contrato» ('__nenhum__') é uma
   escolha (_semContrato).
   Devolve: nada — atualiza o tForm e repinta o modal. */
function onCtChange(){keepTyped();const v=val('t_ct')||'';tForm.contractId=v&&v!=='__nenhum__'?v:null;tForm._semContrato=v==='__nenhum__';tForm._ctEscolhido=true;prefill();repaintTx()}
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
  },isIn(tForm.kind)?'Garagem':'Obras')}
  tForm.category=v;tForm.sub='';
  if(tForm.kind==='income')txSugereMesDaRenda();   /* a «Renda em atraso» que saiu deixa de pedir o mês */
  repaintTx();
}
/* Mudou a subcategoria; "__new__" abre o prompt para criar uma nova dentro da categoria atual.
   Numa despesa repinta, porque a coluna do Anexo F por omissão pode depender da subcategoria
   (e o IMI pode ter o interruptor da nota própria). Numa receita também: a «Renda em atraso»
   torna o mês a que respeita obrigatório e deixa-o em branco se ainda era o sugerido (D54); a
   que deixa de o ser volta a ter o mês sugerido.
   Devolve: nada — atualiza tForm.sub (com "__new__" abre o prompt; numa despesa ou receita repinta). */
function onSubChange(){
  collectTx();
  const v=val('t_sub');
  if(v==='__new__'){repaintTx();return promptModal('Nova subcategoria','Nome','',nm=>{
    const tr=catsFor(tForm.kind)||{},l=tr[tForm.category]||(tr[tForm.category]=[]);
    if(l.indexOf(nm)<0)l.push(nm);
    save();tForm.sub=nm;repaintTx();
    toast('Subcategoria criada.');
  },isIn(tForm.kind)?'Renda de garagem':'Canalização')}
  tForm.sub=v;
  if(tForm.kind==='income'){
    if(txRendaEmAtraso(tForm)){if(tForm._aP&&tForm.periodo===tForm._aP)tForm.periodo='';delete tForm._aP}
    else txSugereMesDaRenda();
    return repaintTx();
  }
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
  /* «Sem imóvel» escolhido de propósito ('__sem__', N027) é um movimento sem imóvel */
  if(document.getElementById('t_prop')){const w=val('t_prop')||'',v=w==='__sem__'?'':w;t._semImovel=w==='__sem__';t.groupId=String(v).startsWith('g:')?v.slice(2):null;t.todos=v==='*';t.propertyId=(t.groupId||t.todos)?null:(v||null)}
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
  /* «Não é de nenhum contrato» escolhido de propósito ('__nenhum__', N083) é sem contrato */
  if(document.getElementById('t_ct')){const v=val('t_ct')||'';t._semContrato=v==='__nenhum__';t.contractId=v&&v!=='__nenhum__'?v:null}
  /* o que o IRS pergunta: cada campo só quando está no ecrã, e no formato do
     normTx — o mês aceita 'AAAA-MM' (o input de mês) e 'MM/AAAA' (onde o
     browser o dá como texto); o resto fica vazio, e não uma data inventada */
  if(document.getElementById('t_periodo')){
    const s=String(val('t_periodo')||'').trim(),m=/^(\d{1,2})\/(\d{4})$/.exec(s);
    t.periodo=/^\d{4}-\d{2}$/.test(s)?s:(m?m[2]+'-'+m[1].padStart(2,'0'):'');
  }
  if(document.getElementById('t_retencao'))t.retencao=Math.max(0,num(val('t_retencao'))||0);
  if(document.getElementById('t_recibo'))t.recibo=chk('t_recibo');
  /* quem paga uma cedência (natureza 02, N076): só algarismos no NIF; um campo
     vazio que nunca teve valor não cria o campo no movimento */
  const lerTexto=(id,k,f)=>{if(!document.getElementById(id))return;const v=f(String(val(id)||''));if(v||t[k]!==undefined)t[k]=v};
  lerTexto('t_pagadorNif','pagadorNif',s=>s.replace(/\D/g,'').slice(0,9));
  lerTexto('t_cedenciaNumero','cedenciaNumero',s=>s.trim().slice(0,40));
  if(document.getElementById('t_irscol'))t.irsCol=val('t_irscol')||'';
  /* o AIMI não tem seletor da coluna (D66): uma escolha antiga não fica gravada escondida */
  if(t.kind==='expense'&&irsColunaDe(t).origem==='lei')t.irsCol='';
  /* a parte (N041; a nota própria do IMI, D32): '1' só a minha parte, '0' o
     total da casa, '' por responder; só onde a pergunta faz sentido — fora
     disso não fica ligada às escondidas */
  if(document.getElementById('t_notaPropria')){const v=String(val('t_notaPropria')||'');if(v==='1'||v==='0'){t.notaPropria=v==='1';t._parteRespondida=true}}
  if(!txNotaPropriaAplica(t))t.notaPropria=false;
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
     <div class="hint u-mt-8px">Podes gerir a lista em Definições → Categorias, etiquetas e IRS.</div>`);
}
// Cria uma etiqueta nova a partir do modal do movimento: entra na lista global
// (Definições → Categorias, etiquetas e IRS), fica gravada, e aplica-se logo a este movimento.
// Devolve: nada — grava nas definições e repinta o modal do movimento.
function newTagFromTx(){
  closeModal();
  promptModal('Nova etiqueta','Nome','',nm=>{
    const l=db.settings.tags||(db.settings.tags=[]);
    if(l.indexOf(nm)<0)l.push(nm);
    if((tForm.tags||[]).indexOf(nm)<0)tForm.tags.push(nm);
    save();repaintTx();
    toast('Etiqueta criada e aplicada.');
  },'Obras 2026');
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
   O toast traz "Anular", que desfaz as duas coisas; os anexos dele só saem do
   aparelho e do servidor quando o Anular expira (anexos.js:apagarAnexosSemRegisto),
   como os de um contrato. Uma parte de um lote apaga o lote inteiro (apagarLote).
   Uma linha importada do Splitwise fica entre as apagadas de propósito
   (splitwise.js:swIgnorar, D127): reimportar o grupo não a repõe; o Anular tira-a.
   Recebe: id — o id do movimento a apagar (string).
   Devolve: nada — grava e re-renderiza. */
function delTx(id){
  /* sem confirmação, com Anular: é a eliminação mais frequente da app, e a
     pergunta constante ensinava o dedo a confirmar sem ler */
  const t=db.transactions.find(x=>x.id===id);if(!t)return;
  if(t.lote)return apagarLote(t);
  const recusa=motivoRecusa(t.propertyId,'tx.add',t,true);if(recusa)return toast(recusa);
  const copia=JSON.parse(JSON.stringify(t));
  const l=t.kind==='loan'&&t.loanId?findLoan(prop(t.propertyId),t.loanId):null;
  if(l)fixarCapitalInicio(l,db.transactions);   /* os dados antigos: antes de o movimento sair */
  const capital=l?l.capitalInicio:null;
  db.transactions=db.transactions.filter(x=>x.id!==id);
  swIgnorar(copia);
  if(l){acertarCapital(l);if(servicoLigado('recurring'))syncLoanRec(prop(t.propertyId),l)}
  save();closeAllModals();render();
  comDesfazer('Movimento apagado.',()=>{
    db.transactions.push(copia);swDesignorar(copia);
    /* volta a procurar a hipoteca: um sync entretanto pode ter trocado os objetos da db */
    const l2=copia.kind==='loan'&&copia.loanId?findLoan(prop(copia.propertyId),copia.loanId):null;
    if(l2){if(l2.capitalInicio==null)l2.capitalInicio=capital;acertarCapital(l2);if(servicoLigado('recurring'))syncLoanRec(prop(copia.propertyId),l2)}
  },()=>apagarAnexosSemRegisto(copia.files));
}

/* ================= LOTES =================
   Um movimento de vários imóveis — de um grupo, ou de «Todos os imóveis» —
   guarda-se partido por imóvel: cada parte é um movimento normal do seu
   imóvel (um registo da casa, que vê quem tem o imóvel), com a marca lote
   {id, n, total, alvo, modo, partes} (dados.js:normLote). Guardava-se como
   um registo só, nos dados de quem o registou: num grupo partilhado os outros
   comproprietários não o viam, e as contas mudavam sempre que o grupo ganhava
   ou perdia um imóvel. O custo é este bloco: editar e apagar tratam o lote
   inteiro, e um lote de que só vejo parte não se mexe daqui. Os moldes
   (planeados e modelos) continuam a guardar o grupo ou «Todos»; parte-se ao
   registar. */

/* O id de uma parte: determinístico — dois aparelhos a partir o mesmo lote
   dão os mesmos ids, e editar mantém-nos — e dentro da forma que o servidor
   aceita (40 + 1 + 12 caracteres, só letras, algarismos, _ e -).
   Recebe: loteId — o id do lote; propId — o id do imóvel da parte.
   Devolve: o id da parte (texto). */
function parteId(loteId,propId){return String(loteId).slice(0,40)+'_'+String(propId).replace(/[^A-Za-z0-9]/g,'').slice(0,12)}
/* As partes de um lote que estão nesta base, pela ordem dos imóveis (a da
   base; a mesma da lista) e, no mesmo imóvel, pelo id.
   Recebe: loteId — o id do lote.
   Devolve: as partes (array de objetos de db.transactions); vazio sem nenhuma. */
function partesDoLote(loteId){
  if(loteId==null||loteId==='')return [];
  const ordem=new Map();(db.properties||[]).forEach((p,i)=>ordem.set(p.id,i));
  const pos=t=>ordem.has(t.propertyId)?ordem.get(t.propertyId):Infinity;
  return (db.transactions||[]).filter(t=>t.lote&&t.lote.id===loteId)
    .sort((a,b)=>(pos(a)-pos(b))||String(a.id).localeCompare(String(b.id)));
}
/* O lote desta parte está inteiro nesta base: as n partes, todas a dizer o
   mesmo n e o mesmo total. Menos (de imóveis que não tenho), ou partes que não
   batem umas com as outras (um lote refeito noutro aparelho a meio de chegar),
   é um lote que daqui não se altera nem se apaga — mexer só no que se vê
   deixava partes velhas e novas misturadas.
   Recebe: t — o movimento.
   Devolve: true se t é parte de um lote inteiro nesta base; false se não é
   parte de lote nenhum, ou se o lote está incompleto. */
function loteCompleto(t){
  if(!t||!t.lote)return false;
  const l=t.lote,ps=partesDoLote(l.id);
  return ps.length===l.n&&ps.every(x=>x.lote.n===l.n&&x.lote.total===l.total);
}
/* A frase de um lote incompleto, para a ficha e para a recusa.
   Recebe: n — de quantas partes é o lote.
   Devolve: o texto (por escapar). */
function fraseDoLoteIncompleto(n){return 'Parte de um movimento dividido por '+n+' imóveis. Só quem vê os '+n+' imóveis o altera.'}
/* Posso alterar ou apagar o lote desta parte? Só inteiro nesta base
   (loteCompleto) e com cada parte ao meu alcance (podeEditar, imóvel a imóvel).
   E um lote de «Todos os imóveis» só por quem o registou: «todos» são os
   imóveis de quem o registou, e guardá-lo à mão de um comproprietário
   dividia-o pelos imóveis DELE — que podem incluir casas que não são do
   autor. A marca do servidor (_createdBy) diz quem foi; sem ela (só neste
   aparelho, ou sem sessão) é meu.
   Recebe: t — o movimento; acao (opcional) — true quando é apagar (ver podeEditar).
   Devolve: a frase da recusa (texto), ou '' quando posso — e '' num movimento
   que não é parte de lote nenhum. */
function recusaDoLote(t,acao){
  if(!t||!t.lote)return '';
  if(!loteCompleto(t))return fraseDoLoteIncompleto(t.lote.n);
  const ps=partesDoLote(t.lote.id),eu=meuId();
  if(t.lote.alvo==='todos'&&eu&&ps.some(y=>y._createdBy&&y._createdBy!==eu))
    return 'Dividido por todos os imóveis de quem o registou: só essa pessoa o altera.';
  const x=ps.find(y=>!podeEditar(y.propertyId,'tx.add',y,acao));
  return x?motivoRecusa(x.propertyId,'tx.add',x,acao):'';
}
/* O movimento que o formulário edita a partir de uma parte: o lote inteiro —
   o id do lote, o total, o grupo ou «Todos», e o modo e os valores da divisão
   entre imóveis; a retenção na fonte é a soma das partes. O resto (descrição,
   data, categoria, quem pagou…) é o da parte, que é o do lote. Sem as marcas
   do servidor (_…): quem guarda tira-as de qualquer forma.
   Recebe: t — uma parte de um lote inteiro nesta base.
   Devolve: um objeto novo, por normalizar, com o lote como um movimento de vários imóveis. */
function movimentoDoLote(t){
  const l=t.lote,alvo=String(l.alvo||''),g=alvo.startsWith('g:')?alvo.slice(2):null;
  const o=JSON.parse(JSON.stringify(t));
  Object.keys(o).forEach(k=>{if(k[0]==='_')delete o[k]});
  return Object.assign(o,{id:l.id,amount:l.total,propertyId:null,groupId:g,todos:!g,lote:null,
    psplit:{mode:l.modo,parts:JSON.parse(JSON.stringify(l.partes||{}))},
    retencao:r2(sum(partesDoLote(l.id).map(x=>Number(x.retencao)||0)))});
}
/* Onde é um lote, na ficha: o nome do grupo (se ainda existir) ou «Todos os
   imóveis», e por quantos imóveis se dividiu. De um grupo que já não existe,
   só quantos são.
   Recebe: t — uma parte do lote.
   Devolve: o texto, já escapado (ex.: «Bloco · 3 imóveis»). */
function ondeDoLote(t){
  const l=t.lote,alvo=String(l.alvo||''),n=Number(l.n)||0;
  const g=alvo.startsWith('g:')?grp(alvo.slice(2)):null,nome=alvo==='todos'?'Todos os imóveis':(g&&g.name)||'';
  return (nome?esc(nome)+' · ':'')+n+(n===1?' imóvel':' imóveis');
}
/* Este movimento divide-se por vários imóveis ao guardar? Uma receita ou
   despesa de um grupo ou de «Todos os imóveis», sem imóvel. Os outros tipos
   com grupo (dados antigos) ficam como estão: só receitas e despesas se
   dividem.
   Recebe: t — o movimento.
   Devolve: true/false. */
function ehDeVariosImoveis(t){return !!t&&!t.propertyId&&(!!t.groupId||!!t.todos)&&(t.kind==='income'||t.kind==='expense')}
/* Parte um movimento de vários imóveis — os do grupo hoje, ou os de «Todos»
   na data dele (txProps) — num lote. Os cêntimos saem do psplitCents sobre os
   cêntimos do total e somam o total ao cêntimo; a retenção na fonte parte-se
   na mesma proporção, ao cêntimo, em vez de se repetir em cada imóvel (o que
   multiplicava o retido no Anexo F). Cada parte leva o resto do movimento tal
   e qual (tipo, descrição, data, categoria, etiquetas, notas, quem pagou, a
   divisão entre donos, a coluna do Anexo F, os anexos — a mesma lista em
   todas, porque a fatura é do movimento inteiro), sem contrato nem hipoteca — são
   de um imóvel, não de vários —, e o id parteId(id do movimento, imóvel).
   Com um imóvel só é um movimento normal nesse imóvel, com o id do movimento.
   Não mexe na base.
   Recebe: t — o movimento (com id, amount, groupId ou todos, date, psplit).
   Devolve: {partes} — os movimentos a pôr na base (normTx), pela ordem dos
   imóveis —, ou {erro} com a frase: sem imóveis, num imóvel onde não posso
   registar, ou com ids que colidem com outro movimento. */
function partirMovimento(t){
  const vistos=new Set(),ps=txProps(t).filter(p=>!vistos.has(p.id)&&vistos.add(p.id));
  if(!ps.length)return {erro:t.groupId?(grp(t.groupId)?'O grupo não tem imóveis.':'O grupo deste movimento não está nesta conta: escolhe onde fica.'):'Não havia imóveis nesta data.'};
  const barrado=ps.find(p=>!pode(p.id,'tx.add'));
  if(barrado)return {erro:'Não podes adicionar movimentos em «'+(barrado.name||'imóvel')+'» — pede ao dono.'};
  const base=JSON.parse(JSON.stringify(t));
  Object.keys(base).forEach(k=>{if(k[0]==='_')delete base[k]});
  Object.assign(base,{groupId:null,todos:false,psplit:null,lote:null,contractId:null,loanId:null});
  if(ps.length===1)return {partes:[normTx(Object.assign(base,{propertyId:ps[0].id}))]};
  const sinal=Number(t.amount)<0?-1:1,total=Math.abs(Math.round((Number(t.amount)||0)*100));
  const c=psplitCents(t,ps,total),sp=t.psplit||{};
  const rs=splitShares(Math.round((Number(t.retencao)||0)*100),c.map(x=>total?x/total:1/ps.length));
  const modo=PSPLIT_MODES.some(m=>m[0]===sp.mode)?sp.mode:'equal';
  const lote={id:t.id,n:ps.length,total:sinal*total/100,alvo:t.groupId?'g:'+t.groupId:'todos',modo,
    partes:['equal','value','purchase'].indexOf(modo)>-1?{}:JSON.parse(JSON.stringify(sp.parts||{}))};
  const partes=ps.map((p,i)=>normTx(Object.assign(JSON.parse(JSON.stringify(base)),
    {id:parteId(t.id,p.id),propertyId:p.id,amount:sinal*c[i]/100,retencao:rs[i]/100,lote:JSON.parse(JSON.stringify(lote))})));
  /* os ids têm de ser de um só movimento: dois imóveis com o mesmo começo de
     id, ou um id de lote comprido que começa como o de outro, davam duas
     partes com o mesmo id — e uma apagava a outra no servidor */
  const ids=new Set(partes.map(x=>x.id));
  if(ids.size<partes.length||(db.transactions||[]).some(x=>ids.has(x.id)&&x.id!==t.id&&!(x.lote&&x.lote.id===t.id)))
    return {erro:'Não consegui dividir este movimento pelos imóveis (os ids das partes colidem). Regista-o de novo.'};
  return {partes};
}
/* Troca na base tudo o que é deste lote — o movimento com o id do lote e as
   partes que o têm como lote — pelos movimentos novos, de uma vez, no lugar do
   primeiro que sai. É por aqui que um lote nunca fica meio gravado: as partes
   velhas saem todas no mesmo passo em que as novas entram.
   Recebe: loteId — o id do lote; novos — os movimentos que ficam (array).
   Devolve: os movimentos que saíram (array). */
function trocarLote(loteId,novos){
  const sai=x=>x.id===loteId||(!!x.lote&&x.lote.id===loteId);
  const lista=db.transactions||[],velhos=lista.filter(sai);
  let i=lista.findIndex(sai);if(i<0)i=lista.length;
  db.transactions=lista.slice(0,i).concat(novos,lista.slice(i).filter(x=>!sai(x)));
  return velhos;
}
/* Um movimento pronto a entrar na base a partir de um molde (o tx de um
   planeado ou de um modelo, já com data): o de um grupo ou de «Todos os
   imóveis» parte-se por imóvel (partirMovimento); o resto entra tal e qual.
   É o que o Confirmar de um planeado e o «guardar e registar» de um modelo
   usam, para um molde de grupo nunca voltar a entrar como um registo só.
   Recebe: t — o movimento (normTx, com id e data).
   Devolve: {partes} — os movimentos a juntar à base —, ou {erro} com a frase. */
function registarMolde(t){return ehDeVariosImoveis(t)?partirMovimento(t):{partes:[t]}}
/* Apaga um lote inteiro — as partes todas, de uma vez —, com «Anular» a
   repô-las todas. Só com o lote inteiro nesta base e cada parte ao meu
   alcance (recusaDoLote): apagar só as partes que vejo deixava os outros
   imóveis com um pedaço de um movimento que já não existe. Os anexos (os
   mesmos em todas as partes) saem quando o Anular expira, uma vez cada. As
   linhas do Splitwise ficam entre as apagadas de propósito, como no delTx.
   Recebe: t — uma parte do lote.
   Devolve: nada — grava e redesenha (ou diz porque não apagou). */
function apagarLote(t){
  const recusa=recusaDoLote(t,true);if(recusa)return toast(recusa);
  const partes=partesDoLote(t.lote.id),ids=new Set(partes.map(x=>x.id));
  const copias=JSON.parse(JSON.stringify(partes));
  db.transactions=db.transactions.filter(x=>!ids.has(x.id));
  swIgnorar(copias);
  save();closeAllModals();render();
  comDesfazer('Movimento apagado.',()=>{
    swDesignorar(copias);
    /* repõe as partes todas — só as que um sync entretanto não trouxe de volta */
    const ja=new Set(db.transactions.map(x=>x.id));
    copias.forEach(c=>{if(!ja.has(c.id))db.transactions.push(c)});
  },()=>apagarAnexosSemRegisto([].concat(...copias.map(c=>c.files||[]))));
}
/* Os movimentos de grupo do formato antigo — um registo só, sem imóvel, nos
   dados de quem o registou, dividido na hora pelos imóveis que o grupo
   tivesse — partem-se por imóvel, com o id antigo como id do lote. Só os que
   se partem sem mudar número nenhum: receita ou despesa; o grupo existe, sem
   imóveis repetidos, e os imóveis dele estão todos nesta base e com
   «Adicionar movimentos»; com um imóvel só, quando as contas entre donos
   ficam iguais (quem pagou é dono dele, ou não há quem pagou). Um de «Todos
   os imóveis» que tenha entrado como registo só (o preenchimento por
   estimativa de um planeado) parte-se da mesma maneira, pelos imóveis da data
   dele. O que não se parte fica como estava, e continua a contar pelo código
   de sempre (txWeight, ownerBalances). Correr outra vez não faz nada: o que se
   partiu já não tem grupo.
   Não grava: quem chama grava (arranque.js:derivarDoArranque).
   Devolve: quantos movimentos se partiram (número). */
function migrarMovimentosDeGrupo(){
  let n=0;
  (db.transactions||[]).slice().forEach(t=>{
    if(!ehDeVariosImoveis(t))return;
    let ps;
    if(t.groupId){
      const g=grp(t.groupId),ids=g?g.ids||[]:[];
      if(!ids.length||new Set(ids).size!==ids.length)return;
      ps=ids.map(prop);if(ps.some(p=>!p))return;
    }else ps=imoveisDeTodos(t.date);
    if(!ps.length||ps.some(p=>!pode(p.id,'tx.add')))return;
    if(ps.length===1&&countsBetweenOwners(t)){const os=ownersOfProp(ps[0]);if(os.length&&os.indexOf(t.paidBy)<0)return}
    const r=partirMovimento(t);if(r.erro)return;
    trocarLote(t.id,r.partes);n++;
  });
  return n;
}
