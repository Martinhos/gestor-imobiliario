/* ================= ANEXOS (IndexedDB) ================= */
let _idb=null;
// Abre (uma só vez) a base 'gi_files' do IndexedDB e devolve a ligação; rejeita quando o browser não deixa.
// Devolve: promessa da ligação (IDBDatabase) à base 'gi_files'; rejeita quando o IndexedDB não abre.
function idb(){
  return new Promise((res,rej)=>{
    if(_idb)return res(_idb);
    try{
      const r=indexedDB.open('gi_files',1);
      r.onupgradeneeded=()=>{r.result.createObjectStore('files')};
      r.onsuccess=()=>{_idb=r.result;res(_idb)};
      r.onerror=()=>rej(r.error||new Error('IndexedDB indisponível'));
    }catch(e){rej(e)}
  });
}
/* sem IndexedDB (pré-visualização num browser restrito) os ficheiros ficam em memória durante a sessão */
const memFiles={};
/* let, não const: a camada da nuvem envolve-as para os anexos irem também
   para o armazenamento remoto e voltarem noutro aparelho */
let idbPut=(id,blob)=>idb().then(d=>new Promise((res,rej)=>{
  const t=d.transaction('files','readwrite');t.objectStore('files').put(blob,id);
  t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})).catch(()=>{memFiles[id]=blob});
let idbGet=id=>idb().then(d=>new Promise((res,rej)=>{
  const r=d.transaction('files','readonly').objectStore('files').get(id);
  r.onsuccess=()=>res(r.result||memFiles[id]);r.onerror=()=>rej(r.error)})).catch(()=>memFiles[id]);
/* Deitar fora o blob deste aparelho, e mais nada.

   Distinto do idbDel de propósito: a nuvem embrulha o idbDel para mandar
   também um DELETE ao servidor, porque «apagar o anexo» é apagá-lo em todo o
   lado. Arrumar a despensa local é outra coisa, e não pode ter esse efeito.
   Recebe: id — o id do anexo.
   Devolve: promessa que resolve quando o blob sai deste aparelho. */
const idbDelLocal=id=>{delete memFiles[id];return idb().then(d=>new Promise((res,rej)=>{
  const t=d.transaction('files','readwrite');t.objectStore('files').delete(id);
  t.oncomplete=()=>res();t.onerror=()=>rej(t.error)}))};
let idbDel=id=>idbDelLocal(id);
const pendingFiles={},thumbCache={};
/* Os anexos pendentes são os dos formulários abertos (o cleanFiles poupa-os
   enquanto lá estão). Sem janela nenhuma aberta não há formulário: o que ficou
   por gravar é lixo, e deixa de ser poupado. Quem chama é o closeModal, ao
   fechar a última janela.
   Devolve: nada — esvazia o pendingFiles (o mesmo objeto, que é const). */
function esquecerPendentes(){Object.keys(pendingFiles).forEach(k=>{delete pendingFiles[k]})}
/* As miniaturas em memória são object URLs, e cada um prende o blob enquanto
   vive: numa app que fica aberta semanas, isso crescia a cada ficha aberta.
   Ficam no máximo MINIATURAS_MAX; passado o teto sai a menos usada, e o URL
   dela revoga-se. Um <img> que já a mostra continua a mostrá-la (o browser já a
   leu), e se ela voltar a ser pedida o thumbSrc faz outra. */
const MINIATURAS_MAX=150;
const _ordemMiniaturas=[];
/* Marca uma miniatura como acabada de usar: passa para o fim da fila do teto.
   Recebe: id — o id da foto.
   Devolve: nada. */
function usarMiniatura(id){const i=_ordemMiniaturas.indexOf(id);if(i>-1)_ordemMiniaturas.splice(i,1);_ordemMiniaturas.push(id)}
/* Guarda a miniatura de uma foto, com o teto. Se ela já lá está (duas pinturas
   seguidas pediram-na ao mesmo tempo), fica a que já estava — pode estar num
   <img> ainda a carregar — e o URL que chegou a mais revoga-se.
   Recebe: id — o id da foto; url — o object URL da miniatura.
   Devolve: o URL que fica guardado (string). */
