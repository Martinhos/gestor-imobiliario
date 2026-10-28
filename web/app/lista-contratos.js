/* ================= CONTRATOS, A LISTA (serviço contracts) ================= */
/* A lista dos contratos, agrupada por imóvel, com as rendas dos grupos, e o
   menu de toque longo de um contrato. A ficha está em contrato.js e o PDF em
   contrato-pdf.js. Veio de vistas.js e de componentes.js:lpMenu quando a app
   passou a serviços; regista-se no fim.

   O desenho é o das pranchetas M-Contratos (telemóvel) e D-Contratos
   (computador), num HTML só: cada contrato é uma linha que no telemóvel diz
   quem, a parte e até quando, os selos do que pede atenção e a renda com a
   líquida; a partir de 1100px a mesma linha é uma fila de tabela — inquilinos
   e parte, período e estado, renda, imposto, líquida, e a situação perante a
   AT com os avisos. A folha mostra as peças de um e esconde as do outro
   (estilos.css, secção «redesign: 1.3.3»). */
/* O total de cada imóvel, escrito depois de a lista estar reconciliada.

   Fica fora da assinatura do grupo de propósito: o rentOf(p) muda sempre que
   um contrato daquele imóvel muda de renda ou de datas, e dentro dela isso
   refazia o grupo inteiro — e com ele todas as linhas, que é o contrário do
   que este motor existe para fazer. É a mesma solução do saldo do mês nos
   movimentos. Um imóvel sem contrato em vigor diz «—», como o canvas.
   Recebe: nada.
   Devolve: nada — enche os spans dos cabeçalhos dos grupos. */
function pintarRendasDosGrupos(){
  const raiz=view();if(!raiz)return;
  [].slice.call(raiz.querySelectorAll('[data-chave^="imovel:"]')).forEach(function(g){
    const p=prop(String(g.getAttribute('data-chave')).slice(7));
    const sp=g.querySelector('.ctrenda');
    if(!p||!sp)return;
    const r=rentOf(p);
    sp.textContent=r>0?euro2(r)+'/mês':'—';
  });
}
/* Os chips do filtro rápido pelo estado: o valor do filtro «st» (o mesmo do
   seletor do painel) e o rótulo do chip. */
const CT_ESTADOS_RAPIDOS=[['','Todos'],['on','Em vigor'],['fut','Por começar'],['off','Terminados']];
/* Os tipos de prazo (prazos.js:prazosDe) cuja chave traz o id do contrato
   logo a seguir ao tipo («oposicao:<id>:<data>»). Os recibos trazem o id do
   movimento, e chegam ao contrato por ele. */
const CT_PRAZOS_DO_CONTRATO=['oposicao','fim','aumento','modelo2','cessacao','fev15','rsaa'];
/* Contratos agrupados por imóvel, como as pranchetas M-Contratos e
   D-Contratos: por cima, os filtros dos Movimentos (vistas.js:lfCabeca,
   montados pelo ctChipsHtml) — a pesquisa sempre à vista com o funil do
   painel completo, e os chips rápidos do estado com as contagens, do imóvel
   e, no computador, da ordenação —; por baixo, um grupo por imóvel com o nome, o que é (imóvel
   inteiro, por quartos e quantos estão arrendados, vago) e a renda do mês, e
   uma linha por contrato (ctLinha). No computador é uma tabela só, com o
   cabeçalho das colunas na moldura. Com contratos de duas ou três origens
   (vistas.js:listaPorOrigem), os meus, os partilhados comigo e aqueles em
   que colaboro são secções, cada uma com os seus grupos por imóvel e, no
   computador, a sua tabela; e há o chip «Origem» (vistas.js:lfOrigem). O «Novo contrato» é a ação do cabeçalho
   (navegacao.js) e o + da barra de baixo; o vazio continua a ter o seu.
   Recebe: nada.
   Devolve: string com o HTML completo da vista. */
