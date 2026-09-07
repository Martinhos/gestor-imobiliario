/* ================= AUXILIARES ================= */
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
const euro=v=>money(v,false);
const euro2=v=>money(v,true);
const fmtIBAN=v=>{const t=String(v||'').replace(/\s+/g,'').toUpperCase();
  return t?t.replace(/(.{4})/g,'$1 ').trim():''};
const fmtNIF=v=>{const t=String(v||'').replace(/\D/g,'');
  return t.length===9?t.replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3'):String(v||'')};
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
/* HTML vindo do editor: fica só com as marcas que a interface cria, sem atributos */
const ZW='\u200B';   /* marcador invisível que segura o cursor dentro de um <b>/<i>/<s> vazio */
const INLINE_TAGS={b:1,i:1,s:1,u:1,code:1};
/* limpa HTML vindo de fora: só ficam as marcas que o editor cria (negrito, listas,
   parágrafos…), sem atributos, scripts nem estilos; marcas inline vazias caem.
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
/* Não usa <label>: uma caixa contenteditable dentro de um <label> faz o toque
   ativar o primeiro botão da barra em vez de dar foco ao texto. */
/* A barra trata o toque ela própria (touchstart com preventDefault): assim o editor não
   perde o foco nem a seleção quando se carrega num botão, que era o que fazia o
   negrito/itálico/rasurado não fazerem nada no telemóvel. */
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
// touchstart na barra do editor: executa o comando do botão tocado sem deixar o editor perder o foco.
// Recebe: e — o evento touchstart vindo da barra de ferramentas do editor.
// Devolve: nada — executa o comando do botão tocado (via richCmd).
function richTouch(e){
  const btn=e.target&&e.target.closest?e.target.closest('button'):null;
  if(!btn)return;
  e.preventDefault();   /* sem isto o editor perdia o foco antes do clique chegar */
  richCmd(btn.getAttribute('data-cmd'),btn.getAttribute('data-arg')||'',btn.closest('.rich-editor'));
}
/* guarda a última seleção dentro de um editor, para o caso de o foco se perder na mesma */
let richLast=null;
document.addEventListener('selectionchange',()=>{
  try{const s=document.getSelection();if(!s||!s.rangeCount)return;const r=s.getRangeAt(0);
    const n=r.startContainer,el=n.nodeType===1?n:n.parentNode,host=el&&el.closest?el.closest('.rich-content'):null;
    if(!host)return;
    /* uma seleção que colapsa por causa de um toque na barra não substitui a que tinha texto */
    if(r.collapsed&&richLast&&richLast.host===host&&!richLast.range.collapsed&&Date.now()-richLast.at<600)return;
    richLast={host,range:r.cloneRange(),at:Date.now()};
    richState(host);
  }catch(e){}
});
const RICH_INLINE={bold:['B','STRONG'],italic:['I','EM'],strikeThrough:['S','STRIKE','DEL']};
/* o editor onde um comando da barra deve atuar: o que tem o foco, ou o da última
   seleção guardada (que é reposta), ou, em último recurso, o do modal de cima com o
   cursor no fim. Devolve a caixa .rich-content já focada, ou null se não houver.
   Recebe: editor (opcional) — o elemento .rich-editor a que o comando se destina; sem ele serve qualquer editor.
   Devolve: o elemento .rich-content já focado, ou null se não houver nenhum. */
function richHost(editor){
  let e=document.activeElement;
  if(e&&e.classList&&e.classList.contains('rich-content')&&(!editor||editor.contains(e)))return e;
  const want=editor?editor.querySelector('.rich-content'):null;
  if(richLast&&document.body.contains(richLast.host)&&(!want||richLast.host===want)){
    e=richLast.host;e.focus();
    try{const s=document.getSelection();s.removeAllRanges();s.addRange(richLast.range)}catch(x){}
    return e;
  }
  e=want||(modalTop()?modalTop().el.querySelector('.rich-content'):null);
  if(e){e.focus();try{const s=document.getSelection(),r=document.createRange();r.selectNodeContents(e);r.collapse(false);s.removeAllRanges();s.addRange(r)}catch(x){}}
  return e;
}
/* com o cursor apenas pousado (sem texto selecionado), o teclado do telemóvel ignora o
   "estilo pendente" do execCommand; por isso criamos a marca com um marcador invisível
   e pomos o cursor lá dentro — o que se escrever a seguir fica formatado
   Recebe: host — a caixa .rich-content onde o cursor está; cmd — o comando inline
   ('bold', 'italic' ou 'strikeThrough').
   Devolve: true se tratou o caso (marca criada, ou cursor posto fora da atual); false sem seleção. */
function toggleInline(host,cmd){
  const s=document.getSelection();if(!s||!s.rangeCount)return false;
  const r=s.getRangeAt(0),tags=RICH_INLINE[cmd];
  let n=r.startContainer,cur=null;
  for(let x=n.nodeType===1?n:n.parentNode;x&&x!==host;x=x.parentNode){if(tags.indexOf(x.tagName)>-1){cur=x;break}}
  const zw=document.createTextNode(ZW),nr=document.createRange();
  if(cur){cur.parentNode.insertBefore(zw,cur.nextSibling)}
  else{const el=document.createElement(tags[0].toLowerCase());el.appendChild(zw);r.insertNode(el)}
  nr.setStart(zw,1);nr.collapse(true);s.removeAllRanges();s.addRange(nr);
  return true;
}
// aplica um comando de formatação (execCommand) no editor certo, dispara "input"
// para quem estiver a gravar alterações e atualiza o realce da barra.
// Recebe: cmd — o comando do execCommand (ex.: 'bold', 'insertUnorderedList'); arg — o argumento
// do comando (texto; vazio quando não é preciso); editor (opcional) — o .rich-editor onde atuar.
// Devolve: nada — aplica a formatação no editor e atualiza a barra.
function richCmd(cmd,arg,editor){
  const e=richHost(editor);if(!e)return;
  const s=document.getSelection(),collapsed=!s||!s.rangeCount||s.getRangeAt(0).collapsed;
  try{document.execCommand(cmd,false,arg||null)}catch(x){}
  e.dispatchEvent(new Event('input',{bubbles:true}));
  richState(e);
}
/* realça na barra o que está ativo onde o cursor está
   Recebe: host — a caixa .rich-content cuja barra se vai atualizar.
   Devolve: nada — liga/desliga a classe .on nos botões da barra. */
function richState(host){
  const box=host&&host.closest?host.closest('.rich-editor'):null;if(!box)return;
  [].slice.call(box.querySelectorAll('.rich-tools button')).forEach(b=>{
    const cmd=b.getAttribute('data-cmd');let on=false;
    try{on=cmd==='formatBlock'?/pre/i.test(document.queryCommandValue('formatBlock')||''):document.queryCommandState(cmd)}catch(x){}
    b.classList.toggle('on',!!on);
  });
}
/* conteúdo de um editor, já limpo; vazio se só tiver quebras
   Recebe: id — o id do <textarea> do editor.
   Devolve: o texto lá escrito, aparado (string); vazia se o campo não existir. */
function richVal(id){const e=document.getElementById(id);return e?String(e.value||'').trim():''}

// fração → percentagem com vírgula (0.253 → "25,3%"); d casas decimais (1 por omissão); "—" se não for número.
// Recebe: v — a fração (número; 0.25 é 25%); d (opcional) — quantas casas decimais (1 por omissão).
// Devolve: a percentagem em texto, ex.: "25,3%"; "—" se v não for um número finito.
const pct=(v,d)=>isFinite(v)?(v*100).toFixed(d==null?1:d).replace('.',',')+'%':'—';
const dec=v=>String(v==null?'':v).replace('.',',');
const sum=a=>a.reduce((x,y)=>x+(Number(y)||0),0);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
/* texto dentro de uma string JS num atributo onclick="f('…')" */
const jsq=s=>esc(String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' '));
/* data de hoje em ISO (AAAA-MM-DD) — o formato em que as datas se guardam e comparam.
   Formatada em hora local, nunca pelo toISOString: esse converte para UTC e, à noite
   com horário de verão, dava o dia anterior a cada movimento novo.
   Devolve: a data de hoje em texto "AAAA-MM-DD". */
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const YEAR=new Date().getFullYear();
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();

