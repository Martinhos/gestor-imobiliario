/* ================= PRAZOS ================= */
/* O calendário do ciclo de vida do portefólio.

   Os dados sempre cá estiveram — o fim do contrato, a percentagem do
   aumento anual, a validade do cartão de cidadão, o certificado
   energético, o fim da taxa fixa — mas ninguém os olhava até ser tarde.
   Este módulo transforma-os em avisos com antecedência certa: os prazos
   legais do arrendamento medem-se em dias de pré-aviso, e perder um
   custa dinheiro (um aumento que não se fez) ou um ano de contrato
   (uma oposição fora de prazo).

   Cada aviso tem uma chave que inclui a data-alvo: silenciar cala ESTA
   ocorrência; quando a data mudar (o contrato renova, o CC renova-se),
   a chave muda e o aviso volta sozinho.

   E os prazos da AT, que a lei mede em meses e a app conta em dias: o
   Modelo 2 (comunicar o contrato até ao fim do mês seguinte ao início, e
   a cessação até ao fim do mês seguinte ao fim), o recibo eletrónico de
   cada renda (até ao fim do mês seguinte), o Anexo F (de 1 de abril a 30
   de junho) e a comunicação de 15 de fevereiro dos contratos com taxa
   reduzida. Um contrato que o senhorio marcou como «não declarado» é uma
   escolha dele: nenhum destes prazos nasce dele, e nenhum texto o julga. */

// dias de antecedência com que cada tipo de prazo começa a avisar
const PZ_ANTECEDENCIA = { oposicao: 150, fim: 60, aumento: 45, cc: 60, energia: 90, taxa: 90,
  modelo2: 45, cessacao: 45, recibos: 40, irs: 90, fev15: 45 };

/* Uma data local como 'AAAA-MM-DD', sem passar pelo toISOString: esse
   converte para UTC e, com o horário de verão, meia-noite local vira o dia
   ANTERIOR — um prazo legal deslocado um dia é um prazo errado.
   Recebe: d — um objeto Date.
   Devolve: a data local em 'AAAA-MM-DD'. */
function pzIso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

/* Data ISO de hoje, isolada para os testes poderem fingir outro dia.
   Devolve: 'AAAA-MM-DD' de hoje, na hora local. */
function pzHoje(){return pzIso(new Date())}

/* Soma dias a uma data ISO, em hora local (imune ao horário de verão).
   Recebe: iso — a data base; n — dias a somar (negativo anda para trás).
   Devolve: a data ISO resultante. */
function pzAddDias(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return pzIso(d)}

/* Dias entre hoje e uma data ISO (positivo = ainda falta).
   Recebe: iso — a data alvo 'AAAA-MM-DD'; hoje (opcional) — outra base, para testes.
   Devolve: número inteiro de dias (negativo se a data já passou). */
function pzDias(iso,hoje){return Math.round((new Date(iso+'T00:00:00')-new Date((hoje||pzHoje())+'T00:00:00'))/86400000)}

/* Soma anos a uma data ISO, mantendo mês e dia (29/2 cai para 28/2).
   Recebe: iso — a data base; n — quantos anos somar.
   Devolve: a data ISO resultante. */
function pzAddAnos(iso,n){const d=new Date(iso+'T00:00:00');const dia=d.getDate();d.setFullYear(d.getFullYear()+n);if(d.getDate()!==dia)d.setDate(0);return pzIso(d)}

/* O próximo aniversário estrito de uma data (o primeiro > hoje). O aumento
   anual da renda só pode existir a partir do primeiro aniversário.
   Recebe: startIso — o início do contrato; hoje (opcional) — a base, para testes.
   Devolve: a data ISO do próximo aniversário, ou '' sem início válido. */
function pzAniversario(startIso,hoje){
  if(!startIso)return '';
  const h=hoje||pzHoje();
  let n=Math.max(1,new Date(h+'T00:00:00').getFullYear()-new Date(startIso+'T00:00:00').getFullYear());
  let a=pzAddAnos(startIso,n);
  while(a<=h)a=pzAddAnos(startIso,++n);
  return a;
}

/* A urgência visual de um prazo pelo que falta.
   Recebe: dias — quantos faltam para a data alvo.
   Devolve: 'passado' (já foi), 'urgente' (≤7), 'breve' (≤30) ou 'info'. */
