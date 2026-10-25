/* ================= NOTIFICAÇÕES ================= */
/* O sino da vista geral: tudo o que pede atenção, num sítio só.

   Quatro fontes, por ordem de urgência: movimentos em atraso, movimentos
   por confirmar, os prazos do ciclo de vida, e — a novidade que precisou
   do servidor — a atividade dos outros nas casas partilhadas: cada registo
   escrito por outra pessoa chega com o autor e a hora (o worker grava o
   autor em cada escrita), e o que for mais novo do que a última leitura
   aparece aqui com nome e apelido. Na mesma atividade, quem saiu de uma
   casa que fica comigo — um colaborador que deixou de colaborar, um
   comproprietário que deixou de o ser — e o que aconteceu às transferências
   de propriedade (CW.state.departures, notifSaidas).

   As transferências de propriedade (CW.state.transfers): um pedido que me
   fizeram é um pedido por responder, com o «Ver» que abre o que recebo e o
   Aceitar (notifTransfVer); um que fiz espera, com o Cancelar. As ações
   delas vivem aqui, na base, porque as chamam o sino, a ficha do imóvel e o
   cartão dos pedidos da nuvem.

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
   sessão, nenhum. E os pedidos de transferência da propriedade que me
   fizeram (notifTransfRecebidas): alguém quer que um ou vários imóveis dele
   passem a ser meus.
   Devolve: lista de {id, titulo, sub} por ordem de chegada — os de partilha,
   os de transferência e os de grupo; um pedido de grupo leva também tipo
   'grupo', gid e uid — o que o modal passa ao notifGrupoAceitar/
   notifGrupoRecusar —, e um de transferência tipo 'transf' e o lote. */
function notifPedidos(){
  const st=window.CW&&CW.state;
  const partilha=((st&&st.shareRequests&&st.shareRequests.incoming)||[]).map(r=>({id:r.id,
    titulo:(r.fromName||'Alguém')+' quer partilhar '+(r.houseName||'um imóvel')+' contigo',
    sub:'Aceitar torna-te comproprietário — vês contratos, movimentos e pessoas desse imóvel.'}));
  const transf=notifTransfRecebidas().map(t=>({id:'transf:'+t.lote,tipo:'transf',lote:t.lote,
    titulo:notifTransfTitulo(t),sub:notifTransfSub(t)}));
  const sgr=servicoLigado('colaboradores')&&st&&st.sharedGroupRequests;
  // só os grupos meus: um grupo partilhado da base que não é meu nunca pede a minha resposta
  const meuGrupo=r=>{const g=grp(r.groupId);return !(g&&g._partilhado&&!g._meu)};
  const grupos=((sgr&&sgr.incoming)||[]).filter(r=>r&&r.groupId&&r.userId&&meuGrupo(r)).map(r=>({
    id:'grupo:'+r.groupId+':'+r.userId,tipo:'grupo',gid:r.groupId,uid:r.userId,
    titulo:(r.name||'Alguém')+' quer entrar no grupo «'+(r.groupName||'sem nome')+'»',
    sub:'Se aceitares, passa a comproprietário dos imóveis do grupo.'}));
  return partilha.concat(transf,grupos);
}

/* ---- as transferências de propriedade ---- */

/* Os pedidos de transferência pendentes de um lado, do estado do servidor
   (CW.state.transfers, worker/src/rotas/estado.js). Um servidor de antes não
   manda o campo, e o estado de antes do primeiro sync também não: aí não há
   nenhum, sem rebentar.
   Recebe: lado — 'incoming' (os que me fizeram) ou 'outgoing' (os que fiz).
   Devolve: array de {lote, from|to, houses, ficar, shares, at} — só os que têm lote. */
function notifTransf(lado){
  const st=window.CW&&CW.state,t=st&&st.transfers;
  const l=t&&typeof t==='object'&&Array.isArray(t[lado])?t[lado]:[];
  return l.filter(x=>x&&x.lote);
}
/* Os pedidos de transferência que me fizeram e esperam a minha resposta.
   Devolve: array (notifTransf('incoming')). */
