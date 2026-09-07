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

/* O nome de quem fez uma alteração, a partir do id de utilizador: procura
   nos proprietários (que são os utilizadores com acesso) e cai no id
   encurtado quando não há nome — nunca «undefined».
   Recebe: uid — o id do utilizador autor.
   Devolve: um nome apresentável (texto). */
function notifNome(uid){
  const o=(db.owners||[]).find(x=>x.id===uid||x._userId===uid);
  return (o&&o.name)||String(uid||'?').slice(0,8);
}

/* A atividade dos outros: registos de casas partilhadas escritos por outra
   pessoa depois da última leitura. O autor vem do servidor (_author) e só
   existe em registos com casa; o que eu próprio escrevi nunca entra.
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
  const poe=(tipo,rotulo,nome,x,ir)=>{
    if(!x._author||x._author===meu)return;
    const at=Number(x._atServidor||0);
    if(at<=marca)return;
    const casa=x.propertyId?propName(x.propertyId):(x.tx&&x.tx.propertyId?propName(x.tx.propertyId):'');
    out.push({tipo,at,ir,titulo:rotulo+(nome?' — '+nome:''),
      sub:notifNome(x._author)+(casa?' · '+casa:'')+' · '+new Date(at).toLocaleDateString('pt-PT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})});
  };
  (db.transactions||[]).forEach(t=>poe('mov','Movimento',t.label||t.category||'',t,"go('transactions')"));
  (db.recurring||[]).forEach(r=>poe('rec','Planeado',r.name||'',r,"go('recurring')"));
  (db.contracts||[]).forEach(c=>poe('ct','Contrato',c.name||'',c,"go('contracts')"));
  (db.visits||[]).forEach(v=>poe('vis','Visita',v.nomes||'',v,"go('visits')"));
  (db.tenants||[]).forEach(t=>poe('pes','Ficha de inquilino',t.name||'',t,"go('tenants')"));
  return out.sort((a,b)=>b.at-a.at).slice(0,40);
}

/* O que o sino conta: atrasados + atividade nova dos outros. O que está só
   «por confirmar» ou é prazo informativo não incha o número — está no
   modal, mas o crachá é para o que muda decisões.
   Devolve: o número para o crachá do sino (inteiro). */
function notifConta(){
  return (typeof recLate==='function'?recLate().length:0)+notifPartilha().length;
}

/* O sino do cabeçalho da vista geral, com o crachá quando há novidades.
   Devolve: nada — pinta o botão #hdrBell conforme o separador e a contagem. */
function notifSino(){
  const b=document.getElementById('hdrBell');if(!b)return;
  if(tab!=='dashboard'){b.style.display='none';return}
  const n=notifConta();
  b.style.display='';
  b.innerHTML=ic('bell',16)+(n?`<span class="cnt">${n>9?'9+':n}</span>`:'');
}

/* O modal das notificações: as quatro fontes em secções, cada linha a levar
   ao sítio certo, e «Marcar tudo como lido» a calar a partilha até haver
   coisas novas (a marca sincroniza entre aparelhos).
   Devolve: nada — abre o modal da casa com as listas. */
function notifModal(){
  const atrasados=typeof recLate==='function'?recLate():[];
  const pendentes=(typeof recActive==='function'?recActive():[]).filter(r=>!recIsLate(r));
  const prazos=typeof prazosAtivos==='function'?prazosAtivos().slice(0,6):[];
  const partilha=notifPartilha();
  const linha=(titulo,sub,ir,cls)=>`<div class="card tap" style="padding:10px 13px" onclick="closeModal();${ir}">
    <div class="row-between" style="align-items:center;gap:8px"><div style="min-width:0">
      <b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(titulo)}</b>
      <span class="small">${esc(sub)}</span></div>${cls?`<span class="badge ${cls}" style="flex:0 0 auto">!</span>`:''}</div></div>`;
  const bloco=(titulo,linhas)=>linhas.length?`<div class="navh">${titulo}</div>${linhas.join('')}`:'';
  const corpo=`<div class="list" style="gap:8px">
    ${bloco('Em atraso',atrasados.map(r=>linha(r.name,'devia ter sido confirmado a '+r.next+(r.tx.amount?' · '+euro2(r.tx.amount):''),"go('recurring')",'red')))}
    ${bloco('Por confirmar',pendentes.slice(0,6).map(r=>linha(r.name,r.next+(r.tx.amount?' · '+euro2(r.tx.amount):''),"go('recurring')")))}
    ${bloco('Prazos',prazos.map(p=>linha(p.titulo,(p.dias<0?'há '+(-p.dias)+' dias':p.dias===0?'hoje':'em '+p.dias+' dias'),p.abrir,p.urg==='urgente'||p.urg==='passado'?'red':p.urg==='breve'?'amber':'')))}
    ${bloco('Nas casas partilhadas',partilha.map(n=>linha(n.titulo,n.sub,n.ir)))}
    ${!atrasados.length&&!pendentes.length&&!prazos.length&&!partilha.length?'<div class="empty">Tudo em dia — nada a pedir atenção.</div>':''}
  </div>`;
  openModal('Notificações',corpo,
    `<button class="btn" onclick="closeModal()">Fechar</button>`+
    (partilha.length?`<button class="btn primary" onclick="notifLido()">Marcar tudo como lido</button>`:''));
}

/* Marca a atividade partilhada como lida até agora: a marca vive nas
   definições e sincroniza — ler aqui limpa o sino nos outros aparelhos.
   Devolve: nada — grava a marca, fecha o modal e repinta o sino. */
function notifLido(){
  db.settings.notifLidoAte=Date.now();
  save();closeModal();render();
  toast('Lido — o sino volta quando houver coisas novas.');
}
