/* ================= CALENDÁRIO ================= */
/* O mês de relance: as visitas agendadas e os movimentos planeados, cada
   um no seu dia. Tocar num dia realça-o na grelha e mostra por baixo, na
   própria vista, a lista dele — cada visita abre a própria ficha, cada
   planeado leva aos Planeados — e há sempre o botão para marcar visita
   nesse dia.

   As ocorrências dos planeados expandem-se a partir do próximo vencimento
   com o passo de cada um (semanal, mensal, trimestral, anual): o que se vê
   é o que o cartão «por confirmar» vai pedir, dia a dia. */

let calMes='';      // 'AAAA-MM' do mês em vista; vazio = o mês de hoje
let calDiaSel='';   // 'AAAA-MM-DD' do dia escolhido na grelha; vazio = o dia por omissão (calSelDia)

/* O primeiro dia do mês em vista, como data ISO.
   Devolve: 'AAAA-MM-01' do mês em vista (o de hoje, se nenhum foi escolhido). */
function calInicio(){return (calMes||pzHoje().slice(0,7))+'-01'}

/* O dia em foco no mês em vista: o escolhido, se for deste mês; senão hoje,
   se o mês em vista é o de hoje; senão o dia 1. Nunca vazio — o painel por
   baixo da grelha tem sempre um dia para mostrar.
   Devolve: 'AAAA-MM-DD'. */
function calSelDia(){
  const mes=calInicio().slice(0,7);
  if(calDiaSel&&calDiaSel.slice(0,7)===mes)return calDiaSel;
  const hoje=pzHoje();
  return hoje.slice(0,7)===mes?hoje:mes+'-01';
}

/* O mês que está no ecrã, em 'AAAA-MM'. O calMes vazio quer dizer «o de
   hoje», e vem posto de duas maneiras diferentes: pode estar vazio, ou pode
   estar posto COM o mês de hoje, por se ter voltado até cá pelas setas. Quem
   perguntar «estou no mês de hoje?» tem de as tratar às duas por igual.
   Devolve: o mês em vista, em 'AAAA-MM'. */
function calMesEmVista(){return calMes||pzHoje().slice(0,7)}
/* Anda com o mês em vista (ou volta a hoje) e redesenha; o dia escolhido
   fica para trás — no mês novo o foco cai em hoje ou no dia 1.
   Recebe: delta — meses a andar (+1/-1), ou 0 para voltar ao mês de hoje.
   Devolve: nada — limpa calDiaSel, atualiza calMes e chama render(). */
function calNav(delta){
  calDiaSel='';
  /* A grelha do mês vira como uma página, para o lado a que se foi. Sem isto
     o mês trocava de números no sítio e ninguém via para onde tinha andado. */
  const grelha=()=>document.getElementById('calCard');
  /* E o painel do dia cresce até ao tamanho do mês novo, em vez de o tomar de
     um fotograma para o outro: o dia em foco muda com o mês, e com ele o que
     lá está escrito — medido, 149px em setembro e 426px em outubro, com a
     legenda por baixo a saltar 279px.

     Mexe no #calDiaPanel, que é OUTRO elemento do que o deslizarEntre anima
     (o #calCard): as duas animações não disputam a mesma caixa, e o painel
     está por baixo da grelha, portanto a altura dele também não mexe com o
     retângulo que a fita mede. No --lento da fita, para o ecrã todo assentar
     de uma vez em vez de a caixa parar antes de a página acabar de virar. */
  const comPainel=(pintar)=>()=>crescerEmAltura(
    ()=>document.getElementById('calDiaPanel'),pintar,'--lento');
  const hoje=pzHoje().slice(0,7),emVista=calMesEmVista();
  if(!delta){
    /* já se está no mês de hoje: não há para onde rodar. O calMes podia estar
       posto — com o valor do mês de hoje — por se ter voltado pela seta. */
    if(emVista===hoje)return comPainel(()=>{calMes='';render()})();
    return deslizarEntre(grelha,comPainel(()=>{calMes='';render()}),emVista>hoje?-1:1);
  }
  const d=new Date(calInicio()+'T00:00:00');
  d.setMonth(d.getMonth()+delta);
  deslizarEntre(grelha,comPainel(()=>{calMes=pzIso(d).slice(0,7);render()}),delta>0?1:-1);
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
   navegou), a grelha de segunda a domingo com visitas e planeados por dia,
   e por baixo o painel do dia em foco.
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

  const sel=calSelDia();
  let celulas='';
  for(let i=0;i<antes;i++)celulas+='<div class="calday fora"></div>';
  for(let dia=1;dia<=diasNoMes;dia++){
    const iso=inicio.slice(0,8)+String(dia).padStart(2,'0');
    const vs=visitas[iso]||[],ps=planeados[iso]||[];
    const pontos=vs.slice(0,3).map(()=>'<i class="pt vis"></i>').join('')+
      ps.slice(0,3).map(()=>'<i class="pt pla"></i>').join('')+
      (vs.length+ps.length>6?'<i class="pt mais"></i>':'');
    celulas+=`<div class="calday tap${iso===hoje?' hoje':''}${iso===sel?' on':''}" data-d="${iso}" tabindex="0" aria-pressed="${iso===sel?'true':'false'}" data-toca="vista" onclick="calSel('${iso}')">
      <span class="n">${dia}</span><span class="pts">${pontos}</span></div>`;
  }
  const total=Object.values(visitas).reduce((n,l)=>n+l.length,0);
  return `<div class="toolbar" style="align-items:center;margin-bottom:12px">
      <button class="btn" data-toca="vista" onclick="calNav(-1)" aria-label="Mês anterior">${ic('chev',18)}</button>
      <b style="flex:1;text-align:center">${esc(nome)}</b>
      ${calMesEmVista()!==pzHoje().slice(0,7)?`<button class="btn" data-toca="vista" onclick="calNav(0)">Hoje</button>`:''}
      <button class="btn" style="transform:scaleX(-1)" data-toca="vista" onclick="calNav(1)" aria-label="Mês seguinte">${ic('chev',18)}</button></div>
    <div class="card" id="calCard" style="padding:12px">
      <div class="calgrid calhead" id="calGrelha0">${['S','T','Q','Q','S','S','D'].map(x=>`<span>${x}</span>`).join('')}</div>
      <div class="calgrid">${celulas}</div></div>
    ${calDiaPanel(sel)}
    <div class="hint" style="margin-top:10px"><i class="pt vis" style="vertical-align:middle"></i> visitas${total?' ('+total+' este mês)':''} · <i class="pt pla" style="vertical-align:middle"></i> movimentos planeados · toca num dia para veres o que tem</div>`;
}