const prop=id=>db.properties.find(p=>p.id===id);
const propName=id=>{const p=prop(id);return p?p.name:''};
const owner=id=>db.owners.find(o=>o.id===id);
const tenant=id=>db.tenants.find(t=>t.id===id);
const contract=id=>db.contracts.find(c=>c.id===id);
const contractsOf=pid=>db.contracts.filter(c=>c.propertyId===pid);
const isActive=c=>c&&c.active!==false&&(!c.end||c.end>=today());
const activeContracts=pid=>contractsOf(pid).filter(isActive);
const ctTenants=c=>(c.tenantIds||[]).map(tenant).filter(Boolean);
const ctNames=c=>ctTenants(c).map(t=>t.name).join(', ')||'Sem inquilino';
// nome do quarto rid do imóvel p; vazio se não existir.
// Recebe: p — o imóvel (objeto; aguenta null); rid — o id do quarto.
// Devolve: o nome do quarto (string); vazia se não existir.
const roomName=(p,rid)=>{const r=((p||{}).rooms||[]).find(x=>x.id===rid);return r?r.name:''};
const ctLabel=c=>{const p=prop(c.propertyId);return (p?p.name:'?')+(c.roomId?' · '+roomName(p,c.roomId):'')};
/* nome pelos inquilinos (e quarto, se houver) — para escolher o contrato */
const ctPick=c=>{const p=prop(c.propertyId),r=c.roomId?roomName(p,c.roomId):'';return ctNames(c)+(r?' · '+r:'')};
/* o contrato identifica-se pelo nome que lhe deres; sem nome, pelos inquilinos */
const ctName=c=>String((c&&c.name)||'').trim()||ctPick(c);
const contractsOfTenant=tid=>db.contracts.filter(c=>(c.tenantIds||[]).indexOf(tid)>-1);
const rentOf=p=>sum(activeContracts(p.id).map(c=>c.rent));
/* taxa especial de IRS sobre rendas de habitação, pela duração do contrato (Lei 56/2023):
   25 %; 15 % com 5 anos ou mais; 10 % com 10 ou mais; 5 % com 20 ou mais. A duração
   conta do início ao fim inclusive (1 jan a 31 dez são 12 meses); sem fim, vale 25 %.
   Recebe: c — o contrato (usa start e end, 'AAAA-MM-DD'; aguenta null).
   Devolve: a taxa em percentagem (número: 25, 15, 10 ou 5). */
function irsRate(c){
  if(!c||!c.start||!c.end)return 25;
  const s=new Date(c.start+'T00:00:00'),e=new Date(c.end+'T00:00:00');e.setDate(e.getDate()+1);
  const meses=(e.getFullYear()-s.getFullYear())*12+(e.getMonth()-s.getMonth())-(e.getDate()<s.getDate()?1:0);
  return meses>=240?5:meses>=120?10:meses>=60?15:25;
}
/* a taxa de imposto que se aplica à renda de um contrato: a que foi escrita; em branco
   (ou 0, que é como o formulário guarda o branco) a estimativa pela duração (irsRate)
   Recebe: c — o contrato.
   Devolve: a taxa em percentagem (número). */
const taxRateOf=c=>Number(c.taxRate)>0?Number(c.taxRate):irsRate(c);
const netRent=c=>c.rent*(1-taxRateOf(c)/100);
const netRentOf=p=>sum(activeContracts(p.id).map(netRent));
const loansOf=p=>((p||{}).loans)||[];
const liveLoans=p=>loansOf(p).filter(l=>Number(l.outstanding)>0);
const debtOf=p=>sum(liveLoans(p).map(l=>l.outstanding));
const payOf=p=>sum(liveLoans(p).map(l=>loanCalc(l).total));
// hipoteca com este id dentro do imóvel p; null se lá não estiver.
// Recebe: p — o imóvel (objeto; aguenta null); id — o id da hipoteca.
// Devolve: o objeto da hipoteca, ou null se lá não estiver.
const findLoan=(p,id)=>loansOf(p).find(l=>l.id===id)||null;
/* hipoteca por id, procurada em todos os imóveis
   Recebe: id — o id da hipoteca.
   Devolve: {p, l} — o imóvel e a hipoteca; null se não existir em lado nenhum. */
function anyLoan(id){for(const p of db.properties){const l=findLoan(p,id);if(l)return{p,l}}return null}
/* grupos de imóveis, proprietários ou contratos */
const grp=id=>(db.groups||[]).find(g=>g.id===id);
const grpsOf=kind=>(db.groups||[]).filter(g=>g.kind===kind);
/* imóveis de um filtro: id de imóvel, 'g:ID' de grupo, ou vazio = âmbito atual. Num grupo
   só entram os imóveis do âmbito: com um proprietário filtrado, os dos outros ficam de fora.
   Recebe: pid — o id de um imóvel, 'g:ID' de um grupo, ou vazio para o âmbito atual.
   Devolve: os imóveis abrangidos pelo filtro (array de objetos). */
function pidProps(pid){
  if(!pid)return scope();
  if(String(pid).startsWith('g:')){const g=grp(String(pid).slice(2));return g?g.ids.map(prop).filter(p=>p&&inScope(p.id)):[]}
  const p=prop(pid);return p?[p]:[];
}
const loanName=l=>{const n=((l&&l.name)||'').trim(),b=((l&&l.bank)||'').trim();
  return n&&b?n+' · '+b:(n||b||'Hipoteca')};
const propsOf=oid=>db.properties.filter(p=>(p.ownerIds||[]).indexOf(oid)>-1);
const ownerNames=p=>(p.ownerIds||[]).map(owner).filter(Boolean).map(o=>o.name).join(', ');

