/* ================= FORMATO =================
   Como a app escreve o que se lê: dinheiro (milhares com espaço fino, vírgula
   decimal e € no fim), percentagens, datas à portuguesa, NIF, CC, IBAN e
   telefone; o que se escreve à mão lido como número (num); o texto que vai
   para dentro do HTML e de um onclick (esc, jsq); as notas guardadas com o
   HTML do antigo editor rico (rich, richToText); e as datas em hora local
   (today, addDays, dayInMonth) e a pesquisa sem acentos (deacc), que vieram
   dos serviços porque a base também as usa. Nenhuma guarda estado da app
   nem abre janelas. */
/* milhares separados por espaço fino, como pedido */
const SP='\u202F';
// mete o espaço fino de milhares numa string de dígitos (a parte inteira, já em texto).
// Recebe: intStr — a parte inteira do número, já em texto, só com dígitos.
// Devolve: a mesma string com um espaço fino a separar os grupos de milhares.
function grupos(intStr){return intStr.replace(/\B(?=(\d{3})+(?!\d))/g,SP)}
/* valor em euros para mostrar: milhares com espaço fino, vírgula decimal e € no fim.
   dec2 força sempre duas casas; sem dec2 arredonda ao euro inteiro. Os negativos
   levam o sinal de menos tipográfico (−), não o hífen.
   Recebe: v — o valor em euros (número, ou texto convertível; o que não for número conta como 0);
   dec2 — verdadeiro para mostrar sempre duas casas decimais, falso arredonda ao euro inteiro.
   Devolve: o valor formatado em texto, ex.: "1 250,50 €". */
function money(v,dec2){
  const n=Number(v)||0,neg=n<0,a=Math.abs(n);
  const s=dec2?a.toFixed(2):String(Math.round(a));
  const parts=s.split('.');
  return (neg?'−':'')+grupos(parts[0])+(parts[1]?','+parts[1]:'')+SP+'€';
}
/* Um valor em euros arredondado ao euro inteiro, pela regra do money.
   Recebe: v — o valor em euros (número, ou texto convertível).
   Devolve: o texto, ex.: «1 251 €». */
const euro=v=>money(v,false);
/* Um valor em euros sempre com duas casas, pela regra do money.
   Recebe: v — o valor em euros (número, ou texto convertível).
   Devolve: o texto, ex.: «1 250,50 €». */
const euro2=v=>money(v,true);
/* Um IBAN legível: sem espaços, em maiúsculas e em grupos de quatro.
   Recebe: v — o IBAN como foi escrito (aguenta vazio).
   Devolve: o IBAN agrupado (texto); '' sem nada escrito. */
const fmtIBAN=v=>{const t=String(v||'').replace(/\s+/g,'').toUpperCase();
  return t?t.replace(/(.{4})/g,'$1 ').trim():''};

/* Uma data como se escreve em Portugal: 2028-03-15 vira 15/03/2028.

   O ISO fica onde é DADO — na base, nos <input type="date"> (o HTML exige-o e
   o browser já o mostra na forma local), nas comparações e ordenações (a
   comparação de texto só funciona em ISO), nas chaves e no que sai para o
   servidor e para o CSV. Isto é só para o que se lê.

   Devolve vazio para o que não é uma data: uma data por preencher não deve
   escrever «//» nem «NaN» no meio de uma frase.
   Recebe: iso — a data em AAAA-MM-DD (aguenta vazio, nulo e lixo).
   Devolve: a data em dd/mm/aaaa, ou '' se não for uma data. */
const dPT=iso=>{const t=String(iso||'').slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t)?t.slice(8,10)+'/'+t.slice(5,7)+'/'+t.slice(0,4):''};
/* Um NIF legível: os nove dígitos em três grupos de três; o que não tiver nove
   dígitos fica como foi escrito.
   Recebe: v — o NIF (texto ou número; aguenta vazio).
   Devolve: o texto, ex.: «123 456 789». */
