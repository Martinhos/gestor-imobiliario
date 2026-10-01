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
  const m=id&&souCriador(id)?menu('prop',[{label:'Apagar imóvel',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delProp('${id}')`}]):'';
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
    /* o capital de cada hipoteca é obrigatório (o asterisco de loanSect): a
       dobra pode estar fechada, e abre-se antes de apontar o campo */
    const semCapital=servicoLigado('credits')?(pForm.loans||[]).find(l=>!(capitalDoInicio(l,db.transactions)>0)):null;
    if(semCapital){
      const f=document.getElementById('fold_loans');if(f&&!f.classList.contains('open'))toggleFold('loans');
      return falhaCampo('l_out_'+semCapital.id,'Indica o capital em dívida.');
    }
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
/* O corpo da ficha de um imóvel: o que se sabe sobre ele, para ler.

   O que é sempre visível (morada, destino, quartos, donos) e o resto conforme
   o cargo — fotos com file.view, valores e a linha fiscal com report.view,
   hipotecas com loan.view. Nunca o bloco de quotas nem os comentários dos donos: o servidor
   já não os manda a quem colabora. E conforme os serviços ligados nesta conta:
   o estado e os contratos ativos são dos Contratos, o bloco das hipotecas é
   dos Créditos — desligados, a ficha não os mostra.
   Recebe: id — o id do imóvel.
   Devolve: o HTML do corpo, ou vazio se o imóvel já não existir. */
function propFicha(id){
  const p=prop(id);if(!p)return '';
  const vCt=pode(id,'contract.view')&&servicoLigado('contracts'),vLoan=pode(id,'loan.view')&&servicoLigado('credits');
  const st=vCt?propStatus(p):null,ls=loansOf(p),c=cargoDe(id);
  const dono=p._sharedFrom||(p._ownerUserId?nomeUtilizador(p._ownerUserId):''),ac=vCt?activeContracts(id):[];
  const reg=[p.freguesia||p.parish,p.freguesiaCodigo?'freguesia n.º '+p.freguesiaCodigo:'',p.concelho,p.distrito,
    p.tipoPredio==='U'?'urbano':p.tipoPredio==='R'?'rústico':'',p.tipologia,
    p.fraction?'fração '+p.fraction:'',p.floor,p.registry?'n.º '+p.registry:'',p.matrix?'artigo '+p.matrix:'',p.energyClass?'classe '+p.energyClass:''].filter(Boolean).map(esc).join(' · ');
  /* o que o Anexo F e o Anexo G pedem e não é dado registal: o VPT (reparte os gastos
     quando só se arrenda parte do imóvel) e o dia em que o imóvel foi comprado */
  const fisco=[p.vpt?'VPT '+euro(p.vpt):'',p.purchaseDate?'adquirido a '+dPT(p.purchaseDate):''].filter(Boolean).join(' · ');
  /* as despesas fixas são planeados (dos Planeados): vê-as quem é dono ou vê planeados */
  const fixas=servicoLigado('recurring')&&(c.dono||pode(id,'rec.view'))?despesasFixasTxt(p):'';
  const corpo=ficha([
    {rotulo:'Morada',valor:esc(p.address||'')},
    {rotulo:'Destino',valor:p.use==='proprio'?'Uso próprio':'Arrendamento'+(p.rentalMode==='quartos'?' · por quartos':' · imóvel inteiro')},
    st?{rotulo:'Estado',valor:esc(st.label)}:null,
    (p.rooms||[]).length?{rotulo:'Quartos',valor:(p.rooms||[]).map(r=>esc(r.name)).join(', ')}:null,
    {rotulo:'Proprietários',valor:esc(ownerNames(p))},
    ac.length?{tipo:'bloco',rotulo:'Contratos ativos',valor:ac.map(x=>`${x.roomId?esc(roomName(p,x.roomId))+': ':''}${esc(ctNames(x))} · ${euro(x.rent)}`).join('<br>')}:null,
    pode(id,'report.view')?{rotulo:'Valor de mercado',valor:euro(p.value)}:null,
    pode(id,'report.view')?{rotulo:'Valor de aquisição',valor:euro(p.purchase)}:null,
    pode(id,'report.view')&&fisco?{rotulo:'Fiscal',valor:fisco}:null,
    fixas?{tipo:'bloco',rotulo:'Despesas fixas',valor:esc(fixas)+'<br><span class="u-c-v-muted">Criam os planeados sozinhas.</span>'}:null,
    vLoan&&ls.length?{tipo:'bloco',rotulo:'Hipotecas',
      valor:ls.map(l=>`${esc(loanName(l))} · ${euro2(loanCalc(l).total)}/mês · ${euro(l.outstanding)} em dívida`).join('<br>')}:null,
    pode(id,'file.view')&&(p.photos||[]).length?{tipo:'bloco',rotulo:'Fotos',
      valor:`<div class="u-d-flex u-fxw-wrap u-g-8px">${(p.photos||[]).map(f=>`<div class="pcover u-w-84px u-h-66px u-br-10px u-bg-v-chip u-ov-hidden" id="th_${esc(f.id)}"></div>`).join('')}</div>`}:null,
    reg?{tipo:'bloco',rotulo:'Dados registais',valor:reg}:null,
    p.listing?{tipo:'bloco',rotulo:'Anúncio',valor:esc(p.listing)}:null,
  ]);
  if(c.dono)return corpo;
  /* quem colabora lê primeiro o que o cargo lhe deixa fazer aqui, e tem os
     botões à mão; o «Editar a ficha» é o «Editar» do rodapé */
  const podes=frasePodesNoImovel(id);
  const acoes=acoesNoImovel(id).filter(a=>a.perm!=='house.edit');
  const nota=`${dono?'Imóvel de <b>'+esc(dono)+'</b>. ':''}És colaborador${c.nome?' como <b>'+esc(c.nome)+'</b>':''}${pode(id,'house.edit')?'.':acoes.length?' — os dados do imóvel são só de leitura.':' — a ficha é só de leitura.'}`
    +(podes?`<span class="u-d-block u-mt-4px">${esc(podes)}</span>`:'');
  /* um botão que muda de ecrã fecha antes a ficha, senão ela ficava por cima */
  const botoes=acoes.map((a,i)=>`<button type="button" class="btn${i?'':' primary'}" data-toca="${a.toca}" data-click="${a.toca==='ecra'?'closeAllModals();':''}${a.act}">${ic(a.icon,16)} ${esc(a.rotulo)}</button>`).join('');
  return ficha([{tipo:'nota',valor:nota}])+(botoes?`<div class="colab-acoes u-mt-12px">${botoes}</div>`:'')+`<div class="u-mt-14px">${corpo}</div>`;
}
/* A ficha de um imóvel: o que tocar num imóvel passa a abrir.

   Era só para quem colabora sem poder editar; toda a gente apanhava, ao
   tocar, um formulário de vinte e um campos com o «Apagar imóvel» encostado
   ao título. Agora tocar lê, e editar é um passo deliberado — o botão do
   rodapé, que só existe para quem pode.
   Recebe: id — o id do imóvel.
   Devolve: nada — abre a janela. */
function propView(id){
  const p=prop(id);if(!p)return;
  abrirFicha({
    titulo:()=>{const x=prop(id);return x?x.name:'Imóvel'},
    corpo:()=>propFicha(id),
    menu:()=>souCriador(id)?menu('fichaProp',[{label:'Apagar imóvel',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delProp('${jsq(id)}')`}]):'',
    editar:pode(id,'house.edit')?{rotulo:'Editar',act:`propModal('${jsq(id)}')`}:null,
    depois:()=>{if(pode(id,'file.view')){const x=prop(id);if(x)paintThumbs(x.photos)}},
  });
}
/* O nome de um mês por extenso, para o menu do mês do seguro e a ficha.
   Recebe: m — o mês (1–12).
   Devolve: o nome em minúsculas (texto); '' fora de 1–12. */