/* ================= CONTAS ENTRE PROPRIETÁRIOS =================
   Cada movimento com "pago por" fica a crédito de quem pagou, e o custo divide-se
   em partes iguais pelos proprietários do imóvel. Receber uma renda é o inverso:
   quem recebeu passa a dever aos outros. Movimentos sem pagador indicado não
   entram nestas contas — de outra forma inventavam-se dívidas.
   Recebe: p — o imóvel (objeto).
   Devolve: os ids dos proprietários do imóvel que têm ficha (array de strings). */
function ownersOfProp(p){return (p.ownerIds||[]).filter(id=>owner(id))}
/* quota-parte de cada proprietário (fração). Sem percentagens definidas: partes iguais.
   Recebe: p — o imóvel (objeto; aguenta null).
   Devolve: objeto {idDoDono: fração 0–1}; vazio se o imóvel não tiver donos com ficha. */
function sharesOf(p){
  const os=ownersOfProp(p||{}),out={};if(!os.length)return out;
  const raw=(p&&p.ownerShares)||{};
  const has=o=>raw[o]!==undefined&&raw[o]!==null&&raw[o]!==''&&isFinite(Number(raw[o]))&&Number(raw[o])>=0;
  const given=os.filter(has),blank=os.filter(o=>!has(o));
  if(!given.length){os.forEach(o=>{out[o]=1/os.length});return out}
  const sumG=sum(given.map(o=>Number(raw[o])));
  /* quem não tem percentagem fica com o que falta até 100%, em partes iguais */
  const rest=blank.length?Math.max(0,100-sumG):0,tot=sumG+rest;
  if(!(tot>0)){os.forEach(o=>{out[o]=0});return out}
  os.forEach(o=>{out[o]=has(o)?Number(raw[o])/tot:(blank.length?rest/blank.length/tot:0)});
  return out;
}
// quota-parte (fração 0–1) do proprietário oid no imóvel p; 0 se não for dono.
// Recebe: p — o imóvel (objeto); oid — o id do proprietário.
// Devolve: a fração 0–1 desse dono; 0 se não for dono.
const shareOf=(p,oid)=>{const s=sharesOf(p);return s[oid]===undefined?0:s[oid]};
const hasShares=p=>Object.keys((p&&p.ownerShares)||{}).length>0;
/* fator a aplicar aos valores de um imóvel quando a vista está filtrada por proprietário */
const sh=p=>(ownerFilter&&!ownerIsGrp()&&p)?shareOf(p,ownerFilter):1;
const shareText=p=>ownerFilter?pct(sh(p),0):'';
/* divide um total inteiro (cêntimos) pelas quotas, somando exatamente o total
   Recebe: total — o valor a dividir (inteiro, em cêntimos); shares — a fração de cada um (array de números).
   Devolve: array de inteiros (cêntimos), pela mesma ordem de shares, cuja soma dá exatamente o total. */
function splitShares(total,shares){
  const raw=shares.map(x=>total*x),out=raw.map(x=>Math.trunc(x));
  let rem=total-out.reduce((a,b)=>a+b,0);
  const idx=raw.map((x,i)=>({i,f:Math.abs(x-out[i])})).sort((a,b)=>b.f-a.f);
  const step=rem>0?1:-1;
  for(let k=0;k<Math.abs(rem)&&idx.length;k++)out[idx[k%idx.length].i]+=step;
  return out;
}
/* quanto cabe a cada dono (cêntimos, positivos) num movimento, conforme o modo de divisão:
   equal (partes iguais), quota (quota-parte), pct/percent (pesos ou percentagens próprias),
   amount (valores certos) ou adjust (um extra por cima da parte igual: ao total tira-se a
   soma dos ajustes, o resto divide-se em partes iguais por todos e cada um soma o seu)
   Recebe: t — o movimento (objeto; usa t.amount e t.split); p — o imóvel (objeto; pode ser null
   e, sem quotas, a divisão cai em partes iguais); os — os ids dos donos (array de strings).
   Devolve: array de cêntimos (inteiros, positivos) por dono, pela ordem de os. */
function txSplitCents(t,p,os){
  const total=Math.abs(Math.round((Number(t.amount)||0)*100));
  const shares=sharesOf(p),fr=os.map(o=>shares[o]||0);
  const sp=t.split||{},parts=sp.parts||{},get=o=>Math.max(0,Number(parts[o])||0);
  const eq=os.map(()=>1/os.length);
  if(sp.mode==='equal')return splitShares(total,eq);
  if(sp.mode==='pct'||sp.mode==='percent'){const w=os.map(get),tw=sum(w);return splitShares(total,tw>0?w.map(x=>x/tw):eq)}
  if(sp.mode==='amount'){
    const c=os.map(o=>Math.round(get(o)*100));let rem=total-sum(c);
    if(rem<0){const k=total/Math.max(1,sum(c));return c.map(x=>Math.round(x*k))}
    const rest=splitShares(Math.max(0,rem),eq);return c.map((x,i)=>x+rest[i]);
  }
  if(sp.mode==='adjust'){
    /* o ajuste é um extra por cima da parte igual: tira-se ao total a soma dos ajustes,
       o que sobra divide-se em partes iguais por todos e cada um soma o seu
       (15 € com A=5: 10/2=5 → A 10, B 5). Em branco vale 0; negativos contam 0.
       Se os ajustes passarem o total (o formulário recusa, mas dados antigos podem
       trazê-lo), reparte-se o total na proporção dos ajustes para a soma bater certo. */
    const adj=os.map(o=>Math.round(get(o)*100)),ta=sum(adj),rem=total-ta;
    if(rem<0)return splitShares(total,adj.map(x=>x/ta));
    const rest=splitShares(rem,eq);return adj.map((x,i)=>x+rest[i]);
  }
  return splitShares(total,sum(fr)>0?fr:eq);
}
/* fração de um movimento que cabe a um dono (para a vista filtrada por proprietário)
   Recebe: t — o movimento (objeto); oid — o id do proprietário.
   Devolve: a fração 0–1 do valor do movimento que cabe a esse dono; 0 se não for dono do imóvel. */
function txOwnerFrac(t,oid){
  const p=prop(t.propertyId);if(!p)return 0;
  const os=ownersOfProp(p);if(os.indexOf(oid)<0)return 0;
  if(!t.split||!t.split.mode)return shareOf(p,oid);
  const total=Math.abs(Math.round((Number(t.amount)||0)*100));if(!total)return shareOf(p,oid);
  return txSplitCents(t,p,os)[os.indexOf(oid)]/total;
}
const splitLabel=t=>({equal:'em partes iguais',pct:'por quotas a definir',percent:'por percentagem',amount:'por valor',adjust:'por ajuste'})[(t.split||{}).mode]||'';
/* imóveis abrangidos por um movimento (o próprio, ou os do grupo)
   Recebe: t — o movimento (objeto; usa t.propertyId ou t.groupId).
   Devolve: os imóveis abrangidos (array de objetos); vazio se não apontar a nenhum. */