function vContracts(){
  const K='lcts',s=lf(K),cgs=grpsOf('contract');
  const adiciona=casasComo('contract.add').length;   /* a condição do botão do vazio */
  /* O que se conta é o que a lista pode mostrar: os contratos dos imóveis do
     âmbito (ambito.js:visiveis). Contar db.contracts inteiro punha, com um
     proprietário em foco, «Todos 6» por cima de três linhas — e um contrato
     sem imóvel entrava nas contagens sem nunca aparecer. */
  const noAmbito=new Set(visiveis().map(p=>p.id)),base=db.contracts.filter(c=>noAmbito.has(c.propertyId));
  /* sem imóveis ou sem contratos não há o que pesquisar nem filtrar: fica o vazio com o seu botão */
  if(!db.properties.length)return esperaDoServidor()||`<div class="empty"><b>Cria primeiro um imóvel</b>Um contrato liga um imóvel a um ou mais inquilinos.
    ${saida('Adicionar imóvel',"go('properties')",'ecra')}</div>`;
  if(!db.contracts.length)return `<div class="empty"><b>Sem contratos</b>O contrato é onde vive a renda: podes arrendar o imóvel inteiro, ou um contrato por quarto.${adiciona?saida('Novo contrato','ctModal()','camada'):''}</div>`;
  /* a origem segue o imóvel do contrato: o filtro e as secções (vistas.js:lfOrigem, vistas.js:listaPorOrigem) */
  const deOrigem=c=>origemDaCasa(c.propertyId),org=lfOrigem(K,base,deOrigem),noFiltro=org.filtra(base);
  /* as contagens do estado: os contratos do âmbito que passam os outros filtros (a origem incluída), por estado */
  const semEstado=Object.assign({},s,{st:''}),conta={'':0,on:0,fut:0,off:0};
  noFiltro.forEach(c=>{if(!ctFMatch(c,semEstado))return;conta['']++;const e=ctEstado(c);conta[e==='ativo'?'on':e==='futuro'?'fut':'off']++});
  const head=ctChipsHtml(conta,s,noFiltro.filter(c=>ctFMatch(c,s)).length,cgs,org.campo(base.filter(c=>ctFMatch(c,s)),ORIGEM_CONTRATOS.rot));
  const ctx=ctContextoDaLista();
  /* os contratos que passam, imóvel a imóvel pela ordem do âmbito e, dentro
     de cada um, pela ordenação escolhida: é a ordem das linhas em qualquer
     secção, e cada secção junta-os de novo por imóvel (ctGruposDaLista) */
  const cs=[];
  visiveis().forEach(p=>{
    if(!ctNoImovel(p.id,s.p))return;
    lfSort(K,org.filtra(contractsOf(p.id)).filter(c=>ctFMatch(c,s)),{nome:c=>ctName(c),renda:c=>c.rent,inicio:c=>c.start||''}).forEach(c=>cs.push(c));
  });
  const rodape=ctRodapeDaLista(s);
  if(!cs.length)return head+vazioFiltro()+rodape;
  return head+listaPorOrigem('contratos',cs,deOrigem,ORIGEM_CONTRATOS.titulos,
    (xs,suf)=>`<div class="ct-tabela">${ctCabecalhoDaTabela()}${listaViva('contratos'+suf,ctGruposDaLista(xs,ctx),'ct-lista')}</div>`)+rodape;
}
/* Os textos da origem nos contratos: os títulos das secções
   (vistas.js:listaPorOrigem) e as escolhas do filtro «Origem» (vistas.js:lfOrigem). */
const ORIGEM_CONTRATOS={titulos:{meu:'Os meus contratos',partilhado:'Partilhados comigo',colaboro:'Em que colaboro'},
  rot:{todos:'Todos',meu:'Os meus',partilhado:'Partilhados comigo',colaboro:'Em que colaboro'}};