function guardarMiniatura(id,url){
  const ja=thumbCache[id];
  if(ja&&ja!==url){try{URL.revokeObjectURL(url)}catch(e){}usarMiniatura(id);return ja}
  thumbCache[id]=url;usarMiniatura(id);
  while(_ordemMiniaturas.length>MINIATURAS_MAX){
    const velho=_ordemMiniaturas.shift();
    try{URL.revokeObjectURL(thumbCache[velho])}catch(e){}
    delete thumbCache[velho];
  }
  return url;
}
/* O object URL da última descarga (o downloadMeta, e o download das cópias e
   dos CSV). Revoga-se ao criar o da seguinte, e não logo depois do clique: há
   browsers que só leem o blob depois de o clique voltar, e revogado antes
   disso a descarga sai vazia. Assim fica no máximo um preso, e não um por
   descarga para sempre. */
let _urlDescarga=null;
/* Descarrega um blob com um nome: um <a download> temporário, clicado e tirado.
   Recebe: blob — o conteúdo (Blob); nome — o nome do ficheiro.
   Devolve: nada — dispara a descarga (e revoga o URL da descarga anterior). */
function descarregarBlob(blob,nome){
  if(_urlDescarga){try{URL.revokeObjectURL(_urlDescarga)}catch(e){}}
  _urlDescarga=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=_urlDescarga;a.download=nome;document.body.appendChild(a);a.click();a.remove();
}
// Os metadados de todos os anexos referidos nos dados gravados: contratos, fotos e
// hipotecas dos imóveis, documentos de pessoas. É a lista do que deve existir em disco.
// Devolve: lista de metadados ({id,name,type,size,added}), um por anexo referido.
function allFileMetas(){
  const out=[];
  db.contracts.forEach(c=>(c.files||[]).forEach(f=>out.push(f)));
  db.properties.forEach(p=>{(p.photos||[]).forEach(f=>out.push(f));
    (p.loans||[]).forEach(l=>(l.files||[]).forEach(f=>out.push(f)))});
  db.owners.concat(db.tenants).forEach(p=>(p.files||[]).forEach(f=>out.push(f)));
  return out;
}
// Apaga do IndexedDB os blobs que já nada refere, poupando os pendentes dos
// formulários ainda abertos. Corre em fundo e falha em silêncio.
// Devolve: nada — a limpeza segue em fundo.
function cleanFiles(){
  /* Espera por saber. Isto decide o que é órfão a partir do db, e no arranque
     o db é o que está no aparelho: com uma conta partilhada, o armazenamento
     cheio ou um estado do servidor ainda por chegar, «órfão» queria dizer
     «ainda não sei que existe». A espera acaba sempre (espera.js:sabemosOEstado), por
     isso isto não fica a tentar para sempre. */
  if(!sabemosOEstado())return void setTimeout(cleanFiles,1500);
  /* com um serviço desligado nesta conta, os registos dele não estão no db e
     os anexos deles pareceriam órfãos: não se arruma nada até estar tudo ligado */
  if(typeof servicosDesligados==='function'&&servicosDesligados().length)return;
  idb().then(d=>{
    const r=d.transaction('files','readonly').objectStore('files').getAllKeys();
    r.onsuccess=()=>{
      const keep=Object.assign({},pendingFiles);
      allFileMetas().forEach(f=>keep[f.id]=1);
      /* e a miniatura de cada um (tn_<id>): sem isto o arranque deitava-as
         fora todas, e cada sessão voltava a fazê-las do original (ou a
         pedi-las ao servidor, noutro aparelho) */
      Object.keys(keep).forEach(k=>{keep['tn_'+k]=1});
      /* e apaga SÓ daqui: o idbDel está embrulhado pela nuvem para mandar um
         DELETE ao servidor, e uma arrumação local nunca deve destruir o
         anexo dos outros aparelhos */
      (r.result||[]).forEach(k=>{if(!keep[k])idbDelLocal(k)});
    };
  }).catch(()=>{});
}
/* O tamanho de um ficheiro para ler: em KB, ou em MB a partir de 1 MB, com vírgula.
   Recebe: b — o tamanho em bytes.
   Devolve: o texto, ex.: «1,5 MB»; nunca menos de «1 KB». */
const kb=b=>b>=1048576?(b/1048576).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(b/1024))+' KB';
/* O tipo MIME é de uma imagem.
   Recebe: t — o tipo MIME (aguenta vazio).
   Devolve: true/false. */
const isImg=t=>/^image\//.test(String(t||''));
/** Lê ficheiros do <input>, guarda os blobs e devolve os metadados.
   Recebe: input — o elemento <input type="file"> de onde vêm os ficheiros (o value fica limpo).
   Devolve: promessa da lista de metadados ({id,name,type,size,added}) dos aceites — os maiores de 25 MB ficam de fora. */