function txProps(t){
  if(t.propertyId){const p=prop(t.propertyId);return p?[p]:[]}
  if(t.groupId){const g=grp(t.groupId);return g?g.ids.map(prop).filter(Boolean):[]}
  return [];
}
/* divide o total (cêntimos) pelos imóveis do grupo, conforme o modo escolhido; em
   'adjust' o valor de cada imóvel é um extra por cima da parte igual, como entre donos
   Recebe: t — o movimento (objeto; usa t.psplit); ps — os imóveis do grupo (array de objetos);
   total — o valor a dividir (inteiro, em cêntimos).
   Devolve: array de cêntimos (inteiros) por imóvel, pela ordem de ps. */
function psplitCents(t,ps,total){
  const sp=t.psplit||{},parts=sp.parts||{},get=p=>Math.max(0,Number(parts[p.id])||0);
  const eq=ps.map(()=>1/ps.length);
  const by=f=>{const w=ps.map(f),tw=sum(w);return splitShares(total,tw>0?w.map(x=>x/tw):eq)};
  if(sp.mode==='value')return by(p=>Number(p.value)||0);
  if(sp.mode==='purchase')return by(p=>Number(p.purchase)||0);
  if(sp.mode==='pct')return by(get);
  if(sp.mode==='percent')return by(get);
  if(sp.mode==='amount'){const c=ps.map(p=>Math.round(get(p)*100));let rem=total-sum(c);
    if(rem<0){const k=total/Math.max(1,sum(c));return c.map(x=>Math.round(x*k))}
    const rest=splitShares(Math.max(0,rem),eq);return c.map((x,i)=>x+rest[i]);}
  if(sp.mode==='adjust'){/* extra por cima da parte igual — a mesma regra do txSplitCents */
    const adj=ps.map(p=>Math.round(get(p)*100)),ta=sum(adj),rem=total-ta;
    if(rem<0)return splitShares(total,adj.map(x=>x/ta));
    const rest=splitShares(rem,eq);return adj.map((x,i)=>x+rest[i]);}
  return splitShares(total,eq);
}
/* fração de um movimento que cabe a um imóvel
   Recebe: t — o movimento (objeto); pid — o id do imóvel.
   Devolve: a fração 0–1 do valor do movimento que cabe a esse imóvel. */
function txPropShare(t,pid){
  if(t.propertyId)return t.propertyId===pid?1:0;
  if(!t.groupId)return 0;
  const ps=txProps(t),i=ps.findIndex(p=>p.id===pid);if(i<0)return 0;
  const total=Math.abs(Math.round((Number(t.amount)||0)*100));
  if(!total)return 1/ps.length;
  return psplitCents(t,ps,total)[i]/total;
}
/* peso do movimento numa vista: por imóvel (pid) ou no âmbito atual
   Recebe: t — o movimento (objeto); pid (opcional) — o id de um imóvel ou 'g:ID' de um grupo;
   vazio vale o âmbito atual.
   Devolve: número 0–1 — a fração do valor do movimento que conta nessa vista. */
function txW(t,pid){
  if(String(pid||'').startsWith('g:'))return sum(pidProps(pid).map(p=>txW(t,p.id)));
  if(pid)return txPropShare(t,pid);
  if(t.propertyId)return inScope(t.propertyId)?1:0;
  if(t.groupId)return sum(txProps(t).filter(p=>inScope(p.id)).map(p=>txPropShare(t,p.id)));
  return ownerFilter?0:1;
}
/* donos (fichas) dos imóveis do grupo de um movimento, sem repetir
   Recebe: t — o movimento (objeto).
   Devolve: as fichas dos proprietários (array de objetos), sem repetidos. */
function txGroupOwners(t){
  const ids=[];txProps(t).forEach(p=>ownersOfProp(p).forEach(o=>{if(ids.indexOf(o)<0)ids.push(o)}));
  return ids.map(owner).filter(Boolean);
}
const psplitLabel=t=>({equal:'em partes iguais',value:'pelo valor de mercado',purchase:'pelo valor de aquisição',pct:'por quotas a definir',percent:'por percentagem',amount:'por valor certo',adjust:'por ajuste'})[(t.psplit||{}).mode]||'';
/* o que entra nas contas entre donos: receitas, despesas e prestações com pessoa indicada.
   Dívidas a terceiros (recebidas ou pagas) ficam de fora — são de quem as contraiu. */
const countsBetweenOwners=t=>!!t.paidBy&&(t.kind==='income'||t.kind==='expense'||t.kind==='loan');
/* efeito de cada movimento nos saldos (cêntimos por dono), para se poder conferir
   Recebe: pid (opcional) — o id de um imóvel ou 'g:ID' de um grupo; vazio vale o âmbito atual.
   Devolve: array de {t, p, os, eff}, ordenado por data — o movimento, o imóvel (ou só
   {name:…} nos movimentos de grupo/globais), os ids dos donos e o efeito em cêntimos por dono. */
function balanceLines(pid){
  /* as contas entre proprietários são dos proprietários: um imóvel onde só colaboro fica de fora */
  const props=pidProps(pid).filter(p=>souDono(p.id)),out=[];
  props.forEach(p=>{
    const os=ownersOfProp(p).slice().sort();
    /* os acertos deste imóvel contam sempre — com um só dono, ou entre quem não é dono dele:
       uma dívida de grupo paga por quem não é dono do imóvel salda-se com um acerto aqui */
    db.transactions.filter(t=>t.propertyId===p.id&&t.kind==='settle').forEach(t=>{
      const v=Math.round((Number(t.amount)||0)*100),eff={};os.forEach(o=>eff[o]=0);
      const add=(o,x)=>{if(!o)return;eff[o]=(eff[o]||0)+x};
      add(t.paidBy,v);add(t.toId,-v);
      out.push({t,p,os:Object.keys(eff).sort(),eff});
    });
    if(os.length<2)return;
    db.transactions.filter(t=>t.propertyId===p.id&&countsBetweenOwners(t)&&os.indexOf(t.paidBy)>-1).forEach(t=>{
      const eff={};os.forEach(o=>eff[o]=0);
      const sign=isIn(t.kind)?-1:1,total=Math.abs(Math.round((Number(t.amount)||0)*100));eff[t.paidBy]+=total*sign;txSplitCents(t,p,os).forEach((part,i)=>{eff[os[i]]-=part*sign});
      out.push({t,p,os,eff});
    });
  });
  db.transactions.filter(t=>!t.propertyId&&(t.groupId?countsBetweenOwners(t)&&txProps(t).some(p2=>props.some(p3=>p3.id===p2.id)):(countsBetweenOwners(t)||t.kind==='settle')&&!pid&&!ownerFilter)).forEach(t=>{
    const sign=isIn(t.kind)?-1:1,total=Math.abs(Math.round((Number(t.amount)||0)*100));
    const eff={},add=(o,v)=>{eff[o]=(eff[o]||0)+v};
    if(t.kind==='settle'){   /* acerto das dívidas globais (sem imóvel nem grupo): quem paga sobe, quem recebe desce */
      add(t.paidBy,total);add(t.toId,-total);
    }else if(t.groupId){
      txProps(t).filter(p2=>props.some(p3=>p3.id===p2.id)).forEach(p2=>{
        const cP=Math.round(total*txPropShare(t,p2.id)),os2=ownersOfProp(p2).slice().sort();
        if(!os2.length||!cP)return;
        add(t.paidBy,cP*sign);
        txSplitCents(Object.assign({},t,{amount:cP/100}),p2,os2).forEach((part,i)=>add(os2[i],-part*sign));
      });
    }else{
      const os2=donosGlobais().map(o=>o.id).sort();if(!os2.length)return;
      add(t.paidBy,total*sign);
      txSplitCents(t,null,os2).forEach((part,i)=>add(os2[i],-part*sign));
    }
    if(Object.keys(eff).length)out.push({t,p:{name:t.groupId?('Grupo '+((grp(t.groupId)||{}).name||'')):'todos os imóveis'},os:Object.keys(eff).sort(),eff});
  });
  return out.sort((a,b)=>String(a.t.date).localeCompare(String(b.t.date)));
}
let _detailPid=null;
// se o modal "Como se chega aos saldos" estiver por cima, reabre-o para refletir dados frescos.
// Devolve: nada — fecha e reabre o modal quando é ele que está por cima.
function refreshDetail(){const t=modalTop();if(t&&t.title==='Como se chega aos saldos'){closeModal();balancesDetail(_detailPid)}}
/* abre o modal "Como se chega aos saldos": cada movimento que conta, o efeito em
   cêntimos por dono e o saldo acumulado até aí. pid limita a um imóvel (vazio =
   âmbito atual). Tocar num movimento abre-o para editar; sem movimentos, só avisa.
   Recebe: pid (opcional) — o id de um imóvel; vazio vale o âmbito atual.
   Devolve: nada — abre o modal (ou mostra só um toast se não houver movimentos). */