/* Os grupos por imóvel de uma secção da lista: um item da lista viva por
   imóvel, com o cabeçalho e as linhas dos contratos dele, pela ordem em que
   os contratos chegam (a do âmbito e, dentro, a da ordenação). Cada secção
   da origem tem os seus — um imóvel é só de uma origem, e as chaves não se
   repetem entre secções.
   Um grupo é UM elemento: o pecaDe fica com o primeiro filho do html de cada
   item, e dois irmãos — o cabeçalho e a lista — perdiam o segundo em
   silêncio. O que o imóvel é (vago, 3/4 quartos) entra na assinatura, e o
   total do mês sai dela para um span vazio, preenchido depois de reconciliar
   (pintarRendasDosGrupos). O cabeçalho tem classe própria: o .section-title
   com um utilitário por cima era uma classe com dois aspetos (docs/design.md,
   dívida dos cabeçalhos dos grupos).
   Recebe: cs — os contratos da secção, já filtrados e ordenados; ctx — o ctContextoDaLista.
   Devolve: [{chave, sig, html}] — os itens da lista viva dos grupos. */
function ctGruposDaLista(cs,ctx){
  const ordem=[],por={};
  (cs||[]).forEach(c=>{const k=c.propertyId;if(!por[k]){por[k]=[];ordem.push(k)}por[k].push(c)});
  return ordem.map(pid=>{
    const p=prop(pid);if(!p)return null;
    const desc=ctDescDoImovel(p);
    return {chave:'imovel:'+p.id,sig:'imovel|'+p.id+'|'+p.name+'|'+desc,html:`<section class="ct-grupo">
      <div class="ct-grupo-cab"><h3 class="ct-grupo-nome">${esc(p.name)}</h3><span class="small ct-grupo-desc">${esc(desc)}</span><span class="ctrenda num"></span></div>
      `+listaViva('cts:'+p.id,por[pid].map(c=>({chave:'ct:'+c.id,html:ctLinha(c,p,ctx)})),'ct-linhas')+`</section>`};
  }).filter(Boolean);
}
/* O que um imóvel é, para o cabeçalho do grupo: imóvel inteiro, por quartos
   com quantos estão arrendados hoje, vago, ou uso próprio.
   Recebe: p — o imóvel.
   Devolve: o texto (por escapar), em minúsculas como o canvas. */
function ctDescDoImovel(p){
  if(p.use==='proprio')return 'uso próprio';
  const ac=activeContracts(p.id);
  if(p.rentalMode==='quartos'){
    const tot=(p.rooms||[]).length,occ=new Set(ac.map(c=>c.roomId).filter(Boolean)).size;
    return 'por quartos'+(tot?' · '+occ+'/'+tot:(ac.length?'':' · vago'));
  }
  return ac.length?'imóvel inteiro':'vago';
}
/* O que se sabe de cada contrato fora dele, para uma pintura inteira da
   lista: os prazos que já avisam (prazos.js:prazosAtivos), numa passagem só
   e não uma por linha. Nada antes de se saber o estado do servidor
   (espera.js:sabemosOEstado): um prazo silenciado noutro aparelho aparecia
   aqui um segundo e sumia.
   Recebe: nada.
   Devolve: {pz: {idDoContrato: [prazos]}}. */
function ctContextoDaLista(){
  const pz={};
  if(!sabemosOEstado())return {pz:pz};
  let porTx=null;
  prazosAtivos().forEach(p=>{
    const a=String(p.chave).split(':');
    let cid=CT_PRAZOS_DO_CONTRATO.indexOf(a[0])>-1?a[1]:null;
    if(a[0]==='recibos'){
      if(!porTx){porTx={};(db.transactions||[]).forEach(t=>{if(t.contractId)porTx[t.id]=t.contractId})}
      cid=porTx[a[1]]||null;
    }
    if(cid)(pz[cid]||(pz[cid]=[])).push(p);
  });
  return {pz:pz};
}
/* O dia e o mês de uma data, para um selo curto («31/10»): os prazos que
   avisam estão sempre a menos de meio ano.
   Recebe: iso — 'AAAA-MM-DD'.
   Devolve: 'DD/MM'. */
