/* ================= CRÉDITOS (todas as hipotecas) =================
   Devolve: o HTML da vista de créditos — barra de filtros, KPIs e a lista de
   hipotecas em cartões. */
function vCredits(){
  const K='lcred',s=lf(K);
  const rows=[];
  scope().forEach(p=>loansOf(p).forEach(l=>rows.push({p,l})));
  const live=rows.filter(x=>Number(x.l.outstanding)>0);
  const shown=lfSort(K,rows.filter(({p,l})=>{
    if(s.p&&p.id!==s.p)return false;
    if(s.st==='on'&&!(Number(l.outstanding)>0))return false;
    if(s.st==='off'&&Number(l.outstanding)>0)return false;
    return lfHit(K,[loanName(l),l.name,l.bank,p.name,RATE[l.type],String(l.outstanding)].join(' '));
  }),{divida:x=>x.l.outstanding,prestacao:x=>Number(x.l.outstanding)>0?loanCalc(x.l).total:0,nome:x=>loanName(x.l),imovel:x=>x.p.name});
  const tot=sum(live.map(x=>x.l.outstanding)),pay=sum(live.map(x=>loanCalc(x.l).total));
  const head=lfBar(K,[lfSel(K,'p',lfPropOpts()),
      lfSel(K,'st',[{v:'',label:'Ativas e liquidadas'},{v:'on',label:'Ativas'},{v:'off',label:'Liquidadas'}])],shown.length,
      {opts:[{v:'divida',label:'Ordenar por dívida'},{v:'prestacao',label:'Ordenar por prestação'},{v:'nome',label:'Ordenar por nome'},{v:'imovel',label:'Ordenar por imóvel'}]})
    /* uma hipoteca grava-se na ficha do imóvel: sem «Editar a ficha» em imóvel
       nenhum (o Contabilista de fábrica vê os créditos e não os edita), o botão
       só levava a uma recusa no Guardar */
    +(casasComo('house.edit').length?fab([{label:'Nova hipoteca',act:'newMort()'}]):'');
  const kpis=`<div class="grid u-mb-14px">
    ${kpi('Em dívida',euro(tot),'amber',live.length+(live.length===1?' hipoteca ativa':' hipotecas ativas'))}
    ${kpi('Prestações',euro2(pay),'neg','por mês, no total')}
    ${kpi('Juros até ao fim',euro(sum(live.map(x=>{const a=amort(x.l);return a.totInt+a.totStamp}))),'neg','com imposto do selo')}</div>`;
  /* sem imóveis, o botão do canto só dava um aviso a dizer que faltava um
     imóvel: um caminho que acaba num aviso não é um caminho */
  if(!rows.length)return head+(esperaDoServidor()||`<div class="empty"><b>Sem hipotecas</b>${db.properties.length
    ?'Uma hipoteca está sempre associada a um imóvel.'+(casasComo('house.edit').length?' Cria a primeira aqui ou na ficha do imóvel.':'')
    :'Uma hipoteca está sempre associada a um imóvel, e ainda não há nenhum.'+saida('Adicionar imóvel',"go('properties')",'ecra')}</div>`);
  if(!shown.length)return head+kpis+vazioFiltro();
  const mortCard=({p,l})=>{const live2=Number(l.outstanding)>0,c=live2?loanCalc(l):null;
    return `<div class="card tap" data-lp="mort:${esc(p.id)}:${esc(l.id)}" data-fk="mort:${esc(p.id)}:${esc(l.id)}" data-toca="camada" data-click="mortView('${jsq(p.id)}','${jsq(l.id)}')">
      <div class="row-between"><div class="u-minw-0"><div class="title">${esc(loanName(l))} ${live2?'':'<span class="badge grey">liquidada</span>'}</div>
        <div class="small">${esc(p.name)} · ${esc(RATE[l.type]||'')} · ${esc(rateLabel(l))}${(l.files||[]).length?' · '+l.files.length+' doc.':''}</div></div>
        <div class="u-d-flex u-g-8px u-fx-0-0-auto u-ai-flex-start">
          <div class="u-ta-right"><b>${euro(l.outstanding)}</b>${live2?`<div class="small">${euro2(c.total)}/mês</div>`:''}</div>
          ${kebab('mort:'+p.id+':'+l.id)}</div></div></div>`};
  /* os pagamentos sem crédito são movimentos: sem o serviço dos Movimentos nesta conta não há cartão a mostrar */
  const aviso=(servicoLigado('transactions')?creditosOrfaos():[]).filter(x=>!motivoCredito(x.p.id)).map(({p,l,txs})=>`<div class="card u-mb-14px">
    <div class="title">${txs.length===1?'1 pagamento sem crédito associado':txs.length+' pagamentos sem crédito associado'}</div>
    <div class="small">${esc(p.name)} · ${euro2(sum(txs.map(t=>t.amount||0)))} · ${txs.length===1?'não abateu':'não abateram'} capital nenhum a ${esc(loanName(l))}.</div>
    <div class="toolbar u-m-9px-0-0"><button class="btn sm primary" data-toca="dados" data-click="associarOrfaos('${jsq(p.id)}','${jsq(l.id)}')">Associar à hipoteca ${esc(loanName(l))}</button></div></div>`).join('');
  const act=shown.filter(x=>Number(x.l.outstanding)>0),paid=shown.filter(x=>!(Number(x.l.outstanding)>0));
  const emLista=(id,xs)=>listaViva(id,xs.map(x=>({chave:'mort:'+x.p.id+':'+x.l.id,html:mortCard(x)})));
  const list=aviso+(act.length?emLista('creditos-ativos',act):'')
    +(paid.length?`<div class="section-title ${act.length?'u-mt-18px':'u-mt-0px'}">Créditos antigos já pagos</div>`
      +emLista('creditos-pagos',paid)
      +`<div class="hint u-mt-10px">Se editares um pagamento e a dívida voltar a subir, o crédito volta para a lista de cima.</div>`:'');
  return head+kpis+list+`<div class="hint u-mt-12px">Também podes geri-las na ficha de cada imóvel.</div>`;
}
/* Os pagamentos de crédito de um imóvel que estão à espera de hipoteca: os que
   nasceram de um planeado sem crédito e por isso nunca abateram capital
   nenhum. Ficam de fora os que o delMort desligou de propósito (loanOff) — o
   utilizador apagou a hipoteca e escolheu ficar com os movimentos, que já
   abateram capital no seu tempo; oferecê-los à hipoteca sobrevivente abatia
   duas vezes o mesmo dinheiro, e a hipoteca errada.
   Recebe: pid — o id do imóvel.
   Devolve: os movimentos por ligar, por ordem de data (array). */