/* O painel do dia em foco, por baixo da grelha: as visitas dele (tocar abre
   a ficha), as ocorrências planeadas (tocar leva aos Planeados) e o botão
   para marcar visita já com a data posta.
   Recebe: iso — o dia, em 'AAAA-MM-DD'.
   Devolve: o HTML do painel (texto), com id calDiaPanel para calSel o repintar. */
function calDiaPanel(iso){
  const vs=(db.visits||[]).filter(v=>v.date===iso&&v.estado!=='cancelada')
    .sort((a,b)=>(a.start||'')<(b.start||'')?-1:1);
  const ps=calPlaneados(iso,iso);
  const linhaV=v=>{const p=prop(v.propertyId);
    return `<div class="card tap" style="padding:10px 13px" data-toca="camada" onclick="visitModal('${v.id}')">
      <div class="row-between" style="align-items:center"><div style="min-width:0">
        <b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.nomes||'(sem nome)')}</b>
        <span class="small">${v.start?esc(v.start)+(v.end?'–'+esc(v.end):'')+' · ':''}${esc(p?(p.name||p.address):'')}</span></div>
        <span class="badge ${v.estado==='realizada'?'':'amber'}">${VESTADO[v.estado]||''}</span></div></div>`};
  const linhaP=o=>`<div class="card tap" style="padding:10px 13px" data-toca="ecra" onclick="go('recurring')">
      <div class="row-between" style="align-items:center"><div style="min-width:0">
        <b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.rec.name)}</b>
        <span class="small">${(KIND[o.rec.tx.kind]||{}).short||''}${o.rec.tx.propertyId?' · '+esc(propName(o.rec.tx.propertyId)):''}</span></div>
        <b style="flex:0 0 auto">${o.rec.tx.amount?euro2(o.rec.tx.amount):''}</b></div></div>`;
  const bruto=new Date(iso+'T00:00:00').toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
  const data=bruto.charAt(0).toUpperCase()+bruto.slice(1);   // Sexta-feira, 10 de setembro
  return `<div class="card" id="calDiaPanel" style="margin-top:12px;padding:14px">
    <div class="title">${esc(data)}</div>
    <div class="list" style="gap:8px;margin-top:12px">
      ${vs.length?`<div class="flabel" style="margin:0">Visitas</div>${vs.map(linhaV).join('')}`:''}
      ${ps.length?`<div class="flabel" style="margin:0">Planeados</div>${ps.map(linhaP).join('')}`:''}
      ${!vs.length&&!ps.length?'<div class="hint">Nada marcado para este dia.</div>':''}
      <div class="toolbar" style="justify-content:center;margin-top:6px">
        <button class="btn primary" data-toca="camada" onclick="visitModal(null,{date:'${iso}'})">Marcar visita neste dia</button></div></div></div>`;
}

/* Muda o dia em foco sem redesenhar a página: troca a classe .on na grelha
   e repinta só o painel (o padrão do donutDrill). Sem painel no DOM,
   redesenha a vista toda.

   O painel muda de ALTURA com o dia — um dia cheio tem mais do dobro de um
   dia vazio —, e trocá-lo de repente fazia a legenda por baixo saltar até
   207px. Por isso passa pelo crescerEmAltura (continuidade.js), que o deixa
   crescer ou encolher até ao tamanho novo.
   Recebe: iso — o dia, em 'AAAA-MM-DD'.
   Devolve: nada — atualiza calDiaSel e o DOM. */
function calSel(iso){
  calDiaSel=iso;
  const painel=document.getElementById('calDiaPanel');
  if(!painel)return render();
  [].slice.call(document.querySelectorAll('.calday[data-d]')).forEach(c=>{
    const on=c.getAttribute('data-d')===iso;
    c.classList.toggle('on',on);c.setAttribute('aria-pressed',on?'true':'false');
  });
  crescerEmAltura(()=>document.getElementById('calDiaPanel'),()=>{
    painel.outerHTML=calDiaPanel(iso);
    tornarFocavel(document.getElementById('calDiaPanel'));
  });
}