function ctDiaMes(iso){return dPT(iso).slice(0,5)}
/* O selo curto de um prazo do contrato, como o canvas os escreve na lista
   («Oposição até 31/10», «Cessação por comunicar»). A frase inteira (o
   porquê e o como) está na ficha e no «Pede atenção».
   Recebe: p — o prazo (prazos.js:prazosDe).
   Devolve: o texto (por escapar). */
function ctTextoDoPrazo(p){
  const dm=ctDiaMes(p.alvo),passou=p.dias<0;
  switch(p.tipo){
    case 'oposicao':return 'Oposição até '+dm;
    case 'fim':return passou?'Passou o fim do prazo':'Termina a '+dm;
    case 'aumento':return 'Aviso do aumento até '+dm;
    case 'modelo2':return passou?'Modelo 2 em atraso':'Modelo 2 até '+dm;
    case 'cessacao':return 'Cessação por comunicar';
    case 'fev15':return passou?'Duração por comunicar':'Comunicar a duração até '+dm;
    case 'rsaa':return 'Enviar ao IHRU até '+dm;
    case 'recibos':return 'Recibo por emitir';
  }
  return pzPartes(p).titulo;
}
/* Os selos do que um contrato pede, do mais grave para o menos: os prazos que
   já avisam, com a cor do contrato visual (prazos.js:pzSelo — vermelho o que
   passou ou falta uma semana, âmbar até um mês, cinzento o resto), e o número
   da AT que falta a um contrato declarado. Os recibos por emitir juntam-se
   num selo só. A renda em atraso não se repete aqui: a nuvem pendura por
   baixo da linha o bloco dos por confirmar (cloud/painel.js:decoratePending),
   com o selo «Em atraso» e o Confirmar — dizê-lo duas vezes era ruído.
   Recebe: c — o contrato; p — o imóvel dele; ctx — o ctContextoDaLista.
   Devolve: [{txt, cor}] — cor é a classe do .badge ('red', 'amber', 'grey' ou '' para o cobalto). */
function ctAvisos(c,p,ctx){
  const out=[];
  const pzs=ctx.pz[c.id]||[],recibos=pzs.filter(x=>x.tipo==='recibos');
  pzs.filter(x=>x.tipo!=='recibos').forEach(x=>out.push({txt:ctTextoDoPrazo(x),cor:pzSelo(x)}));
  if(recibos.length){
    const pior=recibos.slice().sort((a,b)=>a.dias-b.dias)[0];
    out.push({txt:recibos.length===1?'Recibo por emitir':recibos.length+' recibos por emitir',cor:pzSelo(pior)});
  }
  const f=fiscoDe(c);
  if(f.estado==='declarado'&&!String(f.numero||'').trim())out.push({txt:'Falta o n.º na AT',cor:'red'});
  const peso={red:0,amber:1,'':2,grey:3};
  return out.sort((a,b)=>peso[a.cor]-peso[b.cor]);
}
/* O selo do estado de um contrato: «Em vigor» a verde (com quantos dias
   faltam, quando o fim está a menos de meio ano), «Por começar» a cobalto,
   «Terminado» a cinzento — as cores do contrato visual.
   Recebe: c — o contrato.
   Devolve: {txt, cor} — cor é a classe do .badge. */
function ctSeloDoEstado(c){
  const e=ctEstado(c);
  if(e==='futuro')return {txt:'Por começar',cor:''};
  if(e==='terminado')return {txt:'Terminado',cor:'grey'};
  const d=c.end?pzDias(c.end):null;
  return {txt:'Em vigor'+(d!=null&&d>=0&&d<=180?(d===0?' · acaba hoje':d===1?' · falta 1 dia':' · faltam '+d+' dias'):''),cor:'in'};
}
/* O período de um contrato numa linha curta, para o telemóvel: até quando,
   desde quando, quando começa ou quando terminou.
   Recebe: c — o contrato.
   Devolve: o texto (por escapar). */