function takeFiles(input){
  const fs=[].slice.call(input.files||[]);input.value='';
  if(!fs.length)return Promise.resolve([]);
  return Promise.all(fs.map(f=>{
    if(f.size>25*1024*1024){toast(`“${f.name}” é demasiado grande (máx. 25 MB).`);return null}
    const id=uid();pendingFiles[id]=1;
    return idbPut(id,f).then(()=>new Promise(resolve=>{
      if(!isImg(f.type)){resolve(normFile({id,name:f.name,type:f.type||'',size:f.size,added:today()}));return}
      /* a miniatura de 220px começa já, a partir do ficheiro na mão; nunca
         o original em memória (componentes.js:fazerMiniatura) — até ela
         chegar, a caixa mostra o marcador */
      fazerMiniatura(id,f).catch(()=>{});
      resolve(normFile({id,name:f.name,type:f.type||'',size:f.size,added:today()}));
    }));
  }).filter(Boolean));
}
// Abre um anexo a partir dos metadados: imagens em modal com botão de guardar,
// o resto descarrega logo. Avisa por toast quando o blob não está no aparelho.
// Uma foto de um imóvel com outras ao lado abre em carrossel (fotoCarrossel),
// e abre logo, sem esperar pelo blob: noutro aparelho a foto inteira desce do
// servidor, e esperar por ela antes de abrir era um toque sem resposta
// nenhuma durante segundos. O palco mostra a miniatura e o anel até ela
// chegar (fotoPintar); uma que não está em lado nenhum diz-o no palco.
// O object URL da imagem vive o que a janela viver: revoga-se quando ela fecha
// (o aoFechar da camada, que o closeModal corre).
// Recebe: meta — os metadados do anexo ({id,name,type,size,added});
// doFormulario (opcional) — verdadeiro quando o toque veio das fotos do
// formulário do imóvel: o carrossel segue a ordem de lá (fotosDoImovel).
// Devolve: nada — abre o modal ou dispara a descarga.
function openFileMeta(meta,doFormulario){
  if(!meta)return toast('Anexo não encontrado.');
  const fotos=isImg(meta.type)?fotosDoImovel(meta.id,doFormulario):null;
  if(fotos&&fotos.lista.length>1)return fotoCarrossel(fotos,meta.id);
  idbGet(meta.id).then(blob=>{
    if(!blob)return toast('Anexo não encontrado no dispositivo.');
    if(isImg(meta.type)){
      const url=URL.createObjectURL(blob);
      const L=openModal(meta.name||'Imagem',`<div class="form"><img src="${url}" alt="" class="u-w-100pc u-br-12px">
        <div class="hint">${kb(meta.size)}${meta.added?' · '+dPT(meta.added):''}</div></div>`,
        `<button class="btn" data-click="closeModal()">Voltar</button><button class="btn primary" data-click="downloadMeta('${jsq(meta.id)}')">Guardar</button>`);
      if(L)L.aoFechar=()=>{try{URL.revokeObjectURL(url)}catch(e){}};
    }else downloadMeta(meta.id);
  }).catch(()=>toast('Não foi possível abrir o anexo.'));
}
/* ================= AS FOTOS DE UM IMÓVEL, EM CARROSSEL =================
   Na janela de uma foto de um imóvel, arrastar de lado passa à seguinte ou à
   anterior, com volta: depois da última vem a primeira, e antes da primeira a
   última. A fita tem três lugares — a anterior, a de agora e a seguinte — e o
   dedo leva-a consigo, com as vizinhas a espreitar dos lados. Largar depois
   de um quarto da largura, ou com um sacudir, acaba a viagem; antes disso a
   foto volta ao sítio. As regras do gesto são as do calendário e dos
   separadores (calendario.js:calArrastar, navegacao.js:sepArrastoMove): o
   eixo decide-se aos 10px e a folga de decidir não conta; um gesto que começa
   na vertical é do corpo da janela, que rola (o touch-action:pan-y do
   .fc-palco); o clique que vem a seguir a um arrasto engole-se. No
   computador há as setas ‹ ›, e no teclado ← → — essas sem fita, porque um
   atalho de teclado não anima. Sem movimento (prefers-reduced-motion) a foto
   não segue o dedo e a troca é de uma vez, como nos separadores.
   Só as fotos de um imóvel: os outros anexos abrem como sempre. */
let _fotoArrasto=null;   // o arrasto em curso: {c,palco,fita,id,x0,y0,base,dx,desl,ativo,mexe,w,vx,xa,ta}, ou null

