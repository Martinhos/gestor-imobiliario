/* ================= NOTIFICAÇÕES ================= */
/* O sino da vista geral: tudo o que pede atenção, num sítio só.

   Quatro fontes, por ordem de urgência: movimentos em atraso, movimentos
   por confirmar, os prazos do ciclo de vida, e — a novidade que precisou
   do servidor — a atividade dos outros nas casas partilhadas: cada registo
   escrito por outra pessoa chega com o autor e a hora (o worker grava o
   autor em cada escrita), e o que for mais novo do que a última leitura
   aparece aqui com nome e apelido.

   «Marcar tudo como lido» guarda a marca temporal nas definições — que
   sincronizam, por isso ler num aparelho limpa o sino nos outros. */

/* O nome de quem fez uma alteração, a partir do id de utilizador: delega em
   nomeUtilizador (proprietários, depois as pessoas do estado, depois o id
   encurtado) e junta o cargo quando é um colaborador — «Maria (Contabilista)».
   Recebe: uid — o id do utilizador autor.
   Devolve: um nome apresentável (texto). */
function notifNome(uid){
  const c=cargoDeUtilizador(uid);
  return nomeUtilizador(uid)+(c?' ('+c+')':'');
}

/* Os pedidos que esperam a minha resposta. Os de partilha que me chegaram
   pela minha ligação (CW.state.shareRequests.incoming): cada um é alguém a
   querer que eu passe a comproprietário de um imóvel dele. E, com o serviço
   Colaboradores ligado, os pedidos para entrar num grupo partilhado meu
   (CW.state.sharedGroupRequests.incoming — só chegam ao dono do grupo): cada
   um é alguém que abriu a ligação do grupo e espera que eu aceite. Sem
   sessão, nenhum.
   Devolve: lista de {id, titulo, sub} por ordem de chegada, os de partilha
   primeiro; um pedido de grupo leva também tipo 'grupo', gid e uid — o que
   o modal passa ao notifGrupoAceitar/notifGrupoRecusar. */
function notifPedidos(){
  const st=window.CW&&CW.state;
  const partilha=((st&&st.shareRequests&&st.shareRequests.incoming)||[]).map(r=>({id:r.id,
    titulo:(r.fromName||'Alguém')+' quer partilhar '+(r.houseName||'um imóvel')+' contigo',
    sub:'Aceitar torna-te comproprietário — vês contratos, movimentos e pessoas desse imóvel.'}));
  const sgr=servicoLigado('colaboradores')&&st&&st.sharedGroupRequests;
  // só os grupos meus: um grupo partilhado da base que não é meu nunca pede a minha resposta
  const meuGrupo=r=>{const g=grp(r.groupId);return !(g&&g._partilhado&&!g._meu)};
  const grupos=((sgr&&sgr.incoming)||[]).filter(r=>r&&r.groupId&&r.userId&&meuGrupo(r)).map(r=>({
    id:'grupo:'+r.groupId+':'+r.userId,tipo:'grupo',gid:r.groupId,uid:r.userId,
    titulo:(r.name||'Alguém')+' quer entrar no grupo «'+(r.groupName||'sem nome')+'»',
    sub:'Se aceitares, passa a comproprietário dos imóveis do grupo.'}));
  return partilha.concat(grupos);
}

/* A atividade dos outros: registos de casas partilhadas escritos por outra
   pessoa depois da última leitura. O autor vem do servidor (_author) e só
   existe em registos com casa; o que eu próprio escrevi nunca entra.
   Um movimento de vários imóveis (um lote, app/movimento.js) vive partido
   numa parte por imóvel, e cada parte é um registo com autor: conta-se uma
   vez só, pelo lote.id — com o título do lote e, em vez de um imóvel, o
   grupo ou «Todos os imóveis» e quantos são; a hora é a da parte mais nova.
   Recebe: desde (opcional) — marca temporal em ms; por omissão, a última
   leitura guardada nas definições (0 se nunca houve).
   Devolve: lista de {tipo, titulo, sub, at, ir} por ordem do mais recente. */
