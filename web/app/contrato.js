/* ================= CONTRATO ================= */
let cForm={};
/* O corpo da ficha de um contrato: o que se sabe sobre ele, para ler.

   Pela ordem das perguntas que trazem alguém aqui: ainda está em vigor, quem
   lá mora, quanto paga, quando acaba — e só depois o que ficou combinado (dia
   de pagamento, caução, aumento, chaves e recheio).

   As datas ficam como a app as escreve em todo o lado. Um formato português
   só aqui dava duas maneiras de escrever a mesma data no mesmo ecrã.
   Recebe: id — o id do contrato.
   Devolve: o HTML do corpo, ou vazio se o contrato já não existir. */
function ctFicha(id){
  const c=contract(id);if(!c)return '';
  const pid=c.propertyId,p=prop(pid),ts=ctTenants(c);
  const inv=c.inventory||[],chaves=c.keys||[],rec=ctRecOf(c);
  const fotos=((p&&p.photos)||[]).filter(f=>(c.photoIds||[]).indexOf(f.id)>-1);
  const rendas=(db.transactions||[]).filter(t=>t.contractId===c.id&&t.kind==='income');
  const ultima=rendas.map(t=>t.date).sort().pop();
  const dias=c.end?pzDias(c.end):null;
  const contacto=(tel,email)=>[tel?fmtPhone(tel):'',email||''].filter(Boolean).join(' · ');
  /* O contacto do inquilino está escrito no CONTRATO, e o servidor manda o
     contrato inteiro a quem tem contract.view. O cargo «Contabilista», que a
     app traz de fábrica, tem contract.view e não tem tenant.view — sem esta
     guarda lia o contacto de quem não pode sequer abrir a ficha da pessoa. */
  const verPessoas=pode(pid,'tenant.view');
  const recusa=motivoRecusa(pid,'contract.add',c);
  return ficha([
    /* Sem botão «Editar» no rodapé, a ficha tem de dizer porquê — e não há
       uma só razão: há «não tens permissão» e há «só quem o adicionou pode
       alterar». Quem tem contract.add mas não criou este contrato lia uma
       frase que não era a sua. A app já sabe dizer a certa. */
    recusa?{tipo:'nota',valor:esc(recusa)}:null,
    /* três estados: dizer «Terminado» três linhas acima do campo «Início»,
       num contrato que começa em 2028, é uma afirmação falsa sobre um
       documento legal, no ecrã onde a pessoa a foi confirmar */
    {rotulo:'Estado',valor:ctEstado(c)==='ativo'?'Em vigor'
      :(ctEstado(c)==='futuro'?'Por começar'+(c.start?' · a '+esc(c.start):''):'Terminado')},
    /* só quando o imóvel existe mesmo: sem ele o ctLabel escreve «?», e um
       ponto de interrogação numa ficha é pior do que a linha não estar lá */
    p?{rotulo:'Imóvel',valor:esc(ctLabel(c))}:null,
    p&&p.rentalMode==='quartos'?{rotulo:'Parte arrendada',valor:c.roomId?esc(roomName(p,c.roomId)):'Imóvel inteiro'}:null,
    ts.length?{tipo:'bloco',rotulo:ts.length>1?'Inquilinos':'Inquilino',
      valor:ts.map(t=>[esc(t.name),verPessoas?esc(contacto(t.phone,t.email)):''].filter(Boolean).join(' · ')).join('<br>')}:null,
    c.rent>0?{rotulo:'Renda mensal',valor:euroS(c.rent)}:null,
    /* o bruto engana, e a marca de «estimado» é a mesma que os cartões já dão:
       o formulário guarda 0 para «em branco», e escrever «0%» era mentira */
    c.rent>0?{rotulo:'Imposto sobre a renda',valor:dec(taxRateOf(c))+'%'+(Number(c.taxRate)>0?'':' (estimado pela duração)')}:null,
    c.rent>0?{rotulo:'Renda líquida',valor:euroS(netRent(c))}:null,
    c.payDay?{rotulo:'Renda paga',valor:(c.payDayTo&&c.payDayTo>c.payDay)?('entre o dia '+c.payDay+' e o dia '+c.payDayTo):('no dia '+c.payDay)}:null,
    isActive(c)&&rec&&rec.next&&pode(pid,'rec.view')?{rotulo:'Próxima renda',valor:esc(rec.next)}:null,
    c.start?{rotulo:'Início',valor:esc(c.start)}:null,
    /* a contagem só quando já é acionável, senão é decoração */
    c.end?{rotulo:'Fim',valor:esc(c.end)+(dias>=0&&dias<=180?' · faltam '+dias+' dias':'')}:null,
    /* o prazo que custa um ano de contrato se passar: a app já o calcula nos
       prazos, e a ficha di-lo onde a pessoa está mesmo a olhar */
    isActive(c)&&c.end&&dias>=0&&dias<=150?{tipo:'nota',
      valor:'Para o contrato não renovar a '+esc(c.end)+', o aviso ao inquilino tem de seguir até <b>'+esc(pzAddDias(c.end,-120))+'</b> (120 dias).'}:null,
    c.increase!=null&&c.increase!==''?{rotulo:'Aumento anual',valor:dec(c.increase)+'%'+(c.start?' · próximo a '+esc(pzAniversario(c.start)):'')}:null,
    c.deposit>0?{rotulo:'Caução',valor:euroS(c.deposit)}:null,
    c.advance>0?{rotulo:'Rendas antecipadas',valor:c.advance+(Number(c.advance)===1?' mês':' meses')}:null,
    c.iban?{rotulo:'IBAN',valor:esc(fmtIBAN(c.iban))}:null,
    (c.ownerPhone||c.ownerEmail)?{rotulo:'Contacto do senhorio',valor:esc(contacto(c.ownerPhone,c.ownerEmail))}:null,
    verPessoas&&(c.tenantPhone||c.tenantEmail)?{rotulo:'Contacto do inquilino',valor:esc(contacto(c.tenantPhone,c.tenantEmail))}:null,
    inv.length?{tipo:'bloco',rotulo:'Inventário',
      valor:inv.map(i=>esc((i.qty||1)+'× '+(i.name||'artigo'))+(i.state==='novo'?' · novo':'')).join('<br>')}:null,
    chaves.length?{tipo:'bloco',rotulo:'Chaves entregues',
      valor:chaves.map(k=>esc((k.qty||1)+'× '+(k.name||'chave'))).join('<br>')}:null,
    pode(pid,'file.view')&&fotos.length?{tipo:'bloco',rotulo:'Registo fotográfico',
      valor:`<div style="display:flex;flex-wrap:wrap;gap:8px">${fotos.map(f=>`<div class="pcover" id="th_${esc(f.id)}" style="width:84px;height:66px;border-radius:10px;background:var(--chip);overflow:hidden"></div>`).join('')}</div>`}:null,
    pode(pid,'file.view')&&(c.files||[]).length?{tipo:'bloco',rotulo:'Anexos',
      valor:(c.files||[]).map(f=>`<span role="button" tabindex="0" data-toca="camada" style="cursor:pointer;text-decoration:underline" onclick="openMeta('${jsq(f.id)}')">${esc(f.name||'ficheiro')}</span>`).join('<br>')}:null,
    /* a pergunta a seguir a «quanto paga» é «já pagou» */
    pode(pid,'tx.view')&&rendas.length?{rotulo:'Rendas registadas',valor:rendas.length+(ultima?' · última a '+esc(ultima):'')}:null,
    String(c.notes||'').trim()?{tipo:'bloco',rotulo:'Notas',valor:rich(c.notes)}:null,
  ]);
}
/* A ficha de um contrato: o que tocar num contrato passa a abrir.

   Era um formulário de quarenta campos, com o «Apagar contrato» encostado ao
   título. Agora tocar lê, e editar é um passo — e as ações que não são ler
   nem editar (registar a renda, gerar o PDF, terminar, apagar) ficam no menu
   do cabeçalho, que é onde vivem as opções de um registo.
   Recebe: id — o id do contrato.
   Devolve: nada — abre a janela. */