function orfaosDe(pid){
  return (db.transactions||[]).filter(t=>t.kind==='loan'&&!t.loanId&&!t.loanOff&&t.propertyId===pid)
    .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
}
/* Pagamentos de crédito já registados sem hipoteca associada, imóvel a
   imóvel — os do orfaosDe. Só entram os que se podem ligar sem dúvida: o
   imóvel tem uma e uma só hipoteca viva. Com duas ou mais, ninguém pode
   adivinhar qual delas e o movimento fica como está, para se corrigir à mão.
   Devolve: array de {p,l,txs} — o imóvel, a hipoteca única e os movimentos
   por ligar por ordem de data; vazio quando não há nada a reparar. */
function creditosOrfaos(){
  const out=[];
  scope().forEach(p=>{
    const ls=liveLoans(p);if(ls.length!==1)return;
    const txs=orfaosDe(p.id);
    if(txs.length)out.push({p,l:ls[0],txs});
  });
  return out;
}
/* Liga à hipoteca os pagamentos daquele imóvel que ficaram sem crédito: por
   ordem de data, cada um passa pelo applyLoan, que lhe reparte juros, selo e
   capital sobre a dívida do momento (ou respeita a distribuição que já
   trouxer, se bater certo com o montante) e a abate — o mesmo que teria
   acontecido se tivessem sido confirmados um a um. Daí o _paidOfs=−1 em cada
   um: sem ele o movimento contava-se a si próprio nas prestações registadas
   (já está em db.transactions), o que numa mista podia dar-lhe a fase de taxa
   seguinte. Quando o capital em dívida deixa de chegar, o applyLoan cortava-o
   e gravava uma distribuição que já não somava o montante: esse pára a fila —
   é desfeito, e ele e os seguintes ficam como estavam, com a mensagem a dizer
   quantos. Não se faz sozinho no arranque de propósito: mexer no capital em
   dívida sem o utilizador saber era pior do que o erro. Deixa Anular, que
   repõe os movimentos, a dívida e os planeados.
   Recebe: pid — o id do imóvel; lid — o id da hipoteca.
   Devolve: nada — pede confirmação e, com o sim, grava e redesenha. */