function notifPartilha(desde){
  const meu=(window.CW&&CW.user&&CW.user.id)||'';
  // primeira vez: a contagem começa AGORA — sem isto, o primeiro sino
  // despejava o histórico inteiro das casas partilhadas
  if(desde==null&&db.settings.notifLidoAte==null){db.settings.notifLidoAte=Date.now();save()}
  const marca=desde!=null?desde:Number((db.settings||{}).notifLidoAte||0);
  const out=[];
  const lotes={};   // lote.id → a linha dele em out
  const quando=at=>new Date(at).toLocaleDateString('pt-PT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const poe=(tipo,rotulo,nome,x,ir)=>{
    if(!x._author||x._author===meu)return;
    const at=Number(x._atServidor||0);
    if(at<=marca)return;
    const lote=x.lote&&x.lote.id?x.lote:null;
    if(lote&&lotes[lote.id]){
      // outra parte do mesmo lote: a linha fica uma, com a hora da parte mais nova
      const l=lotes[lote.id];
      if(at>l.at){l.at=at;l.sub=notifNome(x._author)+' · '+l.casa+' · '+quando(at)}
      return;
    }
    let casa=x.propertyId?propName(x.propertyId):(x.tx&&x.tx.propertyId?propName(x.tx.propertyId):'');
    if(lote){
      // o alvo do lote: 'todos', ou 'g:<id>' de um grupo (que pode já não estar na base)
      const n=Number(lote.n)||1,g=String(lote.alvo||'').indexOf('g:')===0?grp(String(lote.alvo).slice(2)):null;
      const alvo=lote.alvo==='todos'?'Todos os imóveis':(g&&g.name)||'';
      casa=(alvo?alvo+' · ':'')+n+(n===1?' imóvel':' imóveis');
    }
    const linha={tipo,at,ir,casa,titulo:rotulo+(nome?' — '+nome:''),
      sub:notifNome(x._author)+(casa?' · '+casa:'')+' · '+quando(at)};
    if(lote)lotes[lote.id]=linha;
    out.push(linha);
  };
  /* cada linha é de um serviço: com ele desligado nesta conta não há registos
     dele (o servidor não os manda), e mesmo que sobrasse algum no aparelho não
     se oferece um toque para um separador que não abre */
  if(servicoLigado('transactions'))(db.transactions||[]).forEach(t=>poe('mov','Movimento',t.label||t.category||'',t,"go('transactions')"));
  if(servicoLigado('recurring'))(db.recurring||[]).forEach(r=>poe('rec','Planeado',r.name||'',r,"go('recurring')"));
  if(servicoLigado('contracts'))(db.contracts||[]).forEach(c=>poe('ct','Contrato',c.name||'',c,"go('contracts')"));
  if(servicoLigado('visits'))(db.visits||[]).forEach(v=>poe('vis','Visita',v.nomes||'',v,"go('visits')"));
  if(servicoLigado('tenants'))(db.tenants||[]).forEach(t=>poe('pes','Ficha de inquilino',t.name||'',t,"go('tenants')"));
  return out.sort((a,b)=>b.at-a.at).slice(0,40);
}

/* O que o sino conta: atrasados + atividade nova dos outros (um lote conta
   uma vez) + pedidos à espera de resposta (de partilha e para entrar num
   grupo meu). O que está só «por confirmar» ou é prazo
   informativo não incha o número — está no modal, mas o crachá é para o que
   muda decisões.
   Devolve: o número para o crachá do sino (inteiro). */
function notifConta(){
  return (servicoLigado('recurring')?recLate().length:0)+notifPartilha().length+notifPedidos().length;
}

/* O sino do cabeçalho da vista geral, com o crachá quando há novidades.
   Devolve: nada — pinta o botão #hdrBell conforme o separador e a contagem. */
function notifSino(){
  const b=document.getElementById('hdrBell');if(!b)return;
  if(tab!=='dashboard'){b.style.display='none';return}
  /* O crachá espera por saber (espera.js:sabemosOEstado): um número
     errado durante um segundo é pior do que nenhum. */
  const n=sabemosOEstado()?notifConta():0;
  b.style.display='';
  b.innerHTML=ic('bell',16)+(n?`<span class="cnt${cntNovo('sino',n)}">${n>9?'9+':n}</span>`:'');
}

/* Aceitar um pedido de partilha, a partir do sino. Fecha o modal primeiro (o
   render() não fecha janelas, e o cartão ficava lá com os botões a repetir o
   pedido já respondido) e só depois pede à nuvem, se ela estiver carregada.
   Vive numa função com nome porque uma ação declarada não lê propriedades do
   window (`window.CW&&…` fica fora da gramática do eventos.js); faz
   exatamente o que o toque fazia, pela mesma ordem.
   Recebe: id — o id do pedido de partilha.
   Devolve: nada — fecha o modal e chama o CW.pedidoAceitar. */
function notifPedidoAceitar(id){
  closeModal();window.CW&&CW.pedidoAceitar&&CW.pedidoAceitar(id);
}

/* Recusar um pedido de partilha, a partir do sino. O par do notifPedidoAceitar,
   com a mesma ordem: fechar o modal e depois responder.
   Recebe: id — o id do pedido de partilha.
   Devolve: nada — fecha o modal e chama o CW.pedidoRecusar. */
function notifPedidoRecusar(id){
  closeModal();window.CW&&CW.pedidoRecusar&&CW.pedidoRecusar(id);
}

/* Aceitar um pedido para entrar num grupo meu, a partir do sino. O molde do
   notifPedidoAceitar: fecha o modal primeiro e só depois pede à nuvem, se
   ela estiver carregada (CW.grupoAceitarPedido vive em cloud/grupos.js, do
   serviço Colaboradores — sem ele, o toque só fecha o sino).
   Recebe: gid — o id do grupo; uid — o id de quem pediu.
   Devolve: nada — fecha o modal e chama o CW.grupoAceitarPedido. */
function notifGrupoAceitar(gid,uid){
  closeModal();window.CW&&CW.grupoAceitarPedido&&CW.grupoAceitarPedido(gid,uid);
}