function ctPeriodoCurto(c){
  const e=ctEstado(c);
  if(e==='futuro')return c.start?'começa a '+dPT(c.start):'por começar';
  if(e==='terminado')return c.end&&c.end<=today()?'terminou a '+dPT(c.end):'terminado';
  return c.end?'até '+dPT(c.end):c.start?'desde '+dPT(c.start):'sem datas';
}
/* O período inteiro, para a coluna da tabela: início – fim, ou só o que há.
   Sem fim, um contrato que ainda não começou «começa a» (e não «desde» uma
   data que ainda não chegou, ao lado do selo «Por começar»).
   Recebe: c — o contrato.
   Devolve: o texto (por escapar). */
function ctPeriodo(c){
  if(c.start&&c.end)return dPT(c.start)+' – '+dPT(c.end);
  if(c.start)return (ctEstado(c)==='futuro'?'começa a ':'desde ')+dPT(c.start);
  return c.end?'até '+dPT(c.end):'Sem datas';
}
/* O estado de um contrato perante a AT, num selo: declarado a verde (com o
   número, quando o há), por indicar a cobalto, não declarado a cinzento — uma
   escolha do senhorio, sem cor de aviso.
   Recebe: c — o contrato.
   Devolve: o HTML do selo. */
function ctSeloDaAt(c){
  const f=fiscoDe(c);
  if(f.estado==='declarado')return `<span class="badge in">Declarado${String(f.numero||'').trim()?' · '+esc(f.numero):''}</span>`;
  return f.estado==='naoDeclarado'?'<span class="badge grey">Não declarado</span>':'<span class="badge">Por indicar</span>';
}
/* Uma linha da lista: o contrato como o canvas o desenha. O elemento de fora
   leva o data-lp (o toque longo, a seleção da nuvem e o bloco dos por
   confirmar que a nuvem lhe pendura no fim — cloud/painel.js:decoratePending);
   o de dentro (.row-between, onde a seleção põe a caixa) é o que se toca para
   abrir a ficha. Assim tocar no Confirmar de um por confirmar não abre também
   o contrato por baixo. No telemóvel vê-se quem, a parte e até quando, os
   selos (o estado quando não está em vigor, e os dois avisos mais graves) e a
   renda com a líquida; no computador, as colunas da tabela.
   Recebe: c — o contrato; p — o imóvel dele; ctx — o ctContextoDaLista.
   Devolve: o HTML da linha. */
function ctLinha(c,p,ctx){
  const nome=String(c.name||'').trim(),quem=nome||ctNames(c);
  const parte=c.roomId?(roomName(p,c.roomId)||'Quarto'):'Imóvel inteiro';
  const st=ctSeloDoEstado(c),avisos=ctAvisos(c,p,ctx);
  const selo=x=>`<span class="badge${x.cor?' '+x.cor:''}">${esc(x.txt)}</span>`;
  const selosTel=(ctEstado(c)==='ativo'?[]:[st]).concat(avisos.slice(0,2)).map(selo).join('');
  const escrita=Number(c.taxRate)>0,liq=euro2(netRent(c));
  return `<div class="ct-linha" data-lp="ct:${esc(c.id)}" data-fk="ct:${esc(c.id)}">
    <div class="row-between ct-cols" data-toca="camada" data-click="ctAbrirDaLista('${jsq(c.id)}')">
      <div class="ct-c-quem"><b class="ct-nome">${esc(quem)}</b>
        <span class="small ct-sub">${nome?esc(ctNames(c))+' · ':''}${esc(parte)}<span class="ct-so-estreito"> · ${esc(ctPeriodoCurto(c))}</span></span>
        ${selosTel?`<span class="ct-selos ct-so-estreito">${selosTel}</span>`:''}</div>
      <div class="ct-c-per"><span>${esc(ctPeriodo(c))}</span>${selo(st)}</div>
      <div class="ct-c-renda"><b>${euro2(c.rent)}</b><span class="small ct-so-estreito">líquida ${liq}</span></div>
      <div class="ct-c-imp"><span>${dec(taxRateOf(c))}%</span><span class="small">${escrita?'escrita no contrato':esc(irsTaxaPorque(c))+' · estim.'}</span></div>
      <div class="ct-c-liq">${liq}</div>
      <div class="ct-c-at">${ctSeloDaAt(c)}${avisos.map(selo).join('')}</div>
      <span class="ct-c-seta" aria-hidden="true">${ic('chevR',18)}</span>
    </div></div>`;
}
/* Tocar numa linha da lista abre a ficha do contrato — menos em seleção (a
   nuvem, cloud/selecao-listas.js), onde o toque marca a linha: a marca é do
   elemento de fora, e este, por dentro, fica quieto.
   Recebe: id — o id do contrato.
   Devolve: nada — abre a ficha (contrato.js:ctView). */
