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

/* O sino do cabeçalho da vista geral, com o crachá quando há novidades. O
   nome é o da janela que abre, com a contagem (o canvas: «Pede atenção: 4
   por ver») — só com o crachá, o leitor de ecrã dizia «4, botão».
   Devolve: nada — pinta o botão #hdrBell conforme o separador e a contagem. */
function notifSino(){
  const b=document.getElementById('hdrBell');if(!b)return;
  if(tab!=='dashboard'){b.style.display='none';return}
  /* O crachá espera por saber (espera.js:sabemosOEstado): um número
     errado durante um segundo é pior do que nenhum. */
  const n=sabemosOEstado()?notifConta():0;
  const nome=n?'Pede atenção: '+n+' por ver':'Pede atenção';
  b.style.display='';
  b.title=nome;
  b.setAttribute('aria-label',nome);
  b.innerHTML=ic('bell',16)+(n?`<span class="cnt${cntNovo('sino',n)}" aria-hidden="true">${n>9?'9+':n}</span>`:'');
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

/* o filtro do «Pede atenção» aberto: '' (tudo), 'confirmar', 'prazos' ou 'pedidos' */
let _atencaoFiltro='';
/* O «Pede atenção» (o canvas de 2026-10, M-Atencao): o sino abre um sítio
   só para o que muda decisões — os pedidos por responder, os movimentos por
   confirmar (os em atraso primeiro), os prazos legais e fiscais e a atividade
   dos outros nas casas partilhadas. Chips por cima filtram sem «Aplicar»; os
   por confirmar confirmam-se aqui mesmo (ou abrem para rever), os pedidos
   respondem-se aqui mesmo, e cada prazo leva ao sítio dele. «Marcar tudo
   como lido» cala a partilha até haver coisas novas (a marca sincroniza).
   Recebe: filtro (opcional) — '', 'confirmar', 'prazos' ou 'pedidos'.
   Devolve: nada — abre a janela (ou refaz a que está aberta, ao mudar de filtro). */
function notifModal(filtro){
  _atencaoFiltro=typeof filtro==='string'?filtro:'';
  const c=atencaoCorpo();
  if(modalTop()&&modalTop().title==='Pede atenção')return setModal('Pede atenção',c.corpo,c.pe);
  openModal('Pede atenção',c.corpo,c.pe);
}
/* O corpo do «Pede atenção» e o rodapé (só com atividade por ler).
   Devolve: {corpo, pe} — HTML. */
function atencaoCorpo(){
  /* os planeados são dos Planeados (servicoLigado); os prazos são da base e estão sempre */
  const rec=servicoLigado('recurring');
  const conf=(rec?recActive():[]).slice().sort((a,b)=>(servicoLigado('recurring')&&recIsLate(b)?1:0)-(servicoLigado('recurring')&&recIsLate(a)?1:0));
  const prazos=prazosAtivos();
  const partilha=notifPartilha(),pedidos=notifPedidos();
  const f=_atencaoFiltro,ve=k=>!f||f===k;
  const chip=(k,rot,n)=>`<button type="button" class="chip${f===k?' on':''}" aria-pressed="${f===k}" data-toca="vista" data-click="notifModal('${k}')">${rot}${n!=null?' <span class="n">'+n+'</span>':''}</button>`;
  const chips=`<div class="chips-fila atencao-chips">${chip('','Tudo')}${chip('confirmar','Por confirmar',conf.length)}${chip('prazos','Prazos',prazos.length)}${chip('pedidos','Pedidos',pedidos.length)}</div>`;
  const cab=(titulo,extra)=>`<div class="atencao-cab"><h3>${titulo}</h3>${extra?'<span class="small">'+extra+'</span>':''}</div>`;
  /* um pedido responde-se aqui mesmo: a nuvem define CW.pedidoAceitar(id) e
     CW.pedidoRecusar(id) (partilha) e CW.grupoAceitarPedido(gid,uid) e
     CW.grupoRecusarPedido(gid,uid) (entrar num grupo meu), e os notif… de
     cima chamam-nas. A janela fecha-se primeiro — o render() não fecha
     janelas, e o cartão ficava lá com os botões a repetir o pedido já
     respondido */
  const pedido=n=>{
    const sim=n.tipo==='grupo'?`notifGrupoAceitar('${jsq(n.gid)}','${jsq(n.uid)}')`:`notifPedidoAceitar('${jsq(n.id)}')`;
    const nao=n.tipo==='grupo'?`notifGrupoRecusar('${jsq(n.gid)}','${jsq(n.uid)}')`:`notifPedidoRecusar('${jsq(n.id)}')`;
    return `<div class="card atencao-pedido"><p><b>${esc(n.titulo)}</b></p><p class="small">${esc(n.sub)}</p>
      <div class="chips-fila"><button class="btn sm primary" data-toca="dados" data-click="${sim}">Aceitar</button>
      <button class="btn sm" data-toca="dados" data-click="${nao}">Recusar</button></div></div>`;
  };
  /* um por confirmar: o nome, de onde é, quando, o valor e o estado; Confirmar
     regista já (quickConfirmRec), Rever abre o formulário (confirmRec) e
     Silenciar cala-o sem o tirar (skipRec) — cada um só se o cargo deixa.
     Confirmar e Silenciar refazem a janela com o mesmo filtro: o planeado
     confirmado passa ao mês seguinte, e uma linha que ficasse à vista com a
     data antiga confirmava, ao segundo toque, um mês que ninguém viu.
     O valor tem a cor do dinheiro dele, como nos Planeados
     (planeados.js:recValor): receita verde, prestação roxa, o que sai
     laranja com o «−»; uma transferência entre donos não tem cor nem sinal. */
  const porConfirmar=r=>{
    const late=servicoLigado('recurring')&&recIsLate(r),t=r.tx||{};
    const podeConf=servicoLigado('recurring')&&!recusaConfirmar(r)&&!recSemCredito(r)&&!recCreditoPago(r);
    const podeEd=servicoLigado('recurring')&&podeEditar(t.propertyId,'rec.add',r,'confirmar');
    const onde=servicoLigado('recurring')?imovelDoMolde(t):'';
    const sai=flowOf(t.kind)==='out',cor=t.kind==='loan'?'prest':isIn(t.kind)?'pos':sai?'neg':'';
    return `<div class="atencao-linha"><div class="atencao-txt"><p class="title">${esc(r.name)}</p>
      <p class="small">${onde?esc(onde)+' · ':''}${r.until&&r.until!==r.next?'entre '+dPT(r.next)+' e '+dPT(r.until):dPT(r.next)}</p></div>
      <div class="atencao-valor"><b class="num${cor?' '+cor:''}">${t.amount?(sai?'−':'')+euro2(t.amount):''}</b><span class="badge ${late?'red':''}">${late?'Em atraso':'Por confirmar'}</span></div>
      <div class="chips-fila atencao-acoes">${podeConf?`<button class="btn sm primary" data-toca="dados" data-click="quickConfirmRec('${jsq(r.id)}');notifModal('${jsq(f)}')">Confirmar</button>`:''}
      <button class="btn sm" data-toca="camada" data-click="closeModal();confirmRec('${jsq(r.id)}')">Rever</button>
      ${podeEd?`<button class="btn sm ghost" data-toca="dados" data-click="skipRec('${jsq(r.id)}');notifModal('${jsq(f)}')">Silenciar</button>`:''}</div></div>`;
  };
  /* um prazo: o selo diz quanto falta como o cartão da Visão geral o diz
     (prazos.js:pzQuando — «Falta 1 dia», «É hoje», «Passou há 3 dias») e
     com a mesma cor (prazos.js:pzSelo). Sem «abrir» (o serviço que o abria
     está desligado nesta conta) a linha não se apresenta como tocável — um
     toque que só fecha a janela é um beco —, como no prazos.js:prazosCard */
  const prazo=p=>{
    const dentro=`<div class="atencao-txt"><p class="title">${esc(p.titulo)}</p>${p.sub?'<p class="small">'+esc(p.sub)+'</p>':''}</div><span class="badge ${pzSelo(p)}">${pzQuando(p)}</span>`;
    return p.abrir?`<button type="button" class="atencao-linha tap" data-toca="camada" data-click="closeModal();${p.abrir}">${dentro}</button>`:`<div class="atencao-linha">${dentro}</div>`;
  };
  const atividade=n=>`<button type="button" class="atencao-linha tap" data-toca="ecra" data-click="closeModal();${n.ir}"><span class="avatar">${esc(initials(n.sub.split(' · ')[0]||'?'))}</span><div class="atencao-txt"><p class="title">${esc(n.titulo)}</p><p class="small">${esc(n.sub)}</p></div></button>`;
  const total=conf.reduce((s,r)=>s+(Number((r.tx||{}).amount)||0),0),nl=servicoLigado('recurring')?conf.filter(recIsLate).length:0;
  const partes=[];
  if(ve('pedidos')&&pedidos.length)partes.push(cab('Pedidos por responder',String(pedidos.length))+pedidos.map(pedido).join(''));
  if(ve('confirmar')&&conf.length)partes.push(cab('Por confirmar',conf.length+(nl?' · '+nl+' em atraso':'')+' · '+euro2(total))+`<div class="card atencao-lista">${conf.map(porConfirmar).join('')}</div>`);
  if(ve('prazos')&&prazos.length)partes.push(cab('Prazos legais e fiscais',String(prazos.length))+`<div class="card atencao-lista">${prazos.map(prazo).join('')}</div>`);
  if(!f&&partilha.length)partes.push(cab('Atividade nas casas partilhadas')+`<div class="card atencao-lista">${partilha.map(atividade).join('')}</div>`);
  const vazio=f?'<div class="empty"><b>Nada aqui</b>Neste filtro não há nada a pedir atenção.<div><button class="btn sm" data-toca="vista" data-click="notifModal(\'\')">Ver tudo</button></div></div>'
    :'<div class="empty"><b>Tudo em dia</b>Nada a pedir atenção: sem atrasos, prazos à porta nem pedidos por responder.</div>';
  return {corpo:`<div class="atencao">${chips}${partes.join('')||vazio}</div>`,
    pe:partilha.length?`<button class="btn" data-toca="camada" data-click="closeModal()">Fechar</button><button class="btn primary" data-toca="dados" data-click="notifLido()">Marcar tudo como lido</button>`:SEM_RODAPE};
}

/* Marca a atividade partilhada como lida até agora: a marca vive nas
   definições e sincroniza — ler aqui limpa o sino nos outros aparelhos.
   Devolve: nada — grava a marca, fecha o modal e repinta o sino. */
function notifLido(){
  db.settings.notifLidoAte=Date.now();
  save();closeModal();render();
  toast('Lido — o sino volta quando houver coisas novas.');
}