/* Recusar um pedido para entrar num grupo meu, a partir do sino. O par do
   notifGrupoAceitar, com a mesma ordem: fechar o modal e depois responder.
   Recebe: gid — o id do grupo; uid — o id de quem pediu.
   Devolve: nada — fecha o modal e chama o CW.grupoRecusarPedido. */
function notifGrupoRecusar(gid,uid){
  closeModal();window.CW&&CW.grupoRecusarPedido&&CW.grupoRecusarPedido(gid,uid);
}

/* O modal das notificações: as quatro fontes em secções, cada linha a levar
   ao sítio certo, e «Marcar tudo como lido» a calar a partilha até haver
   coisas novas (a marca sincroniza entre aparelhos).
   Devolve: nada — abre o modal da casa com as listas. */
function notifModal(){
  /* os planeados são dos Planeados (servicoLigado); os prazos são da base e estão sempre */
  const atrasados=servicoLigado('recurring')?recLate():[];
  const pendentes=(servicoLigado('recurring')?recActive():[]).filter(r=>!recIsLate(r));
  const prazos=prazosAtivos().slice(0,6);
  const partilha=notifPartilha(),pedidos=notifPedidos();
  const linha=(titulo,sub,ir,cls)=>`<div class="card tap u-p-10px-13px" data-click="closeModal();${ir}">
    <div class="row-between u-ai-center u-g-8px"><div class="u-minw-0">
      <b class="u-d-block u-ov-hidden u-to-ellipsis u-ws-nowrap">${esc(titulo)}</b>
      <span class="small">${esc(sub)}</span></div>${cls?`<span class="badge ${cls} u-fx-0-0-auto">!</span>`:''}</div></div>`;
  /* um pedido responde-se aqui mesmo: a nuvem define CW.pedidoAceitar(id) e
     CW.pedidoRecusar(id) (partilha) e CW.grupoAceitarPedido(gid,uid) e
     CW.grupoRecusarPedido(gid,uid) (entrar num grupo meu), e os notif… de
     cima chamam-nas. O modal fecha-se primeiro — o render() não fecha
     janelas, e o cartão ficava lá com os botões a repetir o pedido já
     respondido */
  const pedido=n=>{
    const sim=n.tipo==='grupo'?`notifGrupoAceitar('${jsq(n.gid)}','${jsq(n.uid)}')`:`notifPedidoAceitar('${jsq(n.id)}')`;
    const nao=n.tipo==='grupo'?`notifGrupoRecusar('${jsq(n.gid)}','${jsq(n.uid)}')`:`notifPedidoRecusar('${jsq(n.id)}')`;
    return `<div class="card u-p-10px-13px">
    <b class="u-d-block">${esc(n.titulo)}</b><span class="small">${esc(n.sub)}</span>
    <div class="toolbar u-m-9px-0-0">
      <button class="btn sm primary" data-toca="dados" data-click="${sim}">Aceitar</button>
      <button class="btn sm" data-toca="dados" data-click="${nao}">Recusar</button></div></div>`;
  };
  const bloco=(titulo,linhas)=>linhas.length?`<div class="navh">${titulo}</div>${linhas.join('')}`:'';
  const corpo=`<div class="list u-g-8px">
    ${bloco('Pedidos por responder',pedidos.map(pedido))}
    ${bloco('Em atraso',atrasados.map(r=>linha(r.name,'devia ter sido confirmado a '+dPT(r.next)+(r.tx.amount?' · '+euro2(r.tx.amount):''),"go('recurring')",'red')))}
    ${bloco('Por confirmar',pendentes.slice(0,6).map(r=>linha(r.name,dPT(r.next)+(r.tx.amount?' · '+euro2(r.tx.amount):''),"go('recurring')")))}
    ${bloco('Prazos',prazos.map(p=>linha(p.titulo,(p.dias<0?'há '+(-p.dias)+' dias':p.dias===0?'hoje':'em '+p.dias+' dias'),p.abrir,p.urg==='urgente'||p.urg==='passado'?'red':p.urg==='breve'?'amber':'')))}
    ${bloco('Nas casas partilhadas',partilha.map(n=>linha(n.titulo,n.sub,n.ir)))}
    ${!atrasados.length&&!pendentes.length&&!prazos.length&&!partilha.length&&!pedidos.length?'<div class="empty">Tudo em dia — nada a pedir atenção.</div>':''}
  </div>`;
  openModal('Notificações',corpo,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>`+
    (partilha.length?`<button class="btn primary" data-toca="dados" data-click="notifLido()">Marcar tudo como lido</button>`:''));
}

/* Marca a atividade partilhada como lida até agora: a marca vive nas
   definições e sincroniza — ler aqui limpa o sino nos outros aparelhos.
   Devolve: nada — grava a marca, fecha o modal e repinta o sino. */
function notifLido(){
  db.settings.notifLidoAte=Date.now();
  save();closeModal();render();
  toast('Lido — o sino volta quando houver coisas novas.');
}