function ctView(id){
  const c=contract(id);if(!c)return;
  const pid=c.propertyId,ok=podeEditar(pid,'contract.add',c);
  abrirFicha({
    titulo:()=>{const x=contract(id);return x?ctName(x):'Contrato'},
    corpo:()=>ctFicha(id),
    menu:()=>{
      const it=[];
      if(isActive(c)&&pode(pid,'tx.add'))it.push({label:'Registar renda',icon:'up',toca:'camada',act:`txModal(null,'income','${jsq(pid)}',null,'${jsq(id)}')`});
      it.push({label:'Gerar contrato em PDF',icon:'pen',toca:'camada',act:`generateContractPdf('${jsq(id)}')`});
      /* o «Reativar» apaga o c.end, e por isso só se oferece a quem
         terminou mesmo: num contrato por começar, um clique destruía a data
         de fim e o menu voltava a oferecê-lo, para sempre */
      if(ok)it.push(ctEstado(c)!=='terminado'?{label:'Terminar contrato',icon:'x',toca:'dados',act:`endContract('${jsq(id)}')`}
        :{label:'Reativar contrato',icon:'check',toca:'dados',act:`reactivateContract('${jsq(id)}')`},
        {label:'Apagar contrato',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delContract('${jsq(id)}')`});
      return it.length?menu('fichaCt',it):'';
    },
    editar:ok?{rotulo:'Editar',act:`ctModal('${jsq(id)}')`}:null,
    depois:()=>{const x=contract(id);if(!x||!pode(pid,'file.view'))return;
      const q=prop(x.propertyId);paintThumbs(((q&&q.photos)||[]).filter(f=>(x.photoIds||[]).indexOf(f.id)>-1))},
  });
}

/* Abre o modal de criar/editar contrato. Sem id é um contrato novo; pid
   pré-escolhe o imóvel (só se for de investimento, senão cai no primeiro
   arrendável). Trabalha sobre uma cópia em cForm — nada toca na base até
   o guardar. Recusa abrir se não houver imóveis de arrendamento.
   Recebe: id (opcional) — id do contrato a editar; sem ele cria um novo;
   pid (opcional) — id do imóvel a pré-escolher no contrato novo.
   Devolve: nada — abre o modal do contrato. */
function ctModal(id,pid){
  foldState={};
  /* Quem não pode alterar recebe a FICHA, e não este formulário com os campos
     apagados. E antes do openModal: não se decora uma janela já aberta,
     escolhe-se qual é a janela a abrir. */
  const _c=id?contract(id):null;
  if(_c&&!podeEditar(_c.propertyId,'contract.add',_c))return ctView(id);
  if(!db.properties.length)return toast('Cria primeiro um imóvel.');
  /* só onde posso adicionar contratos: os meus imóveis e os de colaboração com o cargo certo */
  const rentables=casasComo('contract.add').filter(p=>p.use==='investimento');
  if(!id&&!rentables.length)return toast(db.properties.some(p=>p.use==='investimento')?fraseSemPerm('contract.add'):'Nenhum imóvel de arrendamento. Muda o uso na ficha do imóvel para criar contratos.');
  cForm=normContract(id?JSON.parse(JSON.stringify(contract(id))):{propertyId:(pid&&(prop(pid)||{}).use==='investimento'&&pode(pid,'contract.add')?pid:rentables[0].id),start:today()});
  if(!id)fillOwnerContact();
  const ok=!!id&&podeEditar(cForm.propertyId,'contract.add',contract(id));
  const m=id?menu('ct',[{label:'Gerar contrato em PDF',icon:'pen',act:`generateContractPdf('${id}')`}].concat(ok?[
    ctEstado(cForm)!=='terminado'?{label:'Terminar contrato',icon:'x',act:`endContract('${id}')`}:{label:'Reativar contrato',icon:'check',act:`reactivateContract('${id}')`},
    {label:'Apagar contrato',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delContract('${id}')`}]:[])):'';
  openModal(id?'Editar contrato':'Novo contrato',ctBody(),null,m);
  const p=prop(cForm.propertyId);if(p)paintThumbs(p.photos);
  onSave=ctSaver();
}
/* Os movimentos confirmados que caem FORA das datas do contrato.

   De um lado e do outro: antes do início e depois do fim. São factos — o
   dinheiro entrou naquele dia — e por isso não se mexem nem se movem com o
   contrato; o que a app faz é dizer que deixaram de bater certo, para alguém
   olhar para eles um a um.
   Recebe: c — o contrato.
   Devolve: os movimentos fora da janela, por ordem de data. */
function movimentosForaDoContrato(c){
  if(!c||!c.id)return [];
  return (db.transactions||[]).filter(t=>t.contractId===c.id&&
    ((c.start&&t.date<c.start)||(c.end&&t.date>c.end)))
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
/* Mostra-os, um a um, para se poder abrir cada um e decidir.
   Recebe: id — o id do contrato.
   Devolve: nada — abre a lista de escolha. */
function verMovimentosFora(id){
  const c=contract(id);if(!c)return;
  const fora=movimentosForaDoContrato(c);
  if(!fora.length)return;
  pickModal('Fora das datas do contrato',fora.map(t=>({v:t.id,
    label:(t.label||'Movimento')+' · '+euro2(t.amount),
    sub:t.date+' · '+(c.start&&t.date<c.start?'antes do início ('+c.start+')':'depois do fim ('+c.end+')'),
    icon:'swap'})),o=>{closeModal();txView(o.v)},
    `<div class="hint" style="margin-top:12px">As datas destes movimentos não se mexem: dizem quando o dinheiro entrou. Abre cada um para corrigir o que for preciso.</div>`);
}
/* Devolve o handler que o modal usa ao guardar: valida imóvel, renda,
   inquilinos e datas, insere ou substitui o contrato em db.contracts,
   sincroniza o movimento recorrente da renda e persiste tudo.
   Devolve: a função de guardar (sem argumentos), pronta a pôr em onSave. */
function ctSaver(){
  return ()=>{
    collectCt();
    if(!cForm.propertyId)return toast('Escolhe o imóvel.');
    const recusa=motivoRecusa(cForm.propertyId,'contract.add',contract(cForm.id));if(recusa)return toast(recusa);
    if(!(cForm.rent>0))return falhaCampo('c_rent','Indica a renda mensal.');
    if(!cForm.tenantIds.length)return toast('Escolhe pelo menos um inquilino.');
    /* um fim antes do início guardava sem aviso e o contrato sumia das
       rendas e projeções, sem sinal nenhum do porquê */
    if(cForm.start&&cForm.end&&cForm.end<cForm.start)return falhaCampo('c_end','O fim do contrato é antes do início — verifica as datas.');
    const i=db.contracts.findIndex(x=>x.id===cForm.id);
    if(i<0)db.contracts.push(cForm);else db.contracts[i]=cForm;
    syncContractRec(cForm);
    save();closeModal();buildNav();render();
    /* O que é previsão acompanha o contrato; o que é FACTO fica onde está. A
       data de um movimento diz que o dinheiro entrou naquele dia, e mudá-la
       era dizer que entrou noutro — muda a receita do ano, o IRS, o cashflow
       e as contas entre proprietários. A app aponta, e a pessoa decide. */
    const fora=movimentosForaDoContrato(cForm);
    if(fora.length)return toast(fora.length===1?'1 movimento deste contrato está fora das datas dele.'
      :fora.length+' movimentos deste contrato estão fora das datas dele.',
      {rotulo:'Ver',ms:9000,fn:()=>verMovimentosFora(cForm.id)});
    toast('Contrato guardado.');
  };
}
// HTML do formulário do contrato, montado a partir de cForm. Só devolve a
// string — é o ctModal/repaintCt que a põe no modal e pinta as miniaturas.
// Devolve: string com o HTML do formulário do contrato.
function ctBody(){
  const c=cForm,p=prop(c.propertyId),rooms=(p&&p.rentalMode==='quartos')?(p.rooms||[]):[];
  /* ctVivo: é o único aviso contra assinar dois contratos para o mesmo
     quarto, e um quarto prometido para 2028 já está prometido */
  const taken=db.contracts.filter(x=>x.id!==c.id&&x.propertyId===c.propertyId&&ctVivo(x)).map(x=>x.roomId);
  const tags=ctTenants(c).map(t=>({id:t.id,label:t.name}));
  const inv=c.inventory||[];
  const nSum=(c.keys||[]).length?sum(c.keys.map(k=>k.qty))+' chaves':'';
  return `<div class="form">
    <label>Nome do contrato<input id="c_name" value="${esc(c.name||'')}" placeholder="${esc(ctPick(c)||'Ex.: Ana · T2 Lisboa')}" autocomplete="off"></label>
    <div class="hint" style="margin-top:-6px">É por este nome que o contrato aparece nos movimentos e nas listas. Sem nome, usa-se o dos inquilinos.</div>
    <label>Imóvel${sel('c_prop',c.propertyId,propOptsPara('contract.add',c.propertyId).filter(o=>{const x=prop(o.v);return x&&(x.use==='investimento'||x.id===c.propertyId)}),'onCtProp','rascunho')}</label>
    ${rooms.length?`<label>Quarto${sel('c_room',c.roomId||'',[{v:'',label:'— sem quarto —'}].concat(rooms.map(r=>({v:r.id,label:r.name+(taken.indexOf(r.id)>-1?' (já arrendado)':'')}))),'','rascunho')}</label>`
     :(p&&p.use==='investimento'?`<div class="hint">Este imóvel está definido como arrendado por inteiro. Para arrendar por quartos, muda isso na ficha do imóvel.</div>`:'')}
    <div><div class="flabel">Inquilinos</div>${tagField(tags,'Adicionar','addCtTenant()','delCtTenant','','camada')}</div>
    <div class="row">
      <label>Renda mensal (€) <span class="req">*</span><input id="c_rent" type="text" inputmode="decimal" value="${c.rent||''}" placeholder="450" oninput="liveNet()"></label>
      <label>Imposto sobre a renda (%)<input id="c_tax" type="text" inputmode="decimal" value="${c.taxRate?dec(c.taxRate):''}" placeholder="${dec(irsRate(c))}" oninput="liveNet()"></label></div>
    <div class="hint" style="margin-top:-6px">Em branco, estima-se pela duração do contrato: a taxa especial de IRS sobre rendas de habitação é 25 %, e desce para 15 %, 10 % ou 5 % em contratos de 5, 10 ou 20 anos ou mais. Noutros usos é 28 % — escreve-a. É uma estimativa sobre a renda bruta: as despesas dedutíveis (IMI, condomínio, obras) baixam o imposto.</div>
    <div class="card" style="background:var(--tint);padding:12px" id="netBox">${netBox()}</div>
    ${fold('terms','Prazo, caução e pagamento',`
    <div class="row">
      <label>Início<input id="c_start" type="date" value="${c.start||''}" onchange="liveNet()"></label>
      <label>Fim<input id="c_end" type="date" value="${c.end||''}" onchange="liveNet()"></label></div>
    <div class="row3">
      <label>Renda entre o dia<input id="c_day" type="text" inputmode="numeric" value="${c.payDay||''}" placeholder="1"></label>
      <label>e o dia<input id="c_dayTo" type="text" inputmode="numeric" value="${c.payDayTo||''}" placeholder="8"></label>
      <label>Aumento anual (%)<input id="c_inc" type="text" inputmode="decimal" value="${c.increase==null?'':dec(c.increase)}" placeholder="${dec(db.settings.growth)}"></label></div>
    <div class="row"><label>Caução (€)<input id="c_dep" type="text" inputmode="decimal" value="${c.deposit||''}" placeholder="Opcional"></label>
      <label>Rendas antecipadas (meses)<input id="c_adv" type="text" inputmode="numeric" value="${c.advance||''}" placeholder="0"></label></div>
    <div class="hint" style="margin-top:-6px">A renda cria um movimento recorrente todos os meses. Com rendas antecipadas, arranca depois dos meses pagos à cabeça.</div>
    <label>IBAN para pagamento das rendas<input id="c_iban" value="${esc(c.iban)}" placeholder="PT50 0000 0000 0000 0000 0000 0" autocomplete="off"></label>`,
      {icon:'contract',open:false,summary:[c.start?'de '+c.start:'',c.end?'a '+c.end:'',c.deposit?'caução '+euro(c.deposit):''].filter(Boolean).join(' ')})}
    ${fold('contacts','Contactos',contactSect('owner',c,p)+contactSect('tenant',c,p),{icon:'users',summary:[c.ownerPhone||c.ownerEmail?'senhorio':'',c.tenantPhone||c.tenantEmail?'inquilino':''].filter(Boolean).join(' · ')})}
    ${fold('inv','Inventário',`
      ${inv.length?`<div class="form" style="gap:7px">
        <label class="check" style="margin-bottom:2px"><input type="checkbox" id="inv_all" onchange="invToggleAll()"> Selecionar todos</label>
        ${inv.map(it=>`<div class="invrow">
          <input type="checkbox" class="i-c" id="invc_${it.id}">
          <input class="i-n" id="invn_${it.id}" value="${esc(it.name)}" placeholder="Artigo">
          <input class="i-q" id="invq_${it.id}" type="text" inputmode="numeric" value="${it.qty}" placeholder="1">
          <span class="i-s">${sel('invs_'+it.id,it.state,[{v:'novo',label:'Novo'},{v:'usado',label:'Usado'}],'','rascunho')}</span>
          <button type="button" class="btn sm danger" data-toca="rascunho" onclick="delInv('${it.id}')">${ic('trash',14)}</button></div>`).join('')}
        <div class="toolbar" style="margin:4px 0 0"><button type="button" class="btn sm danger" data-toca="rascunho" onclick="delInvSelected()">Remover selecionados</button></div>
      </div>`:`<div class="hint"></div>`}
      <div class="toolbar" style="margin:0">
        <button type="button" class="btn sm" data-toca="rascunho" onclick="addInv()">${ic('plus',14)} Adicionar artigo</button>
        <button type="button" class="btn sm" data-toca="camada" onclick="addInvBulk()">Adicionar vários</button></div>`,
      {icon:'box',summary:inv.length?inv.length+' artigos':''})}
    ${fold('photos','Registo fotográfico',`
      ${(p&&(p.photos||[]).length)?`
        <div class="hint" style="margin:-4px 0 0">Escolhe quais das fotos do imóvel entram neste contrato.</div>
        <div class="thumbs">${p.photos.map(f=>{const on=(c.photoIds||[]).indexOf(f.id)>-1;
          return `<div class="thumb" style="${on?'border-color:var(--accent);border-width:2px':'opacity:.55'}" data-toca="rascunho" onclick="togCtPhoto('${f.id}')">
            <div id="th_${f.id}" style="height:76px;background:var(--chip)"></div>
            <div class="nm">${on?'✓ ':''}${esc(f.name||'sem nome')}</div></div>`}).join('')}</div>
        <div class="toolbar" style="margin:11px 0 0">
          <button type="button" class="btn sm" data-toca="rascunho" onclick="allCtPhotos(1)">Selecionar todas</button>
          <button type="button" class="btn sm" data-toca="rascunho" onclick="allCtPhotos(0)">Nenhuma</button></div>`
        :`<div class="hint">Este imóvel ainda não tem fotos. Adiciona-as na ficha do imóvel.</div>`}`,
      {icon:'photo',summary:`${(c.photoIds||[]).length} de ${(p&&p.photos||[]).length}`})}
    ${fold('keys','Chaves entregues',`
      ${(c.keys||[]).length?`<div class="form" style="gap:7px">
        <label class="check" style="margin-bottom:2px"><input type="checkbox" id="key_all" onchange="keyToggleAll()"> Selecionar todos</label>
        ${c.keys.map(k=>`<div class="invrow" style="grid-template-columns:auto 1fr 62px auto">
          <input type="checkbox" id="keyc_${k.id}">
          <input class="i-n" id="keyn_${k.id}" value="${esc(k.name)}" placeholder="Chave de casa">
          <input class="i-q" id="keyq_${k.id}" type="text" inputmode="numeric" value="${k.qty}" placeholder="1">
          <button type="button" class="btn sm danger" data-toca="rascunho" onclick="delKey('${k.id}')">${ic('trash',14)}</button></div>`).join('')}
        <div class="toolbar" style="margin:4px 0 0"><button type="button" class="btn sm danger" data-toca="rascunho" onclick="delKeySelected()">Remover selecionadas</button></div>
      </div>`:`<div class="hint"></div>`}
      <div class="toolbar" style="margin:0">
        <button type="button" class="btn sm" data-toca="rascunho" onclick="addKey()">${ic('plus',14)} Adicionar tipo de chave</button>
        <button type="button" class="btn sm" data-toca="camada" onclick="addKeyBulk()">Adicionar várias</button></div>`,
      {icon:'key',summary:nSum})}
    ${fold('files','Anexos',fileBlock('',c.files||[],'c_filein','ctAddFiles','ctDelFile',{hint:'PDF do contrato assinado, recibos, comunicações. Ficam no dispositivo e não entram na cópia em JSON.'}),
      {icon:'clip',summary:(c.files||[]).length?c.files.length+' anexo'+(c.files.length===1?'':'s'):''})}
    <label class="check"><input type="checkbox" id="c_active" ${c.active!==false?'checked':''}> Contrato em vigor</label>
    <label class="check"><input type="checkbox" id="c_autorec" ${c.autoRec!==false?'checked':''}> Criar movimento recorrente da renda</label>
    <div class="hint" style="margin-top:-4px">Todos os meses a app pede para confirmar a renda em Planeados.</div>
    ${richEditor('Notas','c_notes',c.notes)}
  </div>`;
}
// HTML do resumo bruto → imposto → líquido. Lê os campos do formulário se
// já estiverem no DOM; antes disso usa os valores de cForm. Sem taxa escrita,
// a estimativa pela duração do contrato (irsRate), marcada como tal.
// Devolve: string com o HTML do resumo (ou um aviso, se faltar a renda).
function netBox(){
  /* «campo presente e vazio» (apagado de propósito → estimativa) é diferente de «ainda sem DOM» (cForm) */
  const eR=document.getElementById('c_rent'),eT=document.getElementById('c_tax');
  const r=eR?num(eR.value):cForm.rent,escrita=eT?num(eT.value):(Number(cForm.taxRate)||0);
  const datas={start:val('c_start')||cForm.start,end:val('c_end')||cForm.end};
  const tx=escrita>0?escrita:irsRate(datas);
  if(!r)return `<div class="hint">Falta a renda.</div>`;
  const imposto=r*tx/100;
  return `<div class="stat" style="padding-top:0"><span>Renda bruta</span><b>${euro2(r)}</b></div>
    <div class="stat"><span>Imposto (${dec(tx)}%${escrita>0?'':', estimado pela duração'})</span><b class="neg">−${euro2(imposto)}</b></div>
    <div class="stat" style="border:0"><span>Renda líquida</span><b class="pos" style="font-size:16px">${euro2(r-imposto)}</b></div>
    <div class="hint">${euro(( r-imposto)*12)} por ano, se a renda se mantiver.</div>`;
}
// Recalcula o resumo da renda líquida enquanto se escreve na renda ou no imposto.
// Devolve: nada — reescreve o conteúdo da caixa #netBox no modal.
function liveNet(){const b=document.getElementById('netBox');if(b)b.innerHTML=netBox()}
/* Copia o que está nos campos do modal para cForm. Chamar SEMPRE antes de
   repintar ou de mexer nas listas (inventário, chaves, fotos), senão o que
   o utilizador escreveu perde-se. Também normaliza os dias de pagamento
   (1–31, o "até" nunca antes do "de") e as rendas antecipadas (0–36).
   Devolve: nada — só atualiza o objeto cForm. */
function collectCt(){
  const c=cForm;
  if(document.getElementById('c_prop'))c.propertyId=val('c_prop')||null;
  if(document.getElementById('c_autorec'))c.autoRec=chk('c_autorec');
  c.roomId=document.getElementById('c_room')?(val('c_room')||null):null;
  c.name=val('c_name');c.rent=num(val('c_rent'));c.taxRate=num(val('c_tax'));c.iban=val('c_iban');
  if(document.getElementById('c_omail'))c.ownerEmail=val('c_omail');
  if(document.getElementById('c_ophone'))c.ownerPhone=val('c_ophone');
  if(document.getElementById('c_tmail'))c.tenantEmail=val('c_tmail');
  if(document.getElementById('c_tphone'))c.tenantPhone=val('c_tphone');
  c.deposit=num(val('c_dep'));c.start=val('c_start');c.end=val('c_end');
  c.payDay=Math.max(0,Math.min(31,Math.round(num(val('c_day')))))||null;
  c.payDayTo=Math.max(0,Math.min(31,Math.round(num(val('c_dayTo')))))||null;
  c.advance=Math.max(0,Math.min(36,Math.round(num(val('c_adv')))))||0;
  if(c.payDay&&c.payDayTo&&c.payDayTo<c.payDay)c.payDayTo=c.payDay;
  const i=val('c_inc');c.increase=String(i).trim()===''?null:num(i);
  if(document.getElementById('c_notes'))c.notes=richVal('c_notes');c.active=chk('c_active');
  (c.inventory||[]).forEach(it=>{
    const n=document.getElementById('invn_'+it.id);if(n)it.name=n.value;
    const q=document.getElementById('invq_'+it.id);if(q)it.qty=Math.max(1,Math.round(num(q.value))||1);
    const s=document.getElementById('invs_'+it.id);if(s)it.state=s.value;
  });
  (c.files||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
  (c.keys||[]).forEach(k=>{
    const nEl=document.getElementById('keyn_'+k.id);if(nEl)k.name=nEl.value;
    const q=document.getElementById('keyq_'+k.id);if(q)k.qty=Math.max(1,Math.round(num(q.value))||1);
  });
  if(document.getElementById('c_ocid'))c.ownerContactId=val('c_ocid')||'';
  if(document.getElementById('c_tcid'))c.tenantContactId=val('c_tcid')||'';
}
// Repinta o corpo do modal a partir de cForm e recarrega as miniaturas das
// fotos. Não recolhe os campos — chama collectCt() antes, se for preciso.
// Devolve: nada — redesenha o corpo do modal.
function repaintCt(){const b=modalBodyEl();if(!b)return;b.innerHTML=ctBody();
  const p=prop(cForm.propertyId);if(p)paintThumbs(p.photos)}

/* contacto: escolher de uma pessoa conhecida, ou escrever outro
   Recebe: kind — 'owner' ou 'tenant', diz de que lado é a secção; c — o
   contrato (objeto, normalmente cForm); p — o imóvel do contrato (objeto;
   pode vir vazio, só é usado no lado do senhorio).
   Devolve: string com o HTML da secção de contacto. */
function contactSect(kind,c,p){
  const owners=kind==='owner';
  const gente=owners?ownersOfProp(p||{}).map(owner).filter(Boolean):ctTenants(c);
  const cur=owners?c.ownerContactId:c.tenantContactId;
  const opts=gente.map(g=>({v:g.id,label:g.name+(g.phone?' · '+fmtPhone(g.phone):'')})).concat([{v:'',label:'Outro contacto (escrever)'}]);
  const chosen=cur?gente.find(g=>g.id===cur):null;
  return `<div class="sect">
    <div class="sect-head"><span class="ic">${ic(owners?'crown':'users',18)}</span><b>Contacto do ${owners?'senhorio':'inquilino'}</b></div>
    <div class="hint" style="margin:-4px 0 0">${owners?'O que o inquilino usa para vos contactar.':'Ponto de contacto deste contrato.'}</div>
    ${gente.length?`<label>Usar o contacto de${sel(owners?'c_ocid':'c_tcid',cur||'',opts,owners?'onOwnerContact':'onTenantContact','rascunho')}</label>`:''}
    ${chosen?`<div class="stat" style="border:0;padding:4px 0"><span>${esc(chosen.name)}</span>
        <b>${esc([chosen.phone?fmtPhone(chosen.phone):'',chosen.email].filter(Boolean).join(' · ')||'sem contacto na ficha')}</b></div>`
      :`<div class="row">
        <label>Email<input id="${owners?'c_omail':'c_tmail'}" type="email" inputmode="email" value="${esc(owners?c.ownerEmail:c.tenantEmail)}" placeholder="nome@exemplo.pt" autocomplete="off"></label>
        <label>Telemóvel<input id="${owners?'c_ophone':'c_tphone'}" type="tel" inputmode="tel" value="${esc(owners?c.ownerPhone:c.tenantPhone)}" placeholder="+351 912 000 000" autocomplete="off"></label></div>`}
  </div>`;
}
// Ao escolher o contacto do senhorio: copia o email/telefone da pessoa
// escolhida para o contrato e repinta o formulário.
// Devolve: nada — repinta o formulário do contrato.
function onOwnerContact(){
  collectCt();cForm.ownerContactId=val('c_ocid')||'';
  const g=cForm.ownerContactId?owner(cForm.ownerContactId):null;
  if(g){cForm.ownerEmail=g.email||'';cForm.ownerPhone=g.phone||''}
  repaintCt();
}
// Ao escolher o contacto do inquilino: copia o email/telefone da pessoa
// escolhida para o contrato e repinta o formulário.
// Devolve: nada — repinta o formulário do contrato.
function onTenantContact(){
  collectCt();cForm.tenantContactId=val('c_tcid')||'';
  const g=cForm.tenantContactId?tenant(cForm.tenantContactId):null;
  if(g){cForm.tenantEmail=g.email||'';cForm.tenantPhone=g.phone||''}
  repaintCt();
}
// Liga/desliga uma foto do imóvel no registo fotográfico do contrato.
// Recebe: fid — id da foto (uma das fotos do imóvel).
// Devolve: nada — repinta o formulário.
function togCtPhoto(fid){
  collectCt();
  const l=cForm.photoIds||(cForm.photoIds=[]),i=l.indexOf(fid);
  if(i>-1)l.splice(i,1);else l.push(fid);
  repaintCt();
}
// Seleciona todas as fotos do imóvel para o contrato (on=1) ou nenhuma (on=0).
// Recebe: on — 1 seleciona todas, 0 limpa a seleção.
// Devolve: nada — repinta o formulário.
function allCtPhotos(on){
  collectCt();
  const p=prop(cForm.propertyId);
  cForm.photoIds=on?(p&&p.photos||[]).map(f=>f.id):[];
  repaintCt();
}
// Acrescenta uma linha de chave vazia (quantidade 1) e repinta.
// Devolve: nada — repinta o formulário.
function addKey(){collectCt();cForm.keys.push({id:uid(),name:'',qty:1});repaintCt()}
// Remove um tipo de chave pelo id e repinta.
// Recebe: kid — id da chave a remover.
// Devolve: nada — repinta o formulário.
function delKey(kid){collectCt();cForm.keys=cForm.keys.filter(k=>k.id!==kid);repaintCt()}
// Marca/desmarca as checkboxes de todas as chaves conforme o "Selecionar todos".
// Devolve: nada — só mexe nas checkboxes do DOM.
function keyToggleAll(){const on=chk('key_all');(cForm.keys||[]).forEach(k=>{const e=document.getElementById('keyc_'+k.id);if(e)e.checked=on})}
// Remove as chaves com a checkbox marcada; avisa se nenhuma estiver selecionada.
// Devolve: nada — repinta o formulário (ou só avisa, se nada estiver marcado).
function delKeySelected(){
  collectCt();
  const s2=(cForm.keys||[]).filter(k=>chk('keyc_'+k.id));
  if(!s2.length)return toast('Não há chaves selecionadas.');
  const ids={};s2.forEach(k=>ids[k.id]=1);
  cForm.keys=cForm.keys.filter(k=>!ids[k.id]);repaintCt();toast(s2.length+' removidas.');
}
// Abre um modal com textarea para colar várias chaves de uma vez, uma por
// linha ("Nome; quantidade"). Quem as processa é o doKeyBulk().
// Devolve: nada — abre o modal do texto em bloco.
function addKeyBulk(){
  collectCt();
  openModal('Adicionar várias chaves',`<div class="form">
    <div class="hint">Uma por linha, com a quantidade: <b>Chave de casa; 2</b></div>
    <textarea id="keybulk" style="min-height:130px;font:13px/1.6 ui-monospace,Menlo,monospace" placeholder="Chave de casa; 2&#10;Chave do correio; 1&#10;Comando do portão"></textarea></div>`,
    `<button class="btn" data-toca="camada" onclick="closeModal()">Cancelar</button><button class="btn primary" data-toca="rascunho" onclick="doKeyBulk()">Adicionar</button>`);
}
// Lê o textarea do addKeyBulk: uma chave por linha, nome e quantidade
// separados por ;, | ou tab. Sem quantidade, fica 1.
// Devolve: nada — junta as chaves a cForm, fecha o modal e repinta.
function doKeyBulk(){
  let added=0;
  String(val('keybulk')||'').split('\n').map(x=>x.trim()).filter(Boolean).forEach(line=>{
    const p2=line.split(/[;|\t]/).map(x=>x.trim());
    if(p2[0]){cForm.keys.push({id:uid(),name:p2[0],qty:Math.max(1,Math.round(num(p2[1]))||1)});added++}
  });
  closeModal();repaintCt();toast(added?'Chaves adicionadas.':'Nada para adicionar.');
}
/* puxa o contacto do primeiro proprietário, se ainda estiver vazio
   Devolve: nada — só preenche o email/telefone em cForm. */
function fillOwnerContact(){
  const p=prop(cForm.propertyId);if(!p)return;
  const o=ownersOfProp(p).map(owner).filter(Boolean)[0];if(!o)return;
  if(!cForm.ownerEmail)cForm.ownerEmail=o.email||'';
  if(!cForm.ownerPhone)cForm.ownerPhone=o.phone||'';
}
// Preenche o contacto do inquilino do contrato com o da pessoa, mas só os
// campos ainda vazios — não pisa o que já lá estava.
// Recebe: tid — id do inquilino.
// Devolve: nada — só preenche o email/telefone em cForm.
function fillTenantContact(tid){
  const t=tenant(tid);if(!t)return;
  if(!cForm.tenantEmail)cForm.tenantEmail=t.email||'';
  if(!cForm.tenantPhone)cForm.tenantPhone=t.phone||'';
}
// Ao trocar o imóvel do contrato: limpa o quarto (pertencia ao anterior),
// puxa o contacto do proprietário novo e repinta.
// Devolve: nada — repinta o formulário.
function onCtProp(){collectCt();cForm.propertyId=val('c_prop');cForm.roomId=null;fillOwnerContact();repaintCt()}
// Abre o seletor de inquilinos (só os que ainda não estão no contrato); ao
// escolher, junta-o e preenche o contacto do contrato se estiver vazio.
// Devolve: nada — abre o seletor de inquilinos.
function addCtTenant(){
  collectCt();
  const free=db.tenants.filter(t=>(cForm.tenantIds||[]).indexOf(t.id)<0);
  pickModal('Escolher inquilino',free.map(t=>({v:t.id,label:t.name,sub:[t.phone,t.email].filter(Boolean).join(' · '),avatar:true})),
    t=>{cForm.tenantIds.push(t.v);fillTenantContact(t.v);closeModal();repaintCt()},
    `<button type="button" class="btn" style="width:100%;justify-content:center" data-toca="camada" onclick="newTenantFromCt()">${ic('plus',15)} Criar inquilino novo</button>`);
}
// Tira um inquilino do contrato — a ficha da pessoa fica intacta.
// Recebe: tid — id do inquilino a tirar do contrato.
// Devolve: nada — repinta o formulário.
function delCtTenant(tid){collectCt();cForm.tenantIds=(cForm.tenantIds||[]).filter(x=>x!==tid);repaintCt()}
/* Cria um inquilino novo sem sair do fluxo do contrato: fecha o seletor,
   abre a ficha de pessoa e, quando esta é guardada, volta ao modal do
   contrato já com o inquilino adicionado e o contacto preenchido.
   Devolve: nada — abre a ficha de pessoa nova. */
function newTenantFromCt(){
  /* a ficha nova vai subir como registo deste imóvel: sem «Adicionar inquilinos» o servidor recusava-a */
  if(!pode(cForm.propertyId,'tenant.add'))return toast(fraseSemPerm('tenant.add'));
  closeModal();
  /* num imóvel onde só colaboro a ficha fica presa ao imóvel (houseId): se o
     contrato ficar por guardar, sobe na mesma como registo dele, não privada */
  personModal('tenant',null,nid=>{
    if(cForm.tenantIds.indexOf(nid)<0)cForm.tenantIds.push(nid);
    fillTenantContact(nid);
    closeModal();render();repaintCt();
    toast('Inquilino criado e adicionado ao contrato.');
  },souDono(cForm.propertyId)?'':cForm.propertyId);
}
// Acrescenta um artigo vazio ao inventário (quantidade 1, usado) e repinta.
// Devolve: nada — repinta o formulário.
function addInv(){collectCt();cForm.inventory.push({id:uid(),name:'',qty:1,state:'usado'});repaintCt()}
// Remove um artigo do inventário pelo id e repinta.
// Recebe: iid — id do artigo a remover.
// Devolve: nada — repinta o formulário.
function delInv(iid){collectCt();cForm.inventory=cForm.inventory.filter(i=>i.id!==iid);repaintCt()}
// Marca/desmarca as checkboxes de todos os artigos conforme o "Selecionar todos".
// Devolve: nada — só mexe nas checkboxes do DOM.
function invToggleAll(){
  const on=chk('inv_all');
  (cForm.inventory||[]).forEach(i=>{const e=document.getElementById('invc_'+i.id);if(e)e.checked=on});
}
// Remove os artigos com a checkbox marcada; avisa se nenhum estiver selecionado.
// Devolve: nada — repinta o formulário (ou só avisa, se nada estiver marcado).
function delInvSelected(){
  collectCt();
  const sel2=(cForm.inventory||[]).filter(i=>chk('invc_'+i.id));
  if(!sel2.length)return toast('Não há artigos selecionados.');
  const ids={};sel2.forEach(i=>ids[i.id]=1);
  cForm.inventory=cForm.inventory.filter(i=>!ids[i.id]);
  repaintCt();toast(sel2.length+' artigos removidos.');
}
// Abre um modal com textarea para colar vários artigos de uma vez, um por
// linha ("Nome; quantidade; estado"). Quem os processa é o doInvBulk().
// Devolve: nada — abre o modal do texto em bloco.
function addInvBulk(){
  collectCt();
  openModal('Adicionar vários artigos',`<div class="form">
    <div class="hint">Um artigo por linha. Podes indicar quantidade e estado: <b>Cadeira; 4; usado</b></div>
    <textarea id="invbulk" style="min-height:150px;font:13px/1.6 ui-monospace,Menlo,monospace" placeholder="Sofá; 1; novo&#10;Cadeira; 4; usado&#10;Frigorífico"></textarea></div>`,
    `<button class="btn" data-toca="camada" onclick="closeModal()">Cancelar</button><button class="btn primary" data-toca="rascunho" onclick="doInvBulk()">Adicionar</button>`);
}
// Lê o textarea do addInvBulk: um artigo por linha, campos separados por ;,
// | ou tab. Sem quantidade fica 1; o estado só é "novo" se a linha o disser.
// Devolve: nada — junta os artigos a cForm, fecha o modal e repinta.
function doInvBulk(){
  const lines=String(val('invbulk')||'').split('\n').map(x=>x.trim()).filter(Boolean);
  let added=0;
  lines.forEach(line=>{
    const parts=line.split(/[;|\t]/).map(x=>x.trim());
    if(!parts[0])return;
    cForm.inventory.push({id:uid(),name:parts[0],qty:Math.max(1,Math.round(num(parts[1]))||1),
      state:/nov/i.test(parts[2]||'')?'novo':'usado'});
    added++;
  });
  closeModal();repaintCt();
  toast(added?added+' artigos adicionados.':'Nada para adicionar.');
}
// Recebe os ficheiros do input de anexos: o conteúdo vai para o IndexedDB
// (takeFiles) e os metadados juntam-se a cForm.files. Assíncrono — repinta no fim.
// Recebe: input — o elemento <input type="file"> com os ficheiros escolhidos.
// Devolve: nada — repinta quando os ficheiros acabarem de entrar.
function ctAddFiles(input){
  collectCt();
  takeFiles(input).then(ms=>{cForm.files=(cForm.files||[]).concat(ms);repaintCt();
    if(ms.length)toast(ms.length===1?'Anexo adicionado.':ms.length+' anexos adicionados.')});
}
// Tira um anexo do contrato e apaga logo o conteúdo do IndexedDB — para o
// ficheiro em si não há desfazer.
// Recebe: fid — id do anexo a remover.
// Devolve: nada — repinta o formulário.
function ctDelFile(fid){collectCt();cForm.files=(cForm.files||[]).filter(f=>f.id!==fid);idbDel(fid).catch(()=>{});repaintCt()}
// Pede confirmação e termina o contrato: fica inativo, ganha data de fim
// (hoje, se não tiver) e o movimento recorrente da renda é desligado.
// Recebe: id — id do contrato.
// Devolve: nada — pede confirmação e, se aceite, grava e redesenha a vista.
function endContract(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  confirmModal('Terminar contrato',`Marcar o contrato de ${esc(ctNames(c))} como terminado? Deixa de contar para as rendas e projeções.`,()=>{
    c.active=false;if(!c.end)c.end=today();syncContractRec(c);save();closeAllModals();buildNav();render();toast('Contrato terminado.');
  });
}
// Pede confirmação e reativa o contrato: limpa a data de fim e volta a
// ligar o movimento recorrente da renda.
// Recebe: id — id do contrato.
// Devolve: nada — pede confirmação e, se aceite, grava e redesenha a vista.
function reactivateContract(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  confirmModal('Reativar contrato',`Voltar a pôr o contrato de ${esc(ctNames(c))} ativo? Volta a contar para as rendas e projeções.`,()=>{
    c.active=true;c.end='';syncContractRec(c);save();closeAllModals();buildNav();render();toast('Contrato reativado.');
  });
}
/* Apaga o contrato, com confirmação: sai da lista, o recorrente automático
   da renda vai com ele e os movimentos ligados ficam órfãos (mantêm-se, mas
   sem contractId). O toast dá para desfazer tudo; os anexos só se apagam do
   IndexedDB quando o desfazer expira sem ser usado.
   Recebe: id — id do contrato a apagar.
   Devolve: nada — pede confirmação e, se aceite, grava e redesenha a vista. */
function delContract(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c,true);if(recusa)return toast(recusa);
  confirmModal('Apagar contrato',`Apagar o contrato de ${esc(ctNames(c))}? Os movimentos ficam, mas deixam de estar ligados a ele.`,()=>{
    const copia=JSON.parse(JSON.stringify(c));
    const recs=JSON.parse(JSON.stringify((db.recurring||[]).filter(r=>r.auto&&r.tx&&r.tx.contractId===id)));
    const ligados=db.transactions.filter(t=>t.contractId===id).map(t=>t.id);
    db.contracts=db.contracts.filter(x=>x.id!==id);
    db.recurring=(db.recurring||[]).filter(r=>!(r.auto&&r.tx&&r.tx.contractId===id));
    db.transactions.forEach(t=>{if(t.contractId===id)t.contractId=null});
    save();closeAllModals();buildNav();render();
    comDesfazer('Contrato apagado.',()=>{
      db.contracts.push(copia);
      db.recurring=(db.recurring||[]).concat(recs);
      db.transactions.forEach(t=>{if(ligados.indexOf(t.id)>-1)t.contractId=id});
    },()=>{
      (copia.files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    });
  });
}
