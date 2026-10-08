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
   Recebe: delta — meses a andar (+1/-1), ou 0 para voltar ao mês de hoje;
   desde (opcional) — onde o dedo deixou a grelha, em px (o arrasto do
   calArrastoFim): a fita parte daí em vez de partir do sítio.
   Devolve: nada — limpa calDiaSel, atualiza calMes e chama render(). */
function calNav(delta,desde){
  calDiaSel='';
  /* A grelha do mês vira como uma página, para o lado a que se foi. Sem isto
     o mês trocava de números no sítio e ninguém via para onde tinha andado.

     Quem vira são os DIAS, e não o cartão que os envolve. Esteve ao contrário,
     com o #calCard inteiro dentro da fita, e isso obrigava o cartão a ter a
     altura das duas páginas ao mesmo tempo: um mês de seis semanas a seguir a
     um de cinco fazia o cartão saltar 56px de um fotograma para o outro,
     porque a moldura não tinha maneira de crescer a meio de uma viagem em que
     ela própria era o que viajava. Com só os dias na fita, o cartão fica
     parado a fazer de moldura e cresce até ao tamanho do mês que entra — e o
     cabeçalho dos dias da semana, que é igual nos dois meses, deixa de andar
     para trás e para a frente sem razão. */
  const grelha=()=>document.getElementById('calDias');
  const moldura=()=>document.getElementById('calCard');
  /* E o painel do dia cresce até ao tamanho do mês novo, em vez de o tomar de
     um fotograma para o outro: o dia em foco muda com o mês, e com ele o que
     lá está escrito — medido, 149px em setembro e 426px em outubro, com a
     legenda por baixo a saltar 279px.

     Mexe no #calDiaPanel, que é OUTRO elemento do que o deslizarEntre anima
     (os #calDias) e do que lhe serve de moldura (o #calCard): as três
     animações não disputam a mesma caixa, e o painel está por baixo de todas,
     portanto a altura dele não mexe com o retângulo que a fita mede. No
     --lento da fita, para o ecrã todo assentar de uma vez em vez de a caixa
     parar antes de a página acabar de virar. */
  const comPainel=(pintar)=>()=>crescerEmAltura(
    ()=>document.getElementById('calDiaPanel'),pintar,'--lento');
  const hoje=pzHoje().slice(0,7),emVista=calMesEmVista();
  if(!delta){
    /* já se está no mês de hoje: não há para onde rodar. O calMes podia estar
       posto — com o valor do mês de hoje — por se ter voltado pela seta. */
    if(emVista===hoje)return comPainel(()=>{calMes='';render()})();
    return deslizarEntre(grelha,comPainel(()=>{calMes='';render()}),emVista>hoje?-1:1,moldura);
  }
  const d=new Date(calInicio()+'T00:00:00');
  d.setMonth(d.getMonth()+delta);
  deslizarEntre(grelha,comPainel(()=>{calMes=pzIso(d).slice(0,7);render()}),delta>0?1:-1,moldura,desde);
}

/* As ocorrências dos movimentos planeados dentro de um intervalo de dias,
   expandidas a partir do próximo vencimento de cada um com o passo dele,
   até ao fim do planeado (end), quando o tem.
   Os silenciados ficam de fora — no calendário como no cartão. O passo de cada
   um é dos Planeados (planeados.js:nextDate): com esse serviço desligado nesta
   conta não há ocorrências, e a lista sai vazia.
   Recebe: de — data ISO inicial (inclusive); ate — data ISO final (inclusive).
   Devolve: lista de {date, rec} com uma entrada por ocorrência. */
