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
    +fab([{label:'Nova hipoteca',act:'newMort()'}]);
  const kpis=`<div class="grid" style="margin-bottom:14px">
    ${kpi('Em dívida',euro(tot),'amber',live.length+(live.length===1?' hipoteca ativa':' hipotecas ativas'))}
    ${kpi('Prestações',euro2(pay),'neg','por mês, no total')}
    ${kpi('Juros até ao fim',euro(sum(live.map(x=>{const a=amort(x.l);return a.totInt+a.totStamp}))),'neg','com imposto do selo')}</div>`;
  /* sem imóveis, o botão do canto só dava um aviso a dizer que faltava um
     imóvel: um caminho que acaba num aviso não é um caminho */
  if(!rows.length)return head+`<div class="empty"><b>Sem hipotecas</b>${db.properties.length
    ?'Uma hipoteca está sempre associada a um imóvel. Cria a primeira aqui ou na ficha do imóvel.'
    :'Uma hipoteca está sempre associada a um imóvel, e ainda não há nenhum.'+saida('Adicionar imóvel',"go('properties')",'ecra')}</div>`;
  if(!shown.length)return head+kpis+`<div class="empty"><b>Nada neste filtro</b><div style="margin-top:10px"><button type="button" class="btn sm" data-toca="vista" onclick="limparFiltroAtual()">${ic('x',13)} Limpar filtros</button></div></div>`;
  const mortCard=({p,l})=>{const live2=Number(l.outstanding)>0,c=live2?loanCalc(l):null;
    return `<div class="card tap" data-lp="mort:${esc(p.id)}:${esc(l.id)}" data-fk="mort:${esc(p.id)}:${esc(l.id)}" data-toca="camada" onclick="mortView('${jsq(p.id)}','${jsq(l.id)}')">
      <div class="row-between"><div style="min-width:0"><div class="title">${esc(loanName(l))} ${live2?'':'<span class="badge grey">liquidada</span>'}</div>
        <div class="small">${esc(p.name)} · ${RATE[l.type]} · ${rateLabel(l)}${(l.files||[]).length?' · '+l.files.length+' doc.':''}</div></div>
        <div style="display:flex;gap:8px;flex:0 0 auto;align-items:flex-start">
          <div style="text-align:right"><b>${euro(l.outstanding)}</b>${live2?`<div class="small">${euro2(c.total)}/mês</div>`:''}</div>
          ${kebab('mort:'+p.id+':'+l.id)}</div></div></div>`};
  const aviso=creditosOrfaos().filter(x=>!motivoCredito(x.p.id)).map(({p,l,txs})=>`<div class="card" style="margin-bottom:14px">
    <div class="title">${txs.length===1?'1 pagamento sem crédito associado':txs.length+' pagamentos sem crédito associado'}</div>
    <div class="small">${esc(p.name)} · ${euro2(sum(txs.map(t=>t.amount||0)))} · ${txs.length===1?'não abateu':'não abateram'} capital nenhum a ${esc(loanName(l))}.</div>
    <div class="toolbar" style="margin:9px 0 0"><button class="btn sm primary" data-toca="dados" onclick="associarOrfaos('${jsq(p.id)}','${jsq(l.id)}')">Associar à hipoteca ${esc(loanName(l))}</button></div></div>`).join('');
  const act=shown.filter(x=>Number(x.l.outstanding)>0),paid=shown.filter(x=>!(Number(x.l.outstanding)>0));
  const emLista=(id,xs)=>listaViva(id,xs.map(x=>({chave:'mort:'+x.p.id+':'+x.l.id,html:mortCard(x)})));
  const list=aviso+(act.length?emLista('creditos-ativos',act):'')
    +(paid.length?`<div class="section-title" style="margin-top:${act.length?18:0}px">Créditos antigos já pagos</div>`
      +emLista('creditos-pagos',paid)
      +`<div class="hint" style="margin-top:10px">Se editares um pagamento e a dívida voltar a subir, o crédito volta para a lista de cima.</div>`:'');
  return head+kpis+list+`<div class="hint" style="margin-top:12px">Também podes geri-las na ficha de cada imóvel.</div>`;
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
  const recusa=motivoCredito(pid);if(recusa)return toast(recusa);
  const p=prop(pid),l=p?findLoan(p,lid):null;if(!l)return;
  const txs=orfaosDe(pid);
  if(!txs.length)return toast('Já não há pagamentos por associar.');
  const antes=l.outstanding,copias={};txs.forEach(t=>{copias[t.id]=JSON.parse(JSON.stringify(t))});
  const recsAntes=JSON.parse(JSON.stringify(db.recurring||[]));
  confirmModal('Associar à hipoteca',`${txs.length===1?'1 pagamento de crédito':txs.length+' pagamentos de crédito'} de ${esc(p.name)} (${euro2(sum(txs.map(t=>t.amount||0)))} no total) ${txs.length===1?'ficou':'ficaram'} sem hipoteca associada e nunca ${txs.length===1?'abateu':'abateram'} capital. Associar a “${esc(loanName(l))}”? Cada um fica com os juros, o selo e o capital do plano na sua data, e o capital em dívida desce a partir dos <b>${euro2(antes)}</b> de agora.`,()=>{
    const feitos=[];
    for(const t of txs){
      const out0=l.outstanding;
      t.loanId=l.id;l._paidOfs=-1;applyLoan(t);delete l._paidOfs;
      if(!distribuicaoBate(t)){   /* o capital em dívida não chegou: desfaz-se este e páram os seguintes */
        l.outstanding=out0;
        ['interest','stamp','principal','fee'].forEach(k=>delete t[k]);
        Object.assign(t,JSON.parse(JSON.stringify(copias[t.id])));
        db.recurring=JSON.parse(JSON.stringify(recsAntes));   /* a tentativa chegou a liquidar o crédito: o applyLoan apagou o planeado */
        break;
      }
      feitos.push(t);
    }
    const fora=txs.length-feitos.length;
    if(!feitos.length)return toast('Só faltam '+euro2(antes)+' de capital em “'+loanName(l)+'”: o pagamento de '+euro2(txs[0].amount||0)+' não cabe. Associa-o à mão, ajustando a distribuição.');
    syncLoanRec(p,l);save();buildNav();render();
    const frase=(feitos.length===1?'Pagamento associado a “'+loanName(l)+'”.':feitos.length+' pagamentos associados a “'+loanName(l)+'”.')
      +(fora?' '+(fora===1?'1 ficou':fora+' ficaram')+' de fora: o capital em dívida acabou.':'');
    comDesfazer(frase,()=>{
      db.transactions=db.transactions.map(t=>copias[t.id]?normTx(JSON.parse(JSON.stringify(copias[t.id]))):t);
      db.recurring=JSON.parse(JSON.stringify(recsAntes));   /* o planeado que o applyLoan apagou volta como estava, e não um novo */
      /* volta a procurar a hipoteca: um sync entretanto pode ter trocado os objetos da db */
      const x=anyLoan(lid);if(x)x.l.outstanding=antes;
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
/* nova hipoteca: escolhe-se primeiro o imóvel (uma hipoteca tem sempre um)
   Devolve: nada — abre o seletor de imóvel e depois o modal da hipoteca nova
   (ou um toast, quando ainda não há imóveis). */
function newMort(){
  if(!db.properties.length)return toast('Cria primeiro um imóvel.');
  pickModal('Hipoteca de que imóvel?',db.properties.map(p=>({v:p.id,label:p.name,sub:loansOf(p).length?loansOf(p).length+' hipoteca(s)':'sem hipotecas',icon:'building'})),
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
    l.start?{rotulo:'Início',valor:esc(l.start)}:null,
    Number(l.years)>0?{rotulo:'Prazo',valor:l.years+(Number(l.years)===1?' ano':' anos')}:null,
    a?{rotulo:'Juros até ao fim',valor:euro(a.totInt+a.totStamp)}:null,
    l.stampTax===false?{tipo:'nota',valor:'Sem imposto do selo.'}:null,
    l.autoRec===false?{tipo:'nota',valor:'Não cria o movimento recorrente da prestação.'}:null,
  ]);
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
      if(Number(x.outstanding)>0&&!motivoCredito(pid))it.push(
        {label:'Pagamento de crédito',icon:'bank',toca:'camada',act:`txModal(null,'loan','${jsq(pid)}',null,null,{loanId:'${jsq(lid)}'})`},
        {label:'Amortização',icon:'trend',toca:'camada',act:`amortModal('${jsq(pid)}','${jsq(lid)}')`});
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
    if(l&&!(l.outstanding>0)&&isNew)return toast('Indica o capital em dívida.');
    if(l)l.name=l.name||l.bank||'Hipoteca';   /* a recorrência identifica-se pelo nome */
    const antes=loanStartsAntes(prop(pForm.id));   /* antes de trocar o objeto na db */
    const i=db.properties.findIndex(x=>x.id===pForm.id);
    if(i>-1)db.properties[i]=pForm;
    syncAllLoanRecs();save();closeModal();render();toast('Hipoteca guardada.');
    perguntarPrestacoesEmFalta(pForm,antes)};
}
// O corpo do modal: o formulário da hipoteca `lid` dentro de pForm — o mesmo
// loanSect da ficha do imóvel. É também a função de repaint do modal.
// Recebe: lid — o id da hipoteca dentro de pForm.
// Devolve: o HTML do formulário, ou um aviso se a hipoteca já não existir.
function mortBody(lid){
  const i=(pForm.loans||[]).findIndex(x=>x.id===lid),l=pForm.loans[i];
  if(!l)return '<div class="hint">Hipoteca não encontrada.</div>';
  return `<div class="form">
    <div class="hint" style="margin:-2px 0 0">Imóvel: <b>${esc(pForm.name)}</b></div>
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
    syncAllLoanRecs();save();closeAllModals();render();toast('Hipoteca apagada.');
  });
}