function balancesDetail(pid){
  _detailPid=pid||null;
  const lines=balanceLines(pid);
  const ids=[];lines.forEach(l=>l.os.forEach(o=>{if(ids.indexOf(o)<0)ids.push(o)}));
  if(!lines.length)return toast('Ainda não há movimentos que contem para as contas.');
  const nm=o=>esc(((owner(o)||{}).name||'?').split(' ')[0]);
  const run={};ids.forEach(o=>run[o]=0);
  openModal('Como se chega aos saldos',`<div class="form">
    <div class="hint">Quem paga fica a crédito; quem recebe fica a dever a parte dos outros. Positivo: a receber. Negativo: a pagar.</div>
    <div class="list" style="gap:7px">${lines.map(l=>{ids.forEach(o=>run[o]+=(l.eff[o]||0));return `<div class="card tap" style="padding:10px 12px" onclick="txModal('${l.t.id}')">
      <div class="row-between"><b style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.t.label)}</b><span class="small" style="flex:0 0 auto">${l.t.date}</span></div>
      <div class="small">${l.t.kind==='settle'?nm(l.t.paidBy)+' → '+nm(l.t.toId):(KIND[l.t.kind]||{}).short+' · '+(isIn(l.t.kind)?'recebeu ':'pagou ')+nm(l.t.paidBy)+(splitLabel(l.t)?' · '+splitLabel(l.t):' · quotas')}${!pid?' · '+esc(l.p.name):''} · <b>${euro2(l.t.amount)}</b></div>
      <div class="chips" style="margin-top:6px">${ids.map(o=>`<span class="badge grey">${nm(o)} <b class="${l.eff[o]>0?'pos':l.eff[o]<0?'neg':''}">${l.eff[o]?(l.eff[o]>0?'+':'−')+euro2(Math.abs(l.eff[o])/100):'—'}</b> · saldo ${euro2(run[o]/100)}</span>`).join('')}</div></div>`}).join('')}</div>
    <div class="hint">"Saldo" é o acumulado até esse movimento: positivo a receber, negativo a pagar. Toca num movimento para o editar.</div></div>`,
    `<button class="btn" onclick="closeModal()">Fechar</button>`);
}
/* saldos entre comproprietários, em euros por dono: quem pagou fica a crédito e a
   parte de cada um sai das quotas ou da divisão escolhida no movimento; as
   transferências acertam contas diretamente. pid limita a um imóvel ou grupo; sem
   pid vale o âmbito atual. Positivo é a receber, negativo a pagar.
   Recebe: pid (opcional) — o id de um imóvel ou 'g:ID' de um grupo; vazio vale o âmbito atual.
   Devolve: objeto {idDoDono: saldo em euros} — positivo a receber, negativo a pagar. */
function ownerBalances(pid){
  /* as contas entre proprietários são dos proprietários: um imóvel onde só colaboro fica de fora */
  const props=pidProps(pid).filter(p=>souDono(p.id)),cents={};
  props.forEach(p=>{
    const os=ownersOfProp(p).slice().sort();
    /* os acertos deste imóvel contam sempre — com um só dono, ou entre quem não é dono dele
       (uma dívida de grupo paga por quem não é dono do imóvel salda-se com um acerto aqui) */
    db.transactions.filter(t=>t.propertyId===p.id&&t.kind==='settle').forEach(t=>{
      const v=Math.round((Number(t.amount)||0)*100);
      const add=(o,x)=>{if(!o)return;if(cents[o]===undefined)cents[o]=0;cents[o]+=x};
      add(t.paidBy,v);add(t.toId,-v);
    });
    if(os.length<2)return;
    os.forEach(o=>{if(cents[o]===undefined)cents[o]=0});
    db.transactions.filter(t=>countsBetweenOwners(t)&&t.propertyId===p.id&&os.indexOf(t.paidBy)>-1).forEach(t=>{
      const sign=isIn(t.kind)?-1:1,total=Math.abs(Math.round((Number(t.amount)||0)*100));
      cents[t.paidBy]+=total*sign;
      txSplitCents(t,p,os).forEach((part,i)=>{cents[os[i]]-=part*sign});
    });
  });
  /* sem imóvel: divide-se por todos os proprietários (e os acertos globais saldam-se aqui);
     com grupo: pelos donos de cada imóvel do grupo */
  db.transactions.filter(t=>!t.propertyId&&(countsBetweenOwners(t)||(t.kind==='settle'&&!t.groupId))).forEach(t=>{
    const sign=isIn(t.kind)?-1:1,total=Math.abs(Math.round((Number(t.amount)||0)*100));
    const add=(o,v)=>{if(cents[o]===undefined)cents[o]=0;cents[o]+=v};
    if(t.kind==='settle'){
      if(!pid&&!ownerFilter){add(t.paidBy,total);add(t.toId,-total)}
    }else if(t.groupId){
      txProps(t).filter(p2=>props.some(p3=>p3.id===p2.id)).forEach(p2=>{
        const cP=Math.round(total*txPropShare(t,p2.id)),os=ownersOfProp(p2).slice().sort();
        if(!os.length||!cP)return;
        add(t.paidBy,cP*sign);
        txSplitCents(Object.assign({},t,{amount:cP/100}),p2,os).forEach((part,i)=>add(os[i],-part*sign));
      });
    }else if(!pid&&!ownerFilter){
      const os=donosGlobais().map(o=>o.id).sort();if(!os.length)return;
      add(t.paidBy,total*sign);
      txSplitCents(t,null,os).forEach((part,i)=>add(os[i],-part*sign));
    }
  });
  const bal={};Object.keys(cents).forEach(k=>{bal[k]=cents[k]/100});
  return bal;
}
/* menor número de transferências que zera os saldos
   Recebe: bal — os saldos por dono em euros (objeto {id: valor}, como o de ownerBalances).
   Devolve: array de {from, to, amount} — quem paga, quem recebe e quanto (euros, 2 casas). */