function pzUrg(dias){return dias<0?'passado':dias<=7?'urgente':dias<=30?'breve':'info'}

/* O mês por extenso de uma data ou de um período, como se diz a meio de uma
   frase («Renda de junho de 2026»): o nome vem do pt-PT do aparelho, em
   minúsculas, que é como o português o escreve.
   Recebe: iso — 'AAAA-MM-DD' ou 'AAAA-MM' (aguenta vazio).
   Devolve: 'junho de 2026' (texto); '' sem data válida. */
function pzMes(iso){
  const m=/^(\d{4})-(\d{2})/.exec(String(iso||''));if(!m)return '';
  return new Date(Number(m[1]),Number(m[2])-1,1).toLocaleDateString('pt-PT',{month:'long',year:'numeric'});
}

/* Todos os prazos do portefólio que já entraram na janela de aviso, do mais
   urgente para o menos. É função pura sobre o db: quem quiser outra data
   de referência (os testes) passa-a.

   As fontes: contratos ativos com fim (a janela de oposição de 120 dias e o
   próprio fim), contratos com aumento anual configurado (o aviso de 30 dias
   ao inquilino), cartões de cidadão de inquilinos ativos e de proprietários,
   certificados energéticos dos imóveis, e o fim da fase fixa das mistas.
   E a AT: o Modelo 2 dos contratos por indicar (fim do mês seguinte ao
   início), a cessação dos declarados que terminaram (fim do mês seguinte ao
   fim), os recibos por emitir das rendas dos últimos três meses (fim do mês
   seguinte à renda), o Anexo F do ano anterior (30 de junho) quando houve
   rendas, e o 15 de fevereiro dos declarados com taxa reduzida. Nada disto
   nasce de um contrato «não declarado». O `hoje` manda em tudo, incluindo
   no «ano anterior» e nos «últimos três meses».

   Recebe: hoje (opcional) — data ISO de referência; sem ela usa o dia real.
   Devolve: lista de {chave, tipo, titulo, sub, alvo, dias, urg, abrir},
   ordenada por dias; `abrir` é código para o onclick do cartão. */
