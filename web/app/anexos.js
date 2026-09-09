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
let idbDel=id=>{delete memFiles[id];return idb().then(d=>new Promise((res,rej)=>{
  const t=d.transaction('files','readwrite');t.objectStore('files').delete(id);
  t.oncomplete=()=>res();t.onerror=()=>rej(t.error)}))};
const pendingFiles={},thumbCache={};
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
  idb().then(d=>{
    const r=d.transaction('files','readonly').objectStore('files').getAllKeys();
    r.onsuccess=()=>{
      const keep=Object.assign({},pendingFiles);
      allFileMetas().forEach(f=>keep[f.id]=1);
      (r.result||[]).forEach(k=>{if(!keep[k])idbDel(k)});
    };
  }).catch(()=>{});
}
const kb=b=>b>=1048576?(b/1048576).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(b/1024))+' KB';
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
        thumbCache[id]=URL.createObjectURL(f);
        makeThumb(f).then(tb=>{if(tb)idbPut('tn_'+id,tb).catch(()=>{})}).catch(()=>{});
      resolve(normFile({id,name:f.name,type:f.type||'',size:f.size,added:today()}));
    }));
  }).filter(Boolean));
}
// Abre um anexo a partir dos metadados: imagens em modal com botão de guardar,
// o resto descarrega logo. Avisa por toast quando o blob não está no aparelho.
// Recebe: meta — os metadados do anexo ({id,name,type,size,added}).
// Devolve: nada — abre o modal ou dispara a descarga.
function openFileMeta(meta){
  if(!meta)return toast('Anexo não encontrado.');
  idbGet(meta.id).then(blob=>{
    if(!blob)return toast('Anexo não encontrado no dispositivo.');
    if(isImg(meta.type)){
      const url=URL.createObjectURL(blob);
      openModal(meta.name||'Imagem',`<div class="form"><img src="${url}" alt="" style="width:100%;border-radius:12px">
        <div class="hint">${kb(meta.size)}${meta.added?' · '+dPT(meta.added):''}</div></div>`,
        `<button class="btn" onclick="closeModal()">Voltar</button><button class="btn primary" onclick="downloadMeta('${meta.id}')">Guardar</button>`);
    }else downloadMeta(meta.id);
  }).catch(()=>toast('Não foi possível abrir o anexo.'));
}
// Descarrega o anexo com o nome original, através de um <a download> temporário.
// Recebe: fid — o id do anexo (o campo id dos metadados).
// Devolve: nada — dispara a descarga no browser.
function downloadMeta(fid){
  const meta=allFileMetas().concat(pendingMetas()).find(f=>f.id===fid);
  idbGet(fid).then(blob=>{
    if(!blob)return toast('Anexo não encontrado.');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=(meta&&meta.name)||'anexo';
    document.body.appendChild(a);a.click();a.remove();toast('Guardado.');
  }).catch(()=>toast('Não foi possível guardar o anexo.'));
}
// Os anexos ainda nos formulários abertos (contrato, imóvel, pessoa, hipotecas):
// já têm blob guardado, mas os metadados ainda não chegaram a db.
// Devolve: lista de metadados ({id,name,type,size,added}) desses anexos pendentes.
function pendingMetas(){
  return [].concat(cForm.files||[],pForm.photos||[],perForm.files||[],
    ...((pForm.loans||[]).map(l=>l.files||[])));
}