function settlePlan(bal){
  const cred=[],deb=[];
  Object.keys(bal).forEach(k=>{const v=bal[k];
    if(v>0.005)cred.push({id:k,v:v});else if(v<-0.005)deb.push({id:k,v:-v})});
  cred.sort((a,b)=>b.v-a.v);deb.sort((a,b)=>b.v-a.v);
  const out=[];let i=0,j=0;
  while(i<deb.length&&j<cred.length){
    const x=Math.min(deb[i].v,cred[j].v);
    if(x>0.005)out.push({from:deb[i].id,to:cred[j].id,amount:Math.round(x*100)/100});
    deb[i].v-=x;cred[j].v-=x;
    if(deb[i].v<=0.005)i++;
    if(cred[j].v<=0.005)j++;
  }
  return out;
}
const debtTotal=bal=>sum(Object.keys(bal).map(k=>bal[k]>0?bal[k]:0));
const propDebt=pid=>debtTotal(ownerBalances(pid));

let ownerFilter='',dashProp='';
// o filtro de proprietário atual é um grupo ('g:ID')?
// Devolve: true se o filtro atual for um grupo; false caso contrário.
const ownerIsGrp=()=>String(ownerFilter||'').startsWith('g:');
// ids de proprietário abrangidos pelo filtro atual: vazio sem filtro, os do grupo, ou só o escolhido.
// Devolve: os ids abrangidos (array de strings); vazio sem filtro.
function ownerFilterIds(){
  if(!ownerFilter)return [];
  if(ownerIsGrp()){const g=grp(ownerFilter.slice(2));return g?g.ids:[]}
  return [ownerFilter];
}
// nome a mostrar do filtro de proprietário atual (pessoa ou grupo); vazio sem filtro.
// Devolve: o nome a mostrar (string); vazia sem filtro ou se a ficha já não existir.
function ownerFilterName(){
  if(!ownerFilter)return '';
  if(ownerIsGrp()){const g=grp(ownerFilter.slice(2));return g?g.name:''}
  return (owner(ownerFilter)||{}).name||'';
}
/* imóveis da vista atual: todos sem filtro de proprietário; com filtro, os que
   pertencem a quem foi escolhido (e, para uma pessoa, só onde a quota é > 0).
   É o âmbito das listas (Imóveis, Contratos); o das contas é scope().
   Devolve: os imóveis da vista atual (array de objetos). */
const visiveis=()=>{if(!ownerFilter)return db.properties;const ids=ownerFilterIds();
  return db.properties.filter(p=>(p.ownerIds||[]).some(o=>ids.indexOf(o)>-1)&&(ownerIsGrp()||shareOf(p,ownerFilter)>0))};
/* o âmbito das contas: os imóveis visíveis onde o meu cargo abre as finanças —
   movimentos, valores ou hipotecas. Nos meus imóveis é tudo; num imóvel onde
   só colaboro sem nenhuma destas, os KPIs, a Avaliação e os Créditos não o contam
   (o servidor já não manda esses dados; aqui evita-se somar zeros e listá-lo).
   Devolve: os imóveis do âmbito financeiro (array de objetos). */
const scope=()=>visiveis().filter(p=>pode(p.id,'tx.view')||pode(p.id,'report.view')||pode(p.id,'loan.view'));
const inScope=pid=>!ownerFilter||scope().some(p=>p.id===pid);

/* estado de ocupação de um imóvel, para cartões e filtros: devolve {key,label,badge}
   — uso próprio, vago, parcial ("2/3 quartos", no modo de quartos) ou arrendado.
   Recebe: p — o imóvel (objeto).
   Devolve: {key, label, badge} — a chave do estado, o texto a mostrar e a cor do selo. */
function propStatus(p){
  if(p.use==='proprio')return{key:'proprio',label:'Uso próprio',badge:'grey'};
  const ac=activeContracts(p.id);
  if(!ac.length)return{key:'vago',label:'Vago',badge:'amber'};
  if(p.rentalMode==='quartos'){
    const tot=(p.rooms||[]).length,occ=new Set(ac.map(c=>c.roomId).filter(Boolean)).size;
    if(tot&&occ<tot)return{key:'parcial',label:`${occ}/${tot} quartos`,badge:'amber'};
    return{key:'arrendado',label:`${occ||ac.length} quartos arrendados`,badge:''};
  }
  return{key:'arrendado',label:'Arrendado',badge:''};
}
const isRented=p=>['arrendado','parcial'].indexOf(propStatus(p).key)>-1;

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
/* euro() arredonda; isto mostra os cêntimos quando existem — uma renda de
   512,74 € aparecia «513 €» num cartão e «512,74 €» no movimento ao lado */
const euroS=v=>Math.round(v*100)%100?euro2(v):euro(v);
/* op: {rotulo, fn, ms} poe um botao no toast — e a peca que faz o Anular
   possivel. Sem op, comporta-se exatamente como sempre.
   Recebe: m — a mensagem a mostrar (texto); op (opcional) — {rotulo, fn, ms}: o texto do botão,
   o que ele faz ao ser tocado e quanto tempo o aviso fica no ecrã (ms; 2800 por omissão).
   Devolve: nada — mostra o aviso no fundo do ecrã. */
function toast(m,op){const t=document.getElementById('toast');
  t.textContent=m;
  if(op&&op.rotulo&&op.fn){const b=document.createElement('button');b.type='button';b.className='toastbtn';
    b.textContent=op.rotulo;b.onclick=()=>{clearTimeout(t._h);t.classList.remove('on');op.fn()};t.appendChild(b)}
  t.classList.add('on');clearTimeout(t._h);
  t._h=setTimeout(()=>t.classList.remove('on'),(op&&op.ms)||2800)}

const KIND={income:{short:'Receita',sign:'+',color:'pos',flow:'in'},expense:{short:'Despesa',sign:'−',color:'neg',flow:'out'},
  loan:{short:'Pagamento de crédito',sign:'−',color:'amber',flow:'out'},owed:{short:'Dívida recebida',sign:'+',color:'amber',flow:'in'},
  repay:{short:'Pagamento de dívida',sign:'−',color:'neg',flow:'out'},settle:{short:'Transferência',sign:'',color:'',flow:'none'}};
/* os cinco tipos que se escolhem ao criar um movimento */
const TX_TYPES=[['income','up','Receita','renda recebida, reembolso, subsídio'],['expense','dn','Despesa','impostos, obras, condomínio, seguros'],
  ['loan','bank','Pagamento de crédito','prestação ou amortização do crédito'],['owed','users','Dívida','dinheiro recebido de alguém, ou devolvido'],
  ['settle','swap','Transferência entre proprietários','um dono passa dinheiro a outro para acertar contas']];