function nomeDoMes(m){return ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][m-1]||''}
/* As despesas fixas de um imóvel numa linha: «IMI 400,00 €/ano · Condomínio
   55,00 €/mês · Seguro 96,00 €/ano em agosto». É o resumo da dobra do
   formulário e a linha da ficha.
   Recebe: p — o imóvel.
   Devolve: o texto (sem escapar); '' sem nenhum valor. */
function despesasFixasTxt(p){
  return [p.imi>0?'IMI '+euro2(p.imi)+'/ano':'',p.condominio>0?'Condomínio '+euro2(p.condominio)+'/mês':'',
    p.seguro>0?'Seguro '+euro2(p.seguro)+'/ano'+(p.seguroMes?' em '+nomeDoMes(p.seguroMes):''):''].filter(Boolean).join(' · ');
}
/* A dobra «Despesas fixas do imóvel» do formulário: o IMI, o condomínio, o
   seguro e o mês dele. Cada valor cria um planeado (planeados.js:syncPropRecs),
   e a explicação diz em que datas — é dos Planeados, e sem esse serviço na
   conta não se pede o que não criaria nada.
   Devolve: o HTML da dobra (texto); '' sem os Planeados. */
function fixasSect(){
  if(!servicoLigado('recurring'))return '';
  const p=pForm,meses=[{v:0,label:'O mês em que o guardares'}].concat([...Array(12)].map((_,i)=>({v:i+1,label:nomeDoMes(i+1)})));
  return fold('fixas','Despesas fixas do imóvel',`
      <div class="row3">
        <label>IMI (€/ano)<input id="p_imi" type="text" inputmode="decimal" value="${p.imi||''}" placeholder="Opcional"></label>
        <label>Condomínio (€/mês)<input id="p_condominio" type="text" inputmode="decimal" value="${p.condominio||''}" placeholder="Opcional"></label>
        <label>Seguro (€/ano)<input id="p_seguro" type="text" inputmode="decimal" value="${p.seguro||''}" placeholder="Opcional"></label></div>
      <label>Mês do seguro${sel('p_seguroMes',p.seguroMes||0,meses,'','rascunho')}</label>
      <div class="hint">Cada valor cria um planeado que pede confirmação na data, e o valor vive aqui: apagar o planeado apaga-o daqui.
        O IMI sai nas prestações da lei: até 100 € numa só, em maio; de 100 a 500 € em maio e novembro; acima de 500 € em maio, agosto e novembro — no último dia do mês.
        O condomínio no dia 1 de cada mês; o seguro uma vez por ano, no fim do mês escolhido.</div>`,
    {icon:'clock',open:!!(p.imi>0||p.condominio>0||p.seguro>0),summary:esc(despesasFixasTxt(p))||'nenhuma'});
}
/* Constrói o HTML do formulário do imóvel a partir de pForm: proprietários e
   quotas-partes, destino, quartos, valores, despesas fixas, fotos, dados
   registais, hipotecas e anúncio. Só lê — quem escreve de volta é collectProp().
   Devolve: string de HTML do formulário, pronta a inserir com innerHTML. */