function associarOrfaos(pid,lid){
  if(!servicoLigado('transactions'))return toast(hintServicoDesligado('transactions'));   /* o applyLoan é dos Movimentos */
  const recusa=motivoCredito(pid);if(recusa)return toast(recusa);
  const p=prop(pid),l=p?findLoan(p,lid):null;if(!l)return;
  const txs=orfaosDe(pid);
  if(!txs.length)return toast('Já não há pagamentos por associar.');
  const antes=l.outstanding,copias={};txs.forEach(t=>{copias[t.id]=JSON.parse(JSON.stringify(t))});
  const recsAntes=JSON.parse(JSON.stringify(db.recurring||[]));
  confirmModal('Associar à hipoteca',`${txs.length===1?'1 pagamento de crédito':txs.length+' pagamentos de crédito'} de ${esc(p.name)} (${euro2(sum(txs.map(t=>t.amount||0)))} no total) ${txs.length===1?'ficou':'ficaram'} sem hipoteca associada e nunca ${txs.length===1?'abateu':'abateram'} capital. Associar a “${esc(loanName(l))}”? Cada um fica com os juros, o selo e o capital do plano na sua data, e o capital em dívida desce a partir dos <b>${euro2(antes)}</b> de agora.`,()=>{
    /* o capital do início fica gravado antes de estes pagamentos passarem a contar nele */
    fixarCapitalInicio(l,db.transactions);
    const capital=l.capitalInicio,feitos=[];
    for(const t of txs){
      t.loanId=l.id;l._paidOfs=-1;chamarServico('transactions','applyLoan',t);delete l._paidOfs;
      if(!distribuicaoBate(t)){   /* o capital em dívida não chegou: desfaz-se este e páram os seguintes */
        ['interest','stamp','principal','fee'].forEach(k=>delete t[k]);
        Object.assign(t,JSON.parse(JSON.stringify(copias[t.id])));
        acertarCapital(l);
        db.recurring=JSON.parse(JSON.stringify(recsAntes));   /* a tentativa chegou a liquidar o crédito: o applyLoan apagou o planeado */
        break;
      }
      feitos.push(t);
    }
    const fora=txs.length-feitos.length;
    if(!feitos.length)return toast('Só faltam '+euro2(antes)+' de capital em “'+loanName(l)+'”: o pagamento de '+euro2(txs[0].amount||0)+' não cabe. Associa-o à mão, ajustando a distribuição.');
    if(servicoLigado('recurring'))syncLoanRec(p,l);   /* a prestação planeada é dos Planeados */
    save();buildNav();render();
    const frase=(feitos.length===1?'Pagamento associado a “'+loanName(l)+'”.':feitos.length+' pagamentos associados a “'+loanName(l)+'”.')
      +(fora?' '+(fora===1?'1 ficou':fora+' ficaram')+' de fora: o capital em dívida acabou.':'');
    comDesfazer(frase,()=>{
      db.transactions=db.transactions.map(t=>copias[t.id]?normTx(JSON.parse(JSON.stringify(copias[t.id]))):t);
      db.recurring=JSON.parse(JSON.stringify(recsAntes));   /* o planeado que o applyLoan apagou volta como estava, e não um novo */
      /* volta a procurar a hipoteca: um sync entretanto pode ter trocado os objetos da db */
      const x=anyLoan(lid);if(!x)return;
      if(x.l.capitalInicio==null)x.l.capitalInicio=capital;
      acertarCapital(x.l);
    });
  });
}
/* Um pagamento de crédito cuja distribuição soma o montante, ao cêntimo — o
   mesmo que o formulário exige para gravar. Serve para apanhar o corte que o
   applyLoan faz quando o capital em dívida não chega para o movimento todo.
   Recebe: t — o movimento já passado pelo applyLoan.
   Devolve: true quando juros + selo + capital (+ comissão) dão o montante. */
function distribuicaoBate(t){
  const s=r2(Number(t.interest||0)+Number(t.stamp||0)+Number(t.principal||0)+Math.max(0,Number(t.fee||0)));
  return Math.abs(s-(Number(t.amount)||0))<=0.011;
}
/* nova hipoteca: escolhe-se primeiro o imóvel (uma hipoteca tem sempre um),
   entre os que posso editar — a hipoteca grava-se na ficha do imóvel
   Devolve: nada — abre o seletor de imóvel e depois o modal da hipoteca nova
   (ou um toast, quando ainda não há imóveis ou nenhum que eu possa editar). */
function newMort(){
  if(!db.properties.length)return toast('Cria primeiro um imóvel.');
  const casas=casasComo('house.edit');
  if(!casas.length)return toast(fraseSemPerm('house.edit'));
  pickModal('Hipoteca de que imóvel?',casas.map(p=>({v:p.id,label:p.name,sub:loansOf(p).length?loansOf(p).length+' hipoteca(s)':'sem hipotecas',icon:'building'})),
    o=>{closeAllModals();
      pForm=normProp(JSON.parse(JSON.stringify(prop(o.v))));
      const l=normLoan({name:pForm.loans.length?'':'Aquisição'});
      pForm.loans.push(l);
      mortOpen(l.id,true);
    });
}
/* O corpo da ficha de uma hipoteca.

   «Quanto falta pagar, quanto sai por mês, a que taxa e até quando — e
   quanto me custa até ao fim.» A taxa vai inteira numa linha (o rateLabel já
   escreve «fixa 3,2%» ou «Euribor 6m 2,1% + 1% = 3,1%»): a ficha diz a taxa,
   não os campos que a compõem.
   Recebe: pid — o id do imóvel; lid — o id da hipoteca.
   Devolve: o HTML do corpo, ou vazio se a hipoteca já não existir. */
