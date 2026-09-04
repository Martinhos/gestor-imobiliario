/* ================= CALENDÁRIO ================= */
/* O mês de relance: as visitas agendadas e os movimentos planeados, cada
   um no seu dia. Tocar num dia abre a lista dele — cada visita abre a
   própria ficha, cada planeado leva aos Planeados — e um dia vazio
   oferece logo marcar visita ali.

   As ocorrências dos planeados expandem-se a partir do próximo vencimento
   com o passo de cada um (semanal, mensal, trimestral, anual): o que se vê
   é o que o cartão «por confirmar» vai pedir, dia a dia. */

let calMes='';   // 'AAAA-MM' do mês em vista; vazio = o mês de hoje

/* O primeiro dia do mês em vista, como data ISO.
   Devolve: 'AAAA-MM-01' do mês em vista (o de hoje, se nenhum foi escolhido). */
function calInicio(){return (calMes||pzHoje().slice(0,7))+'-01'}

/* Anda com o mês em vista (ou volta a hoje) e redesenha.
   Recebe: delta — meses a andar (+1/-1), ou 0 para voltar ao mês de hoje.
   Devolve: nada — atualiza calMes e chama render(). */
function calNav(delta){
  if(!delta){calMes='';render();return}
  const d=new Date(calInicio()+'T00:00:00');
  d.setMonth(d.getMonth()+delta);
  calMes=pzIso(d).slice(0,7);
  render();
}

/* As ocorrências dos movimentos planeados dentro de um intervalo de dias,
   expandidas a partir do próximo vencimento de cada um com o passo dele.
   Os silenciados ficam de fora — no calendário como no cartão.
   Recebe: de — data ISO inicial (inclusive); ate — data ISO final (inclusive).
   Devolve: lista de {date, rec} com uma entrada por ocorrência. */
function calPlaneados(de,ate){
  const out=[];
  (db.recurring||[]).forEach(r=>{
    if(!r.next||r.muted)return;
    let d=r.next,n=0;
    while(d<=ate&&n<40){
      if(d>=de)out.push({date:d,rec:r});
      if(r.every==='once')break;
      d=nextDate(d,r.every);n++;
    }
  });
  return out;
}

/* A página do calendário: cabeçalho com o mês e as setas (e «Hoje» quando se
   navegou), a grelha de segunda a domingo com visitas e planeados por dia.
   Devolve: o HTML da página (texto). */
function vCalendar(){
  const inicio=calInicio(),hoje=pzHoje();
  const d0=new Date(inicio+'T00:00:00');
  const bruto=d0.toLocaleDateString('pt-PT',{month:'long',year:'numeric'});
  const nome=bruto.charAt(0).toUpperCase()+bruto.slice(1);   // Setembro de 2026, nao Setembro De 2026
  const diasNoMes=new Date(d0.getFullYear(),d0.getMonth()+1,0).getDate();
  const fim=inicio.slice(0,8)+String(diasNoMes).padStart(2,'0');
  // segunda-feira como primeiro dia: getDay() dá 0=domingo
  const antes=(d0.getDay()+6)%7;

  const visitas={};
  (db.visits||[]).forEach(v=>{
    if(v.date>=inicio&&v.date<=fim&&v.estado!=='cancelada')(visitas[v.date]=visitas[v.date]||[]).push(v);
  });
  const planeados={};
  calPlaneados(inicio,fim).forEach(o=>{(planeados[o.date]=planeados[o.date]||[]).push(o.rec)});

  let celulas='';
  for(let i=0;i<antes;i++)celulas+='<div class="calday fora"></div>';
  for(let dia=1;dia<=diasNoMes;dia++){
    const iso=inicio.slice(0,8)+String(dia).padStart(2,'0');
    const vs=visitas[iso]||[],ps=planeados[iso]||[];
    const pontos=vs.slice(0,3).map(()=>'<i class="pt vis"></i>').join('')+
      ps.slice(0,3).map(()=>'<i class="pt pla"></i>').join('')+
      (vs.length+ps.length>6?'<i class="pt mais"></i>':'');
    celulas+=`<div class="calday tap ${iso===hoje?'hoje':''}" tabindex="0" onclick="calDia('${iso}')">
      <span class="n">${dia}</span><span class="pts">${pontos}</span></div>`;
  }
  const total=Object.values(visitas).reduce((n,l)=>n+l.length,0);
  return `<div class="toolbar" style="align-items:center;margin-bottom:12px">
      <button class="btn" onclick="calNav(-1)" aria-label="Mês anterior">${ic('chev',18)}</button>
      <b style="flex:1;text-align:center">${esc(nome)}</b>
      <button class="btn" style="transform:scaleX(-1)" onclick="calNav(1)" aria-label="Mês seguinte">${ic('chev',18)}</button>
      ${calMes?`<button class="btn" onclick="calNav(0)">Hoje</button>`:''}</div>
    <div class="card" style="padding:12px">
      <div class="calgrid calhead">${['S','T','Q','Q','S','S','D'].map(x=>`<span>${x}</span>`).join('')}</div>
      <div class="calgrid">${celulas}</div></div>
    <div class="hint" style="margin-top:10px"><i class="pt vis" style="vertical-align:middle"></i> visitas${total?' ('+total+' este mês)':''} · <i class="pt pla" style="vertical-align:middle"></i> movimentos planeados · toca num dia para o abrir</div>`;
}