const fmtNIF=v=>{const t=String(v||'').replace(/\D/g,'');
  return t.length===9?t.replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3'):String(v||'')};
/* O número do cartão de cidadão legível: os oito dígitos, um espaço e o resto
   (controlo e letras) em maiúsculas; o que não tiver essa forma fica como foi
   escrito.
   Recebe: v — o número como foi escrito (aguenta vazio).
   Devolve: o texto, ex.: «12345678 9ZZ1». */
const fmtCC=v=>{const t=String(v||'').replace(/\s+/g,'').toUpperCase();
  const m=t.match(/^(\d{8})(.+)$/);return m?m[1]+' '+m[2]:String(v||'')};
/* telefone legível: 9 dígitos sem indicativo assumem-se portugueses (+351), o resto
   do número agrupa-se de 3 em 3 a seguir ao indicativo. Vazio se não houver dígitos.
   Recebe: v — o telefone tal como foi escrito (texto; dígitos, espaços e "+" à mistura).
   Devolve: o número formatado em texto, ex.: "+351 912 345 678"; string vazia sem dígitos. */
function fmtPhone(v){
  let t=String(v||'').replace(/[^\d+]/g,'');
  if(!t)return '';
  if(t.indexOf('+')!==0)t=(t.length===9?'+351':'+')+t;
  const cc=t.slice(0,4),rest=t.slice(4).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
  return t.length>9?cc+' '+rest:t;
}

/* texto corrido com marcas legadas */
const RICH_TAGS={B:'b',STRONG:'b',I:'i',EM:'i',S:'s',STRIKE:'s',DEL:'s',U:'u',CODE:'code',PRE:'pre',OL:'ol',UL:'ul',LI:'li',BR:'br',DIV:'div',P:'p'};
/* as marcas inline: uma que fique vazia (só com o marcador invisível que o antigo
   editor rico lá deixava para segurar o cursor) cai */
const INLINE_TAGS={b:1,i:1,s:1,u:1,code:1};
/* limpa HTML vindo de fora: só ficam as marcas que o antigo editor rico criava
   (negrito, listas, parágrafos…), sem atributos, scripts nem estilos; marcas
   inline vazias caem, e o marcador invisível (U+200B) sai.
   Se o DOMParser falhar, devolve o texto todo escapado — nunca HTML por limpar.
   Recebe: html — o HTML a limpar (texto).
   Devolve: HTML seguro (texto) só com as marcas permitidas, pronto a colar na página. */
function sanitizeRich(html){
  let doc;try{doc=new DOMParser().parseFromString('<div>'+html+'</div>','text/html')}catch(e){return esc(html)}
  const walk=node=>{let out='';[].slice.call(node.childNodes).forEach(ch=>{
    if(ch.nodeType===3){out+=esc(ch.nodeValue.replace(/\u200B/g,''));return}
    if(ch.nodeType!==1||ch.tagName==='SCRIPT'||ch.tagName==='STYLE')return;
    const t=RICH_TAGS[ch.tagName];
    if(!t){out+=walk(ch);return}
    if(t==='br'){out+='<br>';return}
    const inner=walk(ch);
    if(INLINE_TAGS[t]&&!inner)return;   /* marca vazia (só tinha o marcador) */
    out+=`<${t}>${inner}</${t}>`;
  });return out};
  return walk(doc.body.firstChild||doc.body);
}
// texto guardado → HTML seguro de apresentação: sanitiza se trouxer marcas; senão escapa e converte \n em <br>.
// Recebe: s — o texto guardado (pode trazer HTML antigo, ou ser texto simples com quebras \n).
// Devolve: HTML seguro (texto) pronto a apresentar.
function rich(s){
  let t=String(s||'');
  if(/<[a-z][^>]*>/i.test(t))return sanitizeRich(t);
  return esc(t).replace(/\n/g,'<br>');
}
/* caixas de texto simples; o que estava guardado com HTML antigo é convertido em texto ao editar
   Recebe: label — o rótulo a mostrar por cima (texto; pode ser vazio); id — o id a dar ao
   <textarea>; value — o texto guardado (pode trazer HTML antigo); ph (opcional) — o
   placeholder ("Escreve aqui…" por omissão).
   Devolve: o HTML do campo (texto): um <label> com o <textarea> lá dentro. */
function richEditor(label,id,value,ph){
  return `<label>${label||''}<textarea id="${id}" placeholder="${esc(ph||'Escreve aqui…')}">${esc(richToText(value||''))}</textarea></label>`;
}
/* HTML antigo → texto simples: itens de lista viram "• ", blocos viram quebras de
   linha, as restantes marcas caem e as entidades são descodificadas. Texto sem
   marcas passa intacto.
   Recebe: s — o texto guardado, com ou sem marcas HTML.
   Devolve: o texto simples equivalente (string), sem marcas e com as entidades descodificadas. */
function richToText(s){
  let t=String(s||'');
  if(!/<[a-z][^>]*>/i.test(t))return t;
  t=t.replace(/<li[^>]*>/gi,'\n• ').replace(/<\/(p|div|li|ul|ol|pre|h\d)>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'');
  const d=document.createElement('textarea');d.innerHTML=t;
  return d.value.replace(/\n{3,}/g,'\n\n').trim();
}
/* conteúdo de um editor, já limpo; vazio se só tiver quebras
   Recebe: id — o id do <textarea> do editor.
   Devolve: o texto lá escrito, aparado (string); vazia se o campo não existir. */
function richVal(id){const e=document.getElementById(id);return e?String(e.value||'').trim():''}

// fração → percentagem com vírgula (0.253 → "25,3%"); d casas decimais (1 por omissão); "—" se não for número.
// Recebe: v — a fração (número; 0.25 é 25%); d (opcional) — quantas casas decimais (1 por omissão).
// Devolve: a percentagem em texto, ex.: "25,3%"; "—" se v não for um número finito.
const pct=(v,d)=>isFinite(v)?(v*100).toFixed(d==null?1:d).replace('.',',')+'%':'—';
/* Um número para mostrar com a vírgula decimal, sem arredondar.
   Recebe: v — o número (ou texto); nulo vale vazio.
   Devolve: o texto com a vírgula no lugar do ponto. */
const dec=v=>String(v==null?'':v).replace('.',',');
/* A soma de uma lista de valores; o que não for número conta 0.
   Recebe: a — a lista de valores (array).
   Devolve: a soma (número). */
const sum=a=>a.reduce((x,y)=>x+(Number(y)||0),0);
/* Texto para colar dentro do HTML: escapa & < > " e '.
   Recebe: s — qualquer valor (nulo e indefinido valem vazio).
   Devolve: o texto escapado (string). */
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
/* texto dentro de uma string JS de uma ação declarada (o data-click de um botão: f('…'))
   Recebe: s — o texto a pôr entre plicas (nulo vale vazio).
   Devolve: o texto com a barra, a plica e as quebras de linha tratadas para a
   string JS, e escapado (esc) para o atributo. */
const jsq=s=>esc(String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' '));
/* O mesmo, para uma ação escrita com setAttribute em vez de ir dentro de HTML:
   trata a barra, a plica e as quebras de linha, e NÃO passa pelo esc(). O
   setAttribute grava o texto tal e qual e o browser não desfaz entidades ao
   ler o atributo — com o jsq, um id com & chegava à função como «a&amp;b» e o
   cartão deixava de responder.
   Recebe: s — o texto a pôr entre plicas (nulo vale vazio).
   Devolve: o texto pronto a entrar entre plicas na ação. */
