/* ================= NOTIFICAÇÕES ================= */
/* O sino da vista geral: tudo o que pede atenção, num sítio só.

   Quatro fontes, por ordem de urgência: movimentos em atraso, movimentos
   por confirmar, os prazos do ciclo de vida, e — a novidade que precisou
   do servidor — a atividade dos outros nas casas partilhadas: cada registo
   escrito por outra pessoa chega com o autor e a hora (o worker grava o
   autor em cada escrita), e o que for mais novo do que a última leitura
   aparece aqui com nome e apelido. Na mesma atividade, quem saiu de uma
   casa que fica comigo — um colaborador que deixou de colaborar, um
   comproprietário que deixou de o ser — e o que aconteceu aos pedidos para
   transferir o controlo de um imóvel (CW.state.departures, notifSaidas).

   Os pedidos para transferir o controlo de um imóvel a um comproprietário
   (CW.state.transfers): chegam a todos os comproprietários, que têm todos de
   aceitar; enquanto me falta responder é um pedido por responder, com o
   «Ver» que diz o que muda, quem já aceitou e quem falta, e o Aceitar
   (notifTransfVer); depois de aceitar espera pelos outros; um que fiz
   espera, com o progresso e o Cancelar. As ações
   delas vivem aqui, na base, porque as chamam o sino, a ficha do imóvel e o
   cartão dos pedidos da nuvem.

   «Marcar tudo como lido» guarda a marca temporal nas definições — que
   sincronizam, por isso ler num aparelho limpa o sino nos outros. Tocar num
   aviso das casas (um de CW.state.departures, que leva à ficha do imóvel)
   lê esse aviso só: o id dele vai para db.settings.notifLidos ({id: 1},
   notifLerAviso), que sincroniza da mesma maneira — a marca temporal, posta
   até ao aviso tocado, calava os mais novos que ainda ninguém viu. */

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
   sessão, nenhum. E os pedidos para transferir o controlo a que me falta
   responder (notifTransfPorResponder): quem criou um ou vários imóveis que
   partilhamos quer transferir o controlo deles na app a mim ou a outro
   comproprietário, e todos temos de aceitar.
   Devolve: lista de {id, titulo, sub} por ordem de chegada — os de partilha,
   os de transferir o controlo e os de grupo; um pedido de grupo leva também
   tipo 'grupo', gid e uid — o que o modal passa ao notifGrupoAceitar/
   notifGrupoRecusar —, e um de transferir o controlo tipo 'transf', o lote e
   concluir (já aceitei e só falta concluir: sem Recusar). */