function prazosDe(hoje){
  const h=hoje||pzHoje();
  const out=[];
  const poe=(tipo,chave,alvo,titulo,sub,abrir,aposAlvo)=>{
    const dias=pzDias(alvo,h);
    if(dias>PZ_ANTECEDENCIA[tipo])return;                       // ainda longe
    if(dias<0&&!aposAlvo)return;                                // passou e já não é acionável
    out.push({chave:tipo+':'+chave,tipo,titulo,sub,alvo,dias,urg:pzUrg(dias),abrir});
  };

  (db.contracts||[]).forEach(c=>{
    /* Só o que foi terminado à mão fica de fora. Um contrato com início futuro
       entra: num contrato curto o aviso de oposição à renovação cai ANTES do
       início, e calá-lo até lá é perdê-lo de vez. E um contrato cujo fim já
       passou sem ninguém o terminar entra também: é precisamente o caso do
       «fim» que aguenta depois de passar (renovou-se sozinho; atualiza a data).
       Era o ctVivo que decidia isto, pelo dia REAL — o «fim» morria no próprio
       dia em que passava, e um teste com hoje fingido só passava por acaso. */
    if(c.active===false)return;
    const nome=c.name||propName(c.propertyId)||'contrato';
    /* o toque abre a ficha do contrato (tocar num registo é lê-lo; o «Editar»
       está lá para quem pode) — só com os Contratos ligados nesta conta; sem
       eles o prazo continua a dizer-se, mas não leva a lado nenhum */
    const abrir=servicoLigado('contracts')?`ctView('${jsq(c.id)}')`:'';
    if(c.end){
      const oposicao=pzAddDias(c.end,-120);
      poe('oposicao',c.id+':'+c.end,oposicao,'Oposição à renovação — '+nome,
        'Para o contrato não renovar a '+dPT(c.end)+', o aviso ao inquilino tem de seguir até '+dPT(oposicao)+' (120 dias).',abrir,false);
      poe('fim',c.id+':'+c.end,c.end,'Fim do prazo do contrato — '+nome,
        'Termina a '+dPT(c.end)+'. Sem oposição, renova-se automaticamente pelo período legal — atualiza o fim para o novo prazo.',abrir,true);
    }
    if(c.increase!=null&&c.start){
      const aniv=pzAniversario(c.start,h);
      const aviso=pzAddDias(aniv,-30);
      poe('aumento',c.id+':'+aniv,aviso,'Aumento anual da renda — '+nome,
        'Para valer a '+dPT(aniv)+', o aviso ao inquilino (30 dias) segue até '+dPT(aviso)+'. Renda '+euro(c.rent)+' '+(c.increase>0?'+':'')+c.increase+'%.'
        +(ctDeclarado(c)?' Depois de a atualizar, comunica a nova renda à AT (Modelo 2).':''),abrir,false);
    }
  });

  /* ---- a AT. Só de contratos que o senhorio não marcou como «não declarado»:
     essa marca é uma escolha, e não há aviso nenhum a discuti-la. O ano de
     referência (Y) é o anterior ao de `hoje`: é o que se entrega em junho e o
     que se comunica em fevereiro. */
  const ano=Number(h.slice(0,4)),Y=ano-1;
  const nomeDe=c=>c.name||propName(c.propertyId)||'contrato';
  /* vivo em `hoje` (e não no dia real, como o ctVivo): um contrato que já
     terminou não pede o Modelo 2 do início */
  const vivoEm=c=>c.active!==false&&!(c.end&&c.end<h);
  const desde=pzIso(new Date(ano,Number(h.slice(5,7))-1-3,1));   // primeiro dia de há três meses
  const comRendasEmY={};
  let houveRendasEmY=false;
  (db.transactions||[]).forEach(t=>{
    if(!ehRenda(t)||!t.date)return;
    const c=t.contractId?contract(t.contractId):null;
    if(c&&ctNaoDeclarado(c))return;
    /* uma renda sem contrato (ou de contrato entretanto apagado) é renda na
       mesma: conta para o Anexo F, e a página Declaração lista-a à parte */
    if(t.date.slice(0,4)===String(Y)){houveRendasEmY=true;if(c)comRendasEmY[c.id]=1}
    if(c&&ctDeclarado(c)&&!t.recibo&&t.date>=desde){
      const alvo=fimDoMesSeguinte(t.date);
      poe('recibos',t.id+':'+alvo,alvo,'Recibo de renda por emitir — '+nomeDe(c),
        'Renda de '+pzMes(t.periodo||t.date)+' recebida a '+dPT(t.date)+': emite o recibo eletrónico no Portal das Finanças e marca-o no movimento.',
        servicoLigado('transactions')?`txView('${jsq(t.id)}')`:'',true);
    }
  });
  (db.contracts||[]).forEach(c=>{
    if(ctNaoDeclarado(c))return;
    const nome=nomeDe(c),abrir=servicoLigado('contracts')?`ctView('${jsq(c.id)}')`:'';
    if(ctFiscoPorIndicar(c)&&c.start&&vivoEm(c)){
      const alvo=fimDoMesSeguinte(c.start);
      poe('modelo2',c.id+':'+alvo,alvo,'Comunicar o contrato à AT (Modelo 2) — '+nome,
        'Até '+dPT(alvo)+', o fim do mês seguinte ao início. Se já o comunicaste, ou se não vais declarar este contrato, marca-o na ficha e este aviso desaparece.',
        abrir,true);
    }
    if(!ctDeclarado(c))return;
    if(c.end&&(c.end<h||c.active===false)){
      const alvo=fimDoMesSeguinte(c.end);
      poe('cessacao',c.id+':'+alvo,alvo,'Comunicar a cessação à AT — '+nome,
        'Até '+dPT(alvo)+', o fim do mês seguinte ao fim do contrato. O Modelo 2 também serve para a cessação; até 15 de fevereiro a AT pede ainda o motivo, nos contratos com taxa reduzida. Depois de a comunicares, silencia este aviso.',
        abrir,true);
    }
    if(irsRate(c)<25&&comRendasEmY[c.id]){
      const alvo=(Y+1)+'-02-15';
      poe('fev15',c.id+':'+alvo,alvo,'Comunicar a duração do contrato à AT — '+nome,
        'Nos contratos com taxa reduzida, até '+dPT(alvo)+' comunica-se no Portal das Finanças o contrato, a duração e as renovações. Sem isto perde-se a redução.',
        abrir,true);
    }
  });
  if(houveRendasEmY){
    const alvo=(Y+1)+'-06-30';
    poe('irs',String(Y),alvo,'Entregar o IRS — Anexo F de '+Y,
      'De 1 de abril a 30 de junho. A página Declaração tem as linhas do quadro 4.1 e o que ainda falta.',
      servicoLigado('fisco')?"go('fisco')":'',false);
  }

  // pessoas: inquilinos de contratos ativos + proprietários, com CC datado
  const ativos={};(db.contracts||[]).forEach(c=>{if(ctVivo(c))(c.tenantIds||[]).forEach(t=>{ativos[t]=1})});
  const vistos={};
  const pessoa=(p,papel)=>{
    if(!p||!p.ccValid||vistos[p.id])return;vistos[p.id]=1;
    /* a ficha da pessoa é dos Inquilinos ou dos Proprietários: sem o serviço
       ligado o prazo diz-se na mesma, mas não abre nada. A ficha, e não o
       formulário: num proprietário com conta ela manda o «Editar» para o perfil
       dele (pessoas.js:personView), e o formulário gravava só neste aparelho */
    poe('cc',p.id+':'+p.ccValid,p.ccValid,'Cartão de cidadão — '+(p.name||'pessoa'),
      'Caduca a '+dPT(p.ccValid)+'. Um contrato novo (ou renovado) precisa do documento válido.',
      servicoLigado(papel==='owner'?'owners':'tenants')?`personView('${papel}','${jsq(p.id)}')`:'',true);
  };
  (db.tenants||[]).forEach(t=>{if(ativos[t.id])pessoa(t,'tenant')});
  (db.owners||[]).forEach(o=>pessoa(o,'owner'));

  (db.properties||[]).forEach(p=>{
    if(p.energyValid){
      poe('energia',p.id+':'+p.energyValid,p.energyValid,'Certificado energético — '+(p.name||'imóvel'),
        'Expira a '+dPT(p.energyValid)+'. É obrigatório para anunciar e celebrar arrendamentos.',
        servicoLigado('properties')?`propView('${jsq(p.id)}')`:'',true);
    }
    (p.loans||[]).forEach(l=>{
      if(l.type!=='mista'||!l.fixedYears||!(Number(l.outstanding)>0))return;
      /* o mesmo relógio da simulação (credito.js:fimDaFaseFixa): as prestações
         registadas, e não o calendário desde o início — os dois discordavam por
         anos num crédito introduzido a meio, e o aviso dizia uma data que as
         contas não usavam */
      const r0=servicoLigado('recurring')?loanRecOf(l):null;
      const fim=fimDaFaseFixa(l,db.transactions||[],h,r0&&r0.next);
      if(!fim)return;
      const depois=(Number(l.euribor)||0)+(Number(l.spread)||0);
      poe('taxa',l.id+':'+fim,fim,'Fim da taxa fixa — '+(l.name||l.bank||'crédito')+' ('+(p.name||'imóvel')+')',
        'A '+dPT(fim)+' a taxa passa de '+dec(l.rate)+'% para Euribor+spread (hoje ~'+dec(depois)+'%). Bom momento para comparar propostas.',
        servicoLigado('credits')?`mortView('${jsq(p.id)}','${jsq(l.id)}')`:(servicoLigado('properties')?`propView('${jsq(p.id)}')`:''),false);
    });
  });

  return out.sort((a,b)=>a.dias-b.dias);
}

