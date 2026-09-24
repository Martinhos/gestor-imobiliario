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
        guardarMiniatura(id,URL.createObjectURL(f));
        makeThumb(f).then(tb=>{if(tb)idbPut('tn_'+id,tb).catch(()=>{})}).catch(()=>{});
      resolve(normFile({id,name:f.name,type:f.type||'',size:f.size,added:today()}));
    }));
  }).filter(Boolean));
}
// Abre um anexo a partir dos metadados: imagens em modal com botão de guardar,
// o resto descarrega logo. Avisa por toast quando o blob não está no aparelho.
// O object URL da imagem vive o que a janela viver: revoga-se quando ela fecha
// (o aoFechar da camada, que o closeModal corre).
// Recebe: meta — os metadados do anexo ({id,name,type,size,added}).
// Devolve: nada — abre o modal ou dispara a descarga.
function openFileMeta(meta){
  if(!meta)return toast('Anexo não encontrado.');
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