function propBody(){
  const p=pForm,ls=p.loans||[];
  const owners=(p.ownerIds||[]).map(owner).filter(Boolean);
  const shares=sharesOf(p),custom=hasShares(p);
  const sumSh=sum(owners.map(o=>Number((p.ownerShares||{})[o.id])||0));
  return `<div class="form">
    <label>Nome <span class="req">*</span><input id="p_name" value="${esc(p.name)}" placeholder="Ex: T2 Lisboa" autocomplete="off"></label>
    <label>Morada<input id="p_addr" value="${esc(p.address)}" placeholder="Opcional" autocomplete="off"></label>
    <div><div class="flabel">Proprietários e quota-parte (%, opcional)</div>
      <div class="form u-g-7px">
        ${owners.map(o=>`<div class="ownrow"><span class="avatar u-w-30px u-h-30px u-fs-11px u-fx-0-0-30px">${esc(initials(o.name))}</span>
          <span class="nm">${esc(o.name)}</span>
          <input id="p_share_${o.id}" type="text" inputmode="decimal" value="${(p.ownerShares||{})[o.id]!=null?dec(p.ownerShares[o.id]):''}" placeholder="Ex: ${dec(Math.round(shares[o.id]*1000)/10)}" data-input="liveShares()">
          <span class="pc">%</span>
          <button type="button" class="btn sm danger" data-toca="rascunho" data-click="delPropOwner('${o.id}')">${ic('x',13)}</button></div>`).join('')}
        <button type="button" class="tagadd u-js-start" data-toca="camada" data-click="addPropOwner()">+ Adicionar proprietário</button></div>
      <div class="hint u-mt-7px" id="shareHint">${shareHint(owners,custom,sumSh)}</div></div>
    <div><div class="flabel">Destino do imóvel</div>
      <div class="seg c2">${[['investimento','key','Arrendamento','para render'],['proprio','home','Uso próprio','vivo cá']]
        .map(([k,i,lb,s])=>`<button type="button" class="opt ${p.use===k?'on':''}" data-toca="rascunho" data-click="setUse('${k}')"><span class="ic">${ic(i,18)}</span><b>${lb}</b><small>${s}</small></button>`).join('')}</div></div>
    ${p.use==='investimento'?`
      <div><div class="flabel">Tipo de arrendamento</div>
        <div class="seg c2">${[['inteiro','building','Imóvel inteiro','um contrato só'],['quartos','door','Por quartos','um contrato por quarto']]
          .map(([k,i,lb,s])=>`<button type="button" class="opt ${p.rentalMode===k?'on':''}" data-toca="rascunho" data-click="setMode('${k}')"><span class="ic">${ic(i,18)}</span><b>${lb}</b><small>${s}</small></button>`).join('')}</div></div>
      ${p.rentalMode==='quartos'?`<div><div class="flabel">Quartos (nome opcional)</div>
        <div class="form u-g-8px">${(p.rooms||[]).map(r=>`<div class="roomrow">
          <input id="p_room_${r.id}" value="${esc(r.name)}" placeholder="Ex: Quarto da varanda" autocomplete="off">
          <button type="button" class="btn sm danger" data-toca="rascunho" data-click="delRoom('${r.id}')">${ic('trash',14)}</button></div>`).join('')}
          <button type="button" class="btn sm" data-toca="rascunho" data-click="addRoom()">${ic('plus',14)} Adicionar quarto</button></div></div>`:''}`:''}
    <div class="row3">
      <label>Valor de mercado (€)<input id="p_value" type="text" inputmode="decimal" value="${p.value||''}" placeholder="Opcional"></label>
      <label>Valor de aquisição (€)<input id="p_purchase" type="text" inputmode="decimal" value="${p.purchase||''}" placeholder="Opcional"></label>
      <label>Data de aquisição<input id="p_purchaseDate" type="date" value="${p.purchaseDate||''}"></label></div>
    ${fixasSect()}
    ${fold('photos','Fotos',fileBlock('',p.photos||[],'p_photoin','propAddPhotos','delPropPhoto',{photos:true,move:1,hint:'A primeira foto é a capa do imóvel. Arrasta pelo puxador para reordenar.'}),{icon:'photo',open:!!(p.photos||[]).length,summary:(p.photos||[]).length?p.photos.length+' foto'+(p.photos.length===1?'':'s'):'nenhuma'})}
    ${fold('reg','Dados registais',`
      <div class="row">
        <label>Freguesia<input id="p_freguesia" value="${esc(p.freguesia||p.parish||'')}" placeholder="Opcional"></label>
        <label>Concelho<input id="p_concelho" value="${esc(p.concelho||'')}" placeholder="Opcional"></label></div>
      <div class="row3">
        <label>Distrito<input id="p_distrito" value="${esc(p.distrito||'')}" placeholder="Opcional"></label>
        <label>Código da freguesia (opcional)<input id="p_freguesiaCodigo" value="${esc(p.freguesiaCodigo||'')}" inputmode="numeric" maxlength="6" placeholder="Ex: 110623" autocomplete="off"></label>
        <label>Tipo de prédio${sel('p_tipoPredio',p.tipoPredio||'',[{v:'',label:'—'},{v:'U',label:'Urbano'},{v:'R',label:'Rústico'}],'','rascunho')}</label></div>
      <div class="row">
        <label>Tipologia${sel('p_tipologia',p.tipologia||'',[{v:'',label:'—'}].concat(['T0','T1','T2','T3','T4','T5','T6'].map(x=>({v:x,label:x}))),'','rascunho')}</label>
        <label>VPT (€)<input id="p_vpt" type="text" inputmode="decimal" value="${p.vpt||''}" placeholder="Opcional"></label></div>
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
        O VPT serve para repartir os gastos quando só se arrenda parte do imóvel. A data de aquisição fica guardada para o dia em que venderes (Anexo G).</div>`,
      {icon:'contract',summary:[esc(p.freguesia||p.parish||''),p.freguesiaCodigo?'freguesia n.º '+esc(p.freguesiaCodigo):'',p.registry?'n.º '+esc(p.registry):''].filter(Boolean).join(' · ')||'para o contrato'})}
    ${!servicoLigado('credits')?'':fold('loans','Hipotecas',`
        ${ls.map((l,i)=>loanSect(l,i)).join('')}
        ${ls.length>1?`<div class="card u-bg-v-tint u-p-12px">
          <div class="stat u-pt-0 u-b-0"><span>Total das prestações</span><b class="u-fs-16px">${euro2(payOf(p))}/mês</b></div>
          <div class="hint">${euro(debtOf(p))} em dívida no total.</div></div>`:''}
        <button type="button" class="addbox" data-toca="rascunho" data-click="addLoan()">
          <span class="ic">${ic('bank',20)}</span>
          <span><b>${ls.length?'Adicionar outra hipoteca':'Adicionar hipoteca'}</b><small>${ls.length?'crédito para obras, consolidação, segunda hipoteca…':'crédito à aquisição ou outro'}</small></span>
          <span class="plus">${ic('plus',18)}</span></button>
      ${ls.length?`<div class="hint">Um imóvel pode ter várias hipotecas em simultâneo. Todas contam para a dívida e para o LTV.</div>`:''}`,
      {icon:'bank',open:!!ls.length,summary:ls.length?(ls.length+(ls.length===1?' hipoteca · ':' hipotecas · ')+euro2(payOf(p))+'/mês'):'nenhuma'})}
    ${fold('text','Anúncio',`<label>Descrição para anúncios<textarea id="p_listing" placeholder="Opcional">${esc(p.listing||'')}</textarea></label>`,
      {icon:'file',open:!!p.listing,summary:p.listing?'com texto':''})}
    <div class="hint">A renda, as datas e os inquilinos ficam no contrato, não aqui.</div>
    ${richEditor('Comentários dos proprietários','p_notes',p.notes,'Opcional')}</div>`;
}
// Secção de uma hipoteca no formulário: campos consoante o tipo de taxa,
// caixa de simulação e documentos. O i serve só para o título por omissão.
// Recebe: l — a hipoteca (objeto de normLoan); i — a posição dela na lista (a
// contar do zero), para o título "Hipoteca N" quando não tem nome.
// Devolve: string de HTML da secção, pronta a inserir com innerHTML.
function loanSect(l,i){
  return `<div class="sect">
    <div class="sect-head"><span class="ic">${ic('bank',18)}</span><b>${esc(l.name||'Hipoteca '+(i+1))}</b><span class="spacer"></span>
      <button type="button" class="btn sm danger" data-toca="dados" data-risco="destroi" data-click="delLoan('${l.id}')">${ic('trash',14)}</button></div>
    <div class="row">
      <label>Finalidade<input id="l_name_${l.id}" value="${esc(l.name)}" placeholder="Opcional" autocomplete="off" data-input="liveLoan('${l.id}')"></label>
      <label>Banco<input id="l_bank_${l.id}" value="${esc(l.bank)}" placeholder="Opcional" autocomplete="off"></label></div>
    <div class="row3">
      <label>Capital em dívida (€) <span class="req">*</span><input id="l_out_${l.id}" type="text" inputmode="decimal" value="${capitalDoInicio(l,db.transactions)||''}" placeholder="Ex: 150000" data-input="liveLoan('${l.id}')"></label>
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
  (p.photos||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
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
// Muda o destino do imóvel (arrendamento/uso próprio) e repinta — os campos
// visíveis dependem dele.
// Recebe: u — o destino: 'investimento' ou 'proprio'.
// Devolve: nada — redesenha a vista.
function setUse(u){collectProp();pForm.use=u;repaintProp()}
// Muda o tipo de arrendamento; ao passar a quartos sem nenhum criado, semeia
// dois para a lista não aparecer vazia.
// Recebe: m — o tipo de arrendamento: 'inteiro' ou 'quartos'.
// Devolve: nada — redesenha a vista.
function setMode(m){
  collectProp();pForm.rentalMode=m;
  if(m==='quartos'&&!(pForm.rooms||[]).length)pForm.rooms=[{id:uid(),name:'Quarto 1'},{id:uid(),name:'Quarto 2'}];
  repaintProp();
}
// Acrescenta um quarto com nome sequencial e repinta.
// Devolve: nada — redesenha a vista.
function addRoom(){collectProp();pForm.rooms.push({id:uid(),name:'Quarto '+(pForm.rooms.length+1)});repaintProp()}
/* Tira um quarto do formulário. Se algum contrato apontava para ele, perde já
   a ligação em db.contracts (não espera pelo Guardar do imóvel) e avisa.
   Recebe: rid — o id do quarto a tirar.
   Devolve: nada — redesenha a vista. */
function delRoom(rid){
  collectProp();
  const used=db.contracts.some(c=>c.roomId===rid);
  pForm.rooms=pForm.rooms.filter(r=>r.id!==rid);
  if(used){db.contracts.forEach(c=>{if(c.roomId===rid)c.roomId=null});toast('O contrato desse quarto ficou sem quarto associado.')}
  repaintProp();
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
  const row=h.closest('.prow');if(!row)return;
  const list=row.parentNode,rows=[...list.querySelectorAll('.prow')];
  idx=rows.indexOf(row);
  const step=(rows.length>1&&rows[1].offsetTop-rows[0].offsetTop)||row.offsetHeight+8||60;
  _pd={idx,to:idx,row,rows,step,y0:e.clientY};
  row.classList.add('drag');
  try{h.setPointerCapture(e.pointerId)}catch(x){}
  /* com o ponteiro capturado, tudo chega ao próprio puxador */
  h.onpointermove=photoDragMove;
  const done=()=>{h.onpointermove=h.onpointerup=h.onpointercancel=null;
    document.removeEventListener('pointermove',photoDragMove);document.removeEventListener('pointerup',done);document.removeEventListener('pointercancel',done);
    photoDragEnd()};
  h.onpointerup=h.onpointercancel=done;
  /* rede de segurança para ambientes onde a captura não redirige os eventos */
  document.addEventListener('pointermove',photoDragMove);
  document.addEventListener('pointerup',done);
  document.addEventListener('pointercancel',done);
}
// Durante o arrasto: a linha agarrada segue o ponteiro e as outras deslocam-se
// para mostrar onde ela vai cair.
// Recebe: e — o PointerEvent do movimento.
// Devolve: nada — mexe nos transforms das linhas.
function photoDragMove(e){
  if(!_pd)return;
  e.preventDefault();
  const dy=e.clientY-_pd.y0;
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
// Largar a foto: limpa os transforms e, se a posição mudou, aplica a nova
// ordem a pForm.photos e ajusta o DOM e a etiqueta de capa à mão.
// Devolve: nada — atualiza pForm.photos e a lista no DOM.
function photoDragEnd(){
  if(!_pd)return;
  const {idx,to,row,rows}=_pd;
  rows.forEach(r=>{r.style.transform='';r.classList.remove('drag')});
  _pd=null;
  if(to===idx)return;
  collectProp();
  const a=pForm.photos,x=a.splice(idx,1)[0];a.splice(to,0,x);
  /* move só a linha no DOM: repintar tudo recarregava as miniaturas e demorava */
  const list=row.parentNode,ref=rows[to];
  if(to>idx)list.insertBefore(row,ref.nextSibling);else list.insertBefore(row,ref);
  list.querySelectorAll('.capa').forEach(x2=>x2.remove());
  const first=list.querySelector('.prow .pth');
  if(first)first.insertAdjacentHTML('afterbegin','<span class="capa">capa</span>');
}
// Tira uma foto do imóvel e apaga o blob e a miniatura do IndexedDB.
// Recebe: fid — o id da foto a tirar.
// Devolve: nada — redesenha a vista.
function delPropPhoto(fid){collectProp();pForm.photos=(pForm.photos||[]).filter(f=>f.id!==fid);idbDel(fid).catch(()=>{});idbDel('tn_'+fid).catch(()=>{});repaintProp()}
// Abre a lista dos proprietários ainda não associados para escolher um, com
// atalho para criar um novo — esse é dos Proprietários, e só aparece com o
// serviço ligado nesta conta.
// Devolve: nada — abre a janela de escolha.
function addPropOwner(){
  collectProp();
  const free=db.owners.filter(o=>(pForm.ownerIds||[]).indexOf(o.id)<0);
  pickModal('Escolher proprietário',free.map(o=>({v:o.id,label:o.name,sub:[o.phone,o.email].filter(Boolean).join(' · '),avatar:true})),
    o=>{pForm.ownerIds.push(o.v);closeModal();repaintProp()},
    servicoLigado('owners')?`<button type="button" class="btn u-w-100pc u-jc-center" data-toca="camada" data-click="newOwnerFromProp()">${ic('plus',15)} Criar proprietário novo</button>`:'');
}
// Desassocia um proprietário do imóvel e esquece a quota-parte dele.
// Recebe: oid — o id do proprietário a desassociar.
// Devolve: nada — redesenha a vista.
function delPropOwner(oid){collectProp();pForm.ownerIds=(pForm.ownerIds||[]).filter(x=>x!==oid);if(pForm.ownerShares)delete pForm.ownerShares[oid];repaintProp()}
// Cria um proprietário novo a partir da ficha do imóvel: abre a ficha de
// pessoa (dos Proprietários — com o serviço desligado nesta conta avisa e
// não abre) e, ao gravar, associa-o logo ao imóvel em edição.
// Devolve: nada — abre a ficha de pessoa.
function newOwnerFromProp(){
  closeModal();   /* fecha a lista de escolha; a ficha nova abre por cima do imóvel */
  chamarServico('owners','personModal','owner',null,nid=>{if(pForm.ownerIds.indexOf(nid)<0)pForm.ownerIds.push(nid);closeModal();render();repaintProp();toast('Proprietário criado.')});
}
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
   movimentos acerta-se (acertarLotesSemImovel).
   Recebe: id — o id do imóvel a apagar.
   Devolve: nada — abre a confirmação; só se apaga depois do sim. */
function delProp(id){
  const p=prop(id),n=contractsOf(id).length;
  if(!p)return;
  /* só quem criou o imóvel o apaga: nem comproprietários, nem colaboradores */
  if(!souCriador(id))return toast('Só quem criou o imóvel o pode apagar.');
  confirmModal('Apagar imóvel',`Apagar “${esc(p.name)}”${n?`, os seus ${n} contratos`:''} e todos os movimentos associados?`,()=>{
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