/* As fotos do imóvel a que pertence uma foto, pela ordem dele (a primeira é a
   capa). Vindo do formulário do imóvel, a ordem é a do formulário — pode ter
   fotos ainda por gravar, ou ter sido reordenada; senão, a do imóvel gravado.
   Recebe: fid — o id da foto; doFormulario (opcional) — verdadeiro quando o
   toque veio das fotos do formulário (componentes.js:fileBlock).
   Devolve: {lista, nome} — as fotos (só imagens) e o nome do imóvel —, ou
   null se a foto não é de imóvel nenhum (um anexo de contrato, de pessoa). */
function fotosDoImovel(fid,doFormulario){
  const tem=l=>(l||[]).some(f=>f&&f.id===fid);
  const de=x=>({lista:(x.photos||[]).filter(f=>f&&isImg(f.type)),nome:x.name||''});
  const form=typeof pForm!=='undefined'&&pForm?pForm:null;
  if(doFormulario&&form&&tem(form.photos))return de(form);
  const p=((typeof db!=='undefined'&&db&&db.properties)||[]).find(x=>tem(x.photos));
  if(p)return de(p);
  // uma foto acabada de adicionar a um imóvel novo só existe no formulário
  return form&&tem(form.photos)?de(form):null;
}

/* O lugar a d passos do i numa fila de n, com volta.
   Recebe: i — o lugar de agora; d — os passos (negativo para trás); n — o tamanho da fila.
   Devolve: o lugar (0..n-1); 0 se a fila está vazia. */
function fotoVolta(i,d,n){return n>0?(((i+d)%n)+n)%n:0}

/* De quem é o gesto, pelo que o dedo andou: horizontal é do carrossel,
   vertical é do corpo da janela, que rola; antes dos 10px ainda não se sabe.
   Recebe: dx, dy — px que o dedo andou desde que pousou.
   Devolve: 'x', 'y' ou '' (ainda por decidir). */
function fotoEixo(dx,dy){
  if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx))return 'y';
  return Math.abs(dx)>=10?'x':'';
}

/* Largar vira para a vizinha? Depois de um quarto da largura, ou com um
   sacudir para o mesmo lado (as contas do calendario.js:calArrastoFim).
   Recebe: desl — px a que a foto está deslocada; w — a largura de um passo;
   vx — a velocidade do dedo, em px/ms.
   Devolve: 1 (a seguinte: arrastou-se para a esquerda), -1 (a anterior) ou 0 (volta ao sítio). */
function fotoDecide(desl,w,vx){
  const vira=Math.abs(desl)>w/4||(Math.abs(desl)>30&&Math.abs(vx)>.4&&(vx<0)===(desl<0));
  return vira?(desl<0?1:-1):0;
}

/* O nome de uma foto para ler: o que lhe deram, ou «Foto 3».
   Recebe: f — os metadados da foto; i — o lugar dela na fila.
   Devolve: o texto. */
function fotoNome(f,i){return (f&&f.name)||('Foto '+(i+1))}

/* Abre a janela do carrossel numa foto. Os object URLs ficam na camada e
   soltam-se quando ela fecha; enquanto está aberta, só ficam presos os das
   três fotos da fita (fotoPintar). Sem o blob, a foto de abertura começa
   logo a ser pedida (fotoUrl), com ou sem palco à vista.
   Recebe: fotos — {lista, nome}, de fotosDoImovel; fid — a foto onde abre;
   blob (opcional) — o blob dela, se já estiver lido.
   Devolve: nada — abre a janela. */
function fotoCarrossel(fotos,fid,blob){
  const lista=fotos.lista,i=Math.max(0,lista.findIndex(f=>f.id===fid));
  const lugar=(cl,k)=>`<div class="fc-slide ${cl}"${k?' aria-hidden="true"':''}><img class="fc-img" alt="" draggable="false"><span class="fc-falta">Esta foto não está neste aparelho.</span></div>`;
  const L=openModal(fotoNome(lista[i],i),`<div class="form fc">
    <div class="fc-palco" role="group" aria-roledescription="carrossel" aria-label="${esc('Fotos'+(fotos.nome?' de '+fotos.nome:''))}" data-pointerdown="fotoArrastar(event,this)">
      <div class="fc-fita">${lugar('fc-ant',-1)}${lugar('fc-cur',0)}${lugar('fc-seg',1)}</div>
      <button type="button" class="fc-seta fc-seta-ant" aria-label="Foto anterior" data-click="fotoPassar(-1)">${ic('chev',20)}</button>
      <button type="button" class="fc-seta fc-seta-seg" aria-label="Foto seguinte" data-click="fotoPassar(1)">${ic('chevR',20)}</button></div>
    <div class="hint fc-info"><b class="fc-pos" aria-live="polite"></b><span class="fc-meta"></span></div></div>`,
    `<button class="btn" data-click="closeModal()">Voltar</button><button class="btn primary" data-click="fotoGuardar()">Guardar</button>`);
  if(!L)return;
  const c={lista,i,L,urls:{},pedidos:{},anim:null,fimAnim:null,animD:0,animW:0,fechado:false};
  if(blob)c.urls[lista[i].id]=URL.createObjectURL(blob);else fotoUrl(c,lista[i]);
  L.fotos=c;
  L.aoFechar=()=>{
    c.fechado=true;
    if(_fotoArrasto&&_fotoArrasto.c===c)fotoArrastoLargar();
    Object.keys(c.urls).forEach(k=>{try{URL.revokeObjectURL(c.urls[k])}catch(e){}});
    c.urls={};c.pedidos={};
  };
  fotoPintar(c);
}