/* Os prazos por mostrar: os de prazosDe menos os silenciados.
   Recebe: hoje (opcional) — data ISO de referência, para os testes.
   Devolve: a mesma lista de prazosDe, filtrada pelos silenciados. */
function prazosAtivos(hoje){
  const s=(db.settings&&db.settings.prazosVistos)||{};
  return prazosDe(hoje).filter(p=>!s[p.chave]);
}

/* Silencia um prazo (esta ocorrência: a chave inclui a data — quando a data
   mudar, o aviso volta) e redesenha, com «Anular» por seis segundos.
   Recebe: chave — a chave do prazo, como vem de prazosDe.
   Devolve: nada — grava em settings.prazosVistos e redesenha a vista. */
function pzSilencia(chave){
  db.settings.prazosVistos=db.settings.prazosVistos||{};
  db.settings.prazosVistos[chave]=true;
  save();
  comDesfazer('Prazo silenciado — volta quando a data mudar.',()=>{
    delete db.settings.prazosVistos[chave];save();render();
  });
  render();
}

/* Estado aberto/fechado do cartão dos prazos, guardado no aparelho (como o
   dos movimentos por confirmar: a vista geral é para ver de relance).
   Devolve: verdadeiro se o cartão deve estar fechado. */
function pzShut(){try{return localStorage.getItem('gi_pz_shut')==='1'}catch(e){return false}}
/* Alterna o cartão dos prazos e redesenha.
   Devolve: nada — grava a escolha no aparelho e redesenha. */
