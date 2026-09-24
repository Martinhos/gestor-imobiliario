/* ================= GRÁFICOS ================= */
const W=360;
/* dica interativa: funciona a toque e a rato
   Recebe: e — o evento de rato ou de toque, de onde saem as coordenadas (pode
   faltar: a dica cai então a meio do ecrã); txt — o texto a mostrar.
   Devolve: nada — mostra a dica por cima da página durante ~2 segundos. */
function chartTip(e,txt){
  /* num grafico que se le com o dedo, o balao seria uma segunda resposta ao
     mesmo toque — e logo a que se queria substituir. Cala-se ali e continua a
     servir onde nao ha leitor: o donut e as barras horizontais. */
  try{if(e&&e.target&&e.target.closest&&e.target.closest('.chartbox[data-lido]'))return}catch(x){}
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
/* Atraso da entrada de uma forma do gráfico, pelo seu lugar na fila.

   O orçamento é sempre o mesmo — 150ms entre a primeira e a última, porque um
   gráfico não pode demorar mais a desenhar-se do que a ser lido — e reparte-se
   por TODAS as formas. Antes eram seis degraus de 30ms e depois parava: com
   doze colunas, metade do gráfico subia em onda e a outra metade saltava toda
   junta no fim, e via-se — o lado direito comportava-se de outra maneira.
   O degrau nunca passa de 30ms, para uma lista curta não ficar preguiçosa.

   Vai escrito em cada forma porque em SVG as barras são irmãs dos elementos do
   eixo — um nth-child contava-os a eles também.
   Recebe: i — o índice da forma (0 é a primeira); n — quantas formas há ao
   todo (com menos de 2 não há onda nenhuma).
   Devolve: os milissegundos do atraso, em texto, para o data-atraso que o
   web/app/estilos-calculados.js passa a animation-delay no el.style; '' para
   a primeira, que não espera nada. */
const atrasoEntrada=(i,n)=>{
  if(!i||!(n>1))return '';
  return `${Math.round(i*Math.min(30,150/(n-1)))}`;
};

/* ================= LER COM O DEDO =================
   Um grafico que se le arrastando, em vez de um balao que foge.

   O balao (chartTip) aparecia debaixo do dedo e ia-se embora ao fim de 2,2s:
   a mao tapava o que se queria ler, o valor desaparecia antes de se poder
   comparar com o do lado, e ver outro mes obrigava a outro toque com o
   primeiro ja esquecido.

   Aqui o dedo percorre o grafico, uma guia acompanha a coluna mais proxima e
   os valores dessa coluna aparecem numa faixa FIXA no topo — no sitio onde a
   mao nao esta, e sem sair enquanto o dedo nao sair. A faixa e sobreposta:
   um grafico nao muda de altura so por alguem lhe tocar. */

/* Uma frase que diz o que o grafico mostra, para quem nao o ve.

   E a outra metade do que a divida das «paragens do Tab» pedia: em vez de
   vinte e quatro formas alcancaveis uma a uma e sem destino, o desenho tem uma
   descricao so.
   Recebe: titulo — o que o grafico mostra; labels — as etiquetas do eixo.
   Devolve: o atributo aria-label pronto a colar na tag do <svg>. */
function descricaoDoGrafico(titulo,labels){
  const n=(labels||[]).length;
  if(!n)return '';
  return ` aria-label="${esc(titulo+', de '+labels[0]+' a '+labels[n-1]+'. Percorre com o dedo para ler cada valor.')}"`;
}

/* O que o leitor precisa de saber sobre um grafico, guardado no proprio
   elemento para nao haver estado a viver noutro sitio.

   Guardam-se as POSICOES de cada coluna, e nao os limites do desenho. Chegou a
   guardar os limites, e a guia calculava o resto com a formula do grafico de
   linhas — onde os pontos se espalham de ponta a ponta. Num histograma as
   colunas ficam no meio de faixas iguais, que e outra conta, e a guia aparecia
   ao lado da coluna. Cada grafico ja sabe onde poe as suas colunas: passa-as.
   Guardam-se os valores JA ESCRITOS, e nao os numeros. A faixa escrevia tudo
   em euros, e o LTV e o «Sobre a aquisicao» sao racios: euro(0,42) arredonda
   para «0 €», e a leitura dizia zero em todos os pontos de um grafico que
   claramente nao dizia zero. Quem desenha e o unico que sabe se aquilo sao
   euros, uma percentagem ou uma contagem — e a funcao de formatar nao pode
   viajar, porque isto vai dentro de um atributo do HTML.
   Recebe: labels — as etiquetas do eixo; series — [{nome,cor,vals}]; xs — a
   posicao de cada coluna, em unidades do viewBox; fmt (opcional) — como
   escrever um valor, o mesmo que o grafico usa no eixo.
   Devolve: o atributo data-lido pronto a colar na tag, ou '' sem series. */
function dadosParaLer(labels,series,xs,fmt){
  if(!labels||!labels.length||!series||!series.length||!xs||!xs.length)return '';
  const F=fmt||euro;
  const escreve=v=>{try{return String(F(+v||0))}catch(e){return String(euro(+v||0))}};
  const d={W:W,xs:xs.map(x=>+x.toFixed(1)),rot:labels,
    s:series.map(x=>({n:x.nome||'',c:x.cor||'',v:(x.vals||[]).map(escreve)}))};
  return ` data-lido="${esc(JSON.stringify(d))}"`;
}

/* Onde e que o dedo esta, em indice de coluna.
   Recebe: caixa — o .chartbox; d — os dados guardados; cx — o x do ponteiro em
   pixeis do ecra.
   Devolve: o indice da coluna mais proxima, dentro dos limites. */
function colunaSobODedo(caixa,d,cx){
  const r=caixa.getBoundingClientRect();
  if(!r.width)return 0;
  const vx=(cx-r.left)/r.width*d.W;                 // pixeis do ecra -> unidades do desenho
  /* a mais proxima, e nao uma conta sobre os limites: as colunas de um
     histograma nao estao onde os pontos de uma linha estariam */
  let melhor=0,dist=Infinity;
  (d.xs||[]).forEach(function(x,i){const p=Math.abs(x-vx);if(p<dist){dist=p;melhor=i}});
  return melhor;
}

/* Mostra a coluna que o dedo escolheu: a guia e a faixa.
   Recebe: caixa — o .chartbox; i — o indice da coluna.
   Devolve: nada — mexe na guia e na faixa dentro da caixa. */
function mostrarColuna(caixa,i){
  let d;try{d=JSON.parse(caixa.getAttribute('data-lido')||'')}catch(e){return}
  if(!d)return;
  let guia=caixa.querySelector('.chartguia'),faixa=caixa.querySelector('.chartlido');
  if(!guia){guia=document.createElement('i');guia.className='chartguia';caixa.appendChild(guia)}
  if(!faixa){faixa=document.createElement('div');faixa.className='chartlido';caixa.appendChild(faixa)}
  const x=(d.xs||[])[i];
  if(x==null)return;
  guia.style.left=(x/d.W*100).toFixed(2)+'%';
  faixa.innerHTML=`<b>${esc(d.rot[i]||'')}</b>`+d.s.map(x=>
    `<span><i data-fundo="${esc(x.c)}"></i>${x.n?esc(x.n)+' ':''}${esc(String(x.v[i]==null?'':x.v[i]))}</span>`).join('');
  caixa.classList.add('a-ler');
}

/* Larga a leitura: a guia e a faixa saem, e o grafico volta ao que era.
   Recebe: caixa — o .chartbox (com null nao faz nada).
   Devolve: nada. */
function largarLeitura(caixa){
  if(caixa)caixa.classList.remove('a-ler');
}

/* Os gestos de ler, registados uma vez no documento: os graficos nascem e
   morrem a cada repintura, e ouvintes pendurados neles morriam com eles. */
document.addEventListener('pointerdown',function(e){
  const caixa=e.target.closest&&e.target.closest('.chartbox[data-lido]');
  if(!caixa)return;
  /* o gesto passa a ser da caixa do princípio ao fim: sem isto, o ponteiro
     anda a saltar de forma em forma e há quem lhe queira pegar pelo caminho */
  try{caixa.setPointerCapture(e.pointerId)}catch(x){}
  mostrarColuna(caixa,colunaSobODedo(caixa,JSON.parse(caixa.getAttribute('data-lido')),e.clientX));
},true);
/* segurar num gráfico é ler, não é pedir um menu */
document.addEventListener('contextmenu',function(e){
  if(e.target&&e.target.closest&&e.target.closest('.chartbox[data-lido]'))e.preventDefault();
});
document.addEventListener('pointermove',function(e){
  const caixa=document.querySelector('.chartbox.a-ler[data-lido]');
  if(!caixa||e.buttons===0&&e.pointerType!=='touch')return;
  mostrarColuna(caixa,colunaSobODedo(caixa,JSON.parse(caixa.getAttribute('data-lido')),e.clientX));
},true);
/* Só o dedo a levantar acaba a leitura. O pointerleave saiu da lista: ouvido
   em captura no documento, dispara ao passar de uma barra para a seguinte
   DENTRO do próprio gráfico, e a leitura piscava a meio do arrasto. */
['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,function(){
  largarLeitura(document.querySelector('.chartbox.a-ler'));
},true));