/* O carrossel da janela de cima, se a de cima for um.
   Devolve: o estado do carrossel ({lista,i,L,…}), ou null. */
function fotoAtual(){
  const t=typeof modalTop==='function'?modalTop():null;
  return t&&t.fotos&&!t.fotos.fechado?t.fotos:null;
}

/* As peças do carrossel no ecrã.
   Recebe: c — o estado do carrossel.
   Devolve: {palco, fita} (null onde não houver). */
function fotoPecas(c){
  const el=c&&c.L&&c.L.el;
  let palco=el&&el.querySelector?el.querySelector('.fc-palco'):null;
  if(palco&&typeof palco.querySelector!=='function')palco=null;
  return {palco,fita:palco?palco.querySelector('.fc-fita'):null};
}

/* O object URL de uma foto, lido uma vez por janela.
   Recebe: c — o estado do carrossel; f — os metadados da foto.
   Devolve: promessa do URL, ou de null se a foto não está no aparelho. */
function fotoUrl(c,f){
  if(c.urls[f.id])return Promise.resolve(c.urls[f.id]);
  if(!c.pedidos[f.id])c.pedidos[f.id]=idbGet(f.id).then(b=>{
    if(!b||c.fechado)return null;
    if(!c.urls[f.id])c.urls[f.id]=URL.createObjectURL(b);
    return c.urls[f.id];
  }).catch(()=>null);
  return c.pedidos[f.id];
}

/* Enquanto a foto inteira desce, o lugar mostra a miniatura dela, se já a
   houver em memória ou a caminho (componentes.js:thumbSrc, o mesmo pedido que
   as caixas fizeram): esticada é desfocada, mas diz que foto vem aí. O URL é
   do thumbCache, não da janela — não entra no c.urls nem se revoga ao fechar.
   Quando a inteira chega, troca-se o src; o browser só larga a miniatura
   quando a inteira está pronta a mostrar.
   Recebe: img — o .fc-img do lugar; id — o id da foto.
   Devolve: nada. */
function fotoMiniaturaPorBaixo(img,id){
  const vale=()=>img.getAttribute('data-id')===id&&!img.getAttribute('data-inteira');
  const ja=typeof thumbCache!=='undefined'&&thumbCache[id];
  if(ja){img.src=ja;return}
  if(typeof thumbSrc!=='function')return;
  thumbSrc(id).then(u=>{if(u&&vale())img.src=u}).catch(()=>{});
}

/* Pinta a fita pelo lugar de agora: a anterior, a de agora e a seguinte (com
   duas fotos, as vizinhas são a mesma), o título, o «3 de 8» e o tamanho.
   Um lugar que já mostra a foto certa fica como está — é o que deixa rodar a
   fita sem a foto piscar. Os URLs das fotos que saíram da fita soltam-se.
   Um lugar cuja foto inteira ainda não está na janela mostra a miniatura
   (fotoMiniaturaPorBaixo) e, se a espera passar do limiar, o anel que roda
   (componentes.js:anelEnquanto) — sai quando ela chega ou quando falha.
   Recebe: c — o estado do carrossel.
   Devolve: nada. */