function mortFicha(pid,lid){
  const p=prop(pid),l=p?findLoan(p,lid):null;if(!l)return '';
  const viva=Number(l.outstanding)>0;
  const c=(viva&&Number(l.years)>0)?loanCalc(l):null;
  const a=c?amort(l):null;
  const faseFixa=l.type==='mista'?Math.round((Number(l.fixedYears)||0)*12)-loanMes(l):0;
  const depois=(a&&faseFixa>0)?a.rows[faseFixa]:null;
  return ficha([
    pode(pid,'house.edit')?null:{tipo:'nota',valor:'Hipoteca de <b>'+esc(p.name)+'</b>, um imóvel onde colaboras — a ficha é só de leitura.'},
    viva?null:{tipo:'nota',valor:'Crédito liquidado: já não há capital em dívida.'},
    viva?{rotulo:'Em dívida',valor:euro(l.outstanding)}:null,
    c?{rotulo:'Prestação mensal',valor:euro2(c.total)}:null,
    /* é o que explica porque é que a dívida desce tão devagar */
    c?{tipo:'bloco',rotulo:'A prestação por dentro',
      valor:'capital '+euro2(c.principal)+' · juros '+euro2(c.interest)+(l.stampTax===false?'':' · selo '+euro2(c.stamp))}:null,
    depois?{rotulo:'Depois da fase fixa',valor:euro2(depois.pay+depois.st)}:null,
    {rotulo:'Taxa',valor:esc(rateLabel(l))},
    l.start?{rotulo:'Início',valor:dPT(l.start)}:null,
    Number(l.years)>0?{rotulo:'Prazo',valor:l.years+(Number(l.years)===1?' ano':' anos')}:null,
    a?{rotulo:'Juros até ao fim',valor:euro(a.totInt+a.totStamp)}:null,
    l.stampTax===false?{tipo:'nota',valor:'Sem imposto do selo.'}:null,
    l.autoRec===false?{tipo:'nota',valor:'Não cria o movimento recorrente da prestação.'}:null,
  ]);
}
/* O «Pagamento de crédito» da ficha de uma hipoteca: abre o formulário do
   movimento com o imóvel e a hipoteca já escolhidos. Era um objeto literal
   escrito no atributo, que a gramática das ações não tem; faz o mesmo.
   Recebe: pid — o id do imóvel; lid — o id da hipoteca.
   Devolve: nada — abre o modal do movimento. */
function pagarCreditoDaHipoteca(pid,lid){
  txModal({kind:'loan',propId:pid,preset:{loanId:lid}});
}
/* A ficha de uma hipoteca: o que tocar numa hipoteca passa a abrir.
   Recebe: pid — o id do imóvel; lid — o id da hipoteca.
   Devolve: nada — abre a janela. */