const jsqBruto=s=>String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');
/* data de hoje em ISO (AAAA-MM-DD) — o formato em que as datas se guardam e comparam.
   Formatada em hora local, nunca pelo toISOString: esse converte para UTC e, à noite
   com horário de verão, dava o dia anterior a cada movimento novo.
   Devolve: a data de hoje em texto "AAAA-MM-DD". */
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const YEAR=new Date().getFullYear();
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
/* As iniciais de um nome, para o avatar: a primeira letra das duas primeiras
   palavras, em maiúsculas.
   Recebe: n — o nome (vazio vale «?»).
   Devolve: uma ou duas letras (texto). */
const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();

/* número escrito à mão → Number: ignora símbolos e decide se as vírgulas e os
   pontos são decimais ou separadores de milhares. Devolve 0 quando não percebe —
   nunca NaN, para as somas não se estragarem.
   Recebe: s — o número escrito à mão (texto; um número a sério passa tal e qual).
   Devolve: o valor como Number; 0 quando não percebe. */
function num(s){
  if(typeof s==='number')return s;
  let t=String(s??'').replace(/[^0-9,.\-]/g,'');
  const lc=t.lastIndexOf(','),ld=t.lastIndexOf('.');
  if(lc>-1&&ld>-1)t=lc>ld?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'');
  else if(lc>-1)t=(t.split(',').length===2&&t.split(',')[1].length<=2)?t.replace(',','.'):t.replace(/,/g,'');
  /* so pontos: um ponto com ate duas casas e decimal (1.5); o resto sao
     milhares (250.000 sao duzentos e cinquenta mil, nao duzentos e cinquenta) */
  else if(ld>-1)t=(t.split('.').length===2&&t.split('.')[1].length<=2)?t:t.replace(/\./g,'');
  const n=parseFloat(t);return isFinite(n)?n:0;
}
/* taxa escrita à mão → Number: numa taxa não há milhares, por isso a vírgula
   e o ponto são SEMPRE decimais. O num() é para dinheiro e lê «0,875» como
   875 (três casas depois do separador são milhares: 250.000 euros), e uma
   TAN de 0,875% virava 875%. Se aparecerem os dois separadores, vale o
   último e o resto ignora-se.
   Recebe: s — a taxa escrita à mão (texto; um número a sério passa tal e qual).
   Devolve: o valor como Number; 0 quando não percebe. */