function fotoPintar(c){
  const n=c.lista.length,{palco}=fotoPecas(c),fica={};
  [['fc-ant',-1],['fc-cur',0],['fc-seg',1]].forEach(([cl,k])=>{
    const j=fotoVolta(c.i,k,n),f=c.lista[j];fica[f.id]=1;
    const s=palco?palco.querySelector('.'+cl):null;if(!s)return;
    if(k)s.setAttribute('aria-hidden','true');else s.removeAttribute('aria-hidden');
    const img=s.querySelector('img');if(!img)return;
    img.alt=k?'':fotoNome(f,j);
    if(img.getAttribute('data-id')===f.id)return;
    img.setAttribute('data-id',f.id);img.removeAttribute('src');img.removeAttribute('data-inteira');s.classList.remove('fc-sem');
    const ja=!!c.urls[f.id],p=fotoUrl(c,f);
    if(!ja){
      // enquanto a inteira desce, a miniatura por baixo (se a houver) e o anel por cima
      fotoMiniaturaPorBaixo(img,f.id);
      if(typeof anelEnquanto==='function')anelEnquanto(s,p);
    }
    p.then(u=>{
      if(img.getAttribute('data-id')!==f.id)return;
      if(u){img.src=u;img.setAttribute('data-inteira','1')}else s.classList.add('fc-sem');
    });
  });
  const f=c.lista[c.i];
  c.L.title=fotoNome(f,c.i);
  const el=c.L.el,q=s=>el&&el.querySelector?el.querySelector(s):null;
  const h=q('.head h2');if(h)h.textContent=c.L.title;
  const pos=q('.fc-pos');if(pos)pos.textContent=(c.i+1)+' de '+n;
  const m=q('.fc-meta');if(m)m.textContent=' · '+kb(f.size||0)+(f.added?' · '+dPT(f.added):'');
  Object.keys(c.urls).forEach(k=>{if(!fica[k]){try{URL.revokeObjectURL(c.urls[k])}catch(e){}delete c.urls[k];delete c.pedidos[k]}});
}

/* Passa d fotos sem fita: muda o lugar e roda os três lugares da fita (a
   seguinte passa a ser a de agora, e a de agora a anterior), para quem já lá
   estava não ter de carregar outra vez.
   Recebe: c — o estado do carrossel; d — 1 (a seguinte) ou -1 (a anterior).
   Devolve: nada. */
function fotoRodar(c,d){
  c.i=fotoVolta(c.i,d,c.lista.length);
  const {palco}=fotoPecas(c);
  if(palco){
    const ant=palco.querySelector('.fc-ant'),cur=palco.querySelector('.fc-cur'),seg=palco.querySelector('.fc-seg');
    const troca=(s,de,para)=>{if(s){s.classList.remove(de);s.classList.add(para)}};
    if(d>0){troca(cur,'fc-cur','fc-ant');troca(seg,'fc-seg','fc-cur');troca(ant,'fc-ant','fc-seg')}
    else{troca(cur,'fc-cur','fc-seg');troca(ant,'fc-ant','fc-cur');troca(seg,'fc-seg','fc-ant')}
  }
  fotoPintar(c);
}

/* A largura de um passo da fita: o palco e a folga entre fotos (--fc-folga).
   Recebe: palco — o .fc-palco.
   Devolve: px (0 sem palco). */
function fotoPasso(palco){
  if(!palco)return 0;
  let folga=0;
  try{folga=parseFloat(getComputedStyle(palco).getPropertyValue('--fc-folga'))||0}catch(e){}
  return (palco.getBoundingClientRect().width||0)+folga;
}

/* Acaba já a viagem em curso (uma seta tocada a meio de outra, um dedo que
   apanha a foto a andar) e diz onde a fita está, já no arranjo novo: a
   viagem seguinte parte dali, sem salto.
   Recebe: c — o estado do carrossel.
   Devolve: px a que a fita está deslocada (0 parada no sítio). */
function fotoParar(c){
  const {fita}=fotoPecas(c);if(!fita)return 0;
  let x=0;
  try{x=new DOMMatrixReadOnly(getComputedStyle(fita).transform).m41||0}catch(e){x=0}
  if(c.anim&&c.fimAnim){const d=c.animD,w=c.animW;c.fimAnim();x+=d*w}
  fita.style.transform='';
  return x;
}

/* A viagem até à vizinha. Pelas setas parte parada, na --curva-fita e no
   --lento (a fita das listas, continuidade.js:correrAFita); largada por um
   dedo já vem a andar, e acaba na --curva-entra e no --medio, que arranca
   à velocidade a que o dedo a deixou. No fim roda os lugares e a fita volta
   a zero no mesmo instante — sem fotograma nenhum pelo meio.
   Recebe: c — o estado do carrossel; d — 1 ou -1; desde — px de onde parte;
   largado — verdadeiro se foi um dedo a largá-la.
   Devolve: nada. */
