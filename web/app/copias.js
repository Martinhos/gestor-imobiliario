/* ================= CÓPIAS ================= */
// Nome do ficheiro da cópia de segurança do dia.
// Devolve: string — "gestor-imobiliario-<AAAA-MM-DD>.json", com a data de hoje.
const bkName=()=>'gestor-imobiliario-'+today()+'.json';
// Texto -> base64 passando por UTF-8 (o btoa sozinho rebenta com acentos); devolve '' se tudo falhar.
// Recebe: s — o texto a codificar (string).
// Devolve: string em base64; '' se tudo falhar.
function b64(s){
  try{const by=new TextEncoder().encode(s);let bin='';for(const b of by)bin+=String.fromCharCode(b);return btoa(bin)}
  catch(e){try{return btoa(unescape(encodeURIComponent(s)))}catch(e2){return ''}}
}
// Cópia de segurança: serializa a base inteira em JSON e entrega ao seletor de ficheiros do Android ou, no browser, descarrega o .json.
// Devolve: nada — entrega o ficheiro ao Android ou dispara a descarga.
function driveSave(){
  const json=JSON.stringify(db,null,2);
  if(window.Android&&window.Android.saveAs){window.Android.saveAs(bkName(),'application/json',b64(json));return toast('Escolhe onde guardar.')}
  download(bkName(),'application/json',json);
}
// Repor uma cópia: no Android abre o seletor de ficheiros nativo; no browser cai no modal de colar o JSON.
// Devolve: nada — abre o seletor nativo ou o modal de colar.
function driveOpen(){
  if(window.Android&&window.Android.openFile){window.Android.openFile('application/json');return toast('Escolhe a cópia.')}
  bkPasteBox();
}
// Chamada pelo lado Android depois de o utilizador escolher um ficheiro: .csv segue para a importação do Splitwise, o resto é tratado como cópia de segurança.
// Recebe: name — o nome do ficheiro escolhido (string; decide pelo sufixo); text — o conteúdo dele (string).
// Devolve: nada de útil — só encaminha o texto para a importação certa.
window.__fileLoaded=function(name,text){
  if(String(name||'').toLowerCase().endsWith('.csv'))return swParse(text);
  bkLoad(text);
};
// Modal com textarea para colar o conteúdo de uma cópia de segurança à mão.
// Devolve: nada — abre o modal; o Repor chama bkLoad com o que lá estiver.
function bkPasteBox(){
  openModal('Colar cópia de segurança',`<div class="form">
    <textarea id="bkText" class="u-minh-130px u-font-13px-1p5-ui-monospace-menlo-monospace" placeholder='{"properties":[…]}'></textarea></div>`,
    `<button class="btn" data-click="closeModal()">Cancelar</button><button class="btn primary" data-click="bkReporColado()">Repor</button>`);
}
/* Repõe a cópia colada na caixa do bkPasteBox. Era a ação do botão Repor, escrita
   no atributo de clique como bkLoad(val('bkText')): o val é um const de topo
   (componentes.js), e um const não está no window, por isso uma ação não lhe
   chega. Faz exatamente o mesmo — lê a caixa e entrega o texto ao bkLoad, que
   valida, pergunta e só então substitui a base.
   Devolve: nada — o bkLoad trata do resto (e não se devolve o que ele devolve). */
function bkReporColado(){bkLoad(val('bkText'))}
/* Repõe uma cópia de segurança: valida o JSON (tem de trazer imóveis e movimentos),
   pede confirmação com os totais e só então substitui a base inteira — pelo MESMO
   caminho do arranque (dados.js:normalizarBase): cada coleção normalizada e as
   migrações de todas as versões, para uma cópia antiga abrir como abriria do disco.
   Havia aqui uma segunda cópia desse caminho, feita à mão, e já tinha ficado para
   trás: sem os contratos dos inquilinos com renda, sem o CATMAP das categorias,
   sem o tenantId → contractId e sem as visitas. No fim grava, refaz a navegação e
   re-renderiza tudo.
   Recebe: text — o conteúdo da cópia (string com o JSON exportado).
   Devolve: nada — pede confirmação e, com o sim, substitui a base e redesenha tudo. */
