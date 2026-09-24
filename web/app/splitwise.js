/* ================= SPLITWISE ================= */
let swRows=null,swHead=null;
// Recebe o ficheiro escolhido no <input type=file>, lê-o como texto e passa-o ao swParse.
// Limpa o input para que escolher o mesmo ficheiro volte a disparar o evento.
// Recebe: input — o próprio elemento <input type=file> (usa input.files[0]).
// Devolve: nada — a leitura é assíncrona e desagua no swParse.
function swPick(input){const f=input.files&&input.files[0];if(!f)return;input.value='';const r=new FileReader();r.onload=()=>swParse(String(r.result));r.readAsText(f,'utf-8')}
// Alternativa ao seletor de ficheiros: modal com textarea para colar o conteúdo do CSV à mão.
// Devolve: nada — abre o modal.
function swPasteBox(){
  openModal('Colar CSV do Splitwise',`<div class="form"><div class="hint">Abre o CSV, copia tudo e cola aqui — incluindo a linha dos títulos.</div>
    <textarea id="swText" class="u-minh-120px u-font-13px-1p5-ui-monospace-menlo-monospace" placeholder="Date,Description,Category,Cost,Currency,..."></textarea></div>`,
    `<button class="btn" data-click="closeModal()">Cancelar</button><button class="btn primary" data-click="swParseColado()">Continuar</button>`);
}
/* O «Continuar» do swPasteBox: lê o textarea e entrega o texto ao swParse.
   Era um onclick com swParse(val('swText')), e o val é um const de topo — não
   está no window, e uma ação não lhe chega. A ação passa a chamar isto.
   Recebe: nada.
   Devolve: nada — o swParse abre o modal de mapeamento (ou avisa por toast). */
function swParseColado(){swParse(val('swText'))}
// Adivinha o separador do CSV pela linha de cabeçalho: conta vírgulas e pontos e vírgula fora de aspas e fica com o mais frequente.
// Recebe: line — a primeira linha do CSV (o cabeçalho), como texto.
// Devolve: o separador detetado, ';' ou ',' (string de um carácter).
function splitDelim(line){let q=false,c=0,s=0;for(const ch of line){if(ch==='"')q=!q;else if(!q){if(ch===',')c++;if(ch===';')s++}}return s>c?';':','}
/* Leitor de CSV completo: respeita campos entre aspas, aspas escapadas ("") e
   fins de linha \r\n. Recebe o texto e o separador (d) e devolve as linhas como
   arrays de células, já sem as linhas totalmente vazias.
   Recebe: text — o conteúdo do CSV como string; d — o separador de campos (',' ou ';').
   Devolve: array de linhas, cada linha um array de strings (as células). */
function parseCsv(text,d){
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true;else if(c===d){row.push(cur);cur=''}
    else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}
    else if(c!=='\r')cur+=c}
  if(cur!==''||row.length){row.push(cur);rows.push(row)}
  return rows.filter(r=>r.some(x=>String(x).trim()!==''));
}
// Ponto de entrada da importação (ficheiro ou colagem): analisa o CSV, guarda cabeçalho e
// linhas em swHead/swRows e abre o modal de mapeamento. Avisa por toast se não houver nada aproveitável.
// Recebe: text — o conteúdo do CSV como string (vindo do ficheiro ou da colagem).
// Devolve: nada — guarda o estado em swHead/swRows e abre o modal (ou avisa por toast).
function swParse(text){
  text=String(text||'').trim();
  if(!text)return toast('Não recebi nenhum texto.');
  const rows=parseCsv(text,splitDelim(text.split('\n')[0]));
  if(rows.length<2)return toast('Não consegui ler linhas neste ficheiro.');
  swHead=rows[0].map(h=>String(h).trim());swRows=rows.slice(1);closeAllModals();swMapModal();
}
// Índice da coluna cujo cabeçalho, reduzido a minúsculas e só letras (a-z e ç), coincide com um dos nomes dados; -1 se nenhum.
// Recebe: ...names — nomes candidatos do cabeçalho, já nessa forma reduzida (ex.: 'data', 'custo').
// Devolve: o índice (número) da primeira coluna que coincide, ou -1 se nenhuma.
const findCol=(...names)=>{for(const n of names){const i=swHead.findIndex(h=>h.toLowerCase().replace(/[^a-zç]/g,'')===n);if(i>-1)return i}return -1};
/* Depois de ler o CSV: deteta as colunas de data, descrição, custo e categoria,
   guarda os índices em window._swCols e abre o modal de importação com escolha
   de imóvel, quota-parte e pré-visualização das despesas.
   Devolve: nada — abre o modal de importação. */