function ctAbrirDaLista(id){
  const b=document.body;
  if(b&&b.classList&&b.classList.contains('sel-on'))return;
  ctView(id);
}
/* O cabeçalho das colunas da tabela do computador. Vive na moldura, logo
   antes da lista viva: lá dentro o reconciliar tirava-o por não ter chave
   (a mesma razão do dos movimentos). No telemóvel não se vê.
   Recebe: nada.
   Devolve: o HTML do cabeçalho. */
function ctCabecalhoDaTabela(){
  return `<div class="ct-cab" aria-hidden="true"><span class="ct-c-quem">Inquilinos · parte</span><span class="ct-c-per">Período</span><span class="ct-c-renda">Renda</span>
    <span class="ct-c-imp">Imposto</span><span class="ct-c-liq">Líquida</span><span class="ct-c-at">Perante a AT · avisos</span><span class="ct-c-seta"></span></div>`;
}
/* O campo do estado, o primeiro chip rápido dos contratos e o primeiro
   seletor do painel (vistas.js:lfCabeca): Em vigor, Por começar e Terminados,
   cada um com quantos há nos imóveis do âmbito entre os que passam os outros
   filtros («Em vigor · 3»), e o «Todos os estados» com todos eles. O chip
   ligado diz o estado sem a contagem.
   Recebe: conta — {'', on, fut, off: quantos}.
   Devolve: o campo {chave, nome, opcoes, curto, rapido, aplicar}. */
function ctCampoEstado(conta){
  return {chave:'st',nome:'Estado',curto:'Todos',rapido:true,aplicar:ctFiltroRapido,
    opcoes:CT_ESTADOS_RAPIDOS.map(([v,rot])=>({v,label:v?rot:'Todos os estados',n:conta[v]||0}))};
}
/* Os filtros por cima da lista, no feitio dos Movimentos (vistas.js:lfCabeca):
   a pesquisa com o funil do painel completo e os chips rápidos — o estado
   com quantos há em cada um (ctCampoEstado), o imóvel quando há mais de um com
   contratos (os imóveis com contratos, a linha e os grupos de imóveis com
   algum deles: componentes.js:imoveisEGruposOpts) e, só no computador, a
   ordenação. O painel tem também o grupo de contratos,
   quando os há, e a origem (os meus, partilhados comigo, em que colaboro),
   quando a lista tem contratos de duas origens (vistas.js:lfOrigem), que é
   também um chip. Tocar filtra logo, sem «Aplicar». A seleção de vários entra
   pelo «Selecionar vários» do cabeçalho (cloud/selecao-listas.js:selLCabecalho).
   Recebe: conta — {'', on, fut, off: quantos}; s — o estado dos filtros
   (lf('lcts')); n — quantos contratos passam os filtros; cgs — os grupos de
   contratos; origem (opcional) — o campo «Origem» já montado, ou null.
   Devolve: o HTML da barra, do painel e dos chips. */