/* mostra no máximo ~13 etiquetas para não ficarem ilegíveis
   Recebe: labels — array das etiquetas (strings) do eixo X.
   Devolve: novo array do mesmo tamanho, com '' nas posições que se escondem
   (alinhado ao fim: a última etiqueta aparece sempre). */
function thinLabels(labels){
  const n=labels.length,step=Math.ceil(n/13);
  if(step<=1)return labels.slice();
  return labels.map((l,i)=>((n-1-i)%step===0)?l:'');   /* alinhado ao último: o fim aparece sempre */
}
/* Um valor do eixo, curto: os milhares em «k» (1,5k; 12k) e o resto arredondado.
   Recebe: v — o número.
   Devolve: o texto. */
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
      if(s.values.length<=26)g+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" fill="var(--card)" stroke="${c}" stroke-width="1.8"><title>${esc(tip)}</title></circle>`;
    });
  });
  /* rótulos do eixo X no próprio SVG, alinhados com os pontos (a régua HTML ficava desalinhada) */
  thinLabels(labels).forEach((l,i)=>{
    if(l==='')return;
    g+=`<text x="${X(i).toFixed(1)}" y="${h+8}" font-size="9" fill="var(--muted)" text-anchor="middle">${esc(l)}</text>`;
  });
  return `<div class="chartbox"${dadosParaLer(labels,series.map((s,i)=>({nome:series.length>1?s.name:'',cor:s.color||PAL[i%PAL.length],vals:s.values})),labels.map((_,i)=>X(i)),F)}><svg viewBox="0 0 ${W} ${h+13}" role="img"${descricaoDoGrafico(o.titulo||'Evolução',labels)}>${g}</svg></div>
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
  /* conta as colunas que chegam a desenhar alguma coisa, e não os meses: num
     ano com uma só despesa em dezembro, o índice do grupo dava-lhe o último
     degrau e a barra ficava 150ms invisível à espera de nada */
  let col=0;
  const colunas=groups.filter(g=>g.some(s=>s.value)).length;
  groups.forEach((grp,i)=>{
    const cx=x0+bw*i+bw/2;let up=0,dn=0;
    /* o atraso é da coluna e não do segmento: as parcelas de uma mesma coluna
       sobem juntas, senão a barra empilhada crescia aos bocados */
    const atraso=grp.some(s=>s.value)?atrasoEntrada(col++,colunas):'';
    grp.forEach(seg=>{
      if(!seg.value)return;
      const a=seg.value>0?up:dn,b=a+seg.value;
      if(seg.value>0)up=b;else dn=b;
      const ya=Y(Math.max(a,b)),yb=Y(Math.min(a,b));
      const tip=`${labels[i]} · ${seg.label}: ${euro(Math.abs(seg.value))}`;
      /* «desce» = está abaixo da linha do zero, e por isso cresce a partir do
         TOPO. Sem isto crescia a partir do fundo do gráfico para cima, solta
         do eixo, e só assentava no fim (index.html:.gbar.desce). */
      /* sem onclick: quem le o valor e o dedo a percorrer o grafico, e cada
         forma com um toque proprio era mais uma paragem do Tab sem destino */
      g+=`<rect class="gbar${seg.value<0?' desce':''}" x="${(cx-w/2).toFixed(1)}" y="${ya.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1,yb-ya).toFixed(1)}" rx="2" fill="${seg.color}"${atraso?` data-atraso="${atraso}"`:''}><title>${esc(tip)}</title></rect>`;
    });
  });
  const names=[];groups.forEach(g2=>g2.forEach(s=>{if(!names.some(n=>n.label===s.label))names.push({label:s.label,color:s.color})}));
  thinLabels(labels).forEach((l,i)=>{
    if(l==='')return;
    g+=`<text x="${(x0+bw*i+bw/2).toFixed(1)}" y="${h+8}" font-size="9" fill="var(--muted)" text-anchor="middle">${esc(l)}</text>`;
  });
  return `<div class="chartbox"${dadosParaLer(labels,names.map(nm=>({nome:nm.label,cor:nm.color,
    vals:groups.map(gr=>sum(gr.filter(x=>x.label===nm.label).map(x=>x.value)))})),groups.map((_,i)=>x0+bw*i+bw/2),o.fmt)}><svg viewBox="0 0 ${W} ${h+13}" role="img"${descricaoDoGrafico(o.titulo||'Entradas e saídas',labels)}>${g}</svg></div>${legend(names,false)}`;
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
    if(ang>=Math.PI*2-1e-6){g+=`<circle class="gdonut${o.onPick?' u-cur-pointer':''}" pathLength="1" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${col}" stroke-width="${th}" ${o.onPick?`data-toca="vista" data-click="${o.onPick}('${jsq(it.label)}')"`:''}/>`;return}
    const b=a+ang,L=ang>Math.PI?1:0;
    const tip=`${it.label}: ${euro(it.value)} (${pct(it.value/tot,0)})`;
    /* Sem balao: a legenda ao lado ja tem o rotulo, o valor e a percentagem
       de cada fatia, e o balao repetia-o a roubar o toque — que aqui tem uma
       acao a serio, entrar na categoria. E cada fatia com onclick era mais uma
       paragem do Tab que nao leva a lado nenhum. */
    const act=o.onPick?`data-toca="vista" data-click="${o.onPick}('${jsq(it.label)}')"`:'';
    g+=`<path class="gdonut${o.onPick?' u-cur-pointer':''}" pathLength="1" d="M${(c+r*Math.cos(a)).toFixed(2)} ${(c+r*Math.sin(a)).toFixed(2)} A${r} ${r} 0 ${L} 1 ${(c+r*Math.cos(b)).toFixed(2)} ${(c+r*Math.sin(b)).toFixed(2)}" fill="none" stroke="${col}" stroke-width="${th}" ${act}><title>${esc(tip)}</title></path>`;
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
  /* Sem balao: cada linha ja tem o nome e o valor escritos por cima da barra.
     O balao repetia-os, e o onclick que o trazia fazia de cada linha uma
     paragem do Tab sem destino. */
  return `<div class="legend u-g-11px">${items.map((it,i)=>{
    const neg=it.value<0,col=it.color||(neg?'var(--danger)':PAL[i%PAL.length]);
    return `<div><div class="li u-mb-4px"><span class="nm u-c-v-ink">${esc(it.label)}</span>
      <span class="vl ${neg?'neg':''}">${o.fmt?o.fmt(it.value):euro(it.value)}</span></div>
      <div class="u-h-8px u-br-99px u-bg-v-chip u-ov-hidden">
      <i class="ghbar u-d-block u-h-100pc u-br-99px" data-largura="${(Math.abs(it.value)/max*100).toFixed(1)}" data-fundo="${col}" data-atraso="${atrasoEntrada(i,items.length)}"></i></div></div>`}).join('')}</div>`;
}
// Legenda com bolinha de cor. withVal acrescenta valor e percentagem; itens com "act" ficam clicáveis.
// Recebe: items — array de {label, color} e, conforme o caso, value (texto já
// formatado), extra (a percentagem) e act (o código a correr ao tocar);
// withVal — verdadeiro para mostrar value e extra.
// Devolve: HTML (string) da legenda.
function legend(items,withVal){
  return `<div class="legend">${items.map(i=>`<div class="li ${i.act?'tap':''}" ${i.act?`data-toca="vista" data-click="${i.act}"`:''}><span class="dot" data-fundo="${i.color}"></span>
    <span class="nm">${esc(i.label)}</span>${withVal?`<span class="vl">${i.value||''}</span>${i.extra?`<span class="small u-minw-38px u-ta-right">${i.extra}</span>`:''}`:''}</div>`).join('')}</div>`;
}