function swMapModal(){
  const iDate=findCol('date','data'),iDesc=findCol('description','descrição','descricao'),
        iCost=findCol('cost','custo','amount','valor'),iCat=findCol('category','categoria');
  window._swCols=[iDate,iDesc,iCost,iCat];
  openModal('Importar do Splitwise',`<div class="form">
    <div class="hint">Encontrei <b>${swRows.length}</b> linhas. Colunas: data → <b>${esc(swHead[iDate]||'?')}</b>, descrição → <b>${esc(swHead[iDesc]||'?')}</b>, custo → <b>${esc(swHead[iCost]||'?')}</b>.</div>
    <label>Lançar em que imóvel?${sel('sw_prop',(db.properties[0]||{}).id||'',db.properties.map(p=>({v:p.id,label:p.name})),'','rascunho')}</label>
    <label>A minha quota-parte (%)<input id="sw_quota" type="text" inputmode="decimal" value="${dec(db.settings.quota||100)}" data-input="swRefresh()"></label>
    <div class="hint">O Splitwise exporta o custo total. Se divides a casa a meias, põe 50 e a app lança só metade.</div>
    <div class="divider"></div><div id="swPrev">${swPrevHtml(swPrepare(iDate,iDesc,iCost,iCat,100,db.settings.quota||100))}</div></div>`,
    `<button class="btn" data-click="closeModal()">Cancelar</button><button class="btn primary" data-click="swDo(${iDate},${iDesc},${iCost},${iCat})">Importar</button>`);
}
// Refaz a pré-visualização (#swPrev) quando o utilizador mexe na quota-parte.
// Devolve: nada — redesenha a pré-visualização no DOM.
function swRefresh(){const[a,b,c,d]=window._swCols;document.getElementById('swPrev').innerHTML=swPrevHtml(swPrepare(a,b,c,d,100,numTaxa(val('sw_quota'))))}
/* Converte as linhas do CSV em despesas prontas a lançar: salta o "Total balance"
   e os acertos ("Payment"), aplica a quota-parte (%), normaliza a data para ISO
   e traduz a categoria. Pára ao atingir "limit" (a pré-visualização usa 100).
   Recebe: iDate, iDesc, iCost, iCat — índices (números) das colunas de data,
   descrição, custo e categoria nas linhas do CSV; limit — máximo de despesas a
   devolver; quota — a quota-parte em percentagem (ex.: 50).
   Devolve: array de despesas {date, label, amount, category, sub}, com a data
   em AAAA-MM-DD e o valor já com a quota aplicada e arredondado aos cêntimos. */
