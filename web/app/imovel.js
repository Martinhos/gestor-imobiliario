/* ================= IMÓVEL ================= */
let pForm={};
/* Abre o modal de criar/editar imóvel. Com id, trabalha sobre uma cópia
   profunda do imóvel (nada muda na base até Guardar); sem id, começa um novo.
   Ao guardar valida o nome, escreve em db.properties e repinta a app.
   Recebe: id (opcional) — o id do imóvel a editar; sem id, cria um imóvel novo.
   Devolve: nada — abre o modal e deixa a gravação pendurada em onSave. */
function propModal(id){
  /* num imóvel onde só colaboro sem «Editar a ficha», a ficha é só de leitura */
  if(id&&!pode(id,'house.edit'))return propView(id);
  foldState={};_propPaint=null;
  pForm=normProp(id?JSON.parse(JSON.stringify(prop(id))):null);
  const m=id&&imvPossoApagar(id)?menu('prop',[{label:'Apagar imóvel',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delProp('${id}')`}]):'';
  openModal(id?'Editar imóvel':'Novo imóvel',propBody(),null,m);
  paintThumbs(pForm.photos);
  onSave=()=>{
    collectProp();
    if(pForm.id&&prop(pForm.id)&&!pode(pForm.id,'house.edit'))return toast(fraseSemPerm('house.edit'));
    if(!pForm.name.trim())return falhaCampo('p_name','Dá um nome ao imóvel.');
    /* o campo vive numa dobra que pode estar fechada (display:none): o falhaCampo
       não chega a um campo escondido, por isso abre-se a dobra primeiro */
    if(pForm.freguesiaCodigo&&!/^\d{6}$/.test(pForm.freguesiaCodigo)){
      const f=document.getElementById('fold_reg');if(f&&!f.classList.contains('open'))toggleFold('reg');
      return falhaCampo('p_freguesiaCodigo','O código da freguesia tem 6 dígitos.');
    }
    /* o capital de cada hipoteca é obrigatório (o asterisco de loanSect); o
       grupo das hipotecas está sempre aberto, e o falhaCampo chega ao campo */
    const semCapital=servicoLigado('credits')?(pForm.loans||[]).find(l=>!(capitalDoInicio(l,db.transactions)>0)):null;
    if(semCapital)return falhaCampo('l_out_'+semCapital.id,'Indica o capital em dívida.');
    (pForm.loans||[]).forEach(l=>{l.name=l.name||l.bank||'Hipoteca'});   /* a recorrência identifica-se pelo nome */
    /* a pergunta pelas prestações desde o início (creditos.js) cria movimentos numa hipoteca:
       corre com os Créditos e os Movimentos ligados nesta conta; o planeado da prestação só
       com os Planeados */
    const historia=servicoLigado('credits')&&servicoLigado('transactions');
    const antes=historia?loanStartsAntes(prop(pForm.id)):null;   /* antes de trocar o objeto na db */
    const i=db.properties.findIndex(x=>x.id===pForm.id);
    if(i<0)db.properties.push(pForm);else db.properties[i]=pForm;
    /* os planeados da ficha (IMI, condomínio, seguro) e os das hipotecas são dos Planeados */
    if(servicoLigado('recurring')){syncPropRecs(pForm);syncAllLoanRecs()}
    save();closeModal();render();toast(id?'Imóvel atualizado.':'Imóvel adicionado.');
    if(historia)perguntarPrestacoesEmFalta(pForm,antes);
  };
}
/* O corpo da ficha de um imóvel: o que se sabe sobre ele, para ler, como a
   prancheta M-Imovel — a capa (a primeira foto, ou o mosaico) com quantas
   fotos há, a morada e os selos, os donos com as quotas e quem deve a quem,
   a transferência pendente (imvTrfNaFicha), as ações rápidas, o cartão dos números, os por confirmar, os quartos ou o
   contrato, as hipotecas, as despesas fixas, as tarefas, os dados registais
   e fiscais e o anúncio. O título é o da janela; o «Editar» é o do rodapé, e
   só existe para quem pode (propView).

   O que é sempre visível (morada, destino, quartos, donos) e o resto conforme
   o cargo — fotos com file.view, valores e a linha fiscal com report.view,
   hipotecas com loan.view. Nunca as quotas nem os comentários dos donos a quem
   colabora: o servidor já não os manda. E conforme os serviços ligados nesta
   conta: o estado e os contratos são dos Contratos, as hipotecas dos Créditos,
   as despesas fixas e os por confirmar dos Planeados, as ações de cada um
   do seu — desligados, a ficha não os mostra.
   Recebe: id — o id do imóvel.
   Devolve: o HTML do corpo, ou vazio se o imóvel já não existir. */
function propFicha(id){
  const p=prop(id);if(!p)return '';
  const v={ct:pode(id,'contract.view')&&servicoLigado('contracts'),loan:pode(id,'loan.view')&&servicoLigado('credits'),
    rep:pode(id,'report.view'),file:pode(id,'file.view')};
  const c=cargoDe(id);
  const cartoes=[imvPorConfirmar(p,c),imvQuartos(p,v.ct),imvContratos(p,v.ct),v.loan?imvHipotecas(p):'',imvFixas(p,c),
    tfCartaoDaFicha('imovel',id),imvRegistais(p,v.rep),
    p.listing?`<div class="card imv-sec"><div class="imv-sec-cab"><h3>Anúncio</h3></div><p class="imv-texto">${esc(p.listing)}</p></div>`:''].filter(Boolean).join('');
  return `<div class="imv-ficha">
    ${imvCapaDaFicha(p,v.file)}
    ${imvTopoDaFicha(p,v.ct,c)}
    ${imvTrfNaFicha(p)}
    ${c.dono?'':imvNotaDeColaborador(p,c)}
    ${imvAcoesRapidas(p,c)}
    ${imvNumerosDaFicha(p,v)}
    ${cartoes?`<div class="imv-grelha">${cartoes}</div>`:''}
  </div>`;
}
/* A capa da ficha: a primeira foto (o depois do propView pinta-a, pelo id
   th_) por cima do mosaico do imóvel, e o botão que abre a galeria com
   quantas fotos há.

   Com fotos, a capa toda abre a galeria: quem vê uma fotografia toca nela, e
   só o «N fotos» no canto abria. É um botão à parte, irmão do «N fotos» e por
   baixo dele (nunca um botão dentro de outro), a cobrir a capa. Para o
   teclado e para o leitor de ecrã a porta continua a ser o «N fotos», que diz
   quantas há: o da capa fica fora da ordem do Tab (tabindex -1), para não
   haver duas paragens seguidas que fazem o mesmo, mas tem nome.
   Recebe: p — o imóvel; vFile — se o cargo deixa ver as fotos.
   Devolve: o HTML da capa. */
function imvCapaDaFicha(p,vFile){
  const fs=vFile?(p.photos||[]):[],f=fs[0],abre=`data-toca="camada" data-click="imvGaleria('${jsq(p.id)}')"`;
  return `<div class="imv-fcapa imv-mosaico ${imvMosaico(p)}${f?' pcover':''}"${f?` id="th_${esc(f.id)}"`:''}>
    ${fs.length?`<button type="button" class="imv-capa-abre" tabindex="-1" aria-label="Ver as fotos" ${abre}></button>
    <button type="button" class="imv-fotos-btn" ${abre}>${ic('photo',16)} ${fs.length} foto${fs.length===1?'':'s'}</button>`:''}</div>`;
}
/* A morada, os selos (o estado, o destino, os contratos por começar, os
   colaboradores) e a linha dos donos: as quotas e, entre donos, quem deve a
   quem (saldos.js:settlePlan). As quotas e as contas são dos donos: a quem
   colabora só os nomes que o servidor mandou.
   Recebe: p — o imóvel; vCt — se o estado se pode mostrar; c — o cargo (acessos.js:cargoDe).
   Devolve: o HTML do topo. */
function imvTopoDaFicha(p,vCt,c){
  const st=vCt?propStatus(p):null;
  const destino=p.use==='proprio'?(st?'':'Uso próprio'):'Arrendamento · '+(p.rentalMode==='quartos'?'por quartos':'imóvel inteiro');
  const futuros=vCt?contractsOf(p.id).filter(x=>ctEstado(x)==='futuro').length:0;
  const selos=[st?`<span class="badge ${imvCorDoEstado(st.key)}">${esc(st.label)}</span>`:'',destino?`<span class="badge grey">${destino}</span>`:'',
    futuros?`<span class="badge">${futuros===1?'1 contrato por começar':futuros+' contratos por começar'}</span>`:'',seloColaboradores(p)].join('');
  const donos=(p.ownerIds||[]).map(owner).filter(Boolean);
  let linha='';
  if(c.dono&&donos.length){
    const sh2=donos.length>1?sharesOf(p):null;
    linha=donos.map(o=>esc(o.name)+(sh2?' '+pct(sh2[o.id]||0,0):'')).join(' · ');
    const primeiro=oid=>{const o=owner(oid);return o?o.name.split(' ')[0]:''};
    const contas=donos.length>1?settlePlan(ownerBalances(p.id)).filter(t=>primeiro(t.from)&&primeiro(t.to))
      .map(t=>`${esc(primeiro(t.from))} deve ${euro2(t.amount)} a ${esc(primeiro(t.to))}`):[];
    if(contas.length)linha+=` <span class="small">· ${contas.join(' · ')}</span>`;
  }else if(ownerNames(p))linha=esc(ownerNames(p));
  return `<div class="imv-ftopo">
    <p class="imv-fmorada">${esc(p.address||'Sem morada')}</p>
    ${selos?`<div class="imv-selos">${selos}</div>`:''}
    ${linha?`<p class="imv-donos num">${linha}</p>`:''}</div>`;
}
/* A nota de quem colabora: de quem é o imóvel, o cargo e o que ele deixa
   fazer aqui. O «Editar a ficha» é o «Editar» do rodapé.
   Recebe: p — o imóvel; c — o cargo (acessos.js:cargoDe).
   Devolve: o HTML da nota. */
function imvNotaDeColaborador(p,c){
  const id=p.id,dono=p._sharedFrom||(p._ownerUserId?nomeUtilizador(p._ownerUserId):'');
  const podes=frasePodesNoImovel(id),acoes=acoesNoImovel(id).filter(a=>a.perm!=='house.edit');
  return `<div class="hint imv-nota">${dono?'Imóvel de <b>'+esc(dono)+'</b>. ':''}És colaborador${c.nome?' como <b>'+esc(c.nome)+'</b>':''}${pode(id,'house.edit')?'.':acoes.length?' — os dados do imóvel são só de leitura.':' — a ficha é só de leitura.'}`
    +(podes?`<span class="imv-nota-podes">${esc(podes)}</span>`:'')+'</div>';
}
/* As ações rápidas da ficha, em chips, só as que o cargo e os serviços
   ligados deixam: à frente e aceso, «Movimentos · N» (os do imóvel); ao
   dono, «Novo contrato» (num imóvel de arrendamento), «Registar despesa» e
   «Pagamento de crédito» (com hipoteca viva e podendo abater capital —
   acessos.js:motivoCredito); a quem colabora, as do cargo
   (acessos.js:acoesNoImovel). Um
   chip que muda de ecrã fecha antes a ficha, senão ela ficava por cima.
   Recebe: p — o imóvel; c — o cargo (acessos.js:cargoDe).
   Devolve: o HTML da fila de chips, ou ''. */
function imvAcoesRapidas(p,c){
  const id=p.id,q=jsq(id),a=[];
  if(c.dono){
    if(servicoLigado('contracts')&&p.use==='investimento'&&pode(id,'contract.add'))a.push({rotulo:'Novo contrato',icon:'plus',toca:'camada',act:`ctModal(null,'${q}')`});
    if(servicoLigado('transactions')&&pode(id,'tx.add'))a.push({rotulo:'Registar despesa',icon:'dn',toca:'camada',act:`despesaNoImovel('${q}')`});
    if(servicoLigado('credits')&&servicoLigado('transactions')&&liveLoans(p).length&&!motivoCredito(id))
      a.push({rotulo:'Pagamento de crédito',icon:'bank',toca:'camada',act:`pagamentoNoImovel('${q}')`});
  }else acoesNoImovel(id).filter(x=>x.perm!=='house.edit').forEach(x=>a.push({rotulo:x.rotulo,icon:x.icon,toca:x.toca,act:x.act}));
  /* o «Movimentos · N» vai à frente e aceso: é o que mais se procura na
     ficha, e no fim da fila, que rola de lado, ficava fora de vista */
  if(servicoLigado('transactions')&&pode(id,'tx.view')){const n=db.transactions.filter(t=>t.propertyId===id).length;
    a.unshift({rotulo:'Movimentos'+(n?' · '+n:''),aria:'Ver os movimentos deste imóvel'+(n?' ('+n+')':''),icon:'lista',toca:'ecra',destaque:true,act:`verMovimentosDoImovel('${q}')`})}
  if(!a.length)return '';
  return `<div class="chips-fila imv-acoes" role="group" aria-label="Ações rápidas">${a.map(x=>
    `<button type="button" class="chip${x.destaque?' on destaque':''}"${x.aria?` aria-label="${esc(x.aria)}"`:''} data-toca="${x.toca}" data-click="${x.toca==='ecra'?'closeAllModals();':''}${x.act}">${ic(x.icon,16)} ${esc(x.rotulo)}</button>`).join('')}</div>`;
}
/* O cartão dos números da ficha, cada um só se o cargo e os serviços o
   deixam ver: a renda em vigor e a yield (dos Contratos), o valor de mercado
   e — sem renda — o de aquisição (os valores), e o que está em dívida nas
   hipotecas (dos Créditos).
   Recebe: p — o imóvel; v — {ct, rep, loan}.
   Devolve: o HTML do cartão, ou '' sem nenhum número para mostrar. */
function imvNumerosDaFicha(p,v){
  const rent=v.ct?rentOf(p):0,ls=v.loan?liveLoans(p):[],cel=[];
  if(rent>0)cel.push(['Renda em vigor',euro2(rent)+'<span class="small">/mês</span>']);
  if(rent>0&&v.rep&&p.value)cel.push(['Yield',pct(rent*12/p.value)]);
  if(v.rep)cel.push(['Valor de mercado',p.value?euro(p.value):'—']);
  if(v.rep&&!(rent>0))cel.push(['Valor de aquisição',p.purchase?euro(p.purchase):'—']);
  if(ls.length)cel.push(['Em dívida · '+(ls.length===1?'1 hipoteca':ls.length+' hipotecas'),euro(debtOf(p))]);
  if(!cel.length)return '';
  return `<div class="card imv-numeros num">${cel.map(([k,x])=>`<div class="imv-cel"><span class="small">${k}</span><b class="disp">${x}</b></div>`).join('')}</div>`;
}
/* O cabeçalho de um cartão da ficha: o título e, à direita, uma nota curta
   ou um selo.
   Recebe: titulo — o texto (por escapar); dir (opcional) — HTML do que vai à direita.
   Devolve: o HTML do cabeçalho. */
function imvCab(titulo,dir){return `<div class="imv-sec-cab"><h3>${esc(titulo)}</h3>${dir||''}</div>`}
/* Os por confirmar deste imóvel (dos Planeados), cada um com o selo do
   atraso e o «Confirmar» de um toque para quem pode; tocar no texto da linha
   revê-o antes (planeados.js:confirmRec). Usa as perguntas dos Planeados
   (recActive, recIsLate, recusaConfirmar, recSemCredito, recCreditoPago) e
   nada antes de se saber o estado do servidor.
   O alvo de «rever» é o bloco do texto, e o «Confirmar» é irmão dele, fora:
   com a linha inteira tocável (o tornarFocavel dá-lhe role="button"), o botão
   ficava dentro de outro botão, e para um leitor de ecrã os filhos de um
   botão são só texto — o «Confirmar» podia nem ser anunciado.
   Recebe: p — o imóvel; c — o cargo (acessos.js:cargoDe).
   Devolve: o HTML do cartão, ou '' sem nada por confirmar. */
function imvPorConfirmar(p,c){
  if(!servicoLigado('recurring')||!sabemosOEstado())return '';
  if(!c.dono&&!pode(p.id,'rec.view'))return '';
  const rs=recActive().filter(r=>r.tx&&r.tx.propertyId===p.id);
  if(!rs.length)return '';
  const linhas=rs.map(r=>{
    const late=recIsLate(r),conf=!recusaConfirmar(r)&&!recSemCredito(r)&&!recCreditoPago(r);
    return `<div class="imv-linha imv-pend">
      <div class="imv-linha-txt tap" data-toca="camada" data-click="confirmRec('${jsq(r.id)}')"><b>${esc(r.name)}</b><span class="small num">${dPT(r.next)}${r.until&&r.until!==r.next?' – '+dPT(r.until):''}${r.tx.amount?' · '+euro2(r.tx.amount):''}</span>
        <span class="badge${late?' red':''}">${late?'Em atraso':'Por confirmar'}</span></div>
      ${conf?`<button type="button" class="btn sm primary" data-toca="dados" data-click="quickConfirmRec('${jsq(r.id)}')">Confirmar</button>`:''}</div>`;
  }).join('');
  return `<div class="card imv-sec">${imvCab('Por confirmar',`<span class="small num">${rs.length}</span>`)}${linhas}</div>`;
}
/* Uma linha de contrato num cartão da ficha: o quarto (ou o rótulo), quem lá
   mora e até quando (ou desde quando), a renda; tocar abre a ficha do
   contrato (contrato.js:ctView). Um contrato que ainda não começou diz-o.
   Recebe: ct — o contrato; rotulo — o nome do quarto ('' num imóvel inteiro:
   a linha leva então o nome de quem lá mora).
   Devolve: o HTML da linha. */
function imvLinhaContrato(ct,rotulo){
  const futuro=ctEstado(ct)==='futuro';
  const quando=futuro?(ct.start?'a partir de '+dPT(ct.start):''):ct.end?'até '+dPT(ct.end):ct.start?'desde '+dPT(ct.start):'';
  const sub=(rotulo?[esc(ctNames(ct)),quando]:[quando]).filter(Boolean).join(' · ');
  return `<div class="imv-linha tap" data-toca="camada" data-click="ctView('${jsq(ct.id)}')">
    <div class="imv-linha-txt"><b>${esc(rotulo||ctNames(ct))}</b>${sub?`<span class="small num">${sub}</span>`:''}${futuro?'<span class="badge">Por começar</span>':''}</div>
    <b class="num">${euro2(ct.rent)}</b><span class="seta">${ic('chevR',18)}</span></div>`;
}
/* O cartão dos quartos de um imóvel por quartos: quantos estão arrendados e,
   quarto a quarto, o contrato (ou «Livre», com o «Novo contrato» e o
   «Marcar visita» para quem pode — a visita já com ESSE quarto, que foi onde
   se tocou: com a casa inteira por omissão, num imóvel com dois quartos
   livres era preciso escolher de novo). Sem poder ver os contratos, só os nomes
   dos quartos — o que o servidor não manda não se adivinha.
   Recebe: p — o imóvel; vCt — se o cargo e os serviços deixam ver os contratos.
   Devolve: o HTML do cartão, ou ''. */
function imvQuartos(p,vCt){
  const rooms=p.rooms||[];
  if(p.use!=='investimento'||p.rentalMode!=='quartos'||!rooms.length)return '';
  if(!vCt)return `<div class="card imv-sec">${imvCab('Quartos',`<span class="small num">${rooms.length}</span>`)}${rooms.map(r=>`<div class="imv-linha"><div class="imv-linha-txt"><b>${esc(r.name||'Quarto')}</b></div></div>`).join('')}</div>`;
  const vivos=contractsOf(p.id).filter(ctVivo),q=jsq(p.id);
  const podeCt=servicoLigado('contracts')&&pode(p.id,'contract.add'),podeVis=servicoLigado('visits')&&pode(p.id,'visit.add');
  let ocupados=0;
  const linhas=rooms.map(r=>{
    const ct=vivos.find(x=>x.roomId===r.id&&isActive(x))||vivos.find(x=>x.roomId===r.id);
    if(ct){if(isActive(ct))ocupados++;return imvLinhaContrato(ct,r.name||'Quarto')}
    const botoes=[podeVis?`<button type="button" class="btn sm" data-toca="camada" data-click="marcarVisitaNoImovel('${q}','${jsq(r.id)}')">Marcar visita</button>`:'',
      podeCt?`<button type="button" class="btn sm" data-toca="camada" data-click="contratoNoQuarto('${q}','${jsq(r.id)}')">Novo contrato</button>`:''].join('');
    return `<div class="imv-linha imv-livre"><div class="imv-linha-txt"><b>${esc(r.name||'Quarto')}</b><span class="small">Sem contrato</span></div>
      <span class="badge amber">Livre</span>${botoes?`<div class="imv-botoes">${botoes}</div>`:''}</div>`;
  });
  vivos.filter(x=>!x.roomId||!rooms.some(r=>r.id===x.roomId)).forEach(x=>linhas.push(imvLinhaContrato(x,'Sem quarto')));
  return `<div class="card imv-sec">${imvCab('Quartos',`<span class="small num">${ocupados} de ${rooms.length} arrendados</span>`)}${linhas.join('')}</div>`;
}
/* O cartão do contrato de um imóvel arrendado inteiro: os contratos em vigor
   e os que ainda não começaram, um por linha. Por quartos, é o cartão dos
   quartos que os mostra.
   Recebe: p — o imóvel; vCt — se o cargo e os serviços deixam ver os contratos.
   Devolve: o HTML do cartão, ou '' sem contratos. */
function imvContratos(p,vCt){
  if(!vCt||p.use!=='investimento'||p.rentalMode==='quartos')return '';
  const vivos=contractsOf(p.id).filter(ctVivo);if(!vivos.length)return '';
  const nA=vivos.filter(isActive).length,nF=vivos.length-nA;
  const sub=[nA?nA+' em vigor':'',nF?nF+' por começar':''].filter(Boolean).join(' · ');
  return `<div class="card imv-sec">${imvCab(vivos.length===1?'Contrato':'Contratos',`<span class="small">${sub}</span>`)}${vivos.map(x=>imvLinhaContrato(x,'')).join('')}</div>`;
}
/* Um cartão por hipoteca (dos Créditos): o tipo de taxa, a taxa e as
   prestações por pagar, a prestação e o que está em dívida hoje, e os botões
   do plano de amortização (creditos.js:amortModal) e da ficha da hipoteca
   com os documentos (creditos.js:mortView).
   Recebe: p — o imóvel.
   Devolve: o HTML dos cartões, ou '' sem hipotecas. */
function imvHipotecas(p){
  const q=jsq(p.id);
  return loansOf(p).map(l=>{
    const viva=Number(l.outstanding)>0,calc=viva?loanCalc(l):null,nd=(l.files||[]).length,lq=jsq(l.id);
    return `<div class="card imv-sec">${imvCab('Hipoteca · '+loanName(l),`<span class="badge loan">${esc(RATE[l.type]||'Taxa')}</span>`)}
      <div class="imv-sec-corpo">
        <p class="small num">${esc(rateLabel(l))}${calc?' · '+calc.n+' prestações por pagar':' · liquidada'}</p>
        ${calc?`<div class="imv-par num"><div><span class="small">Prestação</span><b>${euro2(calc.total)}<span class="small">/mês</span></b></div>
          <div><span class="small">Em dívida hoje</span><b>${euro(l.outstanding)}</b></div></div>`:''}
        <div class="imv-botoes">${viva?`<button type="button" class="btn sm" data-toca="camada" data-click="amortModal('${q}','${lq}')">Plano de amortização</button>`:''}
          <button type="button" class="btn sm" data-toca="camada" data-click="mortView('${q}','${lq}')">${nd?nd+(nd===1?' documento':' documentos'):'Ver hipoteca'}</button></div>
      </div></div>`;
  }).join('');
}
/* O cartão das despesas fixas (o IMI, o condomínio e o seguro da ficha), que
   viram planeados: uma linha por despesa com quando se paga e quanto. É dos
   Planeados, e vê-o quem é dono ou vê planeados.
   Recebe: p — o imóvel; c — o cargo (acessos.js:cargoDe).
   Devolve: o HTML do cartão, ou '' sem nenhuma despesa fixa. */
function imvFixas(p,c){
  if(!servicoLigado('recurring')||!(c.dono||pode(p.id,'rec.view')))return '';
  const curto=m=>nomeDoMes(m).slice(0,3);
  const imi=p.imi>0?imiPrestacoes(p.imi).map(x=>curto(x.mes)).join(' · '):'';
  const linhas=[p.imi>0?['IMI',imi,euro2(p.imi)+'/ano']:null,p.condominio>0?['Condomínio','dia 1',euro2(p.condominio)+'/mês']:null,
    p.seguro>0?['Seguro',p.seguroMes?'fim de '+curto(p.seguroMes):'uma vez por ano',euro2(p.seguro)+'/ano']:null].filter(Boolean);
  if(!linhas.length)return '';
  return `<div class="card imv-sec">${imvCab('Despesas fixas','<span class="small">viram planeados</span>')}
    ${linhas.map(([n,q,x])=>`<div class="imv-linha imv-fixa num"><span class="imv-fixa-n">${n}</span><span class="small">${q}</span><b>${x}</b></div>`).join('')}</div>`;
}
/* O cartão dos dados registais e fiscais: o registo (freguesia, concelho,
   distrito, tipo, tipologia, fração, andar, descrição, artigo, classe e
   validade do certificado energético) e, para quem vê os valores, o fiscal —
   o VPT (reparte os gastos quando só se arrenda parte do imóvel) e o dia em
   que o imóvel foi comprado (o Anexo G).
   Recebe: p — o imóvel; vRep — se o cargo deixa ver os valores.
   Devolve: o HTML do cartão, ou '' sem nada escrito. */
function imvRegistais(p,vRep){
  const reg=[p.freguesia||p.parish,p.freguesiaCodigo?'freguesia n.º '+p.freguesiaCodigo:'',p.concelho,p.distrito,
    p.tipoPredio==='U'?'urbano':p.tipoPredio==='R'?'rústico':'',p.tipologia,
    p.fraction?'fração '+p.fraction:'',p.floor,p.registry?'descrição predial n.º '+p.registry:'',p.matrix?'artigo '+p.matrix:'',p.energyClass?'classe '+p.energyClass:'',
    p.energyValid?'certificado válido até '+dPT(p.energyValid):''].filter(Boolean).map(esc).join(' · ');
  const fisco=vRep?[p.vpt?'VPT '+euro(p.vpt):'',p.purchaseDate?'adquirido a '+dPT(p.purchaseDate):''].filter(Boolean).join(' · '):'';
  if(!reg&&!fisco)return '';
  return `<div class="card imv-sec">${imvCab('Dados registais e fiscais')}<div class="imv-sec-corpo">
    ${reg?`<p class="small num"><b class="imv-rot">Registo</b> ${reg}</p>`:''}${fisco?`<p class="small num"><b class="imv-rot">Fiscal</b> ${fisco}</p>`:''}</div></div>`;
}
/* A galeria das fotos de um imóvel, numa janela: as miniaturas em grelha, e
   tocar numa abre-a (componentes.js:openMeta). É o botão da capa da ficha.
   Recebe: id — o id do imóvel.
   Devolve: nada — abre a janela. */
function imvGaleria(id){
  const p=prop(id);if(!p||!pode(id,'file.view'))return;
  const fs=p.photos||[];if(!fs.length)return;
  openModal('Fotos · '+p.name,`<div class="imv-galeria">${fs.map((f,i)=>
    `<button type="button" class="imv-gfoto pcover" id="th_${esc(f.id)}" data-toca="camada" data-click="openMeta('${jsq(f.id)}')" aria-label="${esc(f.name||('Foto '+(i+1)))}">${i===0?'<span class="imv-nfotos">capa</span>':''}</button>`).join('')}</div>`,
    `<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>`);
  paintThumbs(fs);
}
/* «Registar despesa» da ficha: o formulário da despesa já com o imóvel (é
   dos Movimentos — com o serviço desligado nesta conta avisa e não abre).
   Recebe: pid — o id do imóvel.
   Devolve: nada — abre o formulário. */
function despesaNoImovel(pid){
  if(!pode(pid,'tx.add'))return toast(fraseSemPerm('tx.add'));
  chamarServico('transactions','txModal',{kind:'expense',propId:pid});
}
/* «Pagamento de crédito» da ficha: o formulário do pagamento já com o imóvel
   e, havendo uma só hipoteca viva, com ela. Abate capital, e por isso pede
   também «Editar a ficha» (acessos.js:motivoCredito).
   Recebe: pid — o id do imóvel.
   Devolve: nada — abre o formulário (ou diz porque não). */
function pagamentoNoImovel(pid){
  const rc=motivoCredito(pid);if(rc)return toast(rc);
  const ls=liveLoans(prop(pid));
  chamarServico('transactions','txModal',ls.length===1?{kind:'loan',propId:pid,preset:{loanId:ls[0].id}}:{kind:'loan',propId:pid});
}
/* «Novo contrato» na linha de um quarto livre: o formulário do contrato já
   com o imóvel E o quarto escolhido. Sem isto o botão prometia o quarto e
   abria no «Imóvel inteiro», e quem gravava sem reparar criava um contrato do
   imóvel todo num imóvel por quartos. O quarto acende-se pelo chip do
   formulário (contrato.js:ctEscolheQuarto), sem repintar; e só se o
   formulário abriu mesmo — o ctModal pode sair cedo com um aviso, e aí a
   janela de cima continua a ser a ficha. O quarto pré-escolhido não conta como
   alteração de quem escreve: o retrato da janela tira-se outra vez.
   Recebe: pid — o id do imóvel; rid — o id do quarto.
   Devolve: nada — abre o formulário do contrato. */
function contratoNoQuarto(pid,rid){
  const antes=modalTop();
  ctModal(null,pid);
  const L=modalTop();
  if(!L||L===antes||!cForm||contract(cForm.id)||cForm.propertyId!==pid)return;   /* um contrato novo: o id ainda não está na base */
  const p=prop(pid);if(!p||!(p.rooms||[]).some(r=>r.id===rid))return;
  cForm.roomId=rid;ctEscolheQuarto(rid);
  if(L.el)L.snap=modalSnap(L.el);
}
/* «Ver movimentos» da ficha: os Movimentos filtrados por este imóvel.
   Recebe: pid — o id do imóvel.
   Devolve: nada — muda de ecrã. */
function verMovimentosDoImovel(pid){
  go('transactions');
  setTimeout(()=>{if(tab==='transactions'){txProp=pid;render()}},0);
}
/* A ficha de um imóvel: o que tocar num imóvel passa a abrir.

   Era só para quem colabora sem poder editar; toda a gente apanhava, ao
   tocar, um formulário de vinte e um campos com o «Apagar imóvel» encostado
   ao título. Agora tocar lê, e editar é um passo deliberado — o botão do
   rodapé, que só existe para quem pode.

   A capa pinta-se na camada DESTA ficha, e não na de cima: o render repinta
   as fichas abertas (componentes.js:refrescarFichas) também quando há outra
   janela por cima — a lista das tarefas, a galeria, o plano de amortização —,
   e o paintThumbs sem raiz procurava a capa nessa janela, e a ficha ficava
   com o mosaico e «3 fotos». Na primeira pintura, dentro do abrirFicha, a
   camada ainda não está guardada, mas aí a de cima é a própria ficha. O ⋯
   da janela é o imvMenuDaFicha (o «Transferir propriedade» e o «Apagar
   imóvel»), lido de novo a cada repintura: um pedido de transferência
   pendente tira o «Transferir» até ser cancelado ou respondido.
   Recebe: id — o id do imóvel.
   Devolve: nada — abre a janela. */
function propView(id){
  const p=prop(id);if(!p)return;
  let camada=null;
  camada=abrirFicha({
    titulo:()=>{const x=prop(id);return x?x.name:'Imóvel'},
    corpo:()=>propFicha(id),
    menu:()=>{const it=imvMenuDaFicha(id);return it.length?menu('fichaProp',it):''},
    editar:pode(id,'house.edit')?{rotulo:'Editar',act:`propModal('${jsq(id)}')`}:null,
    depois:()=>{if(pode(id,'file.view')){const x=prop(id);if(x)paintThumbs(x.photos,camada&&camada.el?camada.el:undefined)}},
  });
}
/* O nome de um mês por extenso, para o menu do mês do seguro e a ficha.
   Recebe: m — o mês (1–12).
   Devolve: o nome em minúsculas (texto); '' fora de 1–12. */
function nomeDoMes(m){return ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][m-1]||''}
/* A frase das prestações do IMI, que o grupo das despesas fixas escreve
   enquanto se escreve o valor: «IMI 400,00 €/ano em 2 prestações de
   200,00 €, no fim de maio e de novembro, para confirmares na data.» As
   prestações são as da lei (planeados.js:imiPrestacoes): só se pede com os
   Planeados ligados, que é quando o grupo existe (fixasSect).
   Recebe: v — o IMI do ano (número ou o texto do campo).
   Devolve: a frase (texto, por escapar); '' sem IMI. */
function imvFraseImi(v){
  const imi=Math.round((typeof v==='number'?v:num(v))*100)/100;
  if(!(imi>0)||!servicoLigado('recurring'))return '';
  const ps=imiPrestacoes(imi),meses=listaE(ps.map((x,i)=>(i?'de ':'')+nomeDoMes(x.mes)));
  if(ps.length===1)return `IMI ${euro2(imi)}/ano numa só prestação, no fim de ${meses}, para confirmares na data.`;
  const iguais=ps.every(x=>Math.abs(x.amount-ps[0].amount)<0.005);
  return `IMI ${euro2(imi)}/ano em ${ps.length} prestações ${iguais?'de '+euro2(ps[0].amount):'('+listaE(ps.map(x=>euro2(x.amount)))+')'}, no fim de ${meses}, para confirmares na data.`;
}
/* O campo do IMI mudou: reescreve a frase das prestações por baixo.
   Recebe: v — o texto do campo.
   Devolve: nada — mexe só na frase. */
function imvImiMudou(v){
  const e=document.getElementById('imv_imi_frase');if(!e)return;
  const t=imvFraseImi(v);e.textContent=t;e.classList.toggle('u-d-none',!t);
}
/* Um valor em euros como entra num campo do formulário: com a vírgula
   decimal da app («154277,2») e não com o ponto do JavaScript («154277.2»),
   arredondado ao cêntimo — com três casas, o num() lia «154277,255» como
   milhares. Os inteiros ficam iguais («100000»), e o num() lê os dois.
   Recebe: v — o valor (número; aguenta vazio e nulo).
   Devolve: o texto do campo; '' sem valor. */
function imvEurosNoCampo(v){const n=Number(v)||0;return n?dec(r2(n)):''}
/* O grupo «Despesas fixas do imóvel» do formulário: o IMI, o condomínio, o
   seguro e o mês dele, e por baixo a frase das prestações do IMI. Cada valor
   cria um planeado (planeados.js:syncPropRecs), e a explicação diz em que
   datas — é dos Planeados, e sem esse serviço na conta não se pede o que não
   criaria nada.
   Devolve: o HTML do grupo (texto); '' sem os Planeados. */
function fixasSect(){
  if(!servicoLigado('recurring'))return '';
  const p=pForm,meses=[{v:0,label:'O mês em que o guardares'}].concat([...Array(12)].map((_,i)=>({v:i+1,label:nomeDoMes(i+1)})));
  const frase=imvFraseImi(p.imi);
  /* o seguro e o mês dele numa fila à parte: no telemóvel ela passa a uma
     coluna (estilos.css:.imv-2col-largo), porque «O mês em que o guardares»
     não cabe em meia coluna e cortado não se lê */
  return `<div class="sect imv-grupo">
      ${imvCab('Despesas fixas do imóvel','<span class="small">viram planeados</span>')}
      <div class="imv-2col">
        <label>IMI (€/ano)<input id="p_imi" type="text" inputmode="decimal" value="${imvEurosNoCampo(p.imi)}" placeholder="Opcional" data-input="imvImiMudou(this.value)"></label>
        <label>Condomínio (€/mês)<input id="p_condominio" type="text" inputmode="decimal" value="${imvEurosNoCampo(p.condominio)}" placeholder="Opcional"></label></div>
      <div class="imv-2col imv-2col-largo">
        <label>Seguro (€/ano)<input id="p_seguro" type="text" inputmode="decimal" value="${imvEurosNoCampo(p.seguro)}" placeholder="Opcional"></label>
        <label>Mês do seguro${sel('p_seguroMes',p.seguroMes||0,meses,'','rascunho')}</label></div>
      <p class="imv-frase num${frase?'':' u-d-none'}" id="imv_imi_frase" aria-live="polite">${esc(frase)}</p>
      <div class="hint">Cada valor cria um planeado que pede confirmação na data, e o valor vive aqui: apagar o planeado apaga-o daqui.
        O IMI sai nas prestações da lei: até 100 € numa só, em maio; de 100 a 500 € em maio e novembro; acima de 500 € em maio, agosto e novembro — no último dia do mês.
        O condomínio no dia 1 de cada mês; o seguro uma vez por ano, no fim do mês escolhido.</div></div>`;
}
/* Ponto de extensão da secção dos proprietários do formulário do imóvel.
   Com contas, os proprietários são os utilizadores e as quotas mudam por
   proposta (cloud/utilizadores.js:cwOwnersBlock): a nuvem põe aqui a função
   que escreve a secção dela, e o formulário pede-lha. Devolvendo '', fica a
   secção daqui (donosSect). Era uma expressão regular por cima do HTML do
   formulário, que deixou de casar sem erro nenhum quando o título mudou. */
let donosDoFormulario=null;
/* A secção dos proprietários do formulário: a da nuvem, quando há conta
   (donosDoFormulario), ou a daqui, com as quotas escritas à mão.
   Devolve: o HTML do grupo. */
function seccaoDosDonos(){
  if(donosDoFormulario){try{const h=donosDoFormulario();if(h)return h}catch(e){}}
  return donosSect();
}
/* O grupo «Proprietários e quota-parte» sem contas: um proprietário por
   linha com a percentagem (em branco, partes iguais — o exemplo diz quanto) e
   o remover, a frase que explica a divisão, e os botões de adicionar um que
   já existe e de criar um novo (este dos Proprietários: só com o serviço
   ligado nesta conta).
   Devolve: o HTML do grupo. */
function donosSect(){
  const p=pForm,owners=(p.ownerIds||[]).map(owner).filter(Boolean);
  const shares=sharesOf(p),custom=hasShares(p);
  const sumSh=sum(owners.map(o=>Number((p.ownerShares||{})[o.id])||0));
  return `<div class="sect imv-grupo">
    ${imvCab('Proprietários e quota-parte')}
    ${owners.length?`<div class="imv-donos-lista">${owners.map(o=>`<div class="imv-dono">
        <span class="imv-dono-nome">${esc(o.name)}</span>
        <span class="imv-pct"><input id="p_share_${o.id}" type="text" inputmode="decimal" value="${(p.ownerShares||{})[o.id]!=null?dec(p.ownerShares[o.id]):''}" placeholder="Ex: ${dec(Math.round(shares[o.id]*1000)/10)}" aria-label="Quota de ${esc(o.name)} (%, opcional)" data-input="liveShares()"><span aria-hidden="true">%</span></span>
        <button type="button" class="btn ghost so-icone" aria-label="Remover ${esc(o.name)}" data-toca="rascunho" data-click="delPropOwner('${o.id}')">${ic('x',18)}</button></div>`).join('')}</div>`:''}
    <div class="hint" id="shareHint">${shareHint(owners,custom,sumSh)}</div>
    <div class="imv-botoes">
      <button type="button" class="btn sm" data-toca="camada" data-click="addPropOwner()">${ic('plus',16)} Adicionar proprietário</button></div>
  </div>`;
}
/* Um segmentado de duas escolhas do formulário (o destino, o tipo de
   arrendamento), com a frase da escolha feita por baixo. O realce é uma peça
   à parte (.segm-polegar), posta na escolha pela classe i0/i1, que desliza de
   uma escolha para a outra (imovel.js:imvSegDeslizar) — o fundo trocado de um
   botão para o outro era um salto. A peça leva o contorno no cobalto e o
   texto aceso o --accent-text (estilos.css, a secção ajustes-v40d 1.1): vê-se
   no claro, no escuro e quando o browser escurece a página à força.
   O campo é uma peça do grupo que cresce (data-parte, continuidade.js:partesDe):
   quando o de cima muda e este fica, fica no sítio.
   Recebe: rotulo — o nome do grupo; ops — [[valor, rótulo, frase]]; atual — o
   valor escolhido; fn — o nome da função que muda a escolha.
   Devolve: o HTML do campo. */
function imvSegmentado(rotulo,ops,atual,fn){
  const on=ops.find(o=>o[0]===atual)||ops[0],i=ops.indexOf(on);
  return `<div class="imv-campo" data-parte="seg-${fn}"><div class="flabel" id="imv_seg_${fn}">${rotulo}</div>
    <div class="segm desliza" id="imv_segm_${fn}" role="radiogroup" aria-labelledby="imv_seg_${fn}"><span class="segm-polegar i${i}" aria-hidden="true"></span>${ops.map(([k,lb])=>
      `<button type="button" role="radio" aria-checked="${k===on[0]?'true':'false'}" class="${k===on[0]?'on':''}" data-toca="rascunho" data-click="${fn}('${k}')">${lb}</button>`).join('')}</div>
    <div class="hint imv-seg-frase">${on[2]}</div></div>`;
}
/* Constrói o HTML do formulário do imóvel a partir de pForm, em grupos como
   a prancheta M-NovoImovel: o nome, a morada, o destino e o tipo de
   arrendamento (com os quartos); os proprietários e as quotas-partes; os
   valores; as hipotecas; as despesas fixas; e, recolhidos, as fotos, os dados
   registais e fiscais, e o anúncio com os comentários. Só lê — quem escreve de
   volta é collectProp().
   Devolve: string de HTML do formulário, pronta a inserir com innerHTML. */
function propBody(){
  const p=pForm,ls=p.loans||[];
  return `<div class="form imv-form">
    <div class="sect imv-grupo">
      <label data-parte="nome">Nome <span class="req">*</span><input id="p_name" value="${esc(p.name)}" placeholder="Ex: T2 Lisboa" autocomplete="off"></label>
      <label data-parte="morada">Morada<input id="p_addr" value="${esc(p.address)}" placeholder="Opcional" autocomplete="off"></label>
      ${imvSegmentado('Destino do imóvel',[['investimento','Arrendamento','Para render: tem contratos e rendas.'],['proprio','Uso próprio','Para ti ou para a família, sem rendas.']],p.use,'setUse')}
      ${p.use==='investimento'?imvSegmentado('Tipo de arrendamento',[['inteiro','Imóvel inteiro','Um contrato só, para o imóvel todo.'],['quartos','Por quartos','Um contrato por quarto.']],p.rentalMode,'setMode'):''}
      ${p.use==='investimento'&&p.rentalMode==='quartos'?`<div class="imv-campo" data-parte="quartos"><div class="flabel">Quartos (nome opcional)</div>
        <div class="imv-quartos">${(p.rooms||[]).map(r=>`<div class="roomrow" data-parte="q-${esc(r.id)}">
          <input id="p_room_${r.id}" value="${esc(r.name)}" placeholder="Ex: Quarto da varanda" aria-label="Nome do quarto (opcional)" autocomplete="off">
          <button type="button" class="btn ghost so-icone" aria-label="Remover ${esc(r.name||'o quarto')}" data-toca="rascunho" data-click="delRoom('${r.id}')">${ic('x',18)}</button></div>`).join('')}
          <button type="button" class="btn sm imv-mais" data-parte="q-mais" data-toca="rascunho" data-click="addRoom()">${ic('plus',16)} Adicionar quarto</button></div></div>`:''}
    </div>
    ${seccaoDosDonos()}
    <div class="sect imv-grupo">
      ${imvCab('Valores')}
      <div class="imv-2col">
        <label>Valor de mercado (€)<input id="p_value" type="text" inputmode="decimal" value="${imvEurosNoCampo(p.value)}" placeholder="Opcional"></label>
        <label>Valor de aquisição (€)<input id="p_purchase" type="text" inputmode="decimal" value="${imvEurosNoCampo(p.purchase)}" placeholder="Opcional"></label></div>
      <label>Data de aquisição<input id="p_purchaseDate" type="date" value="${p.purchaseDate||''}"></label>
      <div class="hint imv-colado">Serve para o Anexo G, se um dia venderes.</div>
    </div>
    ${!servicoLigado('credits')?'':`<div class="sect imv-grupo">
      ${imvCab('Hipotecas',`<span class="small num">${ls.length?(ls.length+(ls.length===1?' hipoteca · ':' hipotecas · ')+euro2(payOf(p))+'/mês'):'nenhuma'}</span>`)}
      ${ls.map((l,i)=>loanSect(l,i)).join('')}
      ${ls.length>1?`<div class="card u-bg-v-tint u-p-12px">
        <div class="stat u-pt-0 u-b-0"><span>Total das prestações</span><b class="u-fs-16px">${euro2(payOf(p))}/mês</b></div>
        <div class="hint">${euro(debtOf(p))} em dívida no total.</div></div>`:''}
      <button type="button" class="btn imv-mais" data-toca="rascunho" data-click="addLoan()">${ic('plus',18)} ${ls.length?'Adicionar outra hipoteca':'Adicionar hipoteca'}</button>
      <div class="hint">${ls.length?'Um imóvel pode ter várias hipotecas em simultâneo. Todas contam para a dívida e para o LTV.':'Crédito à aquisição ou outro. Simulamos a prestação enquanto escreves; se o crédito vem de trás, propomos registar as prestações em falta.'}</div>
    </div>`}
    ${fixasSect()}
    ${fold('photos','Fotos',fileBlock('',p.photos||[],'p_photoin','propAddPhotos','delPropPhoto',{photos:true,move:1,hint:'A primeira foto é a capa do imóvel. Arrasta pelo puxador para reordenar.'}),{icon:'photo',open:!!(p.photos||[]).length,summary:(p.photos||[]).length?p.photos.length+' foto'+(p.photos.length===1?'':'s'):'a primeira é a capa'})}
    ${fold('reg','Dados registais e fiscais',`
      <div class="row">
        <label>Freguesia<input id="p_freguesia" value="${esc(p.freguesia||p.parish||'')}" placeholder="Opcional"></label>
        <label>Concelho<input id="p_concelho" value="${esc(p.concelho||'')}" placeholder="Opcional"></label></div>
      <div class="row3">
        <label>Distrito<input id="p_distrito" value="${esc(p.distrito||'')}" placeholder="Opcional"></label>
        <label>Código da freguesia (opcional)<input id="p_freguesiaCodigo" value="${esc(p.freguesiaCodigo||'')}" inputmode="numeric" maxlength="6" placeholder="Ex: 110623" autocomplete="off"></label>
        <label>Tipo de prédio${sel('p_tipoPredio',p.tipoPredio||'',[{v:'',label:'—'},{v:'U',label:'Urbano'},{v:'R',label:'Rústico'}],'','rascunho')}</label></div>
      <div class="row">
        <label>Tipologia${sel('p_tipologia',p.tipologia||'',[{v:'',label:'—'}].concat(['T0','T1','T2','T3','T4','T5','T6'].map(x=>({v:x,label:x}))),'','rascunho')}</label>
        <label>VPT (€)<input id="p_vpt" type="text" inputmode="decimal" value="${imvEurosNoCampo(p.vpt)}" placeholder="Opcional"></label></div>
      <div class="row3">
        <label>Fração autónoma (opcional)<input id="p_fraction" value="${esc(p.fraction||'')}" placeholder="Ex: A"></label>
        <label>Andar (opcional)<input id="p_floor" value="${esc(p.floor||'')}" placeholder="Ex: 2.º"></label>
        <label>Descrição predial n.º (opcional)<input id="p_registry" value="${esc(p.registry)}" placeholder="Ex: 15937"></label></div>
      <div class="row3">
        <label>Rua<input id="p_street" value="${esc(p.street||'')}" placeholder="Opcional"></label>
        <label>Número da porta<input id="p_doorNumber" value="${esc(p.doorNumber||'')}" placeholder="Opcional"></label>
        <label>Código postal (opcional)<input id="p_postalCode" value="${esc(p.postalCode||'')}" placeholder="Ex: 1200-195"></label></div>
      <label>Localidade<input id="p_locality" value="${esc(p.locality||'')}" placeholder="Opcional"></label>
      <div class="row">
        <label>Artigo matricial (opcional)<input id="p_matrix" value="${esc(p.matrix)}" placeholder="Ex: 4651"></label>
        <label>Licença de utilização (opcional)<input id="p_licence" value="${esc(p.licence)}" placeholder="Ex: Alvará n.º 26/2013"></label></div>
      <div class="row3">
        <label>Certificado energético (opcional)<input id="p_energyCert" value="${esc(p.energyCert)}" placeholder="Ex: SCE395442330"></label>
        <label>Classe (opcional)<input id="p_energyClass" value="${esc(p.energyClass)}" placeholder="Ex: D"></label>
        <label>Válido até<input id="p_energyValid" type="date" value="${p.energyValid||''}"></label></div>
      <div class="hint">Usados nas cláusulas do contrato em PDF e no resumo do Anexo F. Deixa em branco o que não se aplicar — as frases correspondentes são omitidas.
        O código da freguesia (6 dígitos), o tipo de prédio e o artigo vêm da caderneta predial ou da nota de cobrança do IMI; o Anexo F pede-os em cada linha do quadro das rendas.
        O VPT serve para repartir os gastos quando só se arrenda parte do imóvel.</div>`,
      {icon:'recibo',summary:[esc(p.freguesia||p.parish||''),p.freguesiaCodigo?'freguesia n.º '+esc(p.freguesiaCodigo):'',p.registry?'descrição predial n.º '+esc(p.registry):''].filter(Boolean).join(' · ')||'para o contrato e o Anexo F'})}
    ${fold('text','Anúncio e comentários',`<label>Descrição para anúncios<textarea id="p_listing" placeholder="Opcional">${esc(p.listing||'')}</textarea></label>
      ${richEditor('Comentários dos proprietários','p_notes',p.notes,'Opcional')}
      <div class="hint">Os comentários dos proprietários nunca chegam a quem colabora.</div>`,
      {icon:'lista',open:!!(p.listing||p.notes),summary:p.listing||p.notes?'com texto':'os comentários ficam entre os donos'})}
    <div class="hint">A renda, as datas e os inquilinos ficam no contrato, não aqui.</div></div>`;
}
// Secção de uma hipoteca no formulário: campos consoante o tipo de taxa,
// caixa de simulação e documentos. O i serve só para o título por omissão.
// Recebe: l — a hipoteca (objeto de normLoan); i — a posição dela na lista (a
// contar do zero), para o título "Hipoteca N" quando não tem nome.
// Devolve: string de HTML da secção, pronta a inserir com innerHTML.
function loanSect(l,i){
  return `<div class="sect">
    <div class="sect-head"><span class="ic">${ic('bank',18)}</span><b>${esc(l.name||'Hipoteca '+(i+1))}</b><span class="spacer"></span>
      <button type="button" class="btn sm danger so-icone" aria-label="Apagar a hipoteca" data-toca="dados" data-risco="destroi" data-click="delLoan('${l.id}')">${ic('trash',16)}</button></div>
    <div class="row">
      <label>Finalidade<input id="l_name_${l.id}" value="${esc(l.name)}" placeholder="Opcional" autocomplete="off" data-input="liveLoan('${l.id}')"></label>
      <label>Banco<input id="l_bank_${l.id}" value="${esc(l.bank)}" placeholder="Opcional" autocomplete="off"></label></div>
    <div class="row3">
      <label>Capital em dívida (€) <span class="req">*</span><input id="l_out_${l.id}" type="text" inputmode="decimal" value="${imvEurosNoCampo(capitalDoInicio(l,db.transactions))}" placeholder="Ex: 150000" data-input="liveLoan('${l.id}')"></label>
      <label>Prazo (anos)<input id="l_years_${l.id}" type="text" inputmode="numeric" value="${esc(l.years||'')}" placeholder="Opcional" data-input="liveLoan('${l.id}')"></label>
      <label>Início<input id="l_start_${l.id}" type="date" value="${esc(l.start||'')}"></label></div>
    <div class="hint u-mt-n4px">À data de início: as prestações registadas abatem-no, e a caixa abaixo diz o que falta hoje. Se o crédito já vem de trás, ao guardar a app propõe registar as prestações desde então — e o capital desce com elas. Prazo em branco: 30 anos.</div>
    <div><div class="flabel">Tipo de taxa</div>
      <div class="seg c3">${[['fixa','lock','Fixa','não muda'],['mista','split','Mista','fixa e depois variável'],['variavel','wave','Variável','Euribor + spread']]
        .map(([k,ico,lb,sb])=>`<button type="button" class="opt ${l.type===k?'on':''}" data-toca="rascunho" data-click="setLType('${l.id}','${k}')"><span class="ic">${ic(ico,18)}</span><b>${lb}</b><small>${sb}</small></button>`).join('')}</div></div>
    ${l.type==='fixa'?`<div class="row">
      <label>Taxa anual TAN (%)<input id="l_rate_${l.id}" type="text" inputmode="decimal" value="${l.rate?dec(l.rate):''}" placeholder="Opcional" data-input="liveLoan('${l.id}')"></label>
      <label>Comissão de amortização (%)<input id="l_ffix_${l.id}" type="text" inputmode="decimal" value="${l.amortFeeFix!=null?dec(l.amortFeeFix):''}" placeholder="Opcional"></label></div>`:''}
    ${l.type==='mista'?`<div class="row">
        <label>Anos com taxa fixa<input id="l_fy_${l.id}" type="text" inputmode="numeric" value="${l.fixedYears||''}" placeholder="Opcional" data-input="liveLoan('${l.id}')"></label>
        <label>Taxa fixa (%)<input id="l_rate_${l.id}" type="text" inputmode="decimal" value="${l.rate?dec(l.rate):''}" placeholder="Opcional" data-input="liveLoan('${l.id}')"></label></div>
      <div class="hint u-mt-n4px">Anos com taxa fixa em branco: 5.</div>`:''}
    ${l.type!=='fixa'?`<div class="row3">
      <label>Indexante${sel('l_index_'+l.id,l.index,['3m','6m','12m'].map(x=>({v:x,label:'Euribor '+x})),'liveLoanAll','rascunho')}</label>
      <label>Indexante (%)<input id="l_eur_${l.id}" type="text" inputmode="decimal" value="${l.euribor?dec(l.euribor):''}" placeholder="Opcional" data-input="liveLoan('${l.id}')"></label>
      <label>Spread (%)<input id="l_spr_${l.id}" type="text" inputmode="decimal" value="${l.spread?dec(l.spread):''}" placeholder="Opcional" data-input="liveLoan('${l.id}')"></label></div>
    <div class="row">
      ${l.type==='mista'?`<label>Comissão amort. — fase fixa (%)<input id="l_ffix_${l.id}" type="text" inputmode="decimal" value="${l.amortFeeFix!=null?dec(l.amortFeeFix):''}" placeholder="Opcional"></label>`:''}
      <label>Comissão amort. — taxa variável (%)<input id="l_fvar_${l.id}" type="text" inputmode="decimal" value="${l.amortFeeVar!=null?dec(l.amortFeeVar):''}" placeholder="Opcional"></label></div>`:''}
    <label class="check"><input type="checkbox" id="l_stamp_${l.id}" ${l.stampTax?'checked':''} data-change="toggleStamp('${l.id}')">
      Pagar imposto do selo sobre os juros (${dec(db.settings.stampPct??4)}%)</label>
    <div class="hint u-mt-n4px">Créditos mais antigos podem não o ter. Desliga se a tua prestação não o inclui.</div>
    <div class="card u-bg-v-tint" id="loanBox_${l.id}">${loanBox(l)}</div>
    ${fileBlock('FINE e outros documentos',l.files||[],'l_filein_'+l.id,'loanAddFiles','delLoanFile',
      {arg:l.id,addLabel:'Anexar documento',hint:'Ficha de Informação Normalizada Europeia, escritura, plano de amortização, cartas do banco.'})}
    <label class="check"><input type="checkbox" id="l_autorec_${l.id}" ${l.autoRec!==false?'checked':''}> Criar movimento recorrente da prestação</label>
    <div class="hint u-mt-n4px">Todos os meses a app pede para confirmar a prestação em Planeados, já com a hipoteca associada.</div>
    </div>`;
}
/* Lê os campos do DOM de volta para pForm. Tolerante a campos ausentes: as
   secções dobradas podem não estar no DOM e nesses casos ficam os valores
   que lá estavam. Chamar sempre antes de mexer em pForm ou de repintar.
   Devolve: nada — atualiza pForm com o que está no ecrã. */
function collectProp(){
  const p=pForm,has=id=>!!document.getElementById(id);
  if(has('p_name'))p.name=val('p_name');
  if(has('p_addr'))p.address=val('p_addr');
  if(has('p_value'))p.value=num(val('p_value'));
  if(has('p_purchase'))p.purchase=num(val('p_purchase'));
  if(has('p_vpt'))p.vpt=Math.max(0,num(val('p_vpt')));
  ['imi','condominio','seguro'].forEach(k=>{if(has('p_'+k))p[k]=Math.max(0,Math.round(num(val('p_'+k))*100)/100)});
  if(has('p_seguroMes'))p.seguroMes=Math.min(12,Math.max(0,Math.round(num(val('p_seguroMes')))));
  ['parish','freguesia','concelho','distrito','freguesiaCodigo','tipoPredio','tipologia','purchaseDate','fraction','floor','street','doorNumber','postalCode','locality','registry','matrix','licence','energyCert','energyClass','energyValid'].forEach(k=>{
    const e=document.getElementById('p_'+k);if(e)p[k]=e.value});
  p.freguesiaCodigo=String(p.freguesiaCodigo||'').trim();   /* a validação ao guardar conta dígitos, não espaços */
  if(document.getElementById('p_notes'))p.notes=richVal('p_notes');
  if(has('p_listing'))p.listing=val('p_listing');
  (p.rooms||[]).forEach(r=>{const e=document.getElementById('p_room_'+r.id);if(e)r.name=e.value});
  photoLerNomes();
  const shr={};(p.ownerIds||[]).forEach(oid=>{const e=document.getElementById('p_share_'+oid);
    if(e&&String(e.value).trim()!==''){const v=numTaxa(e.value);if(v>=0)shr[oid]=v}else if(!e&&p.ownerShares&&p.ownerShares[oid]!=null&&p.ownerShares[oid]>=0)shr[oid]=p.ownerShares[oid]});
  p.ownerShares=shr;
  (p.loans||[]).forEach(l=>{
    const g=k=>document.getElementById('l_'+k+'_'+l.id);
    if(g('stamp'))l.stampTax=chk('l_stamp_'+l.id);
    if(g('autorec'))l.autoRec=chk('l_autorec_'+l.id);
    (l.files||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
    if(g('name'))l.name=val('l_name_'+l.id);
    if(g('bank'))l.bank=val('l_bank_'+l.id);
    /* o campo é o capital da data de início; o capital em dívida deriva dele (fim deste ciclo) */
    if(g('out'))l.capitalInicio=Math.max(0,num(val('l_out_'+l.id))||0);
    if(g('years'))l.years=num(val('l_years_'+l.id))||30;
    if(g('start'))l.start=val('l_start_'+l.id);
    /* as percentagens leem-se pelo numTaxa: numa taxa «0,875» são 0,875,
       nunca 875 (o num() é para euros, onde três casas são milhares) */
    if(g('rate'))l.rate=numTaxa(val('l_rate_'+l.id));
    if(g('eur'))l.euribor=numTaxa(val('l_eur_'+l.id));
    if(g('spr'))l.spread=numTaxa(val('l_spr_'+l.id));
    if(g('fy'))l.fixedYears=num(val('l_fy_'+l.id))||5;
    if(g('index'))l.index=val('l_index_'+l.id);
    if(g('ffix'))l.amortFeeFix=Math.max(0,numTaxa(val('l_ffix_'+l.id)));
    if(g('fvar'))l.amortFeeVar=Math.max(0,numTaxa(val('l_fvar_'+l.id)));
    /* o capital em dívida não se escreve: é o do início menos o que os pagamentos registados abateram */
    l.outstanding=saldoEmDivida(l,db.transactions);
  });
}
// Frase que explica a divisão das quotas-partes: partes iguais, soma 100%,
// restante para quem não tem percentagem, ou soma diferente normalizada.
// Recebe: owners — os proprietários do imóvel (objetos de pessoa, já filtrados);
// custom — se há percentagens escritas à mão (booleano); sumSh — a soma dessas
// percentagens (número, em %).
// Devolve: string de HTML com a frase, para pôr no hint das quotas.
function shareHint(owners,custom,sumSh){
  if(!owners.length)return 'Sem proprietários. Podes filtrar a visão geral por proprietário e as contas entre donos dividem-se pela quota-parte.';
  if(!custom)return owners.length>1?`Partes iguais (${dec(Math.round(1000/owners.length)/10)}% cada). Escreve as percentagens para uma divisão diferente.`:'Proprietário único.';
  const sh2=sharesOf(pForm),parts=owners.map(o=>`${esc(o.name.split(' ')[0])} ${pct(sh2[o.id],0)}`).join(' · ');
  if(Math.abs(sumSh-100)<0.01)return `Soma 100%. ${parts}`;
  return (sumSh<100?`Quem não tem percentagem fica com o restante. `:`Soma ${dec(Math.round(sumSh*100)/100)}%, normalizado. `)+parts;
}
// oninput das percentagens: relê o formulário e actualiza a frase das quotas.
// Devolve: nada — reescreve o hint das quotas no DOM.
function liveShares(){
  collectProp();
  const owners=(pForm.ownerIds||[]).map(owner).filter(Boolean);
  const e=document.getElementById('shareHint');
  if(e)e.innerHTML=shareHint(owners,hasShares(pForm),sum(owners.map(o=>Number((pForm.ownerShares||{})[o.id])||0)));
}
let _propPaint=null;
// Repinta o corpo do modal a partir de pForm (ou do pintor alternativo em
// _propPaint) e volta a carregar as miniaturas das fotos.
// Devolve: nada — redesenha a vista.
function repaintProp(){const b=modalBodyEl();if(!b)return;b.innerHTML=(_propPaint||propBody)();marcarDatasVazias(b);paintThumbs(pForm.photos)}
/* Repinta o formulário do imóvel com o primeiro grupo (o nome, o destino, o
   tipo de arrendamento e os quartos) a crescer ou a encolher até à altura
   nova, em vez de mudar de tamanho de um fotograma para o outro
   (continuidade.js:crescerEmAltura). É aí que os campos aparecem e somem.
   As peças do grupo têm chave (data-parte: o nome, a morada, cada
   segmentado, os quartos e cada quarto, o «Adicionar quarto»): o que fica
   não se mexe, o que sai desvanece onde estava, o que chega desvanece a
   entrar, e os quartos de baixo de um que se remove sobem a deslizar.
   Devolve: nada — redesenha a vista. */
function repaintPropCrescendo(){
  crescerEmAltura(()=>{const b=modalBodyEl();return b&&b.querySelector('.imv-grupo')},repaintProp);
}
/* O realce de um segmentado do formulário desliza da escolha de antes para a
   de agora. A repintura troca o segmentado por um novo, já com o realce no
   sítio novo; a peça parte do sítio velho por transform (o mesmo passo da
   classe i1: a largura dela mais o espaço entre botões) e chega ao novo, no
   --medio e na --curva-fita, a curva do que atravessa em bloco. Sem
   movimento, fica onde a classe a pôs.
   Recebe: fn — o nome da função do segmentado ('setUse' ou 'setMode'); de —
   o índice da escolha de antes.
   Devolve: nada — anima a peça (ou nada). */
function imvSegDeslizar(fn,de){
  const g=document.getElementById('imv_segm_'+fn),p=g&&g.querySelector('.segm-polegar');
  if(!p||!p.animate||semMovimento())return;
  const para=p.classList.contains('i1')?1:0;
  if(para===de)return;
  const passo=i=>i?'translateX(calc(100% + 2px))':'translateX(0)';
  p.animate([{transform:passo(de)},{transform:passo(para)}],
    {duration:msDoToken('--medio',200),easing:tokenTexto('--curva-fita','cubic-bezier(.4,0,.2,1)')});
}
/* O segmentado tem o foco (do teclado, ou do toque que o deu ao botão)? A
   repintura troca-o por um novo, e o foco caía no corpo da página: quem anda
   de Tab tinha de recomeçar do topo do formulário.
   Recebe: fn — o nome da função do segmentado ('setUse' ou 'setMode').
   Devolve: verdadeiro se o foco está num dos botões dele. */
function imvSegTemFoco(fn){
  try{const g=document.getElementById('imv_segm_'+fn),a=document.activeElement;return !!(g&&a&&g!==a&&g.contains(a))}
  catch(e){return false}
}
/* Devolve o foco à escolha acesa do segmentado novo, sem rolar o corpo.
   Recebe: fn — o nome da função do segmentado.
   Devolve: nada — mexe só no foco. */
function imvSegFocar(fn){
  try{const b=document.querySelector('#imv_segm_'+fn+' [aria-checked="true"]');if(b)b.focus({preventScroll:true})}catch(e){}
}
// Muda o destino do imóvel (arrendamento/uso próprio) e repinta — os campos
// visíveis dependem dele: o realce desliza, o grupo cresce até eles, e o foco
// fica na escolha nova se estava no segmentado.
// Recebe: u — o destino: 'investimento' ou 'proprio'.
// Devolve: nada — redesenha a vista.
function setUse(u){
  const foco=imvSegTemFoco('setUse');
  collectProp();const de=pForm.use==='proprio'?1:0;pForm.use=u;
  repaintPropCrescendo();imvSegDeslizar('setUse',de);
  if(foco)imvSegFocar('setUse');
}
// Muda o tipo de arrendamento; ao passar a quartos sem nenhum criado, semeia
// dois para a lista não aparecer vazia. O foco, como no setUse.
// Recebe: m — o tipo de arrendamento: 'inteiro' ou 'quartos'.
// Devolve: nada — redesenha a vista.
function setMode(m){
  const foco=imvSegTemFoco('setMode');
  collectProp();const de=pForm.rentalMode==='quartos'?1:0;pForm.rentalMode=m;
  if(m==='quartos'&&!(pForm.rooms||[]).length)pForm.rooms=[{id:uid(),name:'Quarto 1'},{id:uid(),name:'Quarto 2'}];
  repaintPropCrescendo();imvSegDeslizar('setMode',de);
  if(foco)imvSegFocar('setMode');
}
// Acrescenta um quarto com nome sequencial e repinta.
// Devolve: nada — redesenha a vista.
function addRoom(){collectProp();pForm.rooms.push({id:uid(),name:'Quarto '+(pForm.rooms.length+1)});repaintPropCrescendo()}
/* Tira um quarto do formulário. Se algum contrato apontava para ele, perde já
   a ligação em db.contracts (não espera pelo Guardar do imóvel) e avisa.
   Recebe: rid — o id do quarto a tirar.
   Devolve: nada — redesenha a vista. */
function delRoom(rid){
  collectProp();
  const used=db.contracts.some(c=>c.roomId===rid);
  pForm.rooms=pForm.rooms.filter(r=>r.id!==rid);
  if(used){db.contracts.forEach(c=>{if(c.roomId===rid)c.roomId=null});toast('O contrato desse quarto ficou sem quarto associado.')}
  repaintPropCrescendo();
}
// Acrescenta uma hipoteca normalizada; a primeira chama-se "Aquisição" por
// omissão, as seguintes ficam sem nome até o utilizador dizer a finalidade.
// Devolve: nada — redesenha a vista.
function addLoan(){
  collectProp();
  pForm.loans.push(normLoan({name:pForm.loans.length?'':'Aquisição'}));
  repaintProp();
}
/* Apaga uma hipoteca depois de confirmar. Se há prestações registadas, os
   movimentos ficam mas perdem a ligação (loanId a null); os documentos
   anexados são apagados do IndexedDB de imediato, sem Anular.
   Recebe: lid — o id da hipoteca a apagar.
   Devolve: nada — abre a confirmação; só se apaga depois do sim. */
function delLoan(lid){
  collectProp();
  const l=findLoan(pForm,lid),used=db.transactions.filter(t=>t.loanId===lid).length;
  const drop=()=>{
    ((findLoan(pForm,lid)||{}).files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    pForm.loans=pForm.loans.filter(x=>x.id!==lid);
  };
  if(!used)return confirmModal('Apagar hipoteca',`Apagar “${esc(loanName(l))}”? Não tem prestações registadas.`,()=>{drop();repaintProp();toast('Hipoteca apagada.')});
  confirmModal('Apagar hipoteca',`Há ${used} prestação(ões) registada(s) em “${esc(loanName(l))}”. Os movimentos ficam, mas deixam de estar ligados a esta hipoteca.`,()=>{
    db.transactions.forEach(t=>{if(t.loanId===lid)t.loanId=null});
    drop();repaintProp();
    toast('Hipoteca apagada.');
  });
}
// Anexa os ficheiros escolhidos no input à hipoteca lid (assíncrono — lê e
// guarda os ficheiros primeiro) e repinta quando estiverem prontos.
// Recebe: input — o <input type="file"> com os ficheiros escolhidos; lid — o id
// da hipoteca a que se anexam.
// Devolve: nada — redesenha a vista quando os ficheiros estiverem guardados.
function loanAddFiles(input,lid){
  collectProp();
  takeFiles(input).then(ms=>{
    const l=findLoan(pForm,lid);if(!l)return;
    l.files=(l.files||[]).concat(ms);repaintProp();
    if(ms.length)toast(ms.length===1?'Documento anexado.':ms.length+' documentos anexados.');
  });
}
// Remove um documento de qualquer hipoteca que o tenha e apaga o blob do
// IndexedDB.
// Recebe: fid — o id do ficheiro a remover.
// Devolve: nada — redesenha a vista.
function delLoanFile(fid){
  collectProp();
  (pForm.loans||[]).forEach(l=>{l.files=(l.files||[]).filter(f=>f.id!==fid)});
  idbDel(fid).catch(()=>{});repaintProp();
}
// Liga/desliga o imposto do selo de uma hipoteca e refaz a simulação dela.
// Recebe: lid — o id da hipoteca.
// Devolve: nada — refaz a caixa de simulação no DOM.
function toggleStamp(lid){collectProp();const l=findLoan(pForm,lid);if(l)l.stampTax=chk('l_stamp_'+lid);liveLoan(lid)}
// Muda o tipo de taxa (fixa/mista/variável) e repinta — cada tipo tem os
// seus campos.
// Recebe: lid — o id da hipoteca; t — o tipo: 'fixa', 'mista' ou 'variavel'.
// Devolve: nada — redesenha a vista.
function setLType(lid,t){collectProp();const l=findLoan(pForm,lid);if(l)l.type=t;repaintProp()}
// Refaz a caixa de simulação da hipoteca lid sem repintar o resto do
// formulário; sem lid, refaz todas.
// Recebe: lid (opcional) — o id da hipoteca cuja caixa se refaz; sem lid, todas.
// Devolve: nada — reescreve a(s) caixa(s) de simulação no DOM.
function liveLoan(lid){
  collectProp();
  if(lid){const b=document.getElementById('loanBox_'+lid);if(b)b.innerHTML=loanBox(findLoan(pForm,lid))}
  else liveLoanAll();
}
// Refaz as caixas de simulação de todas as hipotecas (o select do indexante
// repinta-se a si próprio, por isso não dá para saber qual mudou).
// Devolve: nada — reescreve as caixas de simulação no DOM.
function liveLoanAll(){collectProp();(pForm.loans||[]).forEach(l=>{
  const b=document.getElementById('loanBox_'+l.id);if(b)b.innerHTML=loanBox(l)})}
/* HTML da caixa de simulação de uma hipoteca: prestação mensal decomposta em
   capital, juros e selo, o capital em dívida de hoje quando as prestações
   registadas já abateram o do início, prestação após a fase fixa (mista, se
   ainda não chegou — descontando as prestações já registadas) e custo total
   do crédito. Sem capital ou prazo devolve só a dica do que falta; liquidado,
   diz que está; com o prazo já esgotado pelas prestações registadas, avisa em
   vez de fingir uma prestação.
   Recebe: l — a hipoteca (objeto; aguenta null/undefined).
   Devolve: string de HTML da caixa, pronta a inserir com innerHTML; '' sem hipoteca. */
function loanBox(l){
  if(!l)return '';
  const capital=capitalDoInicio(l,db.transactions);
  if(!(capital>0)||!l.years)return `<div class="hint">Falta o capital em dívida e o prazo.</div>`;
  if(!(Number(l.outstanding)>0))return `<div class="hint">Crédito liquidado: as prestações registadas já pagaram o capital todo.</div>`;
  const c=loanCalc(l),a=amort(l);
  let extra='';
  if(l.type==='mista'){
    /* as linhas do plano começam na próxima por pagar: a fase muda em rows[fixedYears*12 − registadas],
       e o mês diz-se pelo mesmo relógio do aviso dos prazos (credito.js:fimDaFaseFixa) */
    const k=Math.round((Number(l.fixedYears)||0)*12)-loanMes(l),r=k>0?a.rows[k]:null;
    const r0=r&&servicoLigado('recurring')?loanRecOf(l):null;
    const fim=r?fimDaFaseFixa(l,db.transactions,today(),r0&&r0.next):'';
    if(r&&fim)extra=`<div class="stat"><span>Prestação a partir de ${MES[Number(fim.slice(5,7))-1]} ${fim.slice(0,4)}</span><b>${euro2(r.pay+r.st)}</b></div>`;
  }
  if(a.esgotado)extra+=`<div class="hint u-bl-3px-solid-v-warn u-pl-10px"><b>Prazo esgotado</b> — as prestações já registadas cobrem o prazo inteiro e ainda há dívida. Confirma o prazo e as prestações registadas.</div>`;
  /* o campo acima é o capital da data de início: o de hoje diz-se aqui, quando já é outro */
  const hoje=Math.abs(capital-Number(l.outstanding))>0.005?`<div class="stat"><span>Capital em dívida hoje</span><b>${euro2(l.outstanding)}</b></div>`:'';
  return `<div class="stat u-pt-0"><span>Prestação mensal</span><b class="u-fs-16px">${euro2(c.total)}</b></div>${hoje}
    <div class="stat"><span>Capital</span><b>${euro2(c.principal)}</b></div>
    <div class="stat"><span>Juros</span><b>${euro2(c.interest)}</b></div>
    ${l.stampTax?`<div class="stat"><span>Imposto do selo (${dec(db.settings.stampPct??4)}% dos juros)</span><b>${euro2(c.stamp)}</b></div>`:''}${extra}
    <div class="stat u-b-0"><span>Custo total do crédito</span><b class="neg">${euro(a.totInt+a.totStamp)}</b></div>
    <div class="hint">${esc(rateLabel(l))} · ${c.n} prestações por pagar</div>`;
}
// Junta as fotos escolhidas no input às do imóvel (assíncrono) e repinta.
// Recebe: input — o <input type="file"> com as fotos escolhidas.
// Devolve: nada — redesenha a vista quando as fotos estiverem guardadas.
function propAddPhotos(input){
  collectProp();
  takeFiles(input).then(ms=>{pForm.photos=(pForm.photos||[]).concat(ms);repaintProp();
    if(ms.length)toast(ms.length===1?'Foto adicionada.':ms.length+' fotos adicionadas.')});
}
/* arrastar as fotos para a posição pretendida (rato e dedo) */
let _pd=null;
/* Início do arrasto (pointerdown no puxador): mede o passo entre linhas,
   captura o ponteiro e liga os handlers de mover e largar.
   Recebe: e — o PointerEvent do pointerdown; h — o puxador (o botão .pgrab);
   idx — a posição da foto na lista (recalculada aqui a partir do DOM).
   Devolve: nada — guarda o estado do arrasto em _pd. */
function photoDrag(e,h,idx){
  e.preventDefault();e.stopPropagation();
  // um arrasto que ficou a meio (outro dedo, um pointerup que se perdeu) acaba aqui
  if(_pd&&_pd.largar)_pd.largar();
  const row=h.closest('.prow');if(!row)return;
  const list=row.parentNode,rows=[...list.querySelectorAll('.prow')];
  idx=rows.indexOf(row);
  // uma linha que ainda assentava do arrasto de antes fica já no sítio
  rows.forEach(photoAssentaPara);
  const step=(rows.length>1&&rows[1].offsetTop-rows[0].offsetTop)||row.offsetHeight+8||60;
  const rol=photoRolante(row);
  _pd={idx,to:idx,row,rows,step,y0:e.clientY,y:e.clientY,id:e.pointerId,rol,top0:photoRolou(rol),vel:0,raf:0};
  row.classList.add('drag');
  try{h.setPointerCapture(e.pointerId)}catch(x){}
  /* Um ouvinte só, no documento: com o ponteiro capturado o evento chega ao
     puxador e sobe até aqui, e sem captura chega na mesma. Havia também um
     h.onpointermove, e cada movimento corria duas vezes. */
  const done=ev=>{if(ev&&_pd&&ev.pointerId!==_pd.id)return;
    document.removeEventListener('pointermove',photoDragMove);document.removeEventListener('pointerup',done);document.removeEventListener('pointercancel',done);
    photoDragEnd()};
  _pd.largar=done;
  document.addEventListener('pointermove',photoDragMove);
  document.addEventListener('pointerup',done);
  document.addEventListener('pointercancel',done);
}
// Durante o arrasto: a linha agarrada segue o ponteiro e as outras deslocam-se
// para mostrar onde ela vai cair.
// Recebe: e — o PointerEvent do movimento.
// Devolve: nada — mexe nos transforms das linhas.
function photoDragMove(e){
  if(!_pd||(e.pointerId!=null&&_pd.id!=null&&e.pointerId!==_pd.id))return;
  e.preventDefault();
  _pd.y=e.clientY;
  photoDragPintar();
  photoDragRolagem();
}
/* Põe a linha agarrada debaixo do dedo e as outras a abrir o lugar. Conta
   com o que a janela rolou desde que se pegou nela: a lista subiu com o
   scroll, e a linha tem de descer outro tanto para ficar no dedo.
   Devolve: nada — mexe nos transforms das linhas. */
function photoDragPintar(){
  if(!_pd)return;
  const dy=_pd.y-_pd.y0+photoRolou(_pd.rol)-_pd.top0;
  _pd.row.style.transform=`translateY(${dy}px)`;
  const to=Math.max(0,Math.min(_pd.rows.length-1,_pd.idx+Math.round(dy/_pd.step)));
  if(to!==_pd.to){_pd.to=to;
    _pd.rows.forEach((r,i)=>{if(r===_pd.row)return;
      let sh=0;
      if(_pd.idx<to&&i>_pd.idx&&i<=to)sh=-_pd.step;
      else if(_pd.idx>to&&i>=to&&i<_pd.idx)sh=_pd.step;
      r.style.transform=sh?`translateY(${sh}px)`:'';});
  }
}
/* Quanto rolou a área que rola (0 sem ela).
   Recebe: rol — o elemento que rola, ou null.
   Devolve: o scrollTop, em px. */
function photoRolou(rol){return rol&&typeof rol.scrollTop==='number'?rol.scrollTop:0}
/* Quem rola por baixo da lista das fotos: a primeira caixa acima dela que
   tem scroll (o corpo da janela), ou a página.
   Recebe: el — a linha agarrada.
   Devolve: o elemento que rola (ou null). */
function photoRolante(el){
  for(let p=el&&el.parentElement;p&&p!==document.body;p=p.parentElement){
    const o=getComputedStyle(p).overflowY;
    if((o==='auto'||o==='scroll')&&p.scrollHeight>p.clientHeight)return p;
  }
  return (el&&el.closest('.body'))||document.scrollingElement||null;
}
/* Perto da borda de cima ou de baixo da área que rola, ela rola sozinha,
   mais depressa quanto mais perto, para a foto poder ir para um lugar que
   não se vê (como o arrasto das tarefas, tarefas.js:tfArrastoRolagem). O
   dedo decide: é uma rolagem e não uma animação, e por isso vale também com
   o movimento reduzido.
   Devolve: nada — arranca ou pára o passo da auto-rolagem. */
function photoDragRolagem(){
  const a=_pd;if(!a||!a.rol||typeof a.rol.getBoundingClientRect!=='function')return;
  const r=a.rol===document.scrollingElement?{top:0,bottom:window.innerHeight}:a.rol.getBoundingClientRect();
  const cima=Math.max(r.top,0),baixo=Math.min(r.bottom,window.innerHeight),zona=56;
  let v=0;
  if(a.y<cima+zona)v=-Math.ceil(14*(cima+zona-a.y)/zona);
  else if(a.y>baixo-zona)v=Math.ceil(14*(a.y-(baixo-zona))/zona);
  a.vel=Math.max(-18,Math.min(18,v));
  if(a.vel&&!a.raf&&typeof requestAnimationFrame==='function')a.raf=requestAnimationFrame(photoDragPasso);
}
/* Um passo da auto-rolagem: rola, volta a pôr a foto debaixo do dedo, e
   continua enquanto o dedo estiver na zona e houver para onde rolar.
   Devolve: nada. */
function photoDragPasso(){
  const a=_pd;if(!a)return;a.raf=0;
  if(!a.vel||!a.rol)return;
  const antes=a.rol.scrollTop;a.rol.scrollTop+=a.vel;
  if(a.rol.scrollTop===antes)return;
  photoDragPintar();
  a.raf=requestAnimationFrame(photoDragPasso);
}
/* Largar a foto, sem saltos. As outras linhas já estão, pelo transform, no
   sítio onde a troca as deixa: troca-se a linha no DOM e limpam-se os
   transforms todos de uma vez, com a transição desligada (.pousar), e elas
   não se mexem. A largada estava onde o dedo a deixou: parte de lá e assenta
   no lugar novo (photoAssenta). Antes, os transforms limpavam-se com a
   transição ligada e a troca vinha no mesmo instante: as vizinhas saltavam
   um lugar e voltavam a deslizar.
   Só os nomes das fotos se leem do formulário (photoLerNomes): nada mais
   mudou, e o collectProp inteiro refazia as contas das hipotecas a cada
   largada.
   Devolve: nada — atualiza pForm.photos e a lista no DOM. */
function photoDragEnd(){
  if(!_pd)return;
  const {idx,to,row,rows}=_pd;
  if(_pd.raf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(_pd.raf);   // a auto-rolagem pára ao largar
  _pd=null;
  const list=row.parentNode;
  const de=row.getBoundingClientRect().top;   // onde o dedo a deixou
  if(list)list.classList.add('pousar');
  rows.forEach(r=>{r.style.transform='';if(r!==row)r.classList.remove('drag')});
  if(to!==idx&&list){
    photoLerNomes();
    const a=pForm.photos,x=a.splice(idx,1)[0];a.splice(to,0,x);
    /* move só a linha no DOM: repintar tudo recarregava as miniaturas e demorava */
    const ref=rows[to];
    if(to>idx)list.insertBefore(row,ref.nextSibling);else list.insertBefore(row,ref);
    list.querySelectorAll('.capa').forEach(x2=>x2.remove());
    const first=list.querySelector('.prow .pth');
    if(first)first.insertAdjacentHTML('afterbegin','<span class="capa">capa</span>');
  }
  // o estilo novo (sem transform) fica assente antes de a transição voltar
  if(list){void list.offsetHeight;list.classList.remove('pousar')}
  photoAssenta(row,de-row.getBoundingClientRect().top);
}
/* A linha largada desliza do sítio onde o dedo a deixou para o lugar dela
   (--rapido, --curva-entra: chega e pousa), e só no fim perde a sombra do
   arrasto. Sem movimento pedido, ou já no sítio, pousa logo.
   Recebe: row — a linha largada (.prow); desl — px entre onde estava e o
   lugar novo (positivo: estava abaixo).
   Devolve: nada. */
function photoAssenta(row,desl){
  // só a desta largada: um dedo novo que pegou na linha (photoAssentaPara) já a tirou
  const pousa=()=>{if(row._assenta!==an)return;row._assenta=null;row.classList.remove('drag')};
  let an=null;
  if(!desl||Math.abs(desl)<0.5||semMovimento()||typeof row.animate!=='function'){row.classList.remove('drag');return}
  an=row.animate([{transform:'translateY('+desl+'px)'},{transform:'none'}],
    {duration:msDoToken('--rapido',120),easing:tokenTexto('--curva-entra','cubic-bezier(0,0,.2,1)')});
  row._assenta=an;
  an.onfinish=pousa;an.oncancel=pousa;
  // a rede de sempre: num separador escondido o onfinish não chega
  setTimeout(pousa,msDoToken('--rapido',120)+120);
}
/* Uma linha que ainda assenta de um arrasto acabado fica já no sítio (um
   dedo novo pega nela a meio).
   Recebe: r — uma linha (.prow).
   Devolve: nada. */
function photoAssentaPara(r){
  const an=r&&r._assenta;if(!an)return;
  r._assenta=null;
  try{an.cancel()}catch(e){}
  r.classList.remove('drag');
}
/* Lê do formulário só os nomes das fotos para o pForm (o que o collectProp
   faz a elas), sem o resto.
   Devolve: nada. */
function photoLerNomes(){
  (pForm&&pForm.photos||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
}
// Tira uma foto do imóvel e apaga o blob e a miniatura do IndexedDB.
// Recebe: fid — o id da foto a tirar.
// Devolve: nada — redesenha a vista.
function delPropPhoto(fid){collectProp();pForm.photos=(pForm.photos||[]).filter(f=>f.id!==fid);idbDel(fid).catch(()=>{});idbDel('tn_'+fid).catch(()=>{});repaintProp()}
// Abre a lista dos proprietários ainda não associados para escolher um. Não
// há «criar novo»: um proprietário é uma conta Rendorium, e chega pela
// partilha (Pessoas › Proprietários), não por uma ficha feita à mão.
// Devolve: nada — abre a janela de escolha.
function addPropOwner(){
  collectProp();
  const free=db.owners.filter(o=>(pForm.ownerIds||[]).indexOf(o.id)<0);
  pickModal('Escolher proprietário',free.map(o=>({v:o.id,label:o.name,sub:[o.phone,o.email].filter(Boolean).join(' · '),avatar:true})),
    o=>{pForm.ownerIds.push(o.v);closeModal();repaintProp()});
}
// Desassocia um proprietário do imóvel e esquece a quota-parte dele.
// Recebe: oid — o id do proprietário a desassociar.
// Devolve: nada — redesenha a vista.
function delPropOwner(oid){collectProp();pForm.ownerIds=(pForm.ownerIds||[]).filter(x=>x!==oid);if(pForm.ownerShares)delete pForm.ownerShares[oid];repaintProp()}
/* Um imóvel apagado leva a parte dele de cada movimento de vários imóveis (um
   lote, movimento.js); as partes que ficam nos outros imóveis passam a ser o
   lote inteiro — menos uma parte, e o total a soma delas —, e uma só que
   sobre passa a movimento normal. Sem isto ficavam a dizer «dividido por 3»
   com duas partes, um lote incompleto para sempre, que ninguém edita nem
   apaga. Só quando todas as partes que ficam estão ao meu alcance: acertar
   uma que o servidor me recusa tirava-a da base local. Só dados: não chama os
   Movimentos (o imóvel é outro serviço).
   Recebe: id — o id do imóvel que sai; txs — os movimentos dele (as cópias).
   Devolve: as cópias das partes que mudaram, como estavam, para o Anular. */
function acertarLotesSemImovel(id,txs){
  const antes=[];
  new Set(txs.filter(x=>x.lote&&x.lote.id).map(x=>x.lote.id)).forEach(lid=>{
    const ficam=db.transactions.filter(x=>x.lote&&x.lote.id===lid&&x.propertyId!==id);
    if(!ficam.length||ficam.some(x=>!pode(x.propertyId,'tx.add')))return;
    ficam.forEach(x=>antes.push(JSON.parse(JSON.stringify(x))));
    if(ficam.length===1){ficam[0].lote=null;return}
    const total=Math.round(sum(ficam.map(x=>Number(x.amount)||0))*100)/100;
    ficam.forEach(x=>{
      const partes=Object.assign({},x.lote.partes||{});delete partes[id];
      x.lote=Object.assign({},x.lote,{n:ficam.length,total,partes});
    });
  });
  return antes;
}
/* Apaga o imóvel e, em cascata, os contratos e os movimentos associados, com
   Anular. A cópia guarda-se antes de apagar; as fotos e os documentos das
   hipotecas só saem do IndexedDB quando o Anular expira. As partes que o
   imóvel tinha em movimentos de vários imóveis saem com ele, e o resto desses
   movimentos acerta-se (acertarLotesSemImovel). Só quem o criou o apaga: num
   imóvel que não criei, «Apagar» é sair dele (imvSair).
   Recebe: id — o id do imóvel a apagar.
   Devolve: nada — abre a confirmação; só se apaga depois do sim. */
function delProp(id){
  const p=prop(id),n=contractsOf(id).length;
  if(!p)return;
  /* um comproprietário ou um colaborador não apaga o imóvel de outro: sai dele */
  if(!souCriador(id))return imvSair(id);
  confirmModal('Apagar imóvel',`Apagar “${esc(p.name)}”${n===1?', o seu contrato':n?`, os seus ${n} contratos`:''} e todos os movimentos associados?`,()=>{
    /* a cópia primeiro, os blobs só quando o Anular expirar: uma cascata
       destas confirmada por hábito era irrecuperável */
    const copia={p:JSON.parse(JSON.stringify(p)),
      cts:JSON.parse(JSON.stringify(db.contracts.filter(x=>x.propertyId===id))),
      txs:JSON.parse(JSON.stringify(db.transactions.filter(x=>x.propertyId===id)))};
    db.properties=db.properties.filter(x=>x.id!==id);if(dashProp===id)dashProp='';if(txProp===id)txProp='';
    db.contracts=db.contracts.filter(x=>x.propertyId!==id);
    db.transactions=db.transactions.filter(x=>x.propertyId!==id);
    const lotesAntes=acertarLotesSemImovel(id,copia.txs);
    save();closeAllModals();render();
    comDesfazer('Imóvel apagado.',()=>{
      db.properties.push(copia.p);
      db.contracts=db.contracts.concat(copia.cts);
      /* as partes que ficaram voltam a ser como eram, e as do imóvel voltam */
      const volta=new Map(lotesAntes.map(x=>[x.id,x]));
      db.transactions=db.transactions.map(x=>volta.get(x.id)||x).concat(copia.txs);
    },()=>{
      (copia.p.photos||[]).forEach(f=>{idbDel(f.id).catch(()=>{});idbDel('tn_'+f.id).catch(()=>{})});
      (copia.p.loans||[]).forEach(l=>(l.files||[]).forEach(f=>idbDel(f.id).catch(()=>{})));
    });
  });
}
/* Num imóvel que não criei, «Apagar» é sair dele: com sessão (a nuvem traz o
   CW.sairDaCasa, cloud/partilha.js) e só num que ainda está na base.
   Recebe: id — o id do imóvel.
   Devolve: true se posso sair dele. */
function imvPossoSair(id){return !!prop(id)&&!souCriador(id)&&typeof (window.CW&&CW.sairDaCasa)==='function'}
/* O ⋯ da ficha, o do formulário e o toque longo têm «Apagar imóvel»: quem o
   criou apaga-o (delProp), quem não o criou sai dele (imvSair).
   Recebe: id — o id do imóvel.
   Devolve: true se o «Apagar imóvel» entra no menu. */
function imvPossoApagar(id){return souCriador(id)||imvPossoSair(id)}
/* Como saio de um imóvel que não criei: tenho cargo (colaborador) ou sou dono
   sem o ter criado (comproprietário, por uma ligação ou por um grupo).
   Recebe: id — o id do imóvel.
   Devolve: 'colaborador', 'comproprietario', ou '' num imóvel que criei. */
function imvComoSaio(id){return souCriador(id)?'':souDono(id)?'comproprietario':'colaborador'}
/* Quem criou o imóvel, para as frases da saída: o nome que o servidor mandou
   (p._sharedFrom, o que o seloCargo usa) ou o da conta pelo id.
   Recebe: p — o imóvel.
   Devolve: o nome (texto, por escapar), ou '' sem nome. */
function imvNomeDoDono(p){return (p&&(p._sharedFrom||(p._ownerUserId?nomeUtilizador(p._ownerUserId):'')))||''}
/* Uma quota como a app a escreve: «30%», «33,33%» (no máximo duas casas,
   como o servidor as arredonda).
   Recebe: f — a fração (0–1).
   Devolve: o texto. */
function imvQuotaTexto(f){return String(Math.round((Number(f)||0)*10000)/100).replace('.',',')+'%'}
/* Para onde vai a minha quota quando saio de um imóvel em compropriedade
   (o contrato da rota: dividida pelos restantes na proporção das quotas
   deles; sem quotas escritas, ficam em partes iguais). Com um só que fica,
   passa para ele.
   Recebe: p — o imóvel.
   Devolve: a frase (HTML, nomes escapados), ou '' sem mais ninguém. */
function imvFraseDaQuota(p){
  const eu=meuId(),minha=sharesOf(p)[eu],ficam=(p.ownerIds||[]).filter(u=>u&&u!==eu);
  if(!ficam.length)return '';
  const q=minha!=null?' ('+imvQuotaTexto(minha)+')':'',nomes=ficam.map(u=>esc(nomeUtilizador(u)));
  if(ficam.length===1)return `A tua quota${q} passa para ${nomes[0]}.`;
  return `A tua quota${q} é dividida por ${listaE(nomes)} ${hasShares(p)?'na proporção das quotas deles':'em partes iguais'}.`;
}
/* O que sair de um imóvel que não criei faz, dito antes de confirmar: as
   permissões são retiradas, o imóvel sai da lista, o registado fica, não se
   desfaz e como se volta (o colaborador pede um convite novo ao dono; ao
   comproprietário, quem o criou tem de voltar a partilhá-lo). Ao
   comproprietário diz também para onde vai a quota (imvFraseDaQuota) e que
   os saldos e o IRS passam a contar com as quotas novas — as quotas não são
   por data, valem para os movimentos já registados.
   Recebe: p — o imóvel.
   Devolve: a frase (HTML, com os nomes escapados). */
function imvFraseSaida(p){
  const nome='<b>'+esc(p.name||'Sem nome')+'</b>',dono=esc(imvNomeDoDono(p));
  if(imvComoSaio(p.id)==='colaborador')
    return `Deixas de colaborar em ${nome}: as tuas permissões neste imóvel são retiradas e ele sai da tua lista. O que registaste fica com ${dono||'o dono'}. Não se desfaz: para voltares a ter acesso, pede ${dono?'a '+dono:'ao dono'} um convite novo.`;
  const quota=imvFraseDaQuota(p);
  return `Deixas de ser comproprietário de ${nome}: as tuas permissões são retiradas e ele sai da tua lista.${quota?' '+quota:''} Os saldos e o IRS do imóvel passam a contar com as quotas novas, também nos movimentos já registados. O que registaste fica. Não se desfaz: para voltares, ${dono||'quem o criou'} tem de voltar a partilhá-lo contigo.`;
}
/* Sair de um imóvel que não criei — o «Apagar imóvel» do ⋯ da ficha, do
   formulário e do toque longo de quem não o criou (delProp encaminha para
   aqui). Uma confirmação com o que se perde (imvFraseSaida), vermelha como a
   do criador, sem Anular: a saída acontece no servidor
   (cloud/partilha.js:CW.sairDaCasa) e não se desfaz. Só com a resposta: o
   aviso, as janelas fecham (a ficha ficava sobre um imóvel que já não está
   na lista), os filtros que apontavam para ele limpam-se e o estado volta a
   ler-se. Um erro diz a frase do servidor e não muda nada.
   Recebe: id — o id do imóvel.
   Devolve: nada — abre a confirmação; só se sai depois do sim. */
function imvSair(id){
  const p=prop(id);if(!p)return;
  if(!imvPossoSair(id))return toast('Só quem criou o imóvel o pode apagar.');
  const nome=p.name||'Sem nome';
  confirmModal('Apagar «'+nome+'»',imvFraseSaida(p),()=>{
    window.CW.sairDaCasa(id).then(()=>{
      if(dashProp===id)dashProp='';if(txProp===id)txProp='';
      closeAllModals();toast('Saíste de '+nome+'.');
      return Promise.resolve(typeof pullNow==='function'?pullNow(true):null).catch(()=>{}).then(()=>render());
    },e=>toast((e&&e.message)||'Não deu para sair deste imóvel. Tenta outra vez.'));
  });
}

/* ================= TRANSFERIR A PROPRIEDADE =================
   Quem criou um imóvel pode passá-lo a um proprietário ligado a ele: o outro
   passa a criador (gere as partilhas, os colaboradores e o apagar) e eu saio,
   ou continuo como comproprietário com as quotas que escrever. O pedido vai
   ao servidor (cloud/partilha.js:CW.pedirTransferencia) e nada muda até o
   outro aceitar; até lá cancelo-o na ficha (imvTrfNaFicha) ou no sino. Os
   avisos e as respostas vivem em notificacoes.js (notifTransf…). */

/* A folha de transferir aberta: os imóveis que vão (ids), os que ficaram de
   fora (naoMeus, pend), quem recebe (para), o interruptor (ficar), o que
   está escrito nas quotas (escrito: {hid: {uid: texto}}), o que corre depois
   de pedir (aoPedir) e se há um pedido a meio (enviando). null sem folha. */
let _trf=null;

/* O ⋯ da ficha do imóvel: «Transferir propriedade» a quem o pode
   transferir (imvPossoTransferir), e «Apagar imóvel» (imvPossoApagar), por
   esta ordem — o que destrói fica no fim, vermelho.
   Recebe: id — o id do imóvel.
   Devolve: os itens do menu() (array; vazio sem nenhum). */
function imvMenuDaFicha(id){
  const q=jsq(id),it=[];
  if(imvPossoTransferir(id))it.push({label:'Transferir propriedade',icon:'swap',toca:'camada',act:`imvTransferir('${q}')`});
  if(imvPossoApagar(id))it.push({label:'Apagar imóvel',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delProp('${q}')`});
  return it;
}
/* A transferência existe aqui? Com sessão, com a nuvem carregada (o
   CW.pedirTransferencia de cloud/partilha.js) e com um servidor que já sabe
   de transferências (notificacoes.js:notifTransfSabe — um de antes não manda
   o campo, e a ação levava a um 404).
   Devolve: true se a transferência se pode oferecer. */
function imvTrfDisponivel(){return !!meuId()&&typeof (window.CW&&CW.pedirTransferencia)==='function'&&notifTransfSabe()}
/* Posso transferir este imóvel? Só quem o criou (souCriador), com a
   transferência disponível (imvTrfDisponivel) e sem um pedido pendente dele
   (um só por casa: o pendente cancela-se primeiro).
   Recebe: id — o id do imóvel.
   Devolve: true se sim. */
function imvPossoTransferir(id){return !!prop(id)&&souCriador(id)&&imvTrfDisponivel()&&!notifTransfDaCasa('outgoing',id)}
/* Para quem posso transferir: os proprietários de Pessoas › Proprietários
   (pessoas.js:donosComPartilha) com quem tenho uma ligação aceite — o
   servidor só aceita esses (um comproprietário só por um grupo não tem
   ligação, e a transferência era recusada). O nome é o da ligação, ou o da
   ficha; por ordem alfabética.
   Devolve: array de {id, nome}. */
function imvTrfDestinos(){
  const st=window.CW&&CW.state,eu=meuId(),vistos={},out=[];
  ((st&&st.connections)||[]).forEach(c=>{
    const u=c&&c.status!=='pending'&&c.peer&&c.peer.id;
    if(!u||u===eu||vistos[u])return;
    vistos[u]=1;
    out.push({id:u,nome:String(c.peer.name||'').trim()||nomeUtilizador(u)||String(c.peer.email||u)});
  });
  return out.sort((a,b)=>a.nome.localeCompare(b.nome,'pt'));
}
/* O nome de alguém na folha de transferir: quem recebe pelo nome da
   ligação; os outros pelo da ficha.
   Recebe: u — o id do utilizador.
   Devolve: o nome (texto, por escapar). */
function imvTrfNomeDe(u){
  const d=imvTrfDestinos().find(x=>x.id===u);
  return d?d.nome:nomeUtilizador(u);
}
/* Quem fica num imóvel com «Continuar como comproprietário»: eu, quem
   recebe e os comproprietários que já lá estão, por esta ordem.
   Recebe: p — o imóvel; para — o id de quem recebe.
   Devolve: array de ids. */
function imvTrfQuem(p,para){
  const eu=meuId();
  return [eu,para].concat((p.ownerIds||[]).filter(u=>u&&u!==eu&&u!==para));
}
/* As quotas com que a folha abre, em percentagem: a minha dividida a meias
   com quem recebe (somada à que ele já tenha), e as dos outros como estão.
   Uma casa sem quotas que se leiam (sem fichas dos donos) conta em partes
   iguais pelos donos.
   Recebe: p — o imóvel; para — o id de quem recebe.
   Devolve: {uid: número} — soma 100. */
function imvTrfQuotasIniciais(p,para){
  const eu=meuId(),donos=(p.ownerIds||[]).length?p.ownerIds:[eu];
  let sh=sharesOf(p);
  if(!(Object.keys(sh).reduce((s,u)=>s+(Number(sh[u])||0),0)>0.99)){sh={};donos.forEach(u=>{sh[u]=1/donos.length})}
  const r2=v=>Math.round(v*100)/100,pc=u=>r2((sh[u]||0)*100);
  const minha=pc(eu),metade=r2(minha/2),out={};
  imvTrfQuem(p,para).forEach(u=>{out[u]=u===eu?r2(minha-metade):u===para?r2(pc(para)+metade):pc(u)});
  return out;
}
/* Os campos das quotas de cada imóvel, com o interruptor ligado: uma linha
   por quem fica (imvTrfQuem), o nome e o campo com o %, como as quotas da
   partilha (estilos.css:.pt-quotas). Começam nas de imvTrfQuotasIniciais, ou
   no que já lá estava escrito. Sem quem recebe ainda escolhido, diz que as
   quotas aparecem depois.
   Devolve: o HTML (texto), ou '' com o interruptor desligado. */
function imvTrfQuotasHtml(){
  if(!_trf||!_trf.ficar)return '';
  if(!_trf.para)return '<p class="hint">Escolhe para quem transferes, e as quotas aparecem aqui.</p>';
  const eu=meuId();
  return _trf.ids.map(hid=>{
    const p=prop(hid);if(!p)return '';
    const ini=imvTrfQuotasIniciais(p,_trf.para),escrito=_trf.escrito[hid]||{},casa=esc(p.name||'Sem nome');
    const linhas=imvTrfQuem(p,_trf.para).map(u=>{
      const nome=esc(u===eu?'Tu':imvTrfNomeDe(u)),v=escrito[u]!=null?escrito[u]:dec(ini[u]);
      return `<label class="pt-quota"><span class="pt-quota-nome">${nome}</span><input id="trf_q_${esc(hid)}_${esc(u)}" type="text" inputmode="decimal" value="${esc(v)}" aria-label="${nome}, quota em ${casa}, em %" data-toca="rascunho" data-input="imvTrfEscreveu()"><span class="pt-pct" aria-hidden="true">%</span></label>`;
    }).join('');
    return `<div class="trf-casa" role="group" aria-label="Quotas em ${casa}"><b>${casa}</b><div class="pt-quotas"><div class="pt-quotas-cab small" aria-hidden="true"><span>Pessoa</span><span>Quota</span></div>${linhas}</div></div>`;
  }).join('')+`<p class="hint">As quotas de cada imóvel somam 100 e entram quando ${esc(imvTrfNomeDe(_trf.para))} aceitar.</p>`;
}
/* Lê o que está escrito nos campos das quotas para a folha (_trf.escrito),
   para voltar igual depois de uma repintura.
   Devolve: nada. */
function imvTrfLer(){
  if(!_trf||!_trf.ficar||!_trf.para)return;
  _trf.ids.forEach(hid=>{
    const p=prop(hid);if(!p)return;
    const e=_trf.escrito[hid]||(_trf.escrito[hid]={});
    imvTrfQuem(p,_trf.para).forEach(u=>{const el=document.getElementById('trf_q_'+hid+'_'+u);if(el)e[u]=el.value});
  });
}
/* As quotas escritas de um imóvel, validadas: cada uma maior do que 0 e no
   máximo 100, e todas a somar 100 (com o arredondamento dos cêntimos de
   percentagem, que vão para a maior).
   Recebe: hid — o id do imóvel.
   Devolve: {q: {uid: número}} ou {campo, msg} com o primeiro erro. */
function imvTrfQuotasDe(hid){
  const p=prop(hid);if(!p)return {q:{}};
  const quem=imvTrfQuem(p,_trf.para),ini=imvTrfQuotasIniciais(p,_trf.para),escrito=_trf.escrito[hid]||{},q={};
  let total=0;
  for(const u of quem){
    const v=escrito[u]!=null?numTaxa(escrito[u]):ini[u];
    if(!(v>0)||v>100)return {campo:'trf_q_'+hid+'_'+u,msg:'Escreve uma quota maior do que 0 e até 100.'};
    q[u]=Math.round(v*100)/100;total+=q[u];
  }
  total=Math.round(total*100)/100;
  if(Math.abs(total-100)>0.05)return {campo:'trf_q_'+hid+'_'+quem[0],msg:'As quotas de '+(p.name||'Sem nome')+' têm de somar 100 (agora somam '+dec(total)+').'};
  const dif=Math.round((100-total)*100)/100;
  if(dif){const maior=quem.reduce((a,b)=>q[b]>q[a]?b:a);q[maior]=Math.round((q[maior]+dif)*100)/100}
  return {q};
}
/* O que transferir faz, dito antes de pedir, sem esconder nada: o que passa
   para quem (e que ele passa a gerir as partilhas, os colaboradores e o
   apagar); se saio — a minha quota passa para ele, as dos outros
   comproprietários não mudam se mantiverem o acesso — ou se fico, e com que
   quotas; que os comproprietários que não estejam ligados a quem recebe
   perdem o acesso (daqui não se sabe quem está ligado a ele); os meus
   colaboradores nesses imóveis, pelo nome, que perdem o acesso e são
   avisados (os cargos são meus e não passam); e que o outro tem de aceitar,
   que até lá nada muda e que posso cancelar. Escreve-se de novo a cada
   mudança na folha.
   Devolve: a frase (HTML, nomes escapados), ou '' sem folha. */
function imvTrfFrase(){
  if(!_trf)return '';
  const ps=_trf.ids.map(prop).filter(Boolean),um=ps.length===1,eu=meuId();
  const nomePara=_trf.para?esc(imvTrfNomeDe(_trf.para)):'';
  const quem=nomePara?'<b>'+nomePara+'</b>':'quem escolheres';
  const f=[`${listaE(ps.map(p=>'<b>'+esc(p.name||'Sem nome')+'</b>'))} ${um?'passa':'passam'} para ${quem}, que fica a gerir ${um?'o imóvel':'os imóveis'}: as partilhas, os colaboradores e o apagar.`];
  if(_trf.ficar){
    let q=null;
    if(um&&_trf.para){const r=imvTrfQuotasDe(ps[0].id);if(r.q)q=r.q}
    f.push(q?`Continuas comproprietário: ${listaE(imvTrfQuem(ps[0],_trf.para).map((u,i)=>(i?esc(imvTrfNomeDe(u))+' com ':'ficas com ')+notifTransfPct(q[u])))}.`
      :`Continuas comproprietário, com as quotas que escreveres em baixo.`);
  }else{
    const minha=um?sharesOf(ps[0])[eu]:null;
    f.push(`Tu sais ${um?'dele':'deles'}, e ${um?`a tua quota${minha!=null?' ('+imvQuotaTexto(minha)+')':''} passa`:'as tuas quotas passam'} para ${nomePara||'quem o recebe'}.`);
    const outros=imvTrfOutrosDonos(ps);
    if(outros.length){const n=listaE(outros.map(u=>esc(nomeUtilizador(u))));f.push(outros.length===1?`A quota de ${n} não muda se mantiver o acesso.`:`As quotas de ${n} não mudam se mantiverem o acesso.`)}
  }
  /* quem pede não sabe quem está ligado a quem recebe: um comproprietário
     que via a casa pela ligação comigo e não está ligado a ele perde-a (o
     servidor decide e avisa-o, 'casa.sem_acesso') */
  if(imvTrfOutrosDonos(ps).length)f.push(`Os comproprietários que não estejam ligados a ${nomePara||'quem recebe'} perdem o acesso, e a quota deles passa para os que ficam.`);
  const colabs=imvTrfColaboradores(_trf.ids);
  if(colabs.length){
    const n=listaE(colabs.map(esc)),onde=um?'a este imóvel':'a estes imóveis';
    f.push((colabs.length===1?`O teu colaborador ${n} perde o acesso ${onde} e é avisado.`:`Os teus colaboradores ${n} perdem o acesso ${onde} e são avisados.`)+' Os cargos são teus e não passam.');
  }
  f.push(`${nomePara||'Quem recebe'} tem de aceitar: até lá nada muda, e podes cancelar o pedido na ficha ${um?'do imóvel':'de cada imóvel'}.`);
  return f.join(' ');
}
/* Os outros comproprietários destes imóveis: nem eu, nem quem recebe.
   Recebe: ps — os imóveis.
   Devolve: array de ids, sem repetidos. */
function imvTrfOutrosDonos(ps){
  const eu=meuId(),out=[];
  ps.forEach(p=>(p.ownerIds||[]).forEach(u=>{if(u&&u!==eu&&u!==(_trf&&_trf.para)&&out.indexOf(u)<0)out.push(u)}));
  return out;
}
/* Os meus colaboradores nestes imóveis, pelo nome: os do CW.state.collaborators
   (só o dono os recebe, e são os dele) que têm algum destes imóveis. São os
   que perdem o acesso quando a transferência for aceite. Com os
   Colaboradores desligados nesta conta o servidor não os manda, e a lista
   fica vazia.
   Recebe: ids — os ids dos imóveis.
   Devolve: array de nomes (texto, por escapar), sem repetidos. */
function imvTrfColaboradores(ids){
  const st=window.CW&&CW.state,out=[];
  ((st&&st.collaborators)||[]).forEach(c=>{
    if(!c||!(c.houses||[]).some(h=>h&&ids.indexOf(h.id)>-1))return;
    const n=String(c.name||'').trim()||(c.userId?nomeUtilizador(c.userId):'')||'Sem nome';
    if(out.indexOf(n)<0)out.push(n);
  });
  return out;
}
/* O corpo da folha de transferir: os que ficaram de fora e porquê; «Para
   quem», obrigatório, com os proprietários ligados (imvTrfDestinos); o
   interruptor «Continuar como comproprietário», desligado; as quotas, com
   ele ligado (imvTrfQuotasHtml); e a frase do que acontece (imvTrfFrase),
   que o leitor de ecrã ouve mudar.
   Recebe: destinos — a lista de imvTrfDestinos.
   Devolve: o HTML (texto). */
function imvTrfCorpo(destinos){
  const nomes=ids=>listaE(ids.map(id=>'<b>'+esc(propName(id)||'Sem nome')+'</b>'));
  const fora=[];
  if(_trf.naoMeus.length)fora.push(nomes(_trf.naoMeus)+(_trf.naoMeus.length===1?' fica de fora: só quem criou um imóvel o pode transferir.':' ficam de fora: só quem criou um imóvel o pode transferir.'));
  if(_trf.pend.length)fora.push(nomes(_trf.pend)+(_trf.pend.length===1?' fica de fora: já tem uma transferência pendente.':' ficam de fora: já têm transferências pendentes.'));
  const um=_trf.ids.length===1;
  const ops=[{v:'',label:'Escolhe um proprietário'}].concat(destinos.map(d=>({v:d.id,label:d.nome})));
  return `<div class="form trf-form">
    ${fora.length?`<div class="hint">${fora.join(' ')}</div>`:''}
    <label>Para quem <span class="req">*</span>${sel('trf_para',_trf.para,ops,'imvTrfMudou','rascunho')}</label>
    <label class="trf-sw"><span class="trf-sw-txt" id="trfFicarL"><b>Continuar como comproprietário</b><span class="small">Ficas com uma quota ${um?'no imóvel':'em cada imóvel'}. Desligado, sais ${um?'dele':'deles'} e a tua quota passa para quem recebe.</span></span><button type="button" class="interruptor" role="switch" id="trfFicar" aria-checked="${_trf.ficar?'true':'false'}" aria-labelledby="trfFicarL" data-toca="rascunho" data-click="imvTrfFicar()"></button></label>
    <div id="trfQuotas" class="trf-quotas">${imvTrfQuotasHtml()}</div>
    <p class="trf-frase" id="trfFrase" aria-live="polite">${imvTrfFrase()}</p>
  </div>`;
}
/* Repinta as partes da folha que dependem das escolhas: as quotas e a frase.
   O «Para quem» e o interruptor ficam (não perdem o foco).
   Devolve: nada. */
function imvTrfPintar(){
  const q=document.getElementById('trfQuotas');if(q)q.innerHTML=imvTrfQuotasHtml();
  const f=document.getElementById('trfFrase');if(f)f.innerHTML=imvTrfFrase();
}
/* Escolheu-se quem recebe: as quotas recomeçam nas de partida para essa
   pessoa (as linhas mudam com ela) e a frase diz o nome.
   Devolve: nada. */
function imvTrfMudou(){
  if(!_trf)return;
  _trf.para=val('trf_para')||'';_trf.escrito={};
  imvTrfPintar();
}
/* O interruptor «Continuar como comproprietário»: liga ou desliga, mostra
   ou tira as quotas e reescreve a frase. O que estava escrito nas quotas
   guarda-se para voltar igual.
   Devolve: nada. */
function imvTrfFicar(){
  if(!_trf)return;
  imvTrfLer();
  _trf.ficar=!_trf.ficar;
  const b=document.getElementById('trfFicar');if(b)b.setAttribute('aria-checked',_trf.ficar?'true':'false');
  imvTrfPintar();
}
/* Escreveu-se numa quota: guarda e reescreve só a frase (o campo fica com o
   foco).
   Devolve: nada. */
function imvTrfEscreveu(){
  if(!_trf)return;
  imvTrfLer();
  const f=document.getElementById('trfFrase');if(f)f.innerHTML=imvTrfFrase();
}
/* Sem ligação aceite a ninguém, a folha leva às Pessoas › Proprietários,
   onde se dá o id e se escreve o do outro.
   Devolve: nada — fecha as janelas e muda de separador. */
function imvTrfLigar(){closeAllModals();go('owners')}
/* A folha «Transferir propriedade» (um imóvel) ou «Transferir N imóveis»
   (da seleção das Casas): o ⋯ da ficha e a barra da seleção abrem-na. Vão
   só os que criei e que não têm já um pedido pendente; os outros dizem-se
   no cimo, e se não sobrar nenhum diz-se porquê num aviso, sem folha. Sem
   nenhum proprietário ligado, a folha diz como ligar e leva às Pessoas ›
   Proprietários. O rodapé é Cancelar e «Pedir transferência»
   (imvTrfPedir).
   Recebe: ids — o id de um imóvel, ou um array deles; aoPedir (opcional) —
   função chamada depois de o pedido seguir (a seleção sai da seleção).
   Devolve: nada — abre a folha (ou avisa). */
function imvTransferir(ids,aoPedir){
  const ps=(Array.isArray(ids)?ids:[ids]).map(prop).filter(Boolean);
  if(!ps.length)return;
  if(!imvTrfDisponivel())return toast('A transferência precisa de sessão e do servidor. Tenta outra vez daqui a pouco.');
  const naoMeus=ps.filter(p=>!souCriador(p.id)),pend=ps.filter(p=>souCriador(p.id)&&notifTransfDaCasa('outgoing',p.id));
  const vao=ps.filter(p=>naoMeus.indexOf(p)<0&&pend.indexOf(p)<0);
  if(!vao.length)return toast(naoMeus.length?(ps.length===1?'Só quem criou o imóvel o pode transferir.':'Só quem criou um imóvel o pode transferir.')
    :(pend.length===1?'Este imóvel já tem uma transferência pendente.':'Estes imóveis já têm transferências pendentes.'));
  const destinos=imvTrfDestinos();
  _trf={ids:vao.map(p=>p.id),naoMeus:naoMeus.map(p=>p.id),pend:pend.map(p=>p.id),para:destinos.length===1?destinos[0].id:'',
    ficar:false,escrito:{},aoPedir:typeof aoPedir==='function'?aoPedir:null,enviando:false};
  const titulo=vao.length===1?'Transferir propriedade':'Transferir '+vao.length+' imóveis';
  const cancelar='<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button>';
  let L;
  if(!destinos.length){
    const onde=servicoLigado('owners')?'Em Pessoas › Proprietários':'Na página Segurança das Definições';
    L=openModal(titulo,`<div class="form trf-form"><p>Só podes transferir para um proprietário ligado a ti, e ainda não tens nenhuma ligação aceite.</p>
      <p class="hint">${onde}, dá o teu id ao outro ou escreve o dele. Quando a ligação for aceite, volta aqui.</p></div>`,
      cancelar+(servicoLigado('owners')?'<button type="button" class="btn primary" data-toca="ecra" data-click="imvTrfLigar()">Ir para os proprietários</button>':''));
  }else{
    L=openModal(titulo,imvTrfCorpo(destinos),cancelar+'<button type="button" class="btn primary" data-toca="dados" data-click="imvTrfPedir()">Pedir transferência</button>');
  }
  if(L){L.trfFolha=true;L.aoFechar=()=>{_trf=null}}
}
/* «Pedir transferência»: valida — quem recebe (o erro no «Para quem») e,
   com o interruptor ligado, as quotas de cada imóvel (o erro no campo:
   imvTrfQuotasDe) — e pede ao servidor (CW.pedirTransferencia). Com a
   resposta, a folha fecha, o aviso diz a quem foi e que até aceitar se
   cancela na ficha, e o estado relê-se: a ficha passa a mostrar o pendente.
   Um erro do servidor diz-se junto do «Para quem» quando é sobre ele, ou num
   aviso, e a folha fica. Um segundo toque com o pedido a meio não repete.
   Devolve: nada. */
function imvTrfPedir(){
  if(!_trf||_trf.enviando)return;
  if(!_trf.para)return falhaCampo('selb_trf_para','Escolhe para quem transferes.');
  const t=_trf,shares={};
  if(t.ficar){
    imvTrfLer();
    for(const hid of t.ids){const r=imvTrfQuotasDe(hid);if(r.campo)return falhaCampo(r.campo,r.msg);shares[hid]=r.q}
  }
  const f=window.CW&&CW.pedirTransferencia;
  if(typeof f!=='function')return toast('A transferência precisa de sessão e do servidor. Tenta outra vez daqui a pouco.');
  const nome=imvTrfNomeDe(t.para),um=t.ids.length===1;
  t.enviando=true;
  Promise.resolve(f({houseIds:t.ids.slice(),toUserId:t.para,ficar:t.ficar,shares:t.ficar?shares:undefined})).then(()=>{
    t.enviando=false;
    if(modalTop()&&modalTop().trfFolha)closeModal();
    toast('Pedido enviado a '+nome+'. Até aceitar, nada muda: podes cancelá-lo na ficha '+(um?'do imóvel.':'de cada imóvel.'),{ms:5000});
    if(t.aoPedir)try{t.aoPedir()}catch(e){}
    return Promise.resolve(typeof pullNow==='function'?pullNow(true):null).catch(()=>{}).then(()=>render());
  },e=>{
    t.enviando=false;
    const msg=(e&&e.message)||'Não deu para pedir a transferência. Tenta outra vez.';
    if(/ligado a ti/.test(msg))return falhaCampo('selb_trf_para',msg);
    toast(msg);
  });
}
/* A transferência pendente na ficha do imóvel: a quem fiz o pedido, que até
   ele aceitar nada muda, as outras casas do mesmo pedido (cancelar cancela o
   pedido todo) e o Cancelar (notificacoes.js:notifTransfCancelar). Num
   imóvel que me querem transferir (e que já vejo, como comproprietário), o
   pedido com o «Ver» (notificacoes.js:notifTransfVer).
   Recebe: p — o imóvel.
   Devolve: o HTML do cartão, ou ''. */
function imvTrfNaFicha(p){
  if(!p||!meuId())return '';
  const nomes=(t,fora)=>(t.houses||[]).filter(h=>h&&h.id!==fora).map(h=>esc(String(h.name||'').trim()||propName(h.id)||'Sem nome'));
  const cartao=(titulo,sub,botao)=>`<div class="card imv-trf"><span class="imv-trf-ic" aria-hidden="true">${ic('swap',18)}</span><div class="imv-trf-txt"><b>${titulo}</b><span class="small">${sub}</span></div>${botao}</div>`;
  const env=notifTransfDaCasa('outgoing',p.id);
  if(env){
    const quem=esc(notifTransfNome(env.to)),outras=nomes(env,p.id);
    return cartao('Transferência pendente para '+quem,
      (env.ficar?'Continuas comproprietário quando aceitar. ':'')+'Até '+quem+' aceitar, nada muda.'+(outras.length?' O pedido leva também '+listaE(outras)+': cancelar cancela o pedido todo.':''),
      `<button type="button" class="btn sm" data-toca="dados" aria-label="Cancelar o pedido de transferência" data-click="notifTransfCancelar('${jsq(env.lote)}')">Cancelar</button>`);
  }
  const rec=notifTransfDaCasa('incoming',p.id);
  if(rec)return cartao(esc(notifTransfNome(rec.from))+' quer transferir-te este imóvel',esc(notifTransfSub(rec)),
    `<button type="button" class="btn sm primary" data-toca="camada" data-click="notifTransfVer('${jsq(rec.lote)}')">Ver</button>`);
  return '';
}