const txTypeName=k=>({income:'receita',expense:'despesa',loan:'pagamento de crédito',owed:'dívida',repay:'dívida',settle:'transferência'})[k]||'movimento';
const txNewWord=k=>(k==='loan'?'Novo ':'Nova ');
const flowOf=k=>(KIND[k]||KIND.expense).flow;
const isIn=k=>flowOf(k)==='in',isOut=k=>flowOf(k)==='out';
// árvore de categorias das despesas e pagamentos: a das definições, ou a de fábrica.
// Devolve: a árvore (objeto {categoria: [subcategorias]}).
const cats=()=>db.settings.cats||CATS0;
// árvore de categorias das receitas: a das definições, ou a de fábrica.
// Devolve: a árvore (objeto {categoria: [subcategorias]}).
const catsIn=()=>db.settings.catsIn||CATS_IN0;
/* árvore de categorias de um tipo de movimento: receitas ou pagamentos (acertos não têm) */
const treeKey=k=>k==='settle'?'':(isIn(k)?'catsIn':'cats');
const catsFor=k=>{const t=treeKey(k);return t?db.settings[t]:null};
/* categorias/subcategorias podem ficar fora dos totais de receitas e despesas
   Recebe: tk — a chave da árvore ('cats' ou 'catsIn'); cat — o nome da categoria;
   sub (opcional) — a subcategoria.
   Devolve: a chave da exclusão (string), ex.: "cats:Obras" ou "cats:Obras/Pinturas". */
const excKey=(tk,cat,sub)=>tk+':'+cat+(sub?'/'+sub:'');
// esta categoria (ou a subcategoria, se dada) está excluída dos totais deste tipo de movimento?
// Recebe: kind — o tipo do movimento (ex.: 'income', 'expense'); cat — a categoria;
// sub (opcional) — a subcategoria.
// Devolve: true se estiver excluída dos totais; false caso contrário.
function isExc(kind,cat,sub){
  if(!cat)return false;
  const e=(db.settings||{}).exclude||{},tk=treeKey(kind);
  return !!(e[excKey(tk,cat)]||(sub&&e[excKey(tk,cat,sub)]));
}
// liga/desliga a exclusão de uma categoria dos totais; tk é a chave da árvore
// ('cats' ou 'catsIn'), não o tipo do movimento. Grava e volta a desenhar tudo.
// Recebe: tk — a chave da árvore ('cats' ou 'catsIn'); cat — a categoria; sub (opcional) — a subcategoria.
// Devolve: nada — grava a alteração e volta a desenhar a vista.
function toggleExc(tk,cat,sub){
  const e=db.settings.exclude=db.settings.exclude||{},k=excKey(tk,cat,sub||null);
  if(e[k])delete e[k];else e[k]=true;
  save();render();
}
/* receitas que são passivo, não rendimento: a caução devolve-se e o empréstimo paga-se.
   Nunca entram nos totais, no resultado nem no cashflow — capitalizadas a 5 % inflavam a avaliação.
   Recebe: t — o movimento.
   Devolve: true se for uma caução ou um empréstimo recebido. */
const isPassivo=t=>t.kind==='income'&&(t.category==='Empréstimos recebidos'||t.sub==='Caução');
const countsInTotals=t=>!isPassivo(t)&&!((t.kind==='income'||t.kind==='expense')&&isExc(t.kind,t.category,t.sub));
/* todas as categorias conhecidas, para o filtro (sem repetir)
   Recebe: kind (opcional) — o tipo de movimento; vazio junta receitas e despesas.
   Devolve: a árvore (objeto {categoria: [subcategorias]}), sem repetidos. */
function allCats(kind){
  if(kind)return catsFor(kind)||{};
  const out={};[catsIn(),cats()].forEach(tr=>Object.keys(tr).forEach(k=>{out[k]=(out[k]||[]).concat(tr[k].filter(x=>(out[k]||[]).indexOf(x)<0))}));
  return out;
}
/* de quem se recebeu / a quem se pagou uma dívida a terceiros, com o que falta devolver
   Recebe: pid (opcional) — o id de um imóvel; vazio vale o âmbito atual.
   Devolve: array de {creditor, propertyId, received, repaid, due} — valores em euros,
   do maior "due" (o que falta devolver) para o menor. */
function creditorBalances(pid){
  const map={};
  db.transactions.filter(t=>(t.kind==='owed'||t.kind==='repay')&&(pid?t.propertyId===pid:inScope(t.propertyId))).forEach(t=>{
    const k=(t.creditor||'').trim()||'—',pk=t.propertyId||'';
    const key=k+'|'+pk,e=map[key]||(map[key]={creditor:k,propertyId:pk||null,received:0,repaid:0});
    if(t.kind==='owed')e.received+=Number(t.amount)||0;else e.repaid+=Number(t.amount)||0;
  });
  return Object.keys(map).map(k=>map[k]).map(e=>Object.assign(e,{due:Math.round((e.received-e.repaid)*100)/100})).sort((a,b)=>b.due-a.due);
}
// credores já escritos nos movimentos, sem repetir e por ordem — para sugerir ao preencher.
// Devolve: os nomes dos credores (array de strings), sem repetidos e por ordem alfabética.
const knownCreditors=()=>[...new Set(db.transactions.map(t=>(t.creditor||'').trim()).filter(Boolean))].sort();
const RATE={fixa:'Taxa fixa',mista:'Taxa mista',variavel:'Taxa variável'};
const GENDER=[['','—'],['f','Feminino'],['m','Masculino']];
const MARITAL=['','Solteiro(a)','Casado(a)','União de facto','Divorciado(a)','Viúvo(a)'];
const PAL_LIGHT=['#2f7d5b','#7aa9d6','#d6a34a','#c56b68','#8a7bb8','#5aa8a0','#b58a5e','#9aa7a1','#6f8f76','#c2926a','#7e93b8','#a4b56c'];
const PAL_DARK=['#5ee0a8','#7aa9ff','#ffc35c','#ff8a80','#c89bff','#5ad0d8','#f0a06a','#b8c2d6','#8fd0a0','#ffb08a','#9fb8ff','#d4e07a'];
const PAL=PAL_LIGHT.slice();