function notifTransfRecebidas(){return notifTransf('incoming')}
/* Os pedidos de transferência que fiz e ainda esperam pelo outro.
   Devolve: array (notifTransf('outgoing')). */
function notifTransfEnviadas(){return notifTransf('outgoing')}
/* O servidor sabe de transferências? Só o que já as tem manda o campo no
   estado; num de antes (ou antes do primeiro estado) a ação de transferir
   não se oferece — levava a um 404.
   Devolve: true se o estado traz o campo transfers. */
function notifTransfSabe(){const st=window.CW&&CW.state;return !!(st&&st.transfers&&typeof st.transfers==='object')}
/* O pedido de transferência pendente de um imóvel, de um lado (só há um
   pendente por casa).
   Recebe: lado — 'incoming' ou 'outgoing'; hid — o id do imóvel.
   Devolve: o pedido, ou null. */
function notifTransfDaCasa(lado,hid){
  return notifTransf(lado).find(t=>(t.houses||[]).some(h=>h&&h.id===hid))||null;
}
/* Os nomes das casas de um pedido: o que o servidor escreveu, ou o da base.
   Recebe: t — o pedido.
   Devolve: array de nomes (texto, por escapar). */
function notifTransfCasas(t){
  return ((t&&t.houses)||[]).filter(Boolean).map(h=>String(h.name||'').trim()||propName(h.id)||'Sem nome');
}
/* O nome de quem pede (num recebido) ou de quem recebe (num enviado).
   Recebe: p — o {id, name} do pedido.
   Devolve: o nome (texto, por escapar). */
function notifTransfNome(p){return String((p&&p.name)||'').trim()||(p&&p.id?nomeUtilizador(p.id):'')||'Alguém'}
/* A frase de um pedido que me fizeram: «Rita quer transferir-te T2 Benfica»
   ou «Rita quer transferir-te 2 imóveis: T2 Benfica e Loja».
   Recebe: t — o pedido recebido.
   Devolve: o texto (por escapar). */
function notifTransfTitulo(t){
  const casas=notifTransfCasas(t),quem=notifTransfNome(t&&t.from);
  return quem+' quer transferir-te '+(casas.length===1?casas[0]:casas.length+' imóveis: '+listaE(casas));
}
/* O que aceitar um pedido de transferência implica, numa linha: os imóveis
   passam a ser meus e quem pede sai deles, ou fica com uma quota (sem
   género: a app não sabe o de ninguém).
   Recebe: t — o pedido recebido.
   Devolve: o texto (por escapar). */
function notifTransfSub(t){
  const um=((t&&t.houses)||[]).length===1,quem=notifTransfNome(t&&t.from);
  return 'Se aceitares, '+(um?'o imóvel passa a ser teu':'os imóveis passam a ser teus')+' e '+quem+
    (t&&t.ficar?(um?' fica com uma quota.':' fica com uma quota em cada um.'):(um?' sai dele.':' sai deles.'));
}
/* Uma quota de um pedido, como a app as escreve: «50%», «33,33%».
   Recebe: v — a percentagem (0–100).
   Devolve: o texto. */
function notifTransfPct(v){return dec(Math.round((Number(v)||0)*100)/100)+'%'}
/* As quotas de uma casa num pedido com «continuar como comproprietário»,
   em linhas só de leitura: quem e quanto (eu, «Tu»).
   Recebe: t — o pedido; hid — o id da casa.
   Devolve: o HTML das linhas (.pt-quota), ou '' sem quotas para essa casa. */