function swPrepare(iDate,iDesc,iCost,iCat,limit,quota){
  const q=(quota||100)/100,out=[];
  for(const r of swRows){
    const desc=String(r[iDesc]||'').trim(),date=String(r[iDate]||'').trim();
    if(!date||/^total balance$/i.test(desc))continue;
    if(/^payment$/i.test(String(r[iCat]||'').trim())||/^payment$/i.test(desc))continue;
    const amount=Math.abs(num(r[iCost]))*q;if(!(amount>0))continue;
    const iso=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:isoDate(date);if(!iso)continue;
    const cat=mapCat(r[iCat]);
    out.push({date:iso,label:desc||'Despesa Splitwise',amount:Math.round(amount*100)/100,category:cat[0],sub:cat[1]});
    if(out.length>=limit)break;
  }
  return out;
}
// Normaliza "31/12/2024", "2024-12-31" ou "31.12.2024" para AAAA-MM-DD; assume dia primeiro quando o ano vem no fim. Devolve null se não reconhecer.
// Recebe: s — a data como texto, num desses formatos.
// Devolve: a data em "AAAA-MM-DD" (string), ou null se não a reconhecer.
function isoDate(s){
  const m=String(s).match(/(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);if(!m)return null;
  const a=m[1],b=m[2],c=m[3];
  if(a.length===4)return `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}`;
  if(c.length===4)return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
  return null;
}
// Traduz a categoria do Splitwise (inglês ou português) para o par [categoria, subcategoria] da app; sem correspondência cai em "Outros".
// Recebe: c — a categoria vinda do Splitwise, como texto (pode vir vazia).
// Devolve: o par [categoria, subcategoria] (array de duas strings; a subcategoria pode ser '').
function mapCat(c){
  const s=String(c||'').toLowerCase();
  if(/water|água|agua/.test(s))return ['Água, luz e gás','Água'];
  if(/electric|luz/.test(s))return ['Água, luz e gás','Eletricidade'];
  if(/gas/.test(s))return ['Água, luz e gás','Gás'];
  if(/tv|internet|phone/.test(s))return ['Água, luz e gás','Internet e TV'];
  if(/utilit/.test(s))return ['Água, luz e gás',''];
  if(/repair|maint|obra/.test(s))return ['Manutenção e reparações',''];
  if(/insur|seguro/.test(s))return ['Seguros',''];
  if(/tax|imi|imposto/.test(s))return ['Impostos',''];
  if(/clean|limpe/.test(s))return ['Limpeza e jardim','Limpeza'];
  if(/furni|mobil/.test(s))return ['Mobiliário e equipamento',''];
  if(/condom/.test(s))return ['Condomínio',''];
  return ['Outros',''];
}
// HTML da pré-visualização: contagem e total das despesas, mais as primeiras 6 em tabela.
// Recebe: rows — as despesas preparadas pelo swPrepare ({date, label, amount, ...}).
// Devolve: string de HTML da pré-visualização, pronta a inserir com innerHTML.
function swPrevHtml(rows){
  if(!rows.length)return `<div class="hint">Nenhuma linha aproveitável. Confirma que exportaste o CSV do grupo.</div>`;
  return `<div class="hint u-mb-8px">${rows.length} despesas · total <b>${euro2(sum(rows.map(r=>r.amount)))}</b></div>
    <div class="tablewrap"><table class="table"><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>
    ${rows.slice(0,6).map(r=>`<tr><td>${r.date}</td><td class="u-ta-left u-ws-normal">${esc(r.label)}</td><td>${euro2(r.amount)}</td></tr>`).join('')}
    ${rows.length>6?`<tr><td colspan="3" class="u-ta-left u-c-v-muted">…e mais ${rows.length-6}</td></tr>`:''}</tbody></table></div>`;
}
/* Executa a importação: guarda a quota nas definições, lança as despesas no imóvel
   escolhido saltando duplicados (mesma data, imóvel, valor e descrição) e marca o
   lote com um id para o undoImport poder anular. Grava e volta a renderizar.
   Recebe: iDate, iDesc, iCost, iCat — índices (números) das colunas de data,
   descrição, custo e categoria detetados no CSV.
   Devolve: nada — grava, fecha o modal, redesenha a vista e avisa por toast. */
function swDo(iDate,iDesc,iCost,iCat){
  const pid=val('sw_prop'),quota=numTaxa(val('sw_quota'))||100;
  if(!pid)return toast('Cria primeiro um imóvel.');
  db.settings.quota=quota;
  const rows=swPrepare(iDate,iDesc,iCost,iCat,1e5,quota);
  if(!rows.length)return toast('Nada para importar.');
  const batch='b'+Date.now();let added=0,dup=0;
  rows.forEach(r=>{
    if(db.transactions.some(t=>t.date===r.date&&t.propertyId===pid&&Math.abs(t.amount-r.amount)<0.005&&t.label===r.label)){dup++;return}
    db.transactions.push(normTx({kind:'expense',label:r.label,amount:r.amount,date:r.date,propertyId:pid,category:r.category,sub:r.sub,batch,src:'splitwise'}));added++;
  });
  save();closeModal();render();toast(`${added} despesas importadas${dup?` · ${dup} repetidas ignoradas`:''}.`);
}
// Anula a última importação: apaga, após confirmação, todos os movimentos do lote mais recente.
// Devolve: nada — se for confirmado, grava e redesenha a vista.
function undoImport(){
  const b=[...new Set(db.transactions.filter(t=>t.batch).map(t=>t.batch))].sort(),last=b[b.length-1];
  if(!last)return toast('Não há importações para anular.');
  const n=db.transactions.filter(t=>t.batch===last).length;
  confirmModal('Anular importação',`Apagar os ${n} movimentos da última importação?`,()=>{
    db.transactions=db.transactions.filter(t=>t.batch!==last);save();render();toast('Importação anulada.');
  });
}