function numTaxa(s){
  if(typeof s==='number')return s;
  const t=String(s??'').replace(/[^0-9,.\-]/g,'');
  const i=Math.max(t.lastIndexOf(','),t.lastIndexOf('.'));
  const limpo=i<0?t:t.slice(0,i).replace(/[.,]/g,'')+'.'+t.slice(i+1);
  const n=parseFloat(limpo);return isFinite(n)?n:0;
}
/* euro() arredonda; isto mostra os cêntimos quando existem — uma renda de
   512,74 € aparecia «513 €» num cartão e «512,74 €» no movimento ao lado
   Recebe: v — o valor em euros (número).
   Devolve: o texto, com as duas casas só quando há cêntimos. */
const euroS=v=>Math.round(v*100)%100?euro2(v):euro(v);

// Soma n dias a uma data AAAA-MM-DD e devolve no mesmo formato. Em hora local,
// como o nextDate: pelo UTC, meia-noite de verão caía no dia anterior.
// Recebe: iso — data AAAA-MM-DD; n — quantos dias somar (número; negativo recua).
// Devolve: a data resultante em AAAA-MM-DD (texto).
const addDays=(iso,n)=>{const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
// Data AAAA-MM-DD para o dia d do mês m (0-11) de y, preso ao último dia desse mês.
// Recebe: y — ano (número); m — mês 0-11 (número); d — dia pretendido (número).
// Devolve: a data em AAAA-MM-DD (texto), com o dia preso ao último do mês.
function dayInMonth(y,m,d){const last=new Date(y,m+1,0).getDate();return `${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`}
/* pesquisa por palavras e por frases entre aspas, sem ligar a acentos
   Recebe: x — o texto (aguenta vazio).
   Devolve: o texto em minúsculas e sem acentos, pronto a comparar. */
const deacc=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