function notifTransfQuotasHtml(t,hid){
  const q=t&&t.shares&&t.shares[hid];if(!q||typeof q!=='object')return '';
  const eu=meuId(),de=(t.from&&t.from.id)||'';
  return Object.keys(q).map(u=>`<div class="pt-quota"><span class="pt-quota-nome">${esc(u===eu?'Tu':u===de?notifTransfNome(t.from):nomeUtilizador(u))}</span><b class="num">${notifTransfPct(q[u])}</b></div>`).join('');
}
/* O que recebo num pedido de transferência, antes de aceitar: a folha que o
   «Ver» abre (do sino, do cartão dos pedidos e da ficha do imóvel). Diz as
   casas; se quem pede sai (a quota dele passa para mim) ou fica com uma
   quota, e as quotas de cada casa; que passo a gerir as partilhas e os
   colaboradores; que os colaboradores dele perdem o acesso; que os
   comproprietários que lá estão ficam se estiverem ligados a mim, e os
   outros perdem o acesso; que as fotos e os documentos passam
   a contar no meu espaço; e que nada muda até aceitar. Em baixo, Recusar e
   Aceitar. Um pedido que já não está pendente (cancelado entretanto) diz-se
   num aviso, sem janela.
   Recebe: lote — o id do pedido.
   Devolve: nada — abre a janela por cima do que houver. */
function notifTransfVer(lote){
  const t=notifTransfRecebidas().find(x=>x.lote===lote);
  if(!t)return toast('Este pedido já não está pendente.');
  const quem=esc(notifTransfNome(t.from)),hs=(t.houses||[]).filter(Boolean),um=hs.length===1;
  const casas=hs.map(h=>{
    const nome=esc(String(h.name||'').trim()||propName(h.id)||'Sem nome'),q=t.ficar?notifTransfQuotasHtml(t,h.id):'';
    return `<div class="trf-casa">${um&&q?'':`<b>${nome}</b>`}${q?`<div class="pt-quotas"><div class="pt-quotas-cab small" aria-hidden="true"><span>Pessoa</span><span>Quota</span></div>${q}</div>`:''}</div>`;
  }).join('');
  const nomes=listaE(hs.map(h=>'<b>'+esc(String(h.name||'').trim()||propName(h.id)||'Sem nome')+'</b>'));
  const frases=[
    `${quem} quer transferir-te ${nomes}.`,
    t.ficar?`${quem} fica com uma quota${um?'':' em cada um'}: ${um?'as quotas passam a ser as que estão em cima':'as quotas de cada imóvel passam a ser as que estão em cima'}.`
      :`${quem} sai ${um?'dele':'deles'}, e a quota que tinha passa para ti, somada à tua se já tiveres uma.`,
    `Passas a gerir as partilhas e os colaboradores, e podes apagar ${um?'o imóvel':'os imóveis'}. Os colaboradores de ${quem} ${um?'neste imóvel':'nestes imóveis'} perdem o acesso. Os comproprietários que já lá estão ficam se estiverem ligados a ti; os outros perdem o acesso.`,
    `As fotos e os documentos passam a contar no teu espaço de armazenamento. Nada muda até aceitares.`];
  const l=jsq(lote);
  const L=openModal('Transferência de '+notifTransfNome(t.from),
    `<div class="form trf-ver"><p>${frases[0]}</p><div class="trf-casas">${casas}</div>${frases.slice(1).map(f=>`<p class="small">${f}</p>`).join('')}</div>`,
    `<button type="button" class="btn" data-toca="dados" data-click="notifTransfRecusar('${l}')">Recusar</button><button type="button" class="btn primary" data-toca="dados" data-click="notifTransfAceitar('${l}')">Aceitar</button>`);
  if(L)L.trf=lote;
}
/* os lotes com um pedido ao servidor a meio: um segundo toque não repete o pedido */
const _trfEmCurso={};
/* Fecha a folha do «Ver» e, por baixo dela, o sino: o render() não fecha
   janelas, e o cartão ficava lá com os botões a repetir o pedido já
   respondido (a regra do notifPedidoAceitar).
   Devolve: nada. */
function notifTransfFechar(){
  if(modalTop()&&modalTop().trf)closeModal();
  if(modalTop()&&modalTop().title==='Pede atenção')closeModal();
}
/* Depois de responder ou cancelar: relê o estado (pullNow, da nuvem),
   repinta, e refaz o sino se ele ficou aberto — com o pedido já fora.
   Devolve: a promessa (resolve depois de repintar). */