function ctChipsHtml(conta,s,n,cgs,origem){
  /* os imóveis do âmbito que têm contratos, e o escolhido mesmo que já não tenha */
  const comContratos=visiveis().filter(p=>contractsOf(p.id).length||p.id===s.p);
  return lfCabeca('lcts',{nome:['contrato','contratos'],dos:'dos contratos',n:n,
    campos:[ctCampoEstado(conta),
      {chave:'p',nome:'Imóvel',curto:'Todos',rapido:comContratos.length>1||!!s.p,
        opcoes:imoveisEGruposOpts(comContratos,s.p)},
      (cgs||[]).length?{chave:'g',nome:'Grupo',curto:'Todos',opcoes:[{v:'',label:'Todos os grupos'}].concat(cgs.map(g=>({v:g.id,label:g.name})))}:null,
      origem||null],
    ordem:{opcoes:[{v:'nome',label:'Nome'},{v:'renda',label:'Renda'},{v:'inicio',label:'Início'}],rapido:'largo'}});
}
/* O que fica por baixo da lista: com «Em vigor» escolhido, os imóveis de
   arrendamento que não têm contrato em vigor (e, havendo terminados, o
   caminho para os ver); no computador, com a seleção à mão, como se apagam
   vários de uma vez.
   Recebe: s — o estado dos filtros (lf('lcts')).
   Devolve: o HTML (ou ''). */
function ctRodapeDaLista(s){
  let out='';
  if(s.st==='on'&&!s.g&&!String(s.q||'').trim()){
    const sem=visiveis().filter(p=>ctNoImovel(p.id,s.p)&&(!s.or||origemDaCasa(p.id)===s.or)&&p.use==='investimento'&&!activeContracts(p.id).length);
    if(sem.length){
      const term=sem.some(p=>contractsOf(p.id).some(c=>ctEstado(c)==='terminado'));
      out+=`<p class="small ct-sem-vigor">${esc(listaE(sem.map(p=>p.name)))} ${sem.length===1?'não tem':'não têm'} contrato em vigor${term?` · <button type="button" class="ct-ligacao" data-toca="vista" data-click="ctFiltroRapido('off')">ver terminados</button>`:''}</p>`;
    }
  }
  if(typeof CW!=='undefined'&&CW&&typeof CW.selLEntrar==='function'&&db.contracts.length)
    out+=`<p class="small ct-dica-sel">Para apagar vários contratos, usa «Selecionar vários», no cabeçalho. Os movimentos ficam; só perdem a ligação ao contrato.</p>`;
  return out;
}
/* Filtra os contratos por um estado — o chip do estado, o seletor do painel
   e o «ver terminados» por baixo da lista passam por aqui.
   Recebe: v — '' (todos), 'on', 'fut' ou 'off'.
   Devolve: nada — repinta a vista. */
function ctFiltroRapido(v){lf('lcts').st=String(v||'');render()}
/* Um imóvel passa no filtro «Imóvel» da lista? Vazio, todos; um id, esse
   imóvel; 'g:ID' (um grupo de imóveis, componentes.js:imoveisEGruposOpts), os
   imóveis do grupo. A lista já só tem os imóveis do âmbito (ambito.js:visiveis).
   Recebe: pid — o id do imóvel; v — o valor do filtro (lf('lcts').p).
   Devolve: true/false. */
function ctNoImovel(pid,v){
  if(!v)return true;
  if(String(v).startsWith('g:')){const g=grp(String(v).slice(2));return !!g&&(g.ids||[]).indexOf(pid)>-1}
  return pid===v;
}
// um contrato passa nos filtros da lista? imóvel (ou grupo de imóveis), estado, grupo e pesquisa por texto (nome, inquilinos, IBAN, notas…)
// Recebe: c — o contrato (objeto); s — o estado dos filtros da lista (lf('lcts'): campos p, st, g e a pesquisa).
// Devolve: true se o contrato passa em todos os filtros, false caso contrário.
function ctFMatch(c,s){
  if(!ctNoImovel(c.propertyId,s.p))return false;
  /* três ramos e não a negação de um booleano: com dois, um contrato que
     ainda não começou caía em «Terminados», que é o separador errado com o
     rótulo errado */
  if(s.st==='on'&&ctEstado(c)!=='ativo')return false;
  if(s.st==='fut'&&ctEstado(c)!=='futuro')return false;
  if(s.st==='off'&&ctEstado(c)!=='terminado')return false;
  if(s.g){const g=grp(s.g);if(!g||(g.ids||[]).indexOf(c.id)<0)return false}
  const p=prop(c.propertyId),ts=ctTenants(c);
  return lfHit('lcts',[ctName(c),c.name,p?p.name:'',c.roomId&&p?roomName(p,c.roomId):'',c.iban,c.notes,String(c.rent),
    ts.map(t=>[t.name,t.phone,t.email,t.nif].join(' ')).join(' '),c.tenantEmail,c.tenantPhone,c.ownerEmail,c.ownerPhone].join(' '));
}
/* O menu de toque longo de um contrato (data-lp "ct:<id>"): só o que é dos
   contratos — editar, o PDF, terminar ou reativar, apagar. O «Registar renda»
   é dos movimentos, e são eles que o trazem por lpExtras (servicos.js:
   lpExtrasDe) quando estão ligados nesta conta; desligados, a opção some sem
   este ficheiro dar por isso. O PDF abre a folha do contrato em PDF
   (contrato-pdf.js:ctPdfJanela), que diz o que vai e o que falta antes de
   descarregar.
   Recebe: a — as partes do data-lp (['ct', id]).
   Devolve: nada — abre a folha de opções (ou nada, se o contrato já não existir). */
