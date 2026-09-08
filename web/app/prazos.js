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
   a chave muda e o aviso volta sozinho. */

// dias de antecedência com que cada tipo de prazo começa a avisar
const PZ_ANTECEDENCIA = { oposicao: 150, fim: 60, aumento: 45, cc: 60, energia: 90, taxa: 90 };

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

/* Todos os prazos do portefólio que já entraram na janela de aviso, do mais
   urgente para o menos. É função pura sobre o db: quem quiser outra data
   de referência (os testes) passa-a.

   As fontes: contratos ativos com fim (a janela de oposição de 120 dias e o
   próprio fim), contratos com aumento anual configurado (o aviso de 30 dias
   ao inquilino), cartões de cidadão de inquilinos ativos e de proprietários,
   certificados energéticos dos imóveis, e o fim da fase fixa das mistas.

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
    if(!isActive(c))return;
    const nome=c.name||propName(c.propertyId)||'contrato';
    const abrir=`ctModal('${c.id}')`;
    if(c.end){
      const oposicao=pzAddDias(c.end,-120);
      poe('oposicao',c.id+':'+c.end,oposicao,'Oposição à renovação — '+nome,
        'Para o contrato não renovar a '+c.end+', o aviso ao inquilino tem de seguir até '+oposicao+' (120 dias).',abrir,false);
      poe('fim',c.id+':'+c.end,c.end,'Fim do prazo do contrato — '+nome,
        'Termina a '+c.end+'. Sem oposição, renova-se automaticamente pelo período legal — atualiza o fim para o novo prazo.',abrir,true);
    }
    if(c.increase!=null&&c.start){
      const aniv=pzAniversario(c.start,h);
      const aviso=pzAddDias(aniv,-30);
      poe('aumento',c.id+':'+aniv,aviso,'Aumento anual da renda — '+nome,
        'Para valer a '+aniv+', o aviso ao inquilino (30 dias) segue até '+aviso+'. Renda '+euro(c.rent)+' '+(c.increase>0?'+':'')+c.increase+'%.',abrir,false);
    }
  });

  // pessoas: inquilinos de contratos ativos + proprietários, com CC datado
  const ativos={};(db.contracts||[]).forEach(c=>{if(isActive(c))(c.tenantIds||[]).forEach(t=>{ativos[t]=1})});
  const vistos={};
  const pessoa=(p,papel)=>{
    if(!p||!p.ccValid||vistos[p.id])return;vistos[p.id]=1;
    poe('cc',p.id+':'+p.ccValid,p.ccValid,'Cartão de cidadão — '+(p.name||'pessoa'),
      'Caduca a '+p.ccValid+'. Um contrato novo (ou renovado) precisa do documento válido.',
      `personModal('${papel}','${p.id}')`,true);
  };
  (db.tenants||[]).forEach(t=>{if(ativos[t.id])pessoa(t,'tenant')});
  (db.owners||[]).forEach(o=>pessoa(o,'owner'));

  (db.properties||[]).forEach(p=>{
    if(p.energyValid){
      poe('energia',p.id+':'+p.energyValid,p.energyValid,'Certificado energético — '+(p.name||'imóvel'),
        'Expira a '+p.energyValid+'. É obrigatório para anunciar e celebrar arrendamentos.',
        `propModal('${p.id}')`,true);
    }
    (p.loans||[]).forEach(l=>{
      if(l.type!=='mista'||!l.start||!l.fixedYears)return;
      const fim=pzAddAnos(l.start,Number(l.fixedYears));
      const depois=(Number(l.euribor)||0)+(Number(l.spread)||0);
      poe('taxa',l.id+':'+fim,fim,'Fim da taxa fixa — '+(l.name||l.bank||'crédito')+' ('+(p.name||'imóvel')+')',
        'A '+fim+' a taxa passa de '+dec(l.rate)+'% para Euribor+spread (hoje ~'+dec(depois)+'%). Bom momento para comparar propostas.',
        `propModal('${p.id}')`,false);
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
  const lista=prazosAtivos();
  if(!lista.length)return '';
  const stop='event.stopPropagation();';
  const selo=p=>{
    const cls=p.urg==='info'?'grey':p.urg==='breve'?'amber':'red';
    const txt=p.dias<0?('há '+(-p.dias)+' d'):p.dias===0?'hoje':(p.dias+' d');
    return `<span class="badge ${cls}" style="flex:0 0 auto">${txt}</span>`;
  };
  const row=p=>`<div class="card tap" style="padding:11px 13px" data-toca="camada" onclick="${p.abrir}">
    <div class="row-between" style="align-items:center;gap:10px">
      <div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.titulo)}</b>
        <span class="small">${esc(p.sub)}</span></div>${selo(p)}</div>
    <div class="toolbar" style="margin:9px 0 0">
      <button class="btn sm" data-toca="dados" onclick="${stop}pzSilencia('${jsq(p.chave)}')">Silenciar</button></div></div>`;
  const urgentes=lista.filter(p=>p.dias<=7).length,open=!pzShut();
  return `<div class="card" id="pzCard" style="margin-bottom:14px">
    <div class="row-between tap" style="align-items:center;cursor:pointer;margin:-16px;padding:16px" data-toca="vista" onclick="pzToggle()">
      <div style="min-width:0"><div class="title">Prazos</div>
        <div class="small">${lista.length} na janela de aviso${urgentes?' · <b class="neg">'+urgentes+' com 7 dias ou menos</b>':''}${open?'':' · toca para ver'}</div></div>
      <span style="flex:0 0 auto;display:inline-flex;transform:rotate(${open?'90':'-90'}deg)">${ic('chev',20)}</span></div>
    ${open?`<div class="list" style="gap:8px;margin-top:12px">${lista.map(row).join('')}</div>
    <div class="hint" style="margin-top:9px">Silenciar cala esta ocorrência; quando a data mudar, o aviso volta sozinho.</div>`:''}</div>`;
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