function calPlaneados(de,ate){
  const out=[];
  if(!servicoLigado('recurring'))return out;
  (db.recurring||[]).forEach(r=>{
    if(!r.next||r.muted)return;
    let d=r.next,n=0;
    // o «Até» do planeado (r.end) também fecha a série: depois dele já não se repete
    while(d&&d<=ate&&n<40&&!(r.end&&d>r.end)){
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
  const inicio=calInicio();
  const d0=new Date(inicio+'T00:00:00');
  const bruto=d0.toLocaleDateString('pt-PT',{month:'long',year:'numeric'});
  const nome=bruto.charAt(0).toUpperCase()+bruto.slice(1);   // Setembro de 2026, nao Setembro De 2026
  const sel=calSelDia();
  const {html:celulas,total}=calCelulas(inicio,sel);
  return `<div class="toolbar u-ai-center u-mb-12px">
      <button class="btn" data-toca="vista" data-click="calNav(-1)" aria-label="Mês anterior">${ic('chev',18)}</button>
      <b class="u-fx-1 u-ta-center">${esc(nome)}</b>
      ${calMesEmVista()!==pzHoje().slice(0,7)?`<button class="btn" data-toca="vista" data-click="calNav(0)">Hoje</button>`:''}
      <button class="btn u-tf-scalex-n1" data-toca="vista" data-click="calNav(1)" aria-label="Mês seguinte">${ic('chev',18)}</button></div>
    <div class="card u-p-12px" id="calCard">
      <div class="calgrid calhead" id="calGrelha0">${['S','T','Q','Q','S','S','D'].map(x=>`<span>${x}</span>`).join('')}</div>
      <div class="calgrid" id="calDias" data-pointerdown="calArrastar(event,this)">${celulas}</div></div>
    ${calDiaPanel(sel)}
    <div class="hint u-mt-10px">${[servicoLigado('visits')?`<i class="pt vis u-va-middle"></i> visitas${total?' ('+total+' este mês)':''}`:'',
      servicoLigado('recurring')?'<i class="pt pla u-va-middle"></i> movimentos planeados':'','toca num dia para veres o que tem'].filter(Boolean).join(' · ')}</div>`;
}

/* Os dias de um mês, prontos para a grelha: as células em branco até à
   segunda-feira, e cada dia com os pontos das visitas e dos planeados. Serve
   o mês em vista e, a meio de um arrasto, os vizinhos que espreitam dos lados.
   Recebe: inicio — o primeiro dia do mês, 'AAAA-MM-01'; sel — o dia em foco
   ('' para nenhum, como nos vizinhos).
   Devolve: {html, total} — as células (texto) e o número de visitas do mês. */
function calCelulas(inicio,sel){
  const hoje=pzHoje();
  const d0=new Date(inicio+'T00:00:00');
  const diasNoMes=new Date(d0.getFullYear(),d0.getMonth()+1,0).getDate();
  const fim=inicio.slice(0,8)+String(diasNoMes).padStart(2,'0');
  // segunda-feira como primeiro dia: getDay() dá 0=domingo
  const antes=(d0.getDay()+6)%7;

  /* as visitas são do serviço das Visitas: desligado nesta conta, a grelha não as marca */
  const visitas={};
  (servicoLigado('visits')?db.visits||[]:[]).forEach(v=>{
    if(v.date>=inicio&&v.date<=fim&&v.estado!=='cancelada')(visitas[v.date]=visitas[v.date]||[]).push(v);
  });
  const planeados={};
  calPlaneados(inicio,fim).forEach(o=>{(planeados[o.date]=planeados[o.date]||[]).push(o.rec)});

  let html='';
  for(let i=0;i<antes;i++)html+='<div class="calday fora"></div>';
  for(let dia=1;dia<=diasNoMes;dia++){
    const iso=inicio.slice(0,8)+String(dia).padStart(2,'0');
    const vs=visitas[iso]||[],ps=planeados[iso]||[];
    const pontos=vs.slice(0,3).map(()=>'<i class="pt vis"></i>').join('')+
      ps.slice(0,3).map(()=>'<i class="pt pla"></i>').join('')+
      (vs.length+ps.length>6?'<i class="pt mais"></i>':'');
    html+=`<div class="calday tap${iso===hoje?' hoje':''}${iso===sel?' on':''}" data-d="${iso}" tabindex="0" aria-pressed="${iso===sel?'true':'false'}" data-toca="vista" data-click="calSel('${iso}')">
      <span class="n">${dia}</span><span class="pts">${pontos}</span></div>`;
  }
  return {html,total:Object.values(visitas).reduce((n,l)=>n+l.length,0)};
}

/* ---- arrastar o mês para os lados ----
   A grelha é um carrossel: o dedo (ou o rato) leva o mês consigo, e o anterior
   e o seguinte espreitam dos lados enquanto se arrasta. Largar depois de um
   quarto da largura, ou com um gesto rápido, vira para esse lado pelo calNav —
   a mesma fita das setas, mas a partir de onde o dedo deixou o mês, para não
   haver salto. Largar antes disso devolve o mês ao sítio.

   O gesto só é do calendário quando começa na horizontal: o touch-action:pan-y
   do #calDias deixa o browser rolar a página na vertical como sempre, e nesse
   caso o pointercancel chega e o mês volta ao sítio. */
let calArrasto=null;   // o arrasto em curso: {x0,y0,dx,el,ativo,w,vx,xa,ta}, ou null

/* Começa (talvez) um arrasto: guarda onde o dedo pousou e fica à escuta. Só
   passa a arrastar no calArrastoMove, quando o dedo andou na horizontal.
   Recebe: e — o PointerEvent do pointerdown; el — a grelha dos dias (#calDias).
   Devolve: nada — liga os ouvintes do documento. */
function calArrastar(e,el){
  if(calArrasto||e.button>0||e.isPrimary===false)return;
  // a meio de uma viragem a grelha verdadeira está escondida debaixo da fita
  if(el.style.visibility==='hidden')return;
  calArrasto={x0:e.clientX,y0:e.clientY,dx:0,el:el,ativo:false,w:0,vx:0,xa:e.clientX,ta:Date.now()};
  document.addEventListener('pointermove',calArrastoMove);
  document.addEventListener('pointerup',calArrastoFim);
  document.addEventListener('pointercancel',calArrastoFim);
}

/* O dedo andou: decide se o gesto é do calendário (horizontal) ou da página
   (vertical), e, sendo do calendário, leva a grelha com ele.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada — mexe no transform da grelha. */
function calArrastoMove(e){
  const a=calArrasto;if(!a)return;
  const dx=e.clientX-a.x0,dy=e.clientY-a.y0;
  if(!a.ativo){
    // o dedo foi para cima ou para baixo: é a página a rolar, não é connosco
    if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx))return calArrastoLargar();
    if(Math.abs(dx)<10)return;
    a.ativo=true;
    a.w=a.el.getBoundingClientRect().width;
    calVizinhos(a.el);
  }
  const agora=Date.now(),dt=agora-a.ta;
  // a velocidade dos últimos instantes, alisada: é ela que diz se o gesto foi um sacudir
  if(dt>0)a.vx=.6*((e.clientX-a.xa)/dt)+.4*a.vx;
  a.xa=e.clientX;a.ta=agora;a.dx=dx;
  a.el.style.transform='translateX('+dx+'px)';
}

/* Tira os ouvintes do documento e esquece o arrasto.
   Devolve: nada. */
function calArrastoLargar(){
  document.removeEventListener('pointermove',calArrastoMove);
  document.removeEventListener('pointerup',calArrastoFim);
  document.removeEventListener('pointercancel',calArrastoFim);
  calArrasto=null;
}

/* O dedo saiu: vira o mês, se o gesto chegou para isso, ou devolve-o ao sítio.
   O toque que o browser dispara a seguir ao pointerup não é um toque num dia —
   engole-se, senão largar um mês em cima do dia 12 escolhia o dia 12.
   Recebe: e — o PointerEvent do pointerup ou do pointercancel.
   Devolve: nada — chama o calNav ou anima o regresso. */
function calArrastoFim(e){
  const a=calArrasto;calArrastoLargar();
  if(!a||!a.ativo)return;
  calEngolirToque();
  const vira=e.type!=='pointercancel'&&(Math.abs(a.dx)>a.w/4||(Math.abs(a.dx)>30&&Math.abs(a.vx)>.4&&(a.vx<0)===(a.dx<0)));
  a.el.style.transform='';
  if(vira){
    calSemVizinhos(a.el);
    // arrastar para a esquerda traz o mês da direita, que é o seguinte
    return calNav(a.dx<0?1:-1,a.dx);
  }
  if(semMovimento()||!a.el.animate)return calSemVizinhos(a.el);
  const an=a.el.animate([{transform:'translateX('+a.dx+'px)'},{transform:'none'}],
    {duration:msDoToken('--medio',200),easing:tokenTexto('--curva-entra','cubic-bezier(0,0,.2,1)')});
  const fim=()=>calSemVizinhos(a.el);
  an.onfinish=fim;
  // a rede de sempre: num separador escondido o onfinish não chega
  setTimeout(fim,msDoToken('--medio',200)+120);
}

/* Engole o próximo clique, venha de onde vier — o que o browser dispara logo
   a seguir ao fim de um arrasto. Corre na captura do window, depois da ligação
   das ações (eventos.js), e trava-o antes de chegar ao dia.
   Devolve: nada. */
function calEngolirToque(){
  const engole=ev=>{ev.stopPropagation();ev.preventDefault();tira()};
  const tira=()=>window.removeEventListener('click',engole,true);
  window.addEventListener('click',engole,true);
  // se não vier clique nenhum (o dedo saiu fora da grelha), o próximo toque é a sério
  setTimeout(tira,350);
}

/* Põe o mês anterior e o seguinte encostados à grelha, um de cada lado, para
   espreitarem enquanto se arrasta. Não são tocáveis nem lidos pelo leitor de
   ecrã: são só a vista do que vem.
   Recebe: el — a grelha dos dias (#calDias).
   Devolve: nada — acrescenta-lhe os dois vizinhos. */
function calVizinhos(el){
  calSemVizinhos(el);
  el.classList.add('arrasta');
  const card=document.getElementById('calCard');if(card)card.classList.add('arrasta');
  [-1,1].forEach(k=>{
    const d=new Date(calInicio()+'T00:00:00');d.setDate(1);d.setMonth(d.getMonth()+k);
    const g=document.createElement('div');
    g.className='calgrid calvizinho';g.setAttribute('aria-hidden','true');
    g.style.left=(k*100)+'%';
    g.innerHTML=calCelulas(pzIso(d).slice(0,8)+'01','').html;
    el.appendChild(g);
  });
}

/* Tira os vizinhos e as marcas do arrasto.
   Recebe: el — a grelha dos dias.
   Devolve: nada. */
function calSemVizinhos(el){
  [].slice.call(el.querySelectorAll('.calvizinho')).forEach(g=>g.remove());
  el.classList.remove('arrasta');
  const card=document.getElementById('calCard');if(card)card.classList.remove('arrasta');
}

/* Posso adicionar um movimento recorrente? O serviço dos Planeados ligado, e
   um sítio onde o pôr — a mesma regra do «Movimento recorrente» da folha do +
   (acessos.js:acoesDeAdicionar).
   Devolve: verdadeiro se o botão do painel do dia se escreve. */
function calPodePlanear(){
  return servicoLigado('recurring')&&(podeSemImovel()||casasComo('rec.add').length>0);
}

/* O painel do dia em foco, por baixo da grelha: as visitas dele (tocar abre
   a ficha), as ocorrências planeadas (tocar leva aos Planeados) e os botões
   para marcar visita e adicionar um movimento recorrente, já com a data
   posta. As visitas, as linhas delas e o botão delas são do serviço das
   Visitas, e o outro botão é dos Planeados: desligados nesta conta, não se
   escrevem.
   Recebe: iso — o dia, em 'AAAA-MM-DD'.
   Devolve: o HTML do painel (texto), com id calDiaPanel para calSel o repintar. */
function calDiaPanel(iso){
  const comVisitas=servicoLigado('visits'),planear=calPodePlanear();
  const vs=(comVisitas?db.visits||[]:[]).filter(v=>v.date===iso&&v.estado!=='cancelada')
    .sort((a,b)=>(a.start||'')<(b.start||'')?-1:1);
  const ps=calPlaneados(iso,iso);
  /* só há linhas de visita com as Visitas ligadas (vs vem vazio sem elas); tocar lê a ficha */
  const linhaV=v=>{const p=prop(v.propertyId),estado=VESTADO[v.estado]||'';
    return `<div class="card tap u-p-10px-13px" data-toca="camada" data-click="visView('${jsq(v.id)}')">
      <div class="row-between u-ai-center"><div class="u-minw-0">
        <b class="u-d-block u-ov-hidden u-to-ellipsis u-ws-nowrap">${esc(v.nomes||'(sem nome)')}</b>
        <span class="small">${v.start?esc(v.start)+(v.end?'–'+esc(v.end):'')+' · ':''}${esc(p?(p.name||p.address):'')}</span></div>
        <span class="badge ${v.estado==='realizada'?'':'amber'}">${estado||''}</span></div></div>`};
  const linhaP=o=>`<div class="card tap u-p-10px-13px" data-toca="ecra" data-click="go('recurring')">
      <div class="row-between u-ai-center"><div class="u-minw-0">
        <b class="u-d-block u-ov-hidden u-to-ellipsis u-ws-nowrap">${esc(o.rec.name)}</b>
        <span class="small">${(KIND[o.rec.tx.kind]||{}).short||''}${o.rec.tx.propertyId?' · '+esc(propName(o.rec.tx.propertyId)):''}</span></div>
        <b class="u-fx-0-0-auto">${o.rec.tx.amount?euro2(o.rec.tx.amount):''}</b></div></div>`;
  const bruto=new Date(iso+'T00:00:00').toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long'});
  const data=bruto.charAt(0).toUpperCase()+bruto.slice(1);   // Sexta-feira, 10 de setembro
  return `<div class="card u-mt-12px u-p-14px" id="calDiaPanel">
    <div class="title">${esc(data)}</div>
    <div class="list u-g-8px u-mt-12px">
      ${vs.length?`<div class="flabel u-m-0">Visitas</div>${vs.map(linhaV).join('')}`:''}
      ${ps.length?`<div class="flabel u-m-0">Planeados</div>${ps.map(linhaP).join('')}`:''}
      ${!vs.length&&!ps.length?'<div class="hint">Nada marcado para este dia.</div>':''}
      ${comVisitas||planear?`<div class="toolbar u-jc-center u-mt-6px">
        ${comVisitas?`<button class="btn primary" data-toca="camada" data-click="calMarcarVisita('${iso}')">Marcar visita neste dia</button>`:''}
        ${planear?`<button class="btn${comVisitas?'':' primary'}" data-toca="camada" data-click="calNovoPlaneado('${iso}')">Adicionar movimento recorrente</button>`:''}</div>`:''}</div></div>`;
}

/* Adicionar um movimento recorrente a partir de um dia do calendário: pergunta
   o tipo, como o «Movimento recorrente» da folha do +, e abre o formulário com
   a primeira ocorrência nesse dia (a data do formulário é o «next» do planeado).
   Recebe: iso — o dia, em 'AAAA-MM-DD'.
   Devolve: nada — abre a escolha do tipo e depois o formulário. */
function calNovoPlaneado(iso){
  newTxPick(k=>txModal({kind:k,modo:'rec',every:'month',preset:{date:iso}}));
}

/* Marcar visita num dia do calendário: abre o formulário de visita nova com a
   data desse dia já posta. Vive numa função com nome porque uma ação declarada
   não leva objetos ({date:…}) — faz exatamente o que o toque fazia.
   Recebe: iso — o dia, em 'AAAA-MM-DD'.
   Devolve: nada — abre o formulário da visita nova com a data posta. */
function calMarcarVisita(iso){
  visitModal(null,{date:iso});
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
/* ---- registo do serviço (servicos.js) ---- */
/* O crachá do Calendário na barra de baixo: os planeados pendentes, o mesmo
   número que o separador dos Planeados mostra — se esse serviço está ligado
   e o estado já se sabe (espera.js:sabemosOEstado).
   Devolve: {n, so:'barra'} — a contagem (0 sem pendentes, ou com os Planeados
   desligados) e o sítio: só a barra de baixo, como sempre; na gaveta o crachá é dos Planeados. */
function calCracha(){
  const n=servicoLigado('recurring')&&sabemosOEstado()?recActive().length:0;
  return {n:n,so:'barra'};
}
registarServico({id:'calendar',vistas:{calendar:'vCalendar'},cracha:{calendar:'calCracha'}});
