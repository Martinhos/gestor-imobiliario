/* ================= GRÁFICOS ================= */
const W=360;
/* dica interativa: funciona a toque e a rato
   Recebe: e — o evento de rato ou de toque, de onde saem as coordenadas (pode
   faltar: a dica cai então a meio do ecrã); txt — o texto a mostrar.
   Devolve: nada — mostra a dica por cima da página durante ~2 segundos. */
function chartTip(e,txt){
  const t=document.getElementById('tip');if(!t)return;
  t.textContent=txt;t.classList.add('on');
  const x=(e&&(e.clientX||(e.touches&&e.touches[0]&&e.touches[0].clientX)))||window.innerWidth/2;
  const y=(e&&(e.clientY||(e.touches&&e.touches[0]&&e.touches[0].clientY)))||120;
  /* mede e encosta às margens em vez de sair do ecrã */
  t.style.left='0px';t.style.top='0px';
  const w=t.offsetWidth,h=t.offsetHeight;
  const left=Math.max(8,Math.min(window.innerWidth-w-8,x-w/2));
  let top=y-h-14;if(top<8)top=y+18;
  t.style.left=left+'px';t.style.top=top+'px';
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),2200);
  if(e&&e.stopPropagation)e.stopPropagation();
}
const hit=txt=>{const j=jsq(txt);return `onclick="chartTip(event,'${j}')" onmouseenter="chartTip(event,'${j}')" style="cursor:pointer"`};
/* mostra no máximo ~13 etiquetas para não ficarem ilegíveis
   Recebe: labels — array das etiquetas (strings) do eixo X.
   Devolve: novo array do mesmo tamanho, com '' nas posições que se escondem
   (alinhado ao fim: a última etiqueta aparece sempre). */
function thinLabels(labels){
  const n=labels.length,step=Math.ceil(n/13);
  if(step<=1)return labels.slice();
  return labels.map((l,i)=>((n-1-i)%step===0)?l:'');   /* alinhado ao último: o fim aparece sempre */
}
const kfmt=v=>Math.abs(v)>=1000?(v/1000).toFixed(Math.abs(v)>=10000?0:1).replace('.',',')+'k':String(Math.round(v));
// Grelha e valores do eixo Y: 5 marcas de min a max, formatadas com fmt (ou kfmt).
// Recebe: min, max — os valores dos extremos do eixo; x0, x1 — os limites
// horizontais da área do gráfico (unidades do viewBox); y0, y1 — os verticais
// (y0 em cima, y1 na base); fmt (opcional) — função que formata cada valor
// (sem ela usa-se kfmt).
// Devolve: o fragmento SVG (string) que os gráficos de linhas e de barras partilham.
function axisY(min,max,x0,x1,y0,y1,fmt){
  let g='';
  for(let k=0;k<=4;k++){const v=min+(max-min)*k/4,y=y1-(y1-y0)*k/4;
    g+=`<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x1}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`;
    g+=`<text x="${x0-6}" y="${(y+3.2).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--muted)">${fmt?esc(fmt(v)):kfmt(v)}</text>`}
  return g;
}
/* Gráfico de linhas com área sombreada e dica em cada ponto. series=[{name,values,color}],
   labels no eixo X; o: h (altura), fmt (formatação dos valores, por omissão euro),
   area:false tira o sombreado, marks=[{i,label}] põe linhas verticais de referência.
   Substitui valores não finitos por 0 (mexe nos arrays recebidos).
   Recebe: series — array de séries {name, values, color} (values em números;
   color opcional, sai da paleta); labels — etiquetas do eixo X, uma por ponto;
   o (opcional) — as opções h, fmt, area e marks descritas acima.
   Devolve: HTML pronto a inserir; com mais de uma série acrescenta a legenda
   por baixo. */