// ícone SVG inline pelo nome n, com s px de lado (20 por omissão);
// o traço herda a cor do texto onde for colado (currentColor).
// Recebe: n — o nome do ícone (ex.: 'home', 'trash'); s (opcional) — o lado em px (20 por omissão).
// Devolve: o SVG inline (string HTML); um SVG sem traços se o nome não existir.
function ic(n,s){s=s||20;const I={
  shield:'<path d="M12 3l7 2.6v5.2c0 4.6-3 8.4-7 10.2-4-1.8-7-5.6-7-10.2V5.6z"/><path d="M9 11.5l2 2 4-4"/>',
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-5h5v5"/>',
  building:'<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M15 10h3a2 2 0 0 1 2 2v9"/><path d="M8 7h3M8 11h3M8 15h3"/><path d="M2 21h20"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  crown:'<path d="M3 18h18"/><path d="M4 8l4 3 4-6 4 6 4-3-2 7H6z"/>',
  contract:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 12h6M9 16h4"/>',
  swap:'<path d="M7 4v13M4 14l3 3 3-3"/><path d="M17 20V7M14 10l3-3 3 3"/>',
  trend:'<path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/>',
  down:'<path d="M12 3v13M7 12l5 5 5-5"/><path d="M4 21h16"/>',
  file:'<path d="M9 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9"/><path d="M3 12h10M9 8l4 4-4 4"/>',
  bank:'<path d="M3 10 12 4l9 6"/><path d="M5 10v9M10 10v9M14 10v9M19 10v9"/><path d="M3 21h18"/>',
  door:'<path d="M4 21V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v17"/><path d="M2 21h20"/><circle cx="13.5" cy="12.5" r="1"/>',
  photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5L5 19"/>',
  box:'<path d="M3 8 12 4l9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v8"/>',
  tag:'<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  up:'<path d="M12 20V6M6 12l6-6 6 6"/>',dn:'<path d="M12 4v14M6 12l6 6 6-6"/>',
  trash:'<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',key:'<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4M15 12v3"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  wave:'<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  split:'<path d="M4 6h5l3 6 3-6h5"/><path d="M4 18h5l3-6"/>',
  cloud:'<path d="M6 18a4 4 0 0 1 .6-8A6 6 0 0 1 18 9.5 3.5 3.5 0 0 1 17.5 18z"/><path d="M12 12v6M9.5 15.5 12 18l2.5-2.5"/>',
  clip:'<path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3l8-8"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  filter:'<path d="M22 4H2l8 9.2V19l4 2.4v-8.2z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  moon:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cal:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  bell:'<path d="M18 9a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
  grip:'<circle cx="9" cy="5.5" r="1.3"/><circle cx="15" cy="5.5" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18.5" r="1.3"/><circle cx="15" cy="18.5" r="1.3"/>',
  auto:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
  chev:'<path d="M15 6l-6 6 6 6"/>',chevD:'<path d="M6 9l6 6 6-6"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',
  pen:'<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  dots:'<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>'
}[n]||'';
return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+I+'</svg>'}

/* ================= ÁREA SEGURA ================= */
/* O wrapper Android injeta os valores exatos. Fora dele, medimos o env() e,
   se der zero num ecrã sem barra do browser, assumimos uma barra de estado.
   Devolve: nada — quando é preciso, escreve a variável CSS --inset-top no <html>. */
function fitInsets(){
  const el=document.documentElement;
  if(window.__nativeInsets)return;
  let envTop=0;
  try{
    const d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top,0px);visibility:hidden';
    document.body.appendChild(d);envTop=d.offsetHeight;d.remove();
  }catch(e){}
  if(envTop>0)return;
  let full=false;
  try{full=window.screen&&Math.abs(screen.height-window.innerHeight)<52}catch(e){}
  if(full)el.style.setProperty('--inset-top','28px');
}
/* chamada pelo wrapper Android com as margens exatas da área segura (px); passa-as
   às variáveis CSS e marca-as como nativas, para o fitInsets deixar de adivinhar.
   Recebe: t — a margem de topo (número, px); b — a de fundo; l — a da esquerda; r — a da direita.
   Devolve: nada — escreve as variáveis CSS --inset-* no <html>. */
window.__setInsets=function(t,b,l,r){
  window.__nativeInsets=1;
  const s=document.documentElement.style;
  s.setProperty('--inset-top',t+'px');
  s.setProperty('--inset-bottom',b+'px');
  s.setProperty('--inset-left',l+'px');
  s.setProperty('--inset-right',r+'px');
};

/* ================= TEMA ================= */
/* uma so MediaQueryList, guardada: registar o ouvinte numa criada de fresco
   deixa-a sem referencias, e ha motores que a recolhem e param de avisar */
let _mq=null;
// a tal MediaQueryList do modo escuro, criada uma vez e reutilizada; se o matchMedia
// falhar, devolve um substituto inerte para o resto do código não ter de testar.
// Devolve: a MediaQueryList de '(prefers-color-scheme: dark)', ou o tal substituto inerte.
const mq=()=>{
  if(_mq)return _mq;
  try{_mq=window.matchMedia('(prefers-color-scheme: dark)')}
  catch(e){_mq={matches:false,addEventListener(){},addListener(){}}}
  return _mq;
};
// o tema efetivo é escuro? Sim com 'dark' explícito, ou em automático quando o sistema está escuro.
// Devolve: true se o tema efetivo for escuro; false caso contrário.
function isDark(){const t=db.settings.theme;return t==='dark'||(t!=='light'&&mq().matches)}
/* aplica o tema efetivo à página: classe .dark no <html>, paleta dos gráficos
   trocada dentro do próprio array PAL (quem lhe guarda referência vê as cores
   novas), e meta theme-color / color-scheme atualizados — a razão de o modo
   automático não fixar o color-scheme está na nota lá dentro.
   Devolve: nada — aplica o tema à página (classe, paleta e metas). */
function applyTheme(){
  const d=isDark();
  document.documentElement.classList.toggle('dark',d);
  PAL.splice(0,PAL.length,...(d?PAL_DARK:PAL_LIGHT));
  const m=document.getElementById('metaTheme');if(m)m.content=d?'#161a3a':'#1a3a2c';
  /* No modo automático não se fixa o esquema. Fixá-lo era um ciclo vicioso: o
     browser dizia "claro", a app escrevia color-scheme:light, e isso confirma
     ao browser que a página não sabe ser escura — deixando-o sem razão para
     mudar de ideias. Em automático dizemos que sabemos os dois e quem decide
     é ele; só uma escolha explícita fixa um deles. */
  const esq=db.settings.theme==='auto'?'light dark':(d?'dark':'light');
  const cs=document.querySelector('meta[name=color-scheme]');if(cs)cs.content=esq;
  /* «only light» e não «light»: com o telemóvel em modo escuro, o Chrome
     Android («tema escuro para sites») escurece à força páginas que se
     declaram só-claras — o «modo claro que não é bem claro». O only é o
     opt-out documentado desse escurecimento; no escuro não é preciso. */
  try{document.documentElement.style.colorScheme=(esq==='light'?'only light':esq)}catch(e){}
}
// escolhe o tema ('light', 'dark' ou 'auto'), grava nas definições e aplica já.
// Recebe: t — o tema a usar: 'light', 'dark' ou 'auto'.
// Devolve: nada — grava nas definições, aplica o tema e redesenha a vista.
function setTheme(t){db.settings.theme=t;save();applyTheme();render()}
/* o Safari so ganhou addEventListener em MediaQueryList na versao 14: sem o
   addListener antigo, os iPhones mais velhos nunca sabiam da mudanca */
(function(){
  const q=mq(),ao=()=>{if(db.settings.theme==='auto'){applyTheme();render()}};
  try{if(q.addEventListener)q.addEventListener('change',ao);else if(q.addListener)q.addListener(ao)}catch(e){}
})();