function bkLoad(text){
  let d;try{d=JSON.parse(text)}catch(e){return toast('Isso não é um ficheiro válido.')}
  if(!d||!Array.isArray(d.properties)||!Array.isArray(d.transactions))return toast('Falta a lista de imóveis ou de movimentos.');
  confirmModal('Repor cópia',`Substituir os dados atuais por ${d.properties.length} imóveis, ${Array.isArray(d.contracts)?d.contracts.length:0} contratos e ${d.transactions.length} movimentos?`,()=>{
    db=normalizarBase(d);
    if(servicoLigado('recurring')){syncAllContractRecs();syncAllLoanRecs()}   // os planeados automáticos são dos Planeados
    save();migrateInline();closeAllModals();applyTheme();buildNav();render();toast('Cópia reposta.');
  });
}
/* Descarrega "content" como ficheiro no browser (anexos.js:descarregarBlob, que
   revoga o URL da descarga anterior). Um CSV leva à frente a marca de ordem de
   bytes (U+FEFF): o Excel em Windows lê um .csv sem ela como ANSI, e
   «Condomínio», «Manutenção e reparações» e os nomes das pessoas chegavam ao
   contabilista com os acentos estragados. O LibreOffice também a lê; o Numbers
   ignora-a. Vale para todos os CSV da app, porque todos passam por aqui.
   Recebe: name — o nome do ficheiro a gravar; mime — o tipo MIME dele; content — o
   conteúdo (string ou Uint8Array; tirando a marca do CSV, vai tal e qual para o Blob).
   Devolve: nada — dispara a descarga. */
function download(name,mime,content){
  const csv=typeof content==='string'&&/^text\/csv\b/i.test(String(mime||''));
  descarregarBlob(new Blob([csv?'﻿'+content:content],{type:mime}),name);
}
/* "bin" é uma string em que cada carácter é um byte (o PDF) — não pode passar por UTF-8
   Recebe: name — o nome do ficheiro; mime — o tipo MIME; bin — a string binária
   (um byte por carácter, 0–255).
   Devolve: nada — converte para Uint8Array e dispara a descarga. */
function downloadBytes(name,mime,bin){
  const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i)&255;
  download(name,mime,u);
}
/* Uma célula do CSV: entre aspas, com as aspas de dentro dobradas. E um texto
   que comece por = + - @, uma tabulação ou um retorno leva uma plica à frente:
   é assim que o Excel e o LibreOffice o leem como texto, e não como uma
   fórmula — um «=HYPERLINK(…)» numa nota que outra pessoa escreveu numa casa
   partilhada corria no computador de quem exporta. Os números vão tal e qual:
   um valor negativo é um número, não uma fórmula.
   Recebe: x — o valor da célula (texto, número ou vazio).
   Devolve: a célula pronta a juntar com ';' (string). */