function mortView(pid,lid){
  const p=prop(pid),l=p?findLoan(p,lid):null;if(!l)return;
  if(!pode(pid,'loan.view'))return;
  abrirFicha({
    titulo:()=>{const q=prop(pid),x=q?findLoan(q,lid):null;return x?loanName(x):'Hipoteca'},
    corpo:()=>mortFicha(pid,lid),
    menu:()=>{const q=prop(pid),x=q?findLoan(q,lid):null;if(!x)return '';
      const it=[];
      /* pagar abre o formulário do movimento: só com os Movimentos ligados nesta
         conta; a tabela da amortização é da hipoteca, e fica */
      const viva=Number(x.outstanding)>0&&!motivoCredito(pid);
      if(viva&&servicoLigado('transactions'))it.push(
        {label:'Pagamento de crédito',icon:'bank',toca:'camada',act:`pagarCreditoDaHipoteca('${jsq(pid)}','${jsq(lid)}')`});
      if(viva)it.push({label:'Amortização',icon:'trend',toca:'camada',act:`amortModal('${jsq(pid)}','${jsq(lid)}')`});
      if(pode(pid,'house.edit'))it.push({label:'Apagar hipoteca',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delMortFrom('${jsq(pid)}','${jsq(lid)}')`});
      return it.length?menu('fichaMort',it):''},
    editar:pode(pid,'house.edit')?{rotulo:'Editar',act:`mortModal('${jsq(pid)}','${jsq(lid)}')`}:null,
  });
}
/* editar uma hipoteca num modal próprio, gravando no imóvel
   Recebe: pid — o id do imóvel; lid — o id da hipoteca dentro dele.
   Devolve: nada — carrega o imóvel em pForm e abre o modal. */
function mortModal(pid,lid){
  pForm=normProp(JSON.parse(JSON.stringify(prop(pid))));
  mortOpen(lid,false);
}
/* Abre o modal da hipoteca `lid` do imóvel já carregado em pForm (newMort e
   mortModal tratam disso primeiro). Liga o repaint ao mortBody, põe o menu de
   apagar quando é edição, e define o onSave: numa hipoteca nova sem capital
   em dívida recusa; senão grava o imóvel inteiro na db, sincroniza os
   movimentos planeados das prestações e fecha.
   Recebe: lid — o id da hipoteca dentro de pForm; isNew — verdadeiro quando
   acabou de ser criada pelo newMort.
   Devolve: nada — abre o modal e deixa o onSave armado. */
function mortOpen(lid,isNew){
  foldState={};
  _propPaint=()=>mortBody(lid);
  const m=!isNew?menu('mort',[{label:'Apagar hipoteca',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delMort('${lid}')`}]):'';
  openModal(isNew?'Nova hipoteca':'Editar hipoteca',mortBody(lid),null,m);
  onSave=()=>{
    /* o propModal testa isto antes de gravar e este não testava: escondia-se
       o «Editar» e ficava o buraco, para quem lá chegasse por outro caminho */
    if(pForm.id&&prop(pForm.id)&&!pode(pForm.id,'house.edit'))return toast(fraseSemPerm('house.edit'));
    collectProp();
    const l=findLoan(pForm,lid);
    if(l&&!(capitalDoInicio(l,db.transactions)>0)&&isNew)return toast('Indica o capital em dívida.');
    if(l)l.name=l.name||l.bank||'Hipoteca';   /* a recorrência identifica-se pelo nome */
    /* a pergunta pelas prestações desde o início cria movimentos: com os
       Movimentos ligados; o planeado da prestação só com os Planeados */
    const historia=servicoLigado('transactions');
    const antes=historia?loanStartsAntes(prop(pForm.id)):null;   /* antes de trocar o objeto na db */
    const i=db.properties.findIndex(x=>x.id===pForm.id);
    if(i>-1)db.properties[i]=pForm;
    if(servicoLigado('recurring'))syncAllLoanRecs();
    save();closeModal();render();toast('Hipoteca guardada.');
    if(historia)perguntarPrestacoesEmFalta(pForm,antes)};
}
// O corpo do modal: o formulário da hipoteca `lid` dentro de pForm — o mesmo
// loanSect da ficha do imóvel. É também a função de repaint do modal.
// Recebe: lid — o id da hipoteca dentro de pForm.
// Devolve: o HTML do formulário, ou um aviso se a hipoteca já não existir.
function mortBody(lid){
  const i=(pForm.loans||[]).findIndex(x=>x.id===lid),l=pForm.loans[i];
  if(!l)return '<div class="hint">Hipoteca não encontrada.</div>';
  return `<div class="form">
    <div class="hint u-m-n2px-0-0">Imóvel: <b>${esc(pForm.name)}</b></div>
    ${loanSect(l,i)}</div>`;
}
// Apagar a partir da lista, onde ainda não há pForm: carrega o imóvel e delega no delMort.
// Recebe: pid — o id do imóvel; lid — o id da hipoteca.
// Devolve: nada — o delMort trata da confirmação e do resto.
function delMortFrom(pid,lid){pForm=normProp(JSON.parse(JSON.stringify(prop(pid))));delMort(lid)}
/* Apagar a hipoteca `lid` de pForm, com confirmação. As prestações já
   registadas não se apagam — só lhes tira o loanId, e o aviso diz quantas
   ficam assim; ficam com a marca loanOff, que as distingue para sempre das
   que nunca tiveram hipoteca (o cartão dos órfãos não as oferece à hipoteca
   sobrevivente: o capital delas já foi abatido, na hipoteca que se apagou).
   Os planeados que a pediam também não se apagam: perdem a hipoteca e a mesma
   marca, para o recLoanId não os apontar à seguinte pelas costas do
   utilizador — as listas passam a pedir-lhe que escolha. O planeado
   automático desta hipoteca é do syncAllLoanRecs, que o apaga logo a seguir.
   Limpa também os anexos dela do IndexedDB antes de gravar o imóvel e repintar.
   Recebe: lid — o id da hipoteca dentro de pForm.
   Devolve: nada — pede confirmação e, com o sim, grava, fecha e repinta. */
function delMort(lid){
  const l=findLoan(pForm,lid),used=db.transactions.filter(t=>t.loanId===lid).length;
  confirmModal('Apagar hipoteca',`Apagar “${esc(loanName(l))}”?${used?` ${used} prestação(ões) ficam sem hipoteca associada.`:''}`,()=>{
    db.transactions.forEach(t=>{if(t.loanId===lid){t.loanId=null;t.loanOff=true}});
    (db.recurring||[]).forEach(r=>{if(!r.auto&&r.tx&&r.tx.loanId===lid){r.tx.loanId=null;r.loanOff=true}});
    ((l||{}).files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    pForm.loans=pForm.loans.filter(x=>x.id!==lid);
    const i=db.properties.findIndex(x=>x.id===pForm.id);
    if(i>-1)db.properties[i]=pForm;
    if(servicoLigado('recurring'))syncAllLoanRecs();   /* o planeado automático desta hipoteca é dos Planeados */
    save();closeAllModals();render();toast('Hipoteca apagada.');
  });
}
/* ---- as prestações desde o início de uma hipoteca ----
   São movimentos (dos Movimentos) numa hipoteca (dos Créditos): a pergunta
   corre com esses dois serviços ligados, e só o planeado da prestação é dos
   Planeados. Estavam em planeados.js e só perguntavam com os Planeados
   ligados — sem eles, um crédito antigo ficava com o capital da data de
   início e o prazo inteiro a partir de hoje, sem a app o dizer. */
/* Retrato dos inícios das hipotecas de um imóvel, {idDaHipoteca: início},
   tirado ANTES de gravar — depois de db.properties[i]=pForm o prop(id) já é
   o próprio pForm e não há com que comparar.
   Recebe: p — o imóvel tal como está na db (objeto; aguenta null/undefined).
   Devolve: objeto {loanId: 'AAAA-MM-DD' ou ''}; vazio sem imóvel. */
function loanStartsAntes(p){const o={};loansOf(p).forEach(l=>{o[l.id]=l.start||''});return o}
/* Depois de gravar o imóvel: para cada hipoteca com dívida cujo início recuou
   (ou que é nova e começou no passado, ou cujo início acabou de ser
   preenchido) e à qual faltam prestações entre o início e a primeira
   registada, pergunta se se inserem — uma hipoteca de cada vez. Com os
   Planeados ligados, correr depois de syncAllLoanRecs, para a janela parar
   onde a recorrência começa (r.next). O mesPt («set 2026») é dos Movimentos,
   que quem chama garante ligados.
   Recebe: p — o imóvel acabado de gravar (objeto de db.properties); antes — o
   retrato de loanStartsAntes tirado antes da gravação ({} num imóvel novo).
   Devolve: nada — abre a(s) pergunta(s); ao confirmar, insere e grava. */
function perguntarPrestacoesEmFalta(p,antes){
  const hoje=today();antes=antes||{};
  const fila=loansOf(p).filter(l=>{
    if(!(Number(l.outstanding)>0)||!l.start||l.start>hoje)return false;
    if(!(l.id in antes))return true;            /* hipoteca nova com início no passado */
    return !antes[l.id]||l.start<antes[l.id];   /* início preenchido agora, ou recuou */
  }).map(l=>{const r=servicoLigado('recurring')?loanRecOf(l):null;return {l,lista:loanPrestacoesEmFalta(l,db.transactions,hoje,r?r.next:'')}}).filter(x=>x.lista.length);
  const seguinte=()=>{const x=fila.shift();if(!x)return;
    const {l,lista}=x,n=lista.length,de=lista[0].date,a=lista[n-1].date;
    /* o capital em dívida desce o capital destas — as que já estavam registadas também o abateram */
    const fim=Math.max(0,r2((Number(l.outstanding)||0)-sum(lista.map(x2=>x2.principal))));
    confirmModal('Prestações em falta',`“${esc(loanName(l))}” começou a ${esc(mesPt(de))} e não tem ${n===1?'a prestação de '+esc(mesPt(de))+' registada':n+' prestações registadas, de '+esc(mesPt(de))+' a '+esc(mesPt(a))} (${euro2(sum(lista.map(x2=>x2.amount)))} no total). Inserir agora? Ficam com os juros, o selo e o capital do plano, e o capital em dívida desce de <b>${euro2(l.outstanding)}</b> para <b>${euro2(fim)}</b>${fim>0?'':' — o crédito fica liquidado'}.`,
      ()=>{inserirPrestacoesEmFalta(p,l,lista);seguinte()});
  };
  seguinte();
}
/* Regista as prestações calculadas como movimentos normais, com a cara da
   recorrência automática e a etiqueta "Estimativa": cada uma abate o seu
   capital ao capital do início, como se fossem confirmadas uma a uma — o
   capital em dívida volta a derivar-se (credito.js:saldoEmDivida). Com os
   Planeados ligados, ressincroniza a recorrência (o prazo restante encurtou:
   a prestação muda; com o crédito liquidado, desaparece). Grava, redesenha e
   dá Anular em bloco — que tira os movimentos e repõe o capital.
   Recebe: p — o imóvel (objeto de db.properties); l — a hipoteca (objeto de
   p.loans); lista — as prestações de loanPrestacoesEmFalta.
   Devolve: nada — mexe em db.transactions, na hipoteca e em db.recurring, grava e redesenha. */
function inserirPrestacoesEmFalta(p,l,lista){
  if(!lista||!lista.length)return;
  fixarCapitalInicio(l,db.transactions);   /* os dados antigos: antes de os movimentos novos contarem */
  const capital=l.capitalInicio;
  const base=loanRecTx(p,l),os=ownersOfProp(p),paidBy=os.length===1?os[0]:null;
  const tags=db.settings.tags||(db.settings.tags=[]);if(tags.indexOf('Estimativa')<0)tags.push('Estimativa');
  const novos=lista.map(x=>normTx(Object.assign({},base,{date:x.date,amount:x.amount,interest:x.interest,stamp:x.stamp,principal:x.principal,fee:0,paidBy,tags:['Estimativa']})));
  db.transactions=db.transactions.concat(novos);
  acertarCapital(l);
  if(servicoLigado('recurring'))syncLoanRec(p,l);
  save();buildNav();render();
  const ids=novos.map(t=>t.id);
  comDesfazer(novos.length===1?'Prestação inserida.':novos.length+' prestações inseridas.',()=>{
    db.transactions=db.transactions.filter(t=>ids.indexOf(t.id)<0);
    /* volta a procurar a hipoteca: um sync entretanto pode ter trocado os objetos da db (como o delTx faz) */
    const x=anyLoan(l.id);if(!x)return;
    if(x.l.capitalInicio==null)x.l.capitalInicio=capital;
    acertarCapital(x.l);
    if(servicoLigado('recurring'))syncLoanRec(x.p,x.l);
  });
}
/* ---- a amortização: a projeção ano a ano de uma hipoteca ----
   É informação da hipoteca, e não toca em movimentos: vive nos Créditos, e
   abre com os Movimentos desligados. */
// Agrega o plano de amortização da hipoteca em linhas anuais (capital, juros, selo,
// taxa e dívida no fim do ano) e devolve também os totais de juros e selo até ao fim.
// Recebe: l — a hipoteca (objeto).
// Devolve: {yrs,totInt,totStamp} — yrs é a lista anual de {yr,int,st,cap,bal,rate} (valores em euros, rate em %).
function yearRows(l){
  const a=amort(l),yrs=[];let ai=0,as=0,ac=0,bal=l.outstanding,yr=YEAR;
  a.rows.forEach((r,i)=>{ai+=r.int;as+=r.st;ac+=r.cap;bal=r.bal;
    if((i+1)%12===0||i===a.rows.length-1){yrs.push({yr:yr++,int:ai,st:as,cap:ac,bal,rate:r.rate});ai=as=ac=0}});
  return {yrs,totInt:a.totInt,totStamp:a.totStamp};
}
let amortPid=null,amortLid='';
/* Modal da amortização de um imóvel: com uma hipoteca escolhida, gráfico e tabela ano a ano;
   sem escolha, todas as hipotecas com a linha do total. Abre sempre uma janela nova (a ficha
   e o toque longo de uma hipoteca já trazem a hipoteca escolhida); só o seletor da própria
   janela (onAmortSel) troca o conteúdo no sítio. Sem hipoteca dada, escolhe sozinho se só
   houver uma.
   Recebe: pid — o id do imóvel (string); lid (opcional) — o id da hipoteca a mostrar ('' mostra
   todas; sem ele, a única ou todas); trocar (opcional) — verdadeiro para trocar o conteúdo da
   janela aberta em vez de abrir outra.
   Devolve: nada — abre ou atualiza o modal. */
function amortModal(pid,lid,trocar){
  const p=prop(pid),ls=liveLoans(p);if(!ls.length)return;
  amortPid=pid;amortLid=lid==null?(ls.length===1?ls[0].id:''):lid;
  const opts=(ls.length>1?[{v:'',label:'Todas as hipotecas'}]:[]).concat(ls.map(l=>({v:l.id,label:loanName(l)})));
  let body='';
  if(amortLid){
    const l=findLoan(p,amortLid),r=yearRows(l);
    body=`${cLine([{name:'Em dívida',values:r.yrs.map(y=>y.bal),color:'#d6a34a'}],r.yrs.map(y=>String(y.yr)),{h:180,marks:decadeMarks(r.yrs[0]?r.yrs[0].yr:YEAR,r.yrs.length)})}
      <div class="tablewrap"><table class="table"><thead><tr><th>Ano</th><th>Taxa</th><th>Capital</th><th>Juros</th><th>Selo</th><th>Em dívida</th></tr></thead>
      <tbody>${r.yrs.map(y=>`<tr><td><b>${y.yr}</b></td><td>${esc(dec(y.rate))}%</td><td>${euro(y.cap)}</td><td class="neg">${euro(y.int)}</td><td class="amber">${euro(y.st)}</td><td>${euro(y.bal)}</td></tr>`).join('')}</tbody></table></div>
      <div class="hint">Juros ${euro(r.totInt)} + imposto do selo ${euro(r.totStamp)} = <b>${euro(r.totInt+r.totStamp)}</b>.</div>`;
  }else{
    const per=ls.map(l=>({l,r:yearRows(l)}));
    const nY=Math.max(...per.map(x=>x.r.yrs.length));
    const totals=[...Array(nY)].map((_,i)=>sum(per.map(x=>x.r.yrs[i]?x.r.yrs[i].bal:0)));
    body=`${cLine(per.map((x,i)=>({name:loanName(x.l),values:[...Array(nY)].map((_,k)=>x.r.yrs[k]?x.r.yrs[k].bal:0),color:PAL[i%PAL.length]}))
        .concat([{name:'Total',values:totals,color:'#d6a34a'}]),[...Array(nY)].map((_,i)=>String(YEAR+i)),{h:200,marks:decadeMarks(YEAR,nY)})}
      <div class="tablewrap"><table class="table"><thead><tr><th>Hipoteca</th><th>Em dívida</th><th>Prestação</th><th>Juros até ao fim</th><th>Selo</th></tr></thead>
      <tbody>${per.map(x=>`<tr><td><b>${esc(loanName(x.l))}</b><div class="small">${esc(RATE[x.l.type]||'')} · ${esc(x.l.years)} anos</div></td>
        <td>${euro(x.l.outstanding)}</td><td>${euro2(loanCalc(x.l).total)}</td><td class="neg">${euro(x.r.totInt)}</td><td class="amber">${euro(x.r.totStamp)}</td></tr>`).join('')}
        <tr><td><b>Total</b></td><td><b>${euro(debtOf(p))}</b></td><td><b>${euro2(payOf(p))}</b></td>
          <td class="neg"><b>${euro(sum(per.map(x=>x.r.totInt)))}</b></td><td class="amber"><b>${euro(sum(per.map(x=>x.r.totStamp)))}</b></td></tr>
      </tbody></table></div>`;
  }
  (trocar?setModal:openModal)('Amortização · '+p.name,`<div class="form">
    ${ls.length>1?`<label>Ver${sel('amSel',amortLid,opts,'onAmortSel','vista')}</label>`:''}
    ${body}</div>`,`<button class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>`);
}
// Mudou a hipoteca no select do modal da amortização: reconstrói o conteúdo.
// Devolve: nada — reconstrói o modal via amortModal.
function onAmortSel(){amortModal(amortPid,val('amSel'),true)}
/* ---- registo do serviço (servicos.js) ---- */
/* O menu de toque longo de uma hipoteca (data-lp "mort:<idImovel>:<idHipoteca>").
   Pagar abre o formulário do movimento, que é dos Movimentos: só com esse
   serviço ligado nesta conta. A amortização é dos Créditos e fica. Os outros
   serviços acrescentam as suas opções por lpExtras.
   Recebe: a — as partes do data-lp (['mort', idImovel, idHipoteca]).
   Devolve: nada — abre a folha de opções (ou nada, se a hipoteca já não existir). */
function lpHipoteca(a){
  const pid=a[1],lid=a[2],p=prop(pid),l=findLoan(p,lid);if(!l)return;
  const opts=pode(pid,'house.edit')?[{label:'Editar hipoteca',icon:'pen',act:()=>mortModal(pid,lid)}]:[];
  const viva=Number(l.outstanding)>0&&!motivoCredito(pid);
  if(viva&&servicoLigado('transactions'))opts.push({label:'Pagamento de crédito',icon:'bank',act:()=>chamarServico('transactions','txModal',{kind:'loan',propId:pid,preset:{loanId:lid}})});
  if(viva)opts.push({label:'Amortização',icon:'trend',act:()=>amortModal(pid,lid)});
  lpExtrasDe('mort',a).forEach(o=>opts.push(o));
  if(pode(pid,'house.edit'))opts.push({label:'Apagar hipoteca',icon:'trash',act:()=>delMortFrom(pid,lid)});
  return lpShow(loanName(l),opts);
}
/* O que os Créditos acrescentam ao menu de toque longo de um imóvel
   (lista-imoveis.js:lpImovel, por servicos.js:lpExtrasDe): «Pagamento de
   crédito» e «Amortização», quando o imóvel tem hipoteca viva e posso abater
   capital (pagar crédito mexe na hipoteca, que vive na ficha do imóvel: pede
   também «Editar a ficha» — motivoCredito). Pagar abre o formulário do
   movimento, que é dos Movimentos: só com esse serviço ligado nesta conta; a
   amortização é dos Créditos e fica.
   Recebe: a — as partes do data-lp (['prop', id]).
   Devolve: um array de {label, icon, act}; vazio quando não há o que acrescentar. */
function lpExtrasCreditosImovel(a){
  const id=a[1],p=prop(id);if(!p)return [];
  if(!liveLoans(p).length||motivoCredito(id))return [];
  return (servicoLigado('transactions')?[{label:'Pagamento de crédito',icon:'bank',act:()=>chamarServico('transactions','txModal',{kind:'loan',propId:id})}]:[])
    .concat([{label:'Amortização',icon:'trend',act:()=>amortModal(id)}]);
}
registarServico({id:'credits',vistas:{credits:'vCredits'},lp:{mort:'lpHipoteca'},lpExtras:{prop:'lpExtrasCreditosImovel'}});