function lpContrato(a){
  const id=a[1],c=contract(id);if(!c)return;
  const ok=podeEditar(c.propertyId,'contract.add',c);
  const opts=ok?[{label:'Editar contrato',icon:'pen',act:()=>ctModal(id)}]:[];
  /* o que os outros serviços acrescentam («Registar renda», dos Movimentos)
     entra logo a seguir a Editar, antes do PDF — a ordem de sempre */
  lpExtrasDe('ct',a).forEach(o=>opts.push(o));
  opts.push({label:'Gerar contrato em PDF',icon:'down',act:()=>ctPdfJanela(id)});
  if(ok)opts.push(ctEstado(c)!=='terminado'?{label:'Terminar contrato',icon:'x',act:()=>endContract(id)}:{label:'Reativar contrato',icon:'check',act:()=>reactivateContract(id)},
    {label:'Apagar contrato',icon:'trash',act:()=>delContract(id)});
  return lpShow(ctName(c),opts);
}
/* O que os Contratos acrescentam ao menu de toque longo de um IMÓVEL (data-lp
   "prop:<id>"): «Novo contrato», já com o imóvel escolhido. Só num imóvel de
   arrendamento onde se pode adicionar contratos — a mesma condição de sempre,
   que antes vivia no ficheiro dos imóveis e agora vive aqui, para os imóveis
   não terem de saber que os contratos existem.
   Recebe: a — as partes do data-lp (['prop', id]).
   Devolve: um array de {label, icon, act} — vazio quando não se aplica. */
function lpExtrasContratosImovel(a){
  const id=a[1],p=prop(id);if(!p)return [];
  return p.use==='investimento'&&pode(id,'contract.add')?[{label:'Novo contrato',icon:'contract',act:()=>ctModal(null,id)}]:[];
}
/* O que os Contratos acrescentam ao menu de toque longo de uma PESSOA (data-lp
   "per:<kind>:<id>"): «Novo contrato», já com o inquilino dentro. Só nos
   inquilinos, e só quando há um imóvel de arrendamento onde se pode
   adicionar contratos — sem isso o ctModal só tinha um aviso para dar.
   Recebe: a — as partes do data-lp (['per', 'owner'|'tenant', id]).
   Devolve: um array de {label, icon, act} — vazio quando não se aplica. */
function lpExtrasContratosPessoa(a){
  if(a[1]!=='tenant'||!tenant(a[2]))return [];
  if(!casasComo('contract.add').some(p=>p.use==='investimento'))return [];
  const tid=a[2];
  return [{label:'Novo contrato',icon:'contract',act:()=>ctModal(null,null,tid)}];
}
registarServico({id:'contracts',vistas:{contracts:'vContracts'},depois:{contracts:'pintarRendasDosGrupos'},lp:{ct:'lpContrato'},
  lpExtras:{prop:'lpExtrasContratosImovel',per:'lpExtrasContratosPessoa'}});