function fotoCorrer(c,d,desde,largado){
  const {palco,fita}=fotoPecas(c),w=fotoPasso(palco);
  if(fita)fita.style.transform='';
  if(!fita||!fita.animate||!w||semMovimento())return fotoRodar(c,d);
  const dur=largado?msDoToken('--medio',200):msDoToken('--lento',340);
  const curva=largado?tokenTexto('--curva-entra','cubic-bezier(0,0,.2,1)'):tokenTexto('--curva-fita','cubic-bezier(.4,0,.2,1)');
  const an=fita.animate([{transform:'translateX('+(desde||0)+'px)'},{transform:'translateX('+(-d*w)+'px)'}],
    {duration:dur,easing:curva,fill:'forwards'});
  const fim=()=>{if(c.anim!==an)return;c.anim=null;c.fimAnim=null;fotoRodar(c,d);try{an.cancel()}catch(e){}};
  c.anim=an;c.animD=d;c.animW=w;c.fimAnim=fim;
  an.onfinish=fim;
  // a rede de sempre: num separador escondido o onfinish não chega
  setTimeout(fim,dur+120);
}

/* A foto volta ao sítio, de onde o dedo a deixou (--medio, --curva-entra,
   como o regresso do calendário e dos separadores).
   Recebe: c — o estado do carrossel; de — px a que estava deslocada.
   Devolve: nada. */
function fotoAssentar(c,de){
  const {fita}=fotoPecas(c);if(!fita)return;
  fita.style.transform='';
  if(!de||!fita.animate||semMovimento())return;
  const dur=msDoToken('--medio',200);
  const an=fita.animate([{transform:'translateX('+de+'px)'},{transform:'none'}],
    {duration:dur,easing:tokenTexto('--curva-entra','cubic-bezier(0,0,.2,1)')});
  const fim=()=>{if(c.anim!==an)return;c.anim=null;c.fimAnim=null;try{an.cancel()}catch(e){}};
  c.anim=an;c.animD=0;c.animW=0;c.fimAnim=fim;
  an.onfinish=fim;
  setTimeout(fim,dur+120);
}

/* As setas ‹ ›: a anterior ou a seguinte, com fita. Uma seta tocada a meio
   de uma viagem acaba essa e continua dali.
   Recebe: d — 1 (a seguinte) ou -1 (a anterior).
   Devolve: nada. */
function fotoPassar(d){
  const c=fotoAtual();if(!c||c.lista.length<2)return;
  fotoCorrer(c,d>0?1:-1,fotoParar(c),false);
}

/* O «Guardar» da janela: descarrega a foto que está à vista.
   Devolve: nada. */
function fotoGuardar(){
  const c=fotoAtual();if(c)downloadMeta(c.lista[c.i].id);
}

/* ← e → passam de foto, sem fita (um atalho de teclado não anima). Não
   mexe num campo de texto nem com uma tecla de modo carregada.
   Recebe: e — o evento keydown.
   Devolve: nada. */
function fotoTecla(e){
  if(!e||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
  const c=fotoAtual();if(!c||c.lista.length<2||_fotoArrasto)return;
  const t=e.target;
  if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName||'')||t.isContentEditable))return;
  if(typeof e.preventDefault==='function')e.preventDefault();
  fotoParar(c);
  fotoRodar(c,e.key==='ArrowRight'?1:-1);
}
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('keydown',fotoTecla);

/* Começa (talvez) um arrasto: guarda onde o dedo pousou e fica à escuta. Só
   passa a arrastar no fotoArrastoMove, quando o dedo andou na horizontal. Um
   dedo que pousa numa foto a meio de uma viagem apanha-a onde ela está.
   Recebe: e — o PointerEvent do pointerdown; palco — o .fc-palco.
   Devolve: nada — liga os ouvintes do documento. */
function fotoArrastar(e,palco){
  const c=fotoAtual();
  if(!c||c.lista.length<2||_fotoArrasto||!e||e.button>0||e.isPrimary===false||!palco)return;
  const fita=palco.querySelector('.fc-fita');if(!fita)return;
  const base=c.anim?fotoParar(c):0;
  if(base)fita.style.transform='translateX('+base+'px)';
  _fotoArrasto={c,palco,fita,id:e.pointerId,x0:e.clientX,y0:e.clientY,base,dx:0,desl:base,ativo:false,mexe:false,w:0,vx:0,xa:e.clientX,ta:Date.now()};
  document.addEventListener('pointermove',fotoArrastoMove);
  document.addEventListener('pointerup',fotoArrastoFim);
  document.addEventListener('pointercancel',fotoArrastoFim);
}