/* O modal de um dia: as visitas dele (tocar abre a ficha), as ocorrências
   planeadas (tocar leva aos Planeados), e o botão para marcar visita já
   com a data posta.
   Recebe: iso — o dia, em 'AAAA-MM-DD'.
   Devolve: nada — abre o modal da casa com a lista do dia. */
function calDia(iso){
  const vs=(db.visits||[]).filter(v=>v.date===iso&&v.estado!=='cancelada')
    .sort((a,b)=>(a.start||'')<(b.start||'')?-1:1);
  const ps=calPlaneados(iso,iso);
  const linhaV=v=>{const p=prop(v.propertyId);
    return `<div class="card tap" style="padding:10px 13px" onclick="closeModal();visitModal('${v.id}')">
      <div class="row-between" style="align-items:center"><div style="min-width:0">
        <b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.nomes||'(sem nome)')}</b>
        <span class="small">${v.start?esc(v.start)+(v.end?'–'+esc(v.end):'')+' · ':''}${esc(p?(p.name||p.address):'')}</span></div>
        <span class="badge ${v.estado==='realizada'?'':'amber'}">${VESTADO[v.estado]||''}</span></div></div>`};
  const linhaP=o=>`<div class="card tap" style="padding:10px 13px" onclick="closeModal();go('recurring')">
      <div class="row-between" style="align-items:center"><div style="min-width:0">
        <b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.rec.name)}</b>
        <span class="small">${(KIND[o.rec.tx.kind]||{}).short||''}${o.rec.tx.propertyId?' · '+esc(propName(o.rec.tx.propertyId)):''}</span></div>
        <b style="flex:0 0 auto">${o.rec.tx.amount?euro2(o.rec.tx.amount):''}</b></div></div>`;
  const data=new Date(iso+'T00:00:00').toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
  const corpo=`<div class="list" style="gap:8px">
    ${vs.length?`<div class="navh">Visitas</div>${vs.map(linhaV).join('')}`:''}
    ${ps.length?`<div class="navh">Planeados</div>${ps.map(linhaP).join('')}`:''}
    ${!vs.length&&!ps.length?'<div class="empty">Nada marcado para este dia.</div>':''}
    <div class="toolbar" style="justify-content:center;margin-top:6px">
      <button class="btn primary" onclick="closeModal();visitModal(null,{date:'${iso}'})">Marcar visita neste dia</button></div></div>`;
  openModal(data.charAt(0).toUpperCase()+data.slice(1),corpo,'<button class="btn" onclick="closeModal()">Fechar</button>');
}