function notifTransfReler(){
  return Promise.resolve(typeof pullNow==='function'?pullNow(true):null).catch(()=>{}).then(()=>{
    render();
    if(modalTop()&&modalTop().title==='Pede atenção')notifModal(_atencaoFiltro);
  });
}
/* Um pedido de transferência ao servidor, com a guarda do toque repetido:
   enquanto o do mesmo lote não responde, outro não sai. Sem a nuvem
   carregada, diz-o.
   Recebe: lote — o id do pedido; fn — o nome da função do CW
   ('aceitarTransferencia', 'recusarTransferencia', 'cancelarTransferencia').
   Devolve: a promessa da resposta, ou null quando não saiu. */
function notifTransfPedido(lote,fn){
  if(!lote||_trfEmCurso[lote])return null;
  const f=window.CW&&CW[fn];
  if(typeof f!=='function'){toast('Sem ligação ao servidor: tenta outra vez.');return null}
  _trfEmCurso[lote]=1;
  const fim=()=>{delete _trfEmCurso[lote]};
  return Promise.resolve(f(lote)).then(r=>{fim();return r},e=>{fim();throw e});
}
/* O aviso de aceitar: o que passou a ser meu e o que ficou de fora, e porquê
   (o servidor diz por casa — a casa mudou entretanto, foi apagada).
   Recebe: ok — os nomes das casas aceites; falhas — [{nome, erro}].
   Devolve: o texto do aviso. */
function notifTransfAvisoAceite(ok,falhas){
  const partes=[];
  if(ok.length===1)partes.push('Aceitaste: '+ok[0]+' passou a ser teu.');
  else if(ok.length)partes.push('Aceitaste: '+ok.length+' imóveis passaram a ser teus.');
  else partes.push('Nenhum imóvel passou para ti.');
  if(falhas.length){
    const nomes=falhas.map(f=>'«'+f.nome+'»').join(', ');
    partes.push(nomes+(falhas.length===1?' ficou de fora: ':' ficaram de fora: ')+String(falhas[0].erro||'o pedido já não valia').replace(/\.?\s*$/,'.'));
  }
  return partes.join(' ');
}
/* Aceitar um pedido de transferência (CW.aceitarTransferencia): fecha a
   folha e o sino, e só com a resposta diz o que passou a ser meu e o que
   ficou de fora (notifTransfAvisoAceite); depois relê o estado. Um erro diz
   a frase do servidor e relê na mesma (o pedido pode ter mudado).
   Recebe: lote — o id do pedido.
   Devolve: a promessa (ou nada, quando não saiu). */
function notifTransfAceitar(lote){
  const t=notifTransfRecebidas().find(x=>x.lote===lote),casas=(t&&t.houses)||[];
  const nomeDe=id=>{const h=casas.find(x=>x&&x.id===id);return String((h&&h.name)||'').trim()||propName(id)||'Sem nome'};
  const p=notifTransfPedido(lote,'aceitarTransferencia');if(!p)return;
  notifTransfFechar();
  return p.then(r=>{
    const falhas=((r&&r.falhadas)||[]).map(f=>({nome:nomeDe(f&&f.houseId),erro:f&&f.error}));
    toast(notifTransfAvisoAceite(((r&&r.aceites)||[]).map(nomeDe),falhas),falhas.length?{ms:7000}:undefined);
  },e=>{toast((e&&e.message)||'Não deu para aceitar. Tenta outra vez.')}).then(notifTransfReler);
}
/* Recusar um pedido de transferência (CW.recusarTransferencia), sem
   perguntar — quem pediu pode voltar a pedir, como nos outros pedidos.
   Recebe: lote — o id do pedido.
   Devolve: a promessa (ou nada, quando não saiu). */
function notifTransfRecusar(lote){
  const p=notifTransfPedido(lote,'recusarTransferencia');if(!p)return;
  notifTransfFechar();
  return p.then(()=>{toast('Recusaste a transferência.')},e=>{toast((e&&e.message)||'Não deu para recusar. Tenta outra vez.')}).then(notifTransfReler);
}
/* Cancelar um pedido de transferência que fiz (CW.cancelarTransferencia):
   do sino e da ficha do imóvel. Cancela o pedido todo (todas as casas que
   ele leva) e não pergunta: não muda nada, e pode-se voltar a pedir. A
   ficha fica aberta e repinta-se sem o pendente.
   Recebe: lote — o id do pedido.
   Devolve: a promessa (ou nada, quando não saiu). */