function pzToggle(){try{localStorage.setItem('gi_pz_shut',pzShut()?'0':'1')}catch(e){}render()}

/* HTML do cartão «Prazos» da vista geral: os avisos dentro da janela, do
   mais urgente para o menos, cada um com a ação certa (abrir o contrato, a
   pessoa, o imóvel) e um «Silenciar» com rede.
   Devolve: o HTML do cartão (texto), ou '' quando não há prazos na janela. */
function prazosCard(){
  /* o mesmo guarda do sino (espera.js:sabemosOEstado): um prazo silenciado
     noutro aparelho reaparecia aqui, com selo vermelho, até o estado chegar */
  if(!sabemosOEstado())return '';
  const lista=prazosAtivos();
  if(!lista.length)return '';
  const selo=p=>{
    const cls=p.urg==='info'?'grey':p.urg==='breve'?'amber':'red';
    const txt=p.dias<0?('há '+(-p.dias)+' d'):p.dias===0?'hoje':(p.dias+' d');
    return `<span class="badge ${cls} u-fx-0-0-auto">${txt}</span>`;
  };
  /* sem «abrir» (o serviço que abria está desligado nesta conta) o cartão não
     se apresenta como tocável: diz o prazo, e o Silenciar continua a servir */
  const row=p=>`<div class="card${p.abrir?' tap':''} u-p-11px-13px"${p.abrir?` data-toca="camada" data-click="${p.abrir}"`:''}>
    <div class="row-between u-ai-center u-g-10px">
      <div class="u-minw-0"><b class="u-d-block u-ov-hidden u-to-ellipsis u-ws-nowrap">${esc(p.titulo)}</b>
        <span class="small">${esc(p.sub)}</span></div>${selo(p)}</div>
    <div class="toolbar u-m-9px-0-0">
      <button class="btn sm" data-toca="dados" data-click="event.stopPropagation();pzSilencia('${jsq(p.chave)}')">Silenciar</button></div></div>`;
  const urgentes=lista.filter(p=>p.dias<=7).length,open=!pzShut();
  return `<div class="card u-mb-14px" id="pzCard">
    <div class="row-between tap u-ai-center u-cur-pointer u-m-n16px u-p-16px" data-toca="vista" data-click="pzToggle()">
      <div class="u-minw-0"><div class="title">Prazos</div>
        <div class="small">${lista.length} na janela de aviso${urgentes?' · <b class="neg">'+urgentes+' com 7 dias ou menos</b>':''}${open?'':' · toca para ver'}</div></div>
      <span class="u-fx-0-0-auto u-d-inline-flex ${open?'u-tf-rotate-90deg':'u-tf-rotate-n90deg'}">${ic('chev',20)}</span></div>
    ${open?`<div class="list u-g-8px u-mt-12px">${lista.map(row).join('')}</div>
    <div class="hint u-mt-9px">Silenciar cala esta ocorrência; quando a data mudar, o aviso volta sozinho.</div>`:''}</div>`;
}

/* Lembretes de prazos para a ponte Android (o scheduleReminders junta-os aos
   dos movimentos): um por prazo não silenciado, no dia-alvo às 9h, mais um
   aviso 7 dias antes quando a antecedência o permite.
   Devolve: lista de {id, at, title, text} com datas futuras. */
function prazosLembretes(){
  const at=iso=>{const d=new Date(iso+'T00:00:00');d.setHours(9,0,0,0);return d.getTime()};
  const list=[];
  prazosAtivos().forEach(p=>{
    list.push({id:'pz_'+p.chave,at:at(p.alvo),title:'Prazo: '+p.titulo,text:p.sub});
    const antes=pzAddDias(p.alvo,-7);
    if(pzDias(antes)>0)list.push({id:'pz7_'+p.chave,at:at(antes),title:'Daqui a 7 dias: '+p.titulo,text:p.sub});
  });
  return list.filter(x=>x.at>Date.now());
}