function cLine(series,labels,o){
  o=o||{};const h=o.h||180,x0=44,x1=W-6,y0=10,y1=h-8,F=o.fmt||euro;
  series.forEach(s=>{s.values=s.values.map(v=>isFinite(v)?v:0)});
  const all=[].concat(...series.map(s=>s.values));
  let max=Math.max(0,...all),min=Math.min(0,...all);
  if(max===min){max=max||1;min=Math.min(0,min)}
  const pad=(max-min)*.08;max+=pad;if(min<0)min-=pad;
  const X=i=>x0+(x1-x0)*(labels.length<2?.5:i/(labels.length-1));
  const Y=v=>y1-(y1-y0)*((v-min)/(max-min));
  let g=axisY(min,max,x0,x1,y0,y1,o.fmt);
  /* barras verticais no início de cada década */
  (o.marks||[]).forEach(m=>{
    if(m.i<0||m.i>=labels.length)return;
    g+=`<line x1="${X(m.i).toFixed(1)}" y1="${y0}" x2="${X(m.i).toFixed(1)}" y2="${y1}" stroke="var(--line2)" stroke-width="1" stroke-dasharray="3 3"/>`;
    g+=`<text x="${(X(m.i)+3).toFixed(1)}" y="${(y0+8).toFixed(1)}" font-size="8.5" fill="var(--muted)">${esc(m.label)}</text>`;
  });
  if(min<0)g+=`<line x1="${x0}" y1="${Y(0).toFixed(1)}" x2="${x1}" y2="${Y(0).toFixed(1)}" stroke="var(--line2)"/>`;
  series.forEach((s,si)=>{
    const c=s.color||PAL[si%PAL.length];
    const pts=s.values.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    if(o.area!==false)g+=`<polygon points="${X(0).toFixed(1)},${Y(Math.max(min,0)).toFixed(1)} ${pts} ${X(s.values.length-1).toFixed(1)},${Y(Math.max(min,0)).toFixed(1)}" fill="${c}" opacity=".12"/>`;
    g+=`<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.values.forEach((v,i)=>{
      const tip=`${labels[i]}${series.length>1?' · '+s.name:''}: ${F(v)}`;
      if(s.values.length<=26)g+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" fill="var(--card)" stroke="${c}" stroke-width="1.8"/>`;
      g+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="10" fill="transparent" ${hit(tip)}><title>${esc(tip)}</title></circle>`;
    });
  });
  /* rótulos do eixo X no próprio SVG, alinhados com os pontos (a régua HTML ficava desalinhada) */
  thinLabels(labels).forEach((l,i)=>{
    if(l==='')return;
    g+=`<text x="${X(i).toFixed(1)}" y="${h+8}" font-size="9" fill="var(--muted)" text-anchor="middle">${esc(l)}</text>`;
  });
  return `<div class="chartbox"><svg viewBox="0 0 ${W} ${h+13}" role="img">${g}</svg></div>
    ${series.length>1?legend(series.map((s,i)=>({label:s.name,color:s.color||PAL[i%PAL.length]})),false):''}`;
}
/* Barras empilhadas: cada grupo é um array de segmentos {label,value,color}, com os
   positivos a empilhar para cima e os negativos para baixo (rendas contra despesas).
   Recebe: groups — array de grupos, cada um o tal array de segmentos {label,
   value, color} (value em euros; negativo empilha para baixo); labels —
   etiquetas do eixo X, uma por grupo; o (opcional) — h é a altura do gráfico.
   Devolve: HTML; a legenda junta-se a partir das etiquetas que aparecem nos segmentos. */
function cBars(groups,labels,o){
  o=o||{};const h=o.h||190,x0=44,x1=W-6,y0=10,y1=h-8;
  const tops=groups.map(g=>sum(g.filter(v=>v.value>0).map(v=>v.value)));
  const bots=groups.map(g=>sum(g.filter(v=>v.value<0).map(v=>v.value)));
  const max=Math.max(1,...tops),min=Math.min(0,...bots);
  const Y=v=>y1-(y1-y0)*((v-min)/(max-min));
  const bw=(x1-x0)/groups.length,w=Math.max(3,bw*.6);
  let g=axisY(min,max,x0,x1,y0,y1);
  g+=`<line x1="${x0}" y1="${Y(0).toFixed(1)}" x2="${x1}" y2="${Y(0).toFixed(1)}" stroke="var(--line2)"/>`;
  groups.forEach((grp,i)=>{
    const cx=x0+bw*i+bw/2;let up=0,dn=0;
    grp.forEach(seg=>{
      if(!seg.value)return;
      const a=seg.value>0?up:dn,b=a+seg.value;
      if(seg.value>0)up=b;else dn=b;
      const ya=Y(Math.max(a,b)),yb=Y(Math.min(a,b));
      const tip=`${labels[i]} · ${seg.label}: ${euro(Math.abs(seg.value))}`;
      g+=`<rect class="gbar" x="${(cx-w/2).toFixed(1)}" y="${ya.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1,yb-ya).toFixed(1)}" rx="2" fill="${seg.color}" ${hit(tip)}><title>${esc(tip)}</title></rect>`;
    });
  });
  const names=[];groups.forEach(g2=>g2.forEach(s=>{if(!names.some(n=>n.label===s.label))names.push({label:s.label,color:s.color})}));
  thinLabels(labels).forEach((l,i)=>{
    if(l==='')return;
    g+=`<text x="${(x0+bw*i+bw/2).toFixed(1)}" y="${h+8}" font-size="9" fill="var(--muted)" text-anchor="middle">${esc(l)}</text>`;
  });
  return `<div class="chartbox"><svg viewBox="0 0 ${W} ${h+13}" role="img">${g}</svg></div>${legend(names,false)}`;
}
/* Anel de proporções com o total ao centro. items=[{label,value,color}] — valores ≤ 0
   ficam de fora. o: center substitui o texto central, sub é a linha pequena por baixo,
   onPick é o nome de uma função global chamada com a etiqueta da fatia (ou da legenda)
   em que se toca.
   Recebe: items — array de fatias {label, value, color} (value numérico; color
   opcional, sai da paleta); o (opcional) — as opções center, sub e onPick acima.
   Devolve: HTML com a legenda ao lado; "Sem dados." quando o total é zero. */
function cDonut(items,o){
  o=o||{};const S=150,th=26,r=(S-th)/2,c=S/2;
  items=items.filter(i=>i.value>0);
  const tot=sum(items.map(i=>i.value));
  if(!tot)return `<div class="hint">Sem dados.</div>`;
  let a=-Math.PI/2,g='';
  items.forEach((it,idx)=>{
    const col=it.color||PAL[idx%PAL.length],ang=it.value/tot*Math.PI*2;
    if(ang>=Math.PI*2-1e-6){g+=`<circle class="gdonut" pathLength="1" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${col}" stroke-width="${th}" ${o.onPick?`onclick="${o.onPick}('${jsq(it.label)}')" style="cursor:pointer"`:''}/>`;return}
    const b=a+ang,L=ang>Math.PI?1:0;
    const tip=`${it.label}: ${euro(it.value)} (${pct(it.value/tot,0)})`;
    const act=o.onPick?`onclick="${o.onPick}('${jsq(it.label)}')" onmouseenter="chartTip(event,'${jsq(tip)}')" style="cursor:pointer"`:hit(tip);
    g+=`<path class="gdonut" pathLength="1" d="M${(c+r*Math.cos(a)).toFixed(2)} ${(c+r*Math.sin(a)).toFixed(2)} A${r} ${r} 0 ${L} 1 ${(c+r*Math.cos(b)).toFixed(2)} ${(c+r*Math.sin(b)).toFixed(2)}" fill="none" stroke="${col}" stroke-width="${th}" ${act}><title>${esc(tip)}</title></path>`;
    a=b;
  });
  g+=`<text x="${c}" y="${c-1}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">${o.center||euro(tot)}</text>`;
  if(o.sub)g+=`<text x="${c}" y="${c+13}" text-anchor="middle" font-size="8.5" fill="var(--muted)">${esc(o.sub)}</text>`;
  return `<div class="donut">
    <div class="chartbox pie"><svg viewBox="0 0 ${S} ${S}" role="img">${g}</svg></div>
    <div class="leg">${legend(items.map((it,i)=>({label:it.label,color:it.color||PAL[i%PAL.length],value:euro(it.value),extra:pct(it.value/tot,0),
      act:o.onPick?`${o.onPick}('${jsq(it.label)}')`:''})),true)}</div></div>`;
}
// Barras horizontais em HTML puro (sem SVG): uma linha por item, com a largura
// proporcional ao maior valor absoluto e os negativos a vermelho. o.fmt formata os valores.
// Recebe: items — array de {label, value, color} (value numérico; color opcional);
// o (opcional) — fmt é a função que formata os valores (por omissão euro).
// Devolve: HTML (string) com as barras — ou "Sem dados." se a lista vier vazia.
function cHBars(items,o){
  o=o||{};if(!items.length)return `<div class="hint">Sem dados.</div>`;
  const max=Math.max(...items.map(i=>Math.abs(i.value)))||1;
  return `<div class="legend" style="gap:11px">${items.map((it,i)=>{
    const neg=it.value<0,col=it.color||(neg?'var(--danger)':PAL[i%PAL.length]);
    return `<div ${hit(it.label+': '+(o.fmt?o.fmt(it.value):euro(it.value)))}><div class="li" style="margin-bottom:4px"><span class="nm" style="color:var(--ink)">${esc(it.label)}</span>
      <span class="vl ${neg?'neg':''}">${o.fmt?o.fmt(it.value):euro(it.value)}</span></div>
      <div style="height:8px;border-radius:99px;background:var(--chip);overflow:hidden">
      <i class="ghbar" style="display:block;height:100%;width:${(Math.abs(it.value)/max*100).toFixed(1)}%;background:${col};border-radius:99px"></i></div></div>`}).join('')}</div>`;
}
// Legenda com bolinha de cor. withVal acrescenta valor e percentagem; itens com "act" ficam clicáveis.
// Recebe: items — array de {label, color} e, conforme o caso, value (texto já
// formatado), extra (a percentagem) e act (o código a correr ao tocar);
// withVal — verdadeiro para mostrar value e extra.
// Devolve: HTML (string) da legenda.
function legend(items,withVal){
  return `<div class="legend">${items.map(i=>`<div class="li ${i.act?'tap':''}" ${i.act?`onclick="${i.act}"`:''}><span class="dot" style="background:${i.color}"></span>
    <span class="nm">${esc(i.label)}</span>${withVal?`<span class="vl">${i.value||''}</span>${i.extra?`<span class="small" style="min-width:38px;text-align:right">${i.extra}</span>`:''}`:''}</div>`).join('')}</div>`;
}