function notifPedidos(){
  const st=window.CW&&CW.state;
  const partilha=((st&&st.shareRequests&&st.shareRequests.incoming)||[]).map(r=>({id:r.id,
    titulo:(r.fromName||'Alguém')+' quer partilhar '+(r.houseName||'um imóvel')+' contigo',
    sub:'Aceitar torna-te comproprietário — vês contratos, movimentos e pessoas desse imóvel.'}));
  const transf=notifTransfPorResponder().map(t=>({id:'transf:'+t.lote,tipo:'transf',lote:t.lote,concluir:notifTransfSoConcluir(t),
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

/* ---- transferir o controlo de um imóvel a um comproprietário ---- */

/* Os pedidos para transferir o controlo pendentes de um lado, do estado do
   servidor (CW.state.transfers, worker/src/rotas/estado.js). Um servidor de
   antes não manda o campo, e o estado de antes do primeiro sync também não:
   aí não há nenhum, sem rebentar.
   Recebe: lado — 'incoming' (os que me chegaram: sou comproprietário de
   alguma casa do pedido e não fui eu que pedi) ou 'outgoing' (os que fiz).
   Devolve: array de {lote, from, to, houses, porResponder, at} — só os que
   têm lote. */
function notifTransf(lado){
  const st=window.CW&&CW.state,t=st&&st.transfers;
  const l=t&&typeof t==='object'&&Array.isArray(t[lado])?t[lado]:[];
  return l.filter(x=>x&&x.lote);
}
/* Os pedidos para transferir o controlo que me chegaram, os que me falta
   responder e os que já aceitei e esperam pelos outros.
   Devolve: array (notifTransf('incoming')). */
function notifTransfRecebidas(){return notifTransf('incoming')}
/* Os pedidos que me chegaram e me falta responder (porResponder: há uma casa
   minha no pedido sem o meu sim). Um servidor de antes não manda o campo, e
   aí todos os recebidos são por responder.
   Devolve: array. */
function notifTransfPorResponder(){return notifTransfRecebidas().filter(t=>t.porResponder!==false)}
/* Os pedidos que me chegaram, já aceitei e esperam pelos outros
   comproprietários.
   Devolve: array. */
function notifTransfAEspera(){return notifTransfRecebidas().filter(t=>t.porResponder===false)}
/* Os pedidos para transferir o controlo que fiz e ainda esperam pelos
   comproprietários.
   Devolve: array (notifTransf('outgoing')). */
function notifTransfEnviadas(){return notifTransf('outgoing')}
/* O controlo deste pedido passa para mim? Um servidor de antes não dizia
   para quem (só mo mandava a mim, que recebia).
   Recebe: t — o pedido recebido.
   Devolve: true se quem recebe sou eu. */
function notifTransfParaMim(t){const id=t&&t.to&&t.to.id;return !id||id===meuId()}
/* Uma lista de pessoas de um pedido ({id, name}), pelo nome, com eu como
   «tu», no fim.
   Recebe: l — a lista do servidor (aceitaram ou faltam).
   Devolve: array de nomes (texto, por escapar). */
function notifTransfGente(l){
  const eu=meuId(),out=[];let tu=false;
  (Array.isArray(l)?l:[]).forEach(p=>{if(!p)return;if(eu&&p.id===eu){tu=true;return}out.push(notifTransfNome(p))});
  if(tu)out.push('tu');
  return out;
}
/* Esta casa do pedido precisa do sim de mais do que uma pessoa? Com o
   servidor de agora, aceitaram e faltam dizem quem; um de antes não os
   manda, e só quem recebia aceitava.
   Recebe: h — uma casa do pedido.
   Devolve: true com dois ou mais comproprietários a aceitar. */
function notifTransfVarios(h){
  const n=l=>Array.isArray(l)?l.length:0;
  return !!h&&n(h.aceitaram)+n(h.faltam)>1;
}
/* Quem já aceitou e quem falta numa casa do pedido: «Já aceitou: Carlos.
   Falta responder: Bruno e tu.» (eu sou «tu»; «Já aceitaste.» e «Falta a
   tua resposta.» quando sou só eu). Com todos a terem aceitado e a casa
   por passar (quem faltava saiu), «Todos aceitaram; falta concluir.».
   Recebe: h — a casa do pedido ({aceitaram, faltam}).
   Devolve: o texto (por escapar), ou '' sem as listas (um servidor de antes). */
function notifTransfProgresso(h){
  if(!h||(!Array.isArray(h.aceitaram)&&!Array.isArray(h.faltam)))return '';
  const a=notifTransfGente(h.aceitaram),f=notifTransfGente(h.faltam),out=[];
  if(a.length&&!f.length)return 'Todos aceitaram; falta concluir.';
  if(a.length)out.push(a.length===1&&a[0]==='tu'?'Já aceitaste.':(a.length===1?'Já aceitou: ':'Já aceitaram: ')+listaE(a)+'.');
  if(f.length)out.push(f.length===1&&f[0]==='tu'?'Falta a tua resposta.':'Falta responder: '+listaE(f)+'.');
  return out.join(' ');
}
/* Um pedido que me chegou em que já aceitei todas as minhas casas, mas que
   ainda me pede o Aceitar: numa casa todos aceitaram e ficou por passar
   (quem faltava saiu, por exemplo), e o accept conclui-a. Aí não há Recusar
   — já aceitei —, só o Aceitar que conclui.
   Recebe: t — o pedido recebido.
   Devolve: true se só falta concluir. */
function notifTransfSoConcluir(t){
  const hs=((t&&t.houses)||[]).filter(Boolean);
  return !!t&&t.porResponder!==false&&hs.length>0&&hs.every(h=>h.euAceitei===true);
}
/* O ponto de um pedido inteiro, para as linhas que esperam (as que fiz e as
   que já aceitei): quem já aceitou e quem falta (notifTransfProgresso), casa
   a casa com vários imóveis («T2 Benfica — Falta responder: Bruno.»), e que
   até todos aceitarem nada muda. Num pedido que só quem recebe aceita (ou de
   um servidor de antes), «Até Bruno aceitar, nada muda.».
   Recebe: t — o pedido (recebido ou enviado).
   Devolve: o texto (por escapar). */
function notifTransfEspera(t){
  const hs=((t&&t.houses)||[]).filter(Boolean);
  if(!hs.some(notifTransfVarios))return 'Até '+notifTransfNome(t&&t.to)+' aceitar, nada muda.';
  const prog=hs.length===1?notifTransfProgresso(hs[0])
    :hs.map(h=>{const p=notifTransfProgresso(h);return p?(String(h.name||'').trim()||propName(h.id)||'Sem nome')+' — '+p:''}).filter(Boolean).join(' ');
  return (prog?prog+' ':'')+'Até todos aceitarem, nada muda.';
}
/* Fico ligado a quem recebe quando aceitar? Só quem chega à casa por uma
   partilha de quem pede (a ligação a ele, com a casa nas partilhas dele) e
   ainda não tem uma ligação aceite a quem recebe — quem chega por um grupo
   não ganha ligação (a regra do servidor ao aceitar).
   Recebe: t — o pedido recebido.
   Devolve: true se aceitar me liga a quem recebe. */
function notifTransfLigoAoAceitar(t){
  const st=window.CW&&CW.state,cs=st&&Array.isArray(st.connections)?st.connections:[];
  const para=t&&t.to&&t.to.id,de=t&&t.from&&t.from.id;
  if(!para||para===meuId()||!de)return false;
  const aceite=id=>cs.find(c=>c&&c.status==='accepted'&&c.peer&&c.peer.id===id);
  if(aceite(para))return false;
  const lig=aceite(de),dele=(lig&&lig.peerShares)||[];
  return ((t&&t.houses)||[]).some(h=>h&&dele.indexOf(h.id)>-1);
}
/* O servidor sabe destes pedidos? Só o que já os tem manda o campo no
   estado; num de antes (ou antes do primeiro estado) transferir o controlo não
   se oferece — levava a um 404.
   Devolve: true se o estado traz o campo transfers. */
function notifTransfSabe(){const st=window.CW&&CW.state;return !!(st&&st.transfers&&typeof st.transfers==='object')}
/* O pedido pendente de um imóvel, de um lado (só há um pendente por casa).
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
/* Quem colabora nestes imóveis, pelo nome: os de cada imóvel
   (p._colaboradores, que a nuvem escreve do estado — o servidor manda-os ao
   criador e aos comproprietários). São os colaboradores de quem criou o
   imóvel, e é com ele que passam a quem recebe o controlo, com o mesmo
   cargo. Com os Colaboradores desligados o servidor não os manda, e a lista
   fica vazia.
   Recebe: ids — os ids dos imóveis.
   Devolve: array de nomes (texto, por escapar), sem repetidos. */
function notifTransfColaboradores(ids){
  const out=[];
  (ids||[]).map(prop).filter(Boolean).forEach(p=>(p._colaboradores||[]).forEach(c=>{
    const n=String((c&&c.name)||'').trim()||(c&&c.userId?nomeUtilizador(c.userId):'')||'Sem nome';
    if(out.indexOf(n)<0)out.push(n);
  }));
  return out;
}
/* Para quem vai o controlo, dito a quem lê: «a ti» ou «a Bruno».
   Recebe: t — o pedido recebido.
   Devolve: o texto (por escapar). */
function notifTransfAQuem(t){return notifTransfParaMim(t)?'a ti':'a '+notifTransfNome(t&&t.to)}
/* A frase de um pedido que me chegou: «Rita quer transferir o controlo de T2
   Benfica a Bruno» (ou «… a ti»), ou «Rita quer transferir o controlo de 2
   imóveis a ti: T2 Benfica e Loja».
   Recebe: t — o pedido recebido.
   Devolve: o texto (por escapar). */
function notifTransfTitulo(t){
  const casas=notifTransfCasas(t),quem=notifTransfNome(t&&t.from),a=notifTransfAQuem(t);
  return quem+' quer transferir o controlo de '+(casas.length===1?casas[0]+' '+a:casas.length+' imóveis '+a+': '+listaE(casas));
}
/* O que aceitar um pedido para transferir o controlo implica, numa linha: quem
   passa a gerir os imóveis na app (eu ou quem recebe) se todos aceitarem,
   que as quotas e os comproprietários não mudam e, com um imóvel só, quem
   já aceitou e quem falta (notifTransfProgresso). Num pedido que só eu
   tenho de aceitar (ou de um servidor de antes), «Se aceitares».
   Recebe: t — o pedido recebido.
   Devolve: o texto (por escapar). */
function notifTransfSub(t){
  const hs=((t&&t.houses)||[]).filter(Boolean),um=hs.length===1,varios=hs.some(notifTransfVarios);
  const oQue=um?'o imóvel':'os imóveis',quem=notifTransfParaMim(t)?'passas':notifTransfNome(t&&t.to)+' passa';
  const prog=um&&varios?notifTransfProgresso(hs[0]):'';
  return (varios?'Se todos aceitarem, ':'Se aceitares, ')+quem+' a gerir '+oQue+' na app. As quotas e os comproprietários não mudam.'+(prog?' '+prog:'');
}
/* O que muda se aceitar um pedido para transferir o controlo: a folha que o
   «Ver» abre (do sino, do cartão dos pedidos e da ficha do imóvel), a todos
   os comproprietários. Diz as casas e a quem vai o controlo; que só muda
   quem as controla na app (quem recebe — eu ou outro — passa a gerir as
   partilhas, os colaboradores e o apagar); que quem pede fica com a quota
   que tem, eu com a minha, e que nada muda nas quotas, nos grupos nem nos
   outros comproprietários; os colaboradores dele nesses imóveis, pelo nome
   (notifTransfColaboradores), que ficam com o mesmo cargo e passam a ser
   geridos por quem recebe; que aceitar me liga a quem recebe, quando ainda
   não estou ligado (notifTransfLigoAoAceitar); que todos os
   comproprietários têm de aceitar e que uma recusa faz cair o pedido (casa a
   casa, com vários imóveis), com quem já aceitou e quem falta em cada casa
   (notifTransfProgresso); e que nada muda até lá. Em baixo, Recusar e
   Aceitar enquanto me falta responder (porResponder); depois de aceitar, só
   o Fechar — ou o Fechar e o Aceitar, quando todos aceitaram e falta
   concluir (notifTransfSoConcluir). Um pedido que já não está pendente (cancelado entretanto)
   diz-se num aviso, sem janela.
   Recebe: lote — o id do pedido.
   Devolve: nada — abre a janela por cima do que houver. */
function notifTransfVer(lote){
  const t=notifTransfRecebidas().find(x=>x.lote===lote);
  if(!t)return toast('Este pedido já não está pendente.');
  const quem=esc(notifTransfNome(t.from)),hs=(t.houses||[]).filter(Boolean),um=hs.length===1,mim=notifTransfParaMim(t);
  const para=esc(notifTransfNome(t.to)),porQuem=mim?'ti':para,responder=t.porResponder!==false,varios=hs.some(notifTransfVarios);
  const casa=h=>esc(String(h.name||'').trim()||propName(h.id)||'Sem nome');
  const nomes=listaE(hs.map(h=>'<b>'+casa(h)+'</b>'));
  const colabs=notifTransfColaboradores(hs.map(h=>h.id)),onde=um?'neste imóvel':'nestes imóveis',n=listaE(colabs.map(esc));
  const frases=[
    `Só muda quem ${um?'o controla':'os controla'} na app: ${mim?'passas':para+' passa'} a gerir as partilhas, os colaboradores e o apagar.`,
    `${quem} fica com a quota que tem, tu ficas com a tua, e nada muda nas quotas, nos grupos nem nos outros comproprietários.`];
  if(colabs.length)frases.push(colabs.length===1?`O colaborador de ${quem} ${onde}, ${n}, continua com o mesmo cargo e passa a ser gerido por ${porQuem}.`
    :`Os colaboradores de ${quem} ${onde}, ${n}, continuam com o mesmo cargo e passam a ser geridos por ${porQuem}.`);
  if(responder&&notifTransfLigoAoAceitar(t))frases.push(`Ainda não tens ligação a ${para}: a ligação fica feita quando aceitares.`);
  let prog='';
  if(varios){
    frases.push(um?'Todos os comproprietários têm de aceitar; se alguém recusar, o pedido cai.'
      :'Cada imóvel passa quando todos os comproprietários dele aceitarem; se alguém recusar, o pedido cai nesse imóvel.');
    prog=um?`<p class="small trf-prog-um">${esc(notifTransfProgresso(hs[0]))}</p>`
      :`<ul class="trf-prog">${hs.map(h=>`<li><b>${casa(h)}</b> ${esc(notifTransfProgresso(h))}</li>`).join('')}</ul>`;
  }
  const concluir=notifTransfSoConcluir(t);
  const fim=concluir?'Todos aceitaram: aceita para concluir.':!varios?'Nada muda até aceitares.':responder?'Nada muda até todos aceitarem.':'Nada muda até os outros aceitarem.';
  const l=jsq(lote),fechar='<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>';
  const aceitar=`<button type="button" class="btn primary" data-toca="dados" data-click="notifTransfAceitar('${l}')">Aceitar</button>`;
  const pe=concluir?fechar+aceitar:responder?`<button type="button" class="btn" data-toca="dados" data-click="notifTransfRecusar('${l}')">Recusar</button>`+aceitar:fechar;
  const L=openModal('Pedido de '+notifTransfNome(t.from),
    `<div class="form trf-ver"><p>${quem} quer transferir o controlo de ${nomes} a ${porQuem}.</p>${frases.map(f=>`<p class="small">${f}</p>`).join('')}${prog}<p class="small">${fim}</p></div>`,pe);
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
/* Uma resposta a um pedido para transferir o controlo, ao servidor, com a guarda do toque repetido:
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
/* O aviso de aceitar, pelo que o servidor diz de cada casa: as que passaram
   agora («Aceitaste: passas a gerir T2 Benfica.», ou «Aceitaste: Bruno
   passou a gerir T2 Benfica.» quando o controlo vai para outro), as que
   esperam pelos outros comproprietários («T2 Benfica fica à espera de
   Carlos.») e as que ficaram de fora, e porquê (quem pediu já não a
   controla, já não sou comproprietário, foi apagada).
   Recebe: ok — os nomes das casas que passaram; falhas — [{nome, erro}];
   para (opcional) — o nome de quem recebe, quando não sou eu; aguardam
   (opcional) — [{nome, faltam: [nomes]}].
   Devolve: o texto do aviso. */
function notifTransfAvisoAceite(ok,falhas,para,aguardam){
  const partes=[],esp=aguardam||[];
  const casas=ok.length===1?ok[0]:ok.length+' imóveis';
  if(ok.length)partes.push(para?'Aceitaste: '+para+' passou a gerir '+casas+'.':'Aceitaste: passas a gerir '+casas+'.');
  else if(esp.length)partes.push('Aceitaste.');
  else partes.push(para?'Nenhum imóvel passou.':'Não passaste a gerir nenhum imóvel.');
  if(esp.length)partes.push(esp.map((a,i)=>(i?a.nome+', de ':a.nome+' fica à espera de ')+(a.faltam.length?listaE(a.faltam):'quem falta')).join('; ')+'.');
  if(falhas.length){
    const nomes=falhas.map(f=>'«'+f.nome+'»').join(', ');
    partes.push(nomes+(falhas.length===1?' ficou de fora: ':' ficaram de fora: ')+String(falhas[0].erro||'o pedido já não valia').replace(/\.?\s*$/,'.'));
  }
  return partes.join(' ');
}
/* Aceitar um pedido para transferir o controlo (CW.aceitarTransferencia): fecha
   a folha e o sino, e só com a resposta diz o que passou, o que espera por
   quem e o que ficou de fora (notifTransfAvisoAceite); depois relê o
   estado, e o pedido que espera pelos outros passa para «À espera dos
   outros». Um erro diz a frase do servidor e relê na mesma (o pedido pode
   ter mudado).
   Recebe: lote — o id do pedido.
   Devolve: a promessa (ou nada, quando não saiu). */
function notifTransfAceitar(lote){
  const t=notifTransfRecebidas().find(x=>x.lote===lote),casas=(t&&t.houses)||[];
  const nomeDe=id=>{const h=casas.find(x=>x&&x.id===id);return String((h&&h.name)||'').trim()||propName(id)||'Sem nome'};
  const para=t&&!notifTransfParaMim(t)?notifTransfNome(t.to):'';
  const p=notifTransfPedido(lote,'aceitarTransferencia');if(!p)return;
  notifTransfFechar();
  return p.then(r=>{
    const falhas=((r&&r.falhadas)||[]).map(f=>({nome:nomeDe(f&&f.houseId),erro:f&&f.error}));
    const aguardam=((r&&r.aguardam)||[]).filter(Boolean).map(a=>({nome:nomeDe(a.houseId),faltam:notifTransfGente(a.faltam)}));
    toast(notifTransfAvisoAceite(((r&&r.aceites)||[]).map(nomeDe),falhas,para,aguardam),falhas.length||aguardam.length?{ms:7000}:undefined);
  },e=>{toast((e&&e.message)||'Não deu para aceitar. Tenta outra vez.')}).then(notifTransfReler);
}
/* Recusar um pedido para transferir o controlo (CW.recusarTransferencia), sem
   perguntar — quem pediu pode voltar a pedir, como nos outros pedidos. O
   pedido cai nas casas de que sou comproprietário, e o servidor avisa quem
   pediu e os outros comproprietários.
   Recebe: lote — o id do pedido.
   Devolve: a promessa (ou nada, quando não saiu). */
function notifTransfRecusar(lote){
  const p=notifTransfPedido(lote,'recusarTransferencia');if(!p)return;
  notifTransfFechar();
  return p.then(()=>{toast('Recusaste o pedido: nada muda. Quem pediu e os outros comproprietários são avisados.')},
    e=>{toast((e&&e.message)||'Não deu para recusar. Tenta outra vez.')}).then(notifTransfReler);
}
/* Cancelar um pedido para transferir o controlo que fiz (CW.cancelarTransferencia):
   do sino e da ficha do imóvel. Cancela o pedido todo (todas as casas que
   ele leva) e não pergunta: não muda nada, e pode-se voltar a pedir. A
   ficha fica aberta e repinta-se sem o pendente.
   Recebe: lote — o id do pedido.
   Devolve: a promessa (ou nada, quando não saiu). */
function notifTransfCancelar(lote){
  const p=notifTransfPedido(lote,'cancelarTransferencia');if(!p)return;
  return p.then(()=>{toast('Cancelaste o pedido.')},e=>{toast((e&&e.message)||'Não deu para cancelar. Tenta outra vez.')}).then(notifTransfReler);
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

/* Os avisos das casas lidos um a um (notifLerAviso): {id: 1} em
   db.settings.notifLidos. É um objeto e não uma lista pela razão das
   apresentações (cloud/apresentacao.js:APR_CHAVE): a fusão a três das
   definições junta-o chave a chave (nucleo.js:fundirTres), e dois aparelhos
   que leem avisos diferentes ficam com os dois — numa lista, o último a
   chegar levava a sua.
   Devolve: o objeto (vazio sem nenhum, ou com um valor que não é objeto). */
function notifLidos(){
  const v=db.settings&&db.settings.notifLidos;
  return v&&typeof v==='object'&&!Array.isArray(v)?v:{};
}

/* Lê um aviso das casas só, ao tocá-lo no sino: o id dele vai para
   db.settings.notifLidos e sincroniza com as definições. Não mexe na marca
   temporal (notifLidoAte): pô-la até este aviso calava os mais novos que
   ainda não se viram. A chave guarda só os ids dos avisos que o servidor
   ainda manda (CW.state.departures, os dos últimos 90 dias): os outros já
   não aparecem, e sem a poda a chave crescia para sempre. Sem a lista do
   servidor, não poda. Depois repinta (o sino e o cartão da atividade).
   Recebe: id — o id do aviso (o de CW.state.departures).
   Devolve: nada. */
function notifLerAviso(id){
  const k=id==null?'':String(id);if(!k)return;
  const st=window.CW&&CW.state,lista=st&&Array.isArray(st.departures)?st.departures:null;
  const v=Object.assign({},notifLidos());v[k]=1;
  if(lista){
    const ha={};lista.forEach(d=>{if(d&&d.id!=null)ha[String(d.id)]=1});
    Object.keys(v).forEach(x=>{if(!ha[x]&&x!==k)delete v[x]});
  }
  db.settings.notifLidos=v;
  save();render();
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
   (ir vazio). Um aviso que já se tocou (notifLerAviso, o id em
   db.settings.notifLidos) está lido e não entra, mesmo mais novo do que a
   marca.

   Os avisos dos pedidos para transferir o controlo chegam pelo mesmo caminho e
   leem-se da mesma maneira, uma frase que já diz quem (notifFraseDoAviso):
   a quem pediu, que o controlo passou; a quem pediu e aos outros
   comproprietários, que alguém recusou e o pedido caiu; aos comproprietários,
   que quem pediu cancelou; aos outros comproprietários, quem passou a gerir
   o imóvel; e aos colaboradores de quem o geria, quem os passa a gerir, com
   o mesmo cargo. O pedido em si ('transf.pedido') não é uma linha da atividade:
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
  const colab=servicoLigado('colaboradores'),lidos=notifLidos();
  const out=[];
  lista.forEach(d=>{
    if(!d||(d.kind==='colab.sair'&&!colab))return;
    if(meu&&d.actorId===meu)return;   // a minha própria saída não é aviso para mim
    const at=typeof d.at==='number'?d.at:(Number(d.at)||Date.parse(d.at)||0);
    if(!(at>marca))return;
    if(d.id!=null&&lidos[String(d.id)])return;   // já tocado: lido só este
    const f=notifFraseDoAviso(d);if(!f)return;
    const abre=!!d.houseId&&servicoLigado('properties')&&!!prop(d.houseId);
    out.push({tipo:'saida',id:String(d.id||''),kind:d.kind,titulo:f.titulo,sub:notifQuando(at),quem:f.quem,at,
      // o toque lê o aviso antes de abrir a ficha, no sino e no cartão da Visão geral (painel-geral.js:atividadeCard)
      ir:abre?(d.id!=null?`notifLerAviso('${jsq(String(d.id))}');`:'')+`propView('${jsq(d.houseId)}')`:'',toca:'camada'});
  });
  return out.sort((a,b)=>b.at-a.at);
}
/* A frase de um aviso das casas (CW.state.departures), já com quem:
   «Rui deixou de colaborar em T2 Benfica.», «Rui deixou de ser
   comproprietário de T2 Benfica.», «Todos aceitaram: Rui passou a gerir T2
   Benfica.» (a quem pediu, quando o último aceita; o ator é quem recebeu
   o controlo), «Rui recusou o pedido para transferir o controlo de …» (a quem
   pediu e aos outros comproprietários: o pedido caiu nessa casa), «Rita
   cancelou o pedido para transferir o controlo de …» (aos comproprietários,
   recebam ou não), «Rui passou a gerir … na app.» (aos outros
   comproprietários) e «Rui passou a gerir …: continuas com o mesmo cargo.»
   ('colab.novo_dono', aos colaboradores de quem o geria). Nos dois últimos
   o ator é quem recebeu o controlo. Um kind que a app não conhece — e o
   'transf.pedido', que é um pedido por responder (notifPedidos) — não tem
   frase.
   Recebe: d — o aviso ({kind, houseId, houseName, actorId, actorName}).
   Devolve: {titulo, quem} (texto, por escapar; quem dá as iniciais do
   avatar), ou null. */
function notifFraseDoAviso(d){
  const quem=String((d&&d.actorName)||'').trim()||'Alguém';
  const casa=String((d&&d.houseName)||'').trim()||propName(d&&d.houseId)||'um imóvel';
  switch(d&&d.kind){
    case 'colab.sair':return {titulo:quem+' deixou de colaborar em '+casa+'.',quem};
    case 'casa.sair':return {titulo:quem+' deixou de ser comproprietário de '+casa+'.',quem};
    case 'transf.aceite':return {titulo:'Todos aceitaram: '+quem+' passou a gerir '+casa+'.',quem};
    case 'transf.recusada':return {titulo:quem+' recusou o pedido para transferir o controlo de '+casa+'.',quem};
    case 'transf.cancelada':return {titulo:quem+' cancelou o pedido para transferir o controlo de '+casa+'.',quem};
    case 'casa.novo_dono':return {titulo:quem+' passou a gerir '+casa+' na app.',quem};
    case 'colab.novo_dono':return {titulo:quem+' passou a gerir '+casa+': continuas com o mesmo cargo.',quem};
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
   respondem-se aqui mesmo (os de transferir o controlo pelo «Ver», que diz o
   que muda antes do Aceitar), os de transferir o controlo que fiz esperam em «À
   espera de resposta», com quem falta e o Cancelar, os que já aceitei em «À
   espera dos outros», com quem falta e o «Ver», e cada prazo leva ao sítio dele. «Marcar tudo
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
    /* transferir o controlo não se aceita daqui: o «Ver» abre a folha com o que
       muda, e o Aceitar está lá (notifTransfVer) */
    if(n.tipo==='transf')return `<div class="card atencao-pedido"><p><b>${esc(n.titulo)}</b></p><p class="small">${esc(n.sub)}</p>
      <div class="chips-fila"><button class="btn sm primary" data-toca="camada" data-click="notifTransfVer('${jsq(n.lote)}')">Ver</button>
      ${n.concluir?'':`<button class="btn sm" data-toca="dados" data-click="notifTransfRecusar('${jsq(n.lote)}')">Recusar</button>`}</div></div>`;
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
     isso é uma linha e não um botão, como o prazo sem destino. Tocar num
     aviso das casas lê-o (o notifLerAviso vai no ir dele, notifSaidas)
     antes de abrir a ficha */
  const atividade=n=>{
    const dentro=`<span class="avatar" aria-hidden="true">${esc(initials(notifQuem(n)))}</span><div class="atencao-txt"><p class="title">${esc(n.titulo)}</p><p class="small">${esc(n.sub)}</p></div>`;
    return n.ir?`<button type="button" class="atencao-linha tap" data-toca="${n.toca||'ecra'}" data-click="closeModal();${n.ir}">${dentro}</button>`:`<div class="atencao-linha">${dentro}</div>`;
  };
  /* um pedido para transferir o controlo que fiz e ainda espera: que imóveis,
     para quem, quem já aceitou e quem falta (notifTransfEspera), e o
     Cancelar (cancela o pedido todo) */
  const enviada=t=>{
    const casas=notifTransfCasas(t),quem=notifTransfNome(t.to);
    return `<div class="atencao-linha"><div class="atencao-txt"><p class="title">${esc(listaE(casas))} · para ${esc(quem)}</p>
      <p class="small">Pediste para transferir o controlo. ${esc(notifTransfEspera(t))}</p></div>
      <button class="btn sm" data-toca="dados" aria-label="Cancelar o pedido para transferir o controlo de ${esc(listaE(casas))}" data-click="notifTransfCancelar('${jsq(t.lote)}')">Cancelar</button></div>`;
  };
  /* um pedido que me chegou e já aceitei: o que é, quem falta, e o «Ver»
     (só de leitura: já respondi) */
  const aceite=t=>`<div class="atencao-linha"><div class="atencao-txt"><p class="title">${esc(notifTransfTitulo(t))}</p>
      <p class="small">${esc(notifTransfEspera(t))}</p></div>
      <button class="btn sm" data-toca="camada" aria-label="Ver o pedido de ${esc(notifTransfNome(t.from))}" data-click="notifTransfVer('${jsq(t.lote)}')">Ver</button></div>`;
  const enviadas=notifTransfEnviadas(),aEspera=notifTransfAEspera();
  const total=conf.reduce((s,r)=>s+(Number((r.tx||{}).amount)||0),0),nl=servicoLigado('recurring')?conf.filter(recIsLate).length:0;
  const partes=[];
  if(ve('pedidos')&&pedidos.length)partes.push(cab('Pedidos por responder',String(pedidos.length))+pedidos.map(pedido).join(''));
  if(ve('pedidos')&&enviadas.length)partes.push(cab('À espera de resposta',String(enviadas.length))+`<div class="card atencao-lista">${enviadas.map(enviada).join('')}</div>`);
  if(ve('pedidos')&&aEspera.length)partes.push(cab('À espera dos outros',String(aEspera.length))+`<div class="card atencao-lista">${aEspera.map(aceite).join('')}</div>`);
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
