/* ================= CÓPIAS ================= */
const bkName=()=>'gestor-imobiliario-'+today()+'.json';
function b64(s){
  try{const by=new TextEncoder().encode(s);let bin='';for(const b of by)bin+=String.fromCharCode(b);return btoa(bin)}
  catch(e){try{return btoa(unescape(encodeURIComponent(s)))}catch(e2){return ''}}
}
function driveSave(){
  const json=JSON.stringify(db,null,2);
  if(window.Android&&window.Android.saveAs){window.Android.saveAs(bkName(),'application/json',b64(json));return toast('Escolhe onde guardar.')}
  download(bkName(),'application/json',json);
}
function driveOpen(){
  if(window.Android&&window.Android.openFile){window.Android.openFile('application/json');return toast('Escolhe a cópia.')}
  bkPasteBox();
}
window.__fileLoaded=function(name,text){
  if(String(name||'').toLowerCase().endsWith('.csv'))return swParse(text);
  bkLoad(text);
};
function bkPasteBox(){
  openModal('Colar cópia de segurança',`<div class="form">
    <textarea id="bkText" style="min-height:130px;font:13px/1.5 ui-monospace,Menlo,monospace" placeholder='{"properties":[…]}'></textarea></div>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="bkLoad(val('bkText'))">Repor</button>`);
}
function bkLoad(text){
  let d;try{d=JSON.parse(text)}catch(e){return toast('Isso não é um ficheiro válido.')}
  if(!d||!Array.isArray(d.properties)||!Array.isArray(d.transactions))return toast('Falta a lista de imóveis ou de movimentos.');
  confirmModal('Repor cópia',`Substituir os dados atuais por ${d.properties.length} imóveis, ${(d.contracts||[]).length} contratos e ${d.transactions.length} movimentos?`,()=>{
    db=Object.assign({},blank,d,{settings:Object.assign({},blank.settings,d.settings||{})});
    db.properties=db.properties.map(normProp);
    db.owners=(db.owners||[]).map(normPerson);
    db.tenants=(db.tenants||[]).map(normPerson);
    db.contracts=(db.contracts||[]).map(normContract);
    db.templates=(db.templates||[]).map(normTpl);db.recurring=(db.recurring||[]).map(normRec);
    db.groups=(db.groups||[]).map(normGroup);
    db.transactions=db.transactions.map(t=>normTx(Object.assign({},t,{kind:t.kind==='debt'?'loan':t.kind})));
    fillCats(db.settings);migrateSettlements(db);syncAllContractRecs();syncAllLoanRecs();
    save();migrateInline();closeAllModals();applyTheme();buildNav();render();toast('Cópia reposta.');
  });
}
function download(name,mime,content){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type:mime}));
  a.download=name;document.body.appendChild(a);a.click();a.remove();
}
/* "bin" é uma string em que cada carácter é um byte (o PDF) — não pode passar por UTF-8 */
function downloadBytes(name,mime,bin){
  const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i)&255;
  download(name,mime,u);
}
function downloadCsv(){
  const rows=[['data','descricao','tipo','valor','imovel','pago_por','recebido_por','divisao','quarto','inquilinos','categoria','subcategoria','etiquetas','credor','comentarios','capital','juros','selo'],
    ...db.transactions.map(t=>{const c=t.contractId?contract(t.contractId):null,p=prop(t.propertyId);
      return [t.date,t.label,(KIND[t.kind]||{}).short||t.kind,t.amount,propName(t.propertyId),
        t.paidBy&&owner(t.paidBy)?owner(t.paidBy).name:'',t.toId&&owner(t.toId)?owner(t.toId).name:'',splitLabel(t),
        c&&c.roomId?roomName(p,c.roomId):'',c?ctNames(c):'',t.category||'',t.sub||'',(t.tags||[]).join(' / '),
        t.creditor||'',t.notes||'',t.principal||'',t.interest||'',t.stamp||'']})];
  download('movimentos-imobiliarios.csv','text/csv;charset=utf-8',rows.map(r=>r.map(x=>'"'+String(x).split('"').join('""')+'"').join(';')).join('\n'));
  toast('CSV exportado.');
}
function shareReport(){
  const txt=reportText();
  if(window.Android&&window.Android.shareText)return window.Android.shareText('Avaliação do portefólio',txt);
  if(navigator.share)return navigator.share({title:'Avaliação do portefólio',text:txt}).catch(()=>{});
  if(navigator.clipboard)return navigator.clipboard.writeText(txt).then(()=>toast('Relatório copiado.'));
  toast('Não foi possível partilhar.');
}
function wipe(){
  /* Com sessão iniciada, o sync propagava o apagão à conta e aos outros
     aparelhos — e a confirmação dizia "deste dispositivo". Um botão que
     promete menos do que destrói não se corrige com texto: bloqueia-se, e
     aponta-se o caminho certo para cada intenção. */
  if(window.CW&&CW.user){
    openModal('Apagar tudo',
      `<div class="hint" style="font-size:14px">Com sessão iniciada, isto apagava os dados também
       na tua conta e nos outros aparelhos — não só neste.<br><br>
       · Para limpar só este dispositivo, sai da conta primeiro (Definições → Conta e partilha).<br>
       · Para apagar a conta e tudo o que lá está, usa Conta e partilha → Apagar conta.</div>`,
      '<button class="btn primary" onclick="closeModal()">Percebi</button>');
    return;
  }
  confirmModal('Apagar tudo','Isto apaga imóveis, contratos, pessoas, movimentos e definições deste dispositivo.',()=>{
    const th=db.settings.theme;db=JSON.parse(JSON.stringify(blank));db.settings.theme=th;
    ownerFilter='';save();render();toast('Dados apagados.');
  });
}