/* O dedo andou: decide se o gesto é do carrossel (horizontal) ou do corpo da
   janela (vertical), e, sendo do carrossel, leva a fita com ele.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada — mexe no transform da fita. */
function fotoArrastoMove(e){
  const a=_fotoArrasto;if(!a||e.pointerId!==a.id)return;
  let dx=e.clientX-a.x0;const dy=e.clientY-a.y0;
  if(!a.ativo){
    const eixo=fotoEixo(dx,dy);
    // o dedo foi para cima ou para baixo: é o corpo da janela a rolar, não é connosco
    if(eixo==='y')return fotoArrastoFim({type:'pointercancel',pointerId:a.id});
    if(!eixo)return;
    // entretanto a janela pode ter fechado (o voltar do sistema): o gesto deixou de ser nosso
    if(fotoAtual()!==a.c)return fotoArrastoLargar();
    a.ativo=true;a.w=fotoPasso(a.palco)||1;a.mexe=!semMovimento();
    // a folga de decidir não conta: a foto arranca colada ao dedo, sem salto
    a.x0+=dx<0?-10:10;dx=e.clientX-a.x0;
    a.palco.classList.add('arrasta');
  }
  const agora=Date.now(),dt=agora-a.ta;
  // a velocidade dos últimos instantes, alisada: é ela que diz se o gesto foi um sacudir
  if(dt>0)a.vx=.6*((e.clientX-a.xa)/dt)+.4*a.vx;
  a.xa=e.clientX;a.ta=agora;a.dx=dx;a.desl=a.base+dx;
  if(a.mexe)a.fita.style.transform='translateX('+a.desl+'px)';
}

/* Tira os ouvintes do documento e esquece o arrasto.
   Devolve: nada. */
function fotoArrastoLargar(){
  document.removeEventListener('pointermove',fotoArrastoMove);
  document.removeEventListener('pointerup',fotoArrastoFim);
  document.removeEventListener('pointercancel',fotoArrastoFim);
  if(_fotoArrasto&&_fotoArrasto.palco)_fotoArrasto.palco.classList.remove('arrasta');
  _fotoArrasto=null;
}

/* O dedo saiu: passa à vizinha, se o gesto chegou para isso, ou devolve a
   foto ao sítio. Um pointercancel (o browser ficou com o gesto, para rolar)
   nunca vira. O clique que o browser dispara a seguir a um arrasto engole-se
   (navegacao.js:sepEngolirToque): largar em cima de uma seta passava outra.
   Recebe: e — o PointerEvent do pointerup ou do pointercancel.
   Devolve: nada — corre a fita ou anima o regresso. */
function fotoArrastoFim(e){
  const a=_fotoArrasto;if(!a||(e&&e.pointerId!==a.id))return;
  fotoArrastoLargar();
  if(a.c.fechado)return;
  // um toque sem arrasto numa foto que andava: ela acaba de assentar
  if(!a.ativo){if(a.base)fotoAssentar(a.c,a.base);return}
  if(typeof sepEngolirToque==='function')sepEngolirToque();
  const d=e.type==='pointercancel'?0:fotoDecide(a.desl,a.w,a.vx);
  if(d)return fotoCorrer(a.c,d,a.mexe?a.desl:0,true);
  fotoAssentar(a.c,a.mexe?a.desl:0);
}
// Descarrega o anexo com o nome original (descarregarBlob, que revoga o URL
// da descarga anterior).
// Recebe: fid — o id do anexo (o campo id dos metadados).
// Devolve: nada — dispara a descarga no browser.
function downloadMeta(fid){
  const meta=allFileMetas().concat(pendingMetas()).find(f=>f.id===fid);
  idbGet(fid).then(blob=>{
    if(!blob)return toast('Anexo não encontrado.');
    descarregarBlob(blob,(meta&&meta.name)||'anexo');toast('Guardado.');
  }).catch(()=>toast('Não foi possível guardar o anexo.'));
}
// Os anexos ainda nos formulários abertos (contrato, imóvel, pessoa, hipotecas):
// já têm blob guardado, mas os metadados ainda não chegaram a db.
// Devolve: lista de metadados ({id,name,type,size,added}) desses anexos pendentes.
function pendingMetas(){
  return [].concat(cForm.files||[],pForm.photos||[],perForm.files||[],
    ...((pForm.loans||[]).map(l=>l.files||[])));
}