function celulaCsv(x){
  let s=String(x==null?'':x);
  if(typeof x!=='number'&&/^[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.split('"').join('""')+'"';
}
/* Exporta todos os movimentos para CSV (ponto e vírgula, campos entre aspas), com
   as colunas já traduzidas para nomes legíveis — imóvel, quem pagou, inquilinos,
   categoria. Pensado para abrir diretamente no Excel: a marca de ordem de bytes
   põe-na o download, e as células passam pelo celulaCsv. No fim vai o que o IRS
   pede: o mês a que a renda respeita, a retenção na fonte, se o recibo
   eletrónico foi emitido (só nas rendas), a coluna do Anexo F (só nas despesas,
   pela mesma regra do resumo: irs.js:irsColunaDe), e o estado fiscal e o
   número na AT do contrato a que o movimento está preso.
   Devolve: nada — dispara a descarga do CSV. */
function downloadCsv(){
  const estadoFisco=c=>!c?'':ctDeclarado(c)?'declarado':ctNaoDeclarado(c)?'nao declarado':'por indicar';
  const rows=[['data','descricao','tipo','valor','imovel','pago_por','recebido_por','divisao','quarto','inquilinos','categoria','subcategoria','etiquetas','credor','comentarios','capital','juros','selo',
      'mes_renda','retencao','recibo','coluna_irs','contrato_fisco','contrato_at'],
    ...db.transactions.map(t=>{const c=t.contractId?contract(t.contractId):null,p=prop(t.propertyId);
      return [t.date,t.label,(KIND[t.kind]||{}).short||t.kind,t.amount,propName(t.propertyId),
        t.paidBy&&owner(t.paidBy)?owner(t.paidBy).name:'',t.toId&&owner(t.toId)?owner(t.toId).name:'',splitLabel(t),
        c&&c.roomId?roomName(p,c.roomId):'',c?ctNames(c):'',t.category||'',t.sub||'',(t.tags||[]).join(' / '),
        t.creditor||'',t.notes||'',t.principal||'',t.interest||'',t.stamp||'',
        t.periodo||'',t.retencao||'',ehRenda(t)?(t.recibo?'sim':'nao'):'',t.kind==='expense'?irsColunaNome(irsColunaDe(t).col):'',
        estadoFisco(c),c?fiscoDe(c).numero:'']})];
  download('movimentos-imobiliarios.csv','text/csv;charset=utf-8',rows.map(r=>r.map(celulaCsv).join(';')).join('\n'));
  toast('CSV exportado.');
}
// Partilha o relatório do portefólio por ordem de preferência: folha de partilha do Android, Web Share API, ou cópia para a área de transferência.
// Devolve: nada de útil — só o efeito de partilhar (ou copiar) o texto.
function shareReport(){
  /* o relatório é da Avaliação: sem esse serviço nesta conta não há o que partilhar */
  const txt=servicoLigado('reports')?reportText():null;
  if(txt==null)return toast(hintServicoDesligado('reports'));
  if(window.Android&&window.Android.shareText)return window.Android.shareText('Avaliação do portefólio',txt);
  if(navigator.share)return navigator.share({title:'Avaliação do portefólio',text:txt}).catch(()=>{});
  if(navigator.clipboard)return navigator.clipboard.writeText(txt).then(()=>toast('Relatório copiado.'));
  toast('Não foi possível partilhar.');
}
// Apagar tudo: limpa a base local (mantém o tema) após confirmação; com sessão iniciada recusa e aponta as alternativas seguras.
// Devolve: nada — com sessão iniciada só explica; sem sessão, apaga após o sim.
function wipe(){
  /* Com sessão iniciada, o sync propagava o apagão à conta e aos outros
     aparelhos — e a confirmação dizia "deste dispositivo". Um botão que
     promete menos do que destrói não se corrige com texto: bloqueia-se, e
     aponta-se o caminho certo para cada intenção. */
  if(window.CW&&CW.user){
    openModal('Apagar tudo',
      `<div class="hint u-fs-14px">Com sessão iniciada, isto apagava os dados também
       na tua conta e nos outros aparelhos — não só neste.<br><br>
       · Para limpar só este dispositivo, sai da conta primeiro (Definições → Conta e partilha).<br>
       · Para apagar a conta e tudo o que lá está, usa Conta e partilha → Apagar conta.</div>`,
      '<button class="btn primary" data-click="closeModal()">Percebi</button>');
    return;
  }
  confirmModal('Apagar tudo','Isto apaga imóveis, contratos, pessoas, movimentos e definições deste dispositivo.',()=>{
    const th=db.settings.theme;db=JSON.parse(JSON.stringify(blank));db.settings.theme=th;
    ownerFilter='';save();render();toast('Dados apagados.');
  });
}