function notifTransfCancelar(lote){
  const p=notifTransfPedido(lote,'cancelarTransferencia');if(!p)return;
  return p.then(()=>{toast('Pedido de transferência cancelado.')},e=>{toast((e&&e.message)||'Não deu para cancelar. Tenta outra vez.')}).then(notifTransfReler);
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
  const marca=notifMarca(desde);
  const out=[];
  const lotes={};   // lote.id → a linha dele em out
  const quando=notifQuando;
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

/* A marca de leitura da atividade (a partilhada e as saídas): o que for
   mais novo do que ela está por ler. Na primeira vez, a contagem começa
   AGORA — sem isto, o primeiro sino despejava o histórico inteiro das casas
   partilhadas —, e a marca grava-se (sincroniza com os outros aparelhos).
   Recebe: desde (opcional) — marca temporal em ms, que manda sobre a guardada.
   Devolve: a marca em ms (número; 0 se nunca houve e não se pôde pôr). */
function notifMarca(desde){
  if(desde!=null)return Number(desde)||0;
  if(db.settings.notifLidoAte==null){db.settings.notifLidoAte=Date.now();save()}
  return Number((db.settings||{}).notifLidoAte||0);
}

/* A hora de uma linha do sino, como as da atividade: «22/10, 14:30».
   Recebe: at — marca temporal em ms.
   Devolve: o texto da data e da hora. */
function notifQuando(at){
  return new Date(at).toLocaleDateString('pt-PT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}

/* Quem saiu das casas que ficam comigo: um colaborador que deixou de
   colaborar num imóvel meu (kind 'colab.sair', só me chega a mim, o dono)
   ou um comproprietário que deixou de o ser num imóvel que partilho
   (kind 'casa.sair', chega a todos os que ficam). Vêm do servidor em
   CW.state.departures (os dos últimos 90 dias, worker/src/rotas/estado.js),
   com o nome da casa e o de quem saiu escritos no momento. Só os mais novos
   do que a marca de leitura, como a atividade: o «Marcar tudo como lido»
   cala-os também. Com os Colaboradores desligados nesta conta, as saídas de
   colaboradores não entram (o servidor já não as manda; se sobrar alguma no
   aparelho, não se mostra um aviso de um serviço que não está). O toque abre
   a ficha do imóvel se ele ainda estiver na base e os Imóveis ligados (o
   propView é desse serviço; a app carrega-o sempre, e por isso a guarda é o
   servicoLigado e não um typeof); sem isso a linha não leva a lado nenhum
   (ir vazio).

   Os avisos das transferências de propriedade chegam pelo mesmo caminho e
   leem-se da mesma maneira, uma frase que já diz quem (notifFraseDoAviso):
   a quem pediu, que o outro aceitou ou recusou; a quem ia receber, que quem
   pediu cancelou; aos comproprietários que ficam, quem é o novo dono; ao
   que perdeu o acesso (não está ligado a quem recebeu), para quem passou; e
   ao colaborador do dono antigo, que deixou de colaborar porque o imóvel
   mudou de dono. O pedido em si ('transf.pedido') não é uma linha da atividade:
   enquanto está pendente já é um pedido por responder (notifPedidos), e
   contava duas vezes no crachá; depois disso, o aviso de como acabou diz o
   resto.
   Recebe: desde (opcional) — marca temporal em ms; por omissão, a última
   leitura guardada nas definições.
   Devolve: lista de {tipo:'saida', id, kind, titulo, sub, quem, at, ir, toca}
   por ordem do mais recente. */
function notifSaidas(desde){
  const st=window.CW&&CW.state;
  const lista=st&&Array.isArray(st.departures)?st.departures:[];
  if(!lista.length)return [];
  const meu=(CW.user&&CW.user.id)||'';
  const marca=notifMarca(desde);
  const colab=servicoLigado('colaboradores');
  const out=[];
  lista.forEach(d=>{
    if(!d||(d.kind==='colab.sair'&&!colab))return;
    if(meu&&d.actorId===meu)return;   // a minha própria saída não é aviso para mim
    const at=typeof d.at==='number'?d.at:(Number(d.at)||Date.parse(d.at)||0);
    if(!(at>marca))return;
    const f=notifFraseDoAviso(d);if(!f)return;
    const abre=!!d.houseId&&servicoLigado('properties')&&!!prop(d.houseId);
    out.push({tipo:'saida',id:String(d.id||''),kind:d.kind,titulo:f.titulo,sub:notifQuando(at),quem:f.quem,at,
      ir:abre?`propView('${jsq(d.houseId)}')`:'',toca:'camada'});
  });
  return out.sort((a,b)=>b.at-a.at);
}
/* A frase de um aviso das casas (CW.state.departures), já com quem:
   «Rui deixou de colaborar em T2 Benfica.», «Rui deixou de ser
   comproprietário de T2 Benfica.», «Rui aceitou a transferência de T2
   Benfica.», «Rui recusou a transferência de …», «Rita cancelou a
   transferência de …», «Rui é o novo dono de …» (o nome é o de quem a casa
   tem por dono na base, que é o que conta; sem ela, o do aviso) e
   «Deixaste de colaborar em T2 Benfica: o imóvel mudou de dono.» e, ao
   comproprietário que via a casa pela ligação com quem a deu e não está
   ligado a quem a recebeu, «Deixaste de ter acesso a T2 Benfica: passou
   para Rui.» ('casa.sem_acesso', o ator é quem recebeu). Um kind
   que a app não conhece — e o 'transf.pedido', que é um pedido por
   responder (notifPedidos) — não tem frase.
   Recebe: d — o aviso ({kind, houseId, houseName, actorId, actorName}).
   Devolve: {titulo, quem} (texto, por escapar; quem dá as iniciais do
   avatar), ou null. */
function notifFraseDoAviso(d){
  const quem=String((d&&d.actorName)||'').trim()||'Alguém';
  const casa=String((d&&d.houseName)||'').trim()||propName(d&&d.houseId)||'um imóvel';
  switch(d&&d.kind){
    case 'colab.sair':return {titulo:quem+' deixou de colaborar em '+casa+'.',quem};
    case 'casa.sair':return {titulo:quem+' deixou de ser comproprietário de '+casa+'.',quem};
    case 'transf.aceite':return {titulo:quem+' aceitou a transferência de '+casa+'.',quem};
    case 'transf.recusada':return {titulo:quem+' recusou a transferência de '+casa+'.',quem};
    case 'transf.cancelada':return {titulo:quem+' cancelou a transferência de '+casa+'.',quem};
    case 'casa.novo_dono':{
      const p=prop(d.houseId),dono=String((p&&(p._sharedFrom||(p._ownerUserId?nomeUtilizador(p._ownerUserId):'')))||'').trim()||quem;
      return {titulo:dono+' é o novo dono de '+casa+'.',quem:dono};
    }
    case 'colab.removido':return {titulo:'Deixaste de colaborar em '+casa+': o imóvel mudou de dono.',quem};
    case 'casa.sem_acesso':return {titulo:'Deixaste de ter acesso a '+casa+': passou para '+quem+'.',quem};
  }
  return null;
}

/* A atividade do sino: a dos outros nas casas partilhadas (notifPartilha) e
   quem saiu delas (notifSaidas), juntas e pela hora — é uma secção só no
   «Pede atenção» e um cartão só no painel geral, com a mesma marca de leitura.
   Recebe: desde (opcional) — como o notifPartilha.
   Devolve: lista das linhas das duas, do mais recente, no máximo 40. */
function notifAtividade(desde){
  return notifPartilha(desde).concat(notifSaidas(desde)).sort((a,b)=>b.at-a.at).slice(0,40);
}

/* Quem fez o que uma linha da atividade diz, para as iniciais do avatar: o
   quem das saídas, ou o nome à cabeça do sub da atividade partilhada
   («Maria Costa · T2 Lisboa · …»).
   Recebe: n — uma linha do notifAtividade.
   Devolve: o nome (texto; '?' sem nenhum). */
function notifQuem(n){
  return (n&&n.quem)||String((n&&n.sub)||'').split(' · ')[0]||'?';
}

/* O que o sino conta: atrasados + atividade nova dos outros (um lote conta
   uma vez, e cada saída de um colaborador ou comproprietário conta uma) +
   pedidos à espera de resposta (de partilha e para entrar num grupo meu). O
   que está só «por confirmar» ou é prazo
   informativo não incha o número — está no modal, mas o crachá é para o que
   muda decisões.
   Devolve: o número para o crachá do sino (inteiro). */
function notifConta(){
  return (servicoLigado('recurring')?recLate().length:0)+notifAtividade().length+notifPedidos().length;
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
   respondem-se aqui mesmo (os de transferência pelo «Ver», que mostra o que
   se recebe antes do Aceitar), os de transferência que fiz esperam em «À
   espera de resposta», com o Cancelar, e cada prazo leva ao sítio dele. «Marcar tudo
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
  const partilha=notifAtividade(),pedidos=notifPedidos();
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
    /* uma transferência não se aceita daqui: o «Ver» abre a folha com o que
       se recebe, e o Aceitar está lá (notifTransfVer) */
    if(n.tipo==='transf')return `<div class="card atencao-pedido"><p><b>${esc(n.titulo)}</b></p><p class="small">${esc(n.sub)}</p>
      <div class="chips-fila"><button class="btn sm primary" data-toca="camada" data-click="notifTransfVer('${jsq(n.lote)}')">Ver</button>
      <button class="btn sm" data-toca="dados" data-click="notifTransfRecusar('${jsq(n.lote)}')">Recusar</button></div></div>`;
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
  /* uma linha da atividade: as iniciais de quem, o que fez e quando; leva ao
     sítio dela (o separador, ou a ficha do imóvel de onde alguém saiu). Uma
     saída de um imóvel que já não está na base não leva a lado nenhum, e por
     isso é uma linha e não um botão, como o prazo sem destino */
  const atividade=n=>{
    const dentro=`<span class="avatar" aria-hidden="true">${esc(initials(notifQuem(n)))}</span><div class="atencao-txt"><p class="title">${esc(n.titulo)}</p><p class="small">${esc(n.sub)}</p></div>`;
    return n.ir?`<button type="button" class="atencao-linha tap" data-toca="${n.toca||'ecra'}" data-click="closeModal();${n.ir}">${dentro}</button>`:`<div class="atencao-linha">${dentro}</div>`;
  };
  /* um pedido de transferência que fiz e ainda espera: que imóveis, para
     quem, e o Cancelar (cancela o pedido todo) */
  const enviada=t=>{
    const casas=notifTransfCasas(t),quem=notifTransfNome(t.to);
    return `<div class="atencao-linha"><div class="atencao-txt"><p class="title">${esc(listaE(casas))} · à espera de ${esc(quem)}</p>
      <p class="small">Pediste a transferência${t.ficar?', a continuares comproprietário':''}. Até ${esc(quem)} aceitar, nada muda.</p></div>
      <button class="btn sm" data-toca="dados" aria-label="Cancelar o pedido de transferência de ${esc(listaE(casas))}" data-click="notifTransfCancelar('${jsq(t.lote)}')">Cancelar</button></div>`;
  };
  const enviadas=notifTransfEnviadas();
  const total=conf.reduce((s,r)=>s+(Number((r.tx||{}).amount)||0),0),nl=servicoLigado('recurring')?conf.filter(recIsLate).length:0;
  const partes=[];
  if(ve('pedidos')&&pedidos.length)partes.push(cab('Pedidos por responder',String(pedidos.length))+pedidos.map(pedido).join(''));
  if(ve('pedidos')&&enviadas.length)partes.push(cab('À espera de resposta',String(enviadas.length))+`<div class="card atencao-lista">${enviadas.map(enviada).join('')}</div>`);
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
