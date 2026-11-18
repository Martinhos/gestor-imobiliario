/* ================= SPLITWISE =================
   A importação das despesas de um grupo do Splitwise (o CSV de «Export as
   spreadsheet»). Lança o custo total de cada linha — a Declaração é que
   reparte pela quota do imóvel (D122) —, com a categoria e a subcategoria que
   a app trata (mapCat, D123). Ficam de fora, contados na pré-visualização: os
   acertos entre as pessoas do grupo (D124), os custos negativos, que são
   reembolsos (D125), as linhas noutra moeda sem o valor em euros escrito
   (D129), as que já estão na base deste imóvel (pela chave da linha, swKey, e
   por multiplicidade — D126), as apagadas de propósito depois de importadas
   (settings.swIgnoradas) e as de antes do «Só desde» (D127). O «Anular» anula
   só um lote meu, e diz quanto sai de cada ano (D128). */
let swRows=null,swHead=null;
/* Os valores em euros escritos na janela para as linhas noutra moeda (D129),
   pelo índice da linha no CSV: ficam quando se muda o imóvel ou o «Só desde»,
   que voltam a desenhar a pré-visualização. */
let swEuros={};
// Recebe o ficheiro escolhido no <input type=file>, lê-o como texto e passa-o ao swParse.
// Limpa o input para que escolher o mesmo ficheiro volte a disparar o evento.
// Recebe: input — o próprio elemento <input type=file> (usa input.files[0]).
// Devolve: nada — a leitura é assíncrona e desagua no swParse.
function swPick(input){const f=input.files&&input.files[0];if(!f)return;input.value='';const r=new FileReader();r.onload=()=>swParse(String(r.result));r.readAsText(f,'utf-8')}
// Alternativa ao seletor de ficheiros: modal com textarea para colar o conteúdo do CSV à mão.
// Devolve: nada — abre o modal.
function swPasteBox(){
  openModal('Colar CSV do Splitwise',`<div class="form"><div class="hint">Abre o CSV, copia tudo e cola aqui — incluindo a linha dos títulos.</div>
    <label>O CSV <span class="req">*</span><textarea id="swText" class="u-minh-120px u-font-13px-1p5-ui-monospace-menlo-monospace" placeholder="Ex: Date,Description,Category,Cost,Currency"></textarea></label></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="camada" data-click="swParseColado()">Continuar</button>`);
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
  swHead=rows[0].map(h=>String(h).trim());swRows=rows.slice(1);swEuros={};closeAllModals();swMapModal();
}
/* Um cabeçalho do CSV na forma em que se compara: minúsculas, sem acentos e só
   letras — «Descrição» fica «descricao» (antes o «ã» saía e a coluna não se
   encontrava, D126).
   Recebe: h — o texto do cabeçalho (ou o nome procurado).
   Devolve: o texto reduzido. */
const swNomeCol=h=>deacc(h).replace(/[^a-z]/g,'');
// Índice da coluna cujo cabeçalho, na forma do swNomeCol, coincide com um dos nomes dados; -1 se nenhum.
// Recebe: ...names — nomes candidatos do cabeçalho (com ou sem acentos: ex.: 'data', 'descrição').
// Devolve: o índice (número) da primeira coluna que coincide, ou -1 se nenhuma.
const findCol=(...names)=>{const hs=(swHead||[]).map(swNomeCol);for(const n of names){const i=hs.indexOf(swNomeCol(n));if(i>-1)return i}return -1};
/* Os nomes de cada coluna do CSV nas línguas em que o Splitwise exporta (a
   exportação sai na língua da conta). */
const SW_COLS={data:['date','data','fecha','datum'],desc:['description','descrição','descripción','beschreibung','descrizione','libellé'],
  custo:['cost','custo','amount','valor','coste','costo','coût','kosten','betrag','importo','montant'],
  cat:['category','categoria','categoría','catégorie','kategorie'],moeda:['currency','moeda','moneda','devise','währung','valuta']};
/* As colunas do CSV: as conhecidas (SW_COLS) e as das pessoas do grupo — as que
   vêm depois delas, com o saldo de cada pessoa em cada linha (o que pagou menos
   o que lhe cabe).
   Recebe: nada (lê o swHead).
   Devolve: {data, desc, custo, cat, moeda} — índices, -1 quando não há —, e
   pessoas — os índices das colunas das pessoas (array). */
function swColunas(){
  const c={};Object.keys(SW_COLS).forEach(k=>{c[k]=findCol(...SW_COLS[k])});
  const usadas=Object.keys(SW_COLS).map(k=>c[k]).filter(i=>i>-1),depois=usadas.length?Math.max(...usadas):-1;
  c.pessoas=(swHead||[]).map((h,i)=>i).filter(i=>i>depois&&String(swHead[i]||'').trim()!=='');
  return c;
}
/* Os nomes do acerto do Splitwise (quando uma pessoa paga a outra o que lhe
   deve), na categoria ou na descrição, nas línguas em que a app lê os
   cabeçalhos (D124), já na forma do deacc. */
const SW_ACERTO=/^(payment|pagamento|pago|paiement|zahlung|settle up|settlement|acerto|acerto de contas|saldar|liquidacao)$/;
/* Uma linha do CSV é um acerto entre as pessoas do grupo, e não uma despesa
   (D124)? Pelo nome da categoria ou da descrição (SW_ACERTO) e, como rede,
   pela forma: só duas pessoas com saldo na linha, simétricos e iguais ao
   custo, e uma descrição «X pagou a Y» / «X paid Y».
   Recebe: r — a linha (array de células); c — as colunas (swColunas); cat,
   desc — a categoria e a descrição (texto); custo — o custo (número).
   Devolve: true quando é um acerto. */
function swEhAcerto(r,c,cat,desc,custo){
  if(SW_ACERTO.test(deacc(cat).trim())||SW_ACERTO.test(deacc(desc).trim()))return true;
  const vs=(c.pessoas||[]).map(i=>num(r[i])).filter(v=>Math.abs(v)>=0.005);
  return vs.length===2&&Math.abs(vs[0]+vs[1])<0.01&&Math.abs(Math.abs(vs[0])-Math.abs(custo))<0.01&&
    /\b(pagou|paid|paye|bezahlt|pagato|pago a)\b/.test(deacc(desc));
}
/* A moeda de uma linha é o euro? Sem coluna da moeda, ou com ela vazia, conta
   como euro (o Splitwise exporta sempre a moeda; um CSV feito à mão não).
   Recebe: m — o texto da moeda.
   Devolve: true ou false. */
const swEmEuros=m=>{const s=String(m||'').trim().toUpperCase();return !s||s==='EUR'||s==='€'};
/* O dia por omissão do «Só desde» (D127): a seguir à última importação do
   Splitwise para este imóvel — a exportação traz o grupo inteiro, desde o
   primeiro dia, e o que já entrou (e foi arrumado ou apagado depois) não deve
   voltar. É o mais tardio de dois dias: o dia em que se fez a última
   importação (o instante do lote, 'b' + ms: o que o grupo tinha até aí já veio
   nela) e o dia a seguir à despesa mais recente já importada. Sem nenhuma,
   vazio: o ficheiro todo.
   Recebe: pid — o id do imóvel.
   Devolve: 'AAAA-MM-DD' ou ''. */
function swDesdeOmissao(pid){
  const ts=(db.transactions||[]).filter(t=>t&&t.src==='splitwise'&&t.propertyId===pid);
  const ds=ts.map(t=>String(t.date||'')).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const ms=ts.map(t=>Number(String(t.batch||'').slice(1))).filter(n=>n>0).sort((a,b)=>a-b).pop();
  const dois=x=>String(x).padStart(2,'0'),d=ms?new Date(ms):null;
  const doLote=d&&!isNaN(d.getTime())?d.getFullYear()+'-'+dois(d.getMonth()+1)+'-'+dois(d.getDate()):'';
  return [ds.length?addDays(ds[ds.length-1],1):'',doLote].sort().pop()||'';
}
/* O prazo da declaração de um ano já acabou (30 de junho do ano seguinte,
   irsAno(ano).entrega.ate)? É o que pinta a âmbar os anos da pré-visualização
   e do «Anular» (D127, D128): importar ou anular muda os gastos de uma
   declaração que pode já estar entregue.
   Recebe: ano — o ano dos rendimentos (número ou texto).
   Devolve: true ou false. */
function swAnoEntregue(ano){
  const v=irsAno(ano),ate=v&&v.entrega?String(v.entrega.ate||''):'';
  return /^\d{4}-\d{2}-\d{2}$/.test(ate)&&today()>ate;
}
/* Uma percentagem para ler: «50 %», «33,33 %».
   Recebe: f — a fração (0–1).
   Devolve: o texto. */
const swPct=f=>String(Math.round(f*10000)/100).replace('.',',')+' %';
/* A linha da quota na janela da importação (D122): a app lança o custo total
   de cada despesa, e a Declaração conta a tua quota do imóvel — sem campo
   para a escrever aqui (era aplicada duas vezes). Com o grupo do Splitwise de
   duas ou mais pessoas e o imóvel com um dono só na app (sem comproprietários
   sem conta escritos), manda escrever as quotas na ficha (decisão do D08), com
   o botão para a ficha quando o serviço dos imóveis está ligado.
   Recebe: pid — o id do imóvel escolhido; nPessoas — quantas pessoas tem o
   grupo (as colunas delas no CSV).
   Devolve: o HTML (texto), ou '' sem imóvel. */
function swQuotaHtml(pid,nPessoas){
  const p=pid?prop(pid):null;if(!p)return '';
  const donos=ownersOfProp(p),fora=quotasForaNaData(p,today()),eu=meuId()||(donos.length===1?donos[0]:'');
  const q=eu?Number(quotasFiscais(p,today())[eu]):NaN;
  const conta=isFinite(q)&&q>0?(q>=1-1e-9?' Na tua Declaração conta por inteiro: és o único dono.':` Na tua Declaração conta a tua quota deste imóvel, ${swPct(q)}.`)
    :' A Declaração reparte-o pelas quotas da ficha do imóvel.';
  const so=donos.length<=1&&!fora.length&&nPessoas>=2;
  return `<div class="hint">A app lança o custo total de cada despesa, como o Splitwise o exporta.${conta}</div>`+
    (so?`<p class="small amber">O grupo do Splitwise tem ${nPessoas} pessoas, e na app este imóvel só tem um dono. Se a casa é partilhada, escreve na ficha do imóvel as quotas dos outros donos, também dos que não têm conta: a Declaração conta só a tua parte.</p>`+
      (servicoLigado('properties')?`<div class="def-botoes"><button class="btn sm" data-toca="camada" data-click="swEscreverQuotas()">Escrever as quotas</button></div>`:''):'');
}
/* O botão «Escrever as quotas» da janela da importação: fecha-a e abre a
   ficha do imóvel escolhido, onde se escrevem as quotas (D08, D122).
   Recebe: nada (lê o imóvel escolhido).
   Devolve: nada — fecha as janelas e abre a ficha. */
function swEscreverQuotas(){
  const pid=val('sw_prop');closeAllModals();
  if(pid&&servicoLigado('properties'))propModal(pid);
}
/* Depois de ler o CSV: deteta as colunas (swColunas), guarda-as em
   window._swCols e abre a janela da importação — o imóvel, a linha da quota
   (swQuotaHtml), o «Só desde» (por omissão a seguir à última importação
   para o imóvel, swDesdeOmissao) e a pré-visualização (swPrevHtml).
   Devolve: nada — abre o modal de importação. */
function swMapModal(){
  const c=swColunas(),pid=(db.properties[0]||{}).id||'',desde=swDesdeOmissao(pid),nome=i=>esc(i>-1?swHead[i]:'?');
  window._swCols=c;
  openModal('Importar do Splitwise',`<div class="form">
    <div class="hint">Encontrei <b>${swRows.length}</b> ${swRows.length===1?'linha':'linhas'}. Colunas: data → <b>${nome(c.data)}</b>, descrição → <b>${nome(c.desc)}</b>, custo → <b>${nome(c.custo)}</b>, categoria → <b>${nome(c.cat)}</b>, moeda → <b>${nome(c.moeda)}</b>.</div>
    ${c.desc<0?'<p class="small amber">Não encontrei a coluna da descrição: as despesas ficam «Despesa Splitwise», e duas com a mesma data, custo e categoria só se distinguem por quantas são.</p>':''}
    <label>Lançar em que imóvel? <span class="req">*</span>${sel('sw_prop',pid,db.properties.map(p=>({v:p.id,label:p.name})),'swPropMudou','rascunho')}</label>
    <div id="swQuota">${swQuotaHtml(pid,c.pessoas.length)}</div>
    <label>Só desde<input id="sw_desde" type="date" value="${esc(desde)}" data-change="swRefresh()"></label>
    <div class="hint">Só as despesas deste dia em diante. Por omissão, a seguir à última importação para este imóvel; em branco, o ficheiro todo.</div>
    <div class="divider"></div><div id="swPrev">${swPrevHtml(swPrepare({pid,desde}))}</div></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="swDo()">Importar</button>`);
}
/* Mudou o imóvel na janela da importação: o «Só desde» passa ao desse imóvel
   (swDesdeOmissao) e a quota e a pré-visualização voltam a desenhar-se.
   Devolve: nada. */
function swPropMudou(){
  const e=document.getElementById('sw_desde');if(e)e.value=swDesdeOmissao(val('sw_prop'));
  swRefresh();
}
/* Guarda em swEuros o que está escrito nos campos dos euros das linhas noutra
   moeda (sw_eur_N), antes de a pré-visualização se voltar a desenhar.
   Devolve: nada. */
function swGuardarEuros(){
  const c=window._swCols||swColunas();if(c.moeda<0)return;
  (swRows||[]).forEach((r,i)=>{
    if(swEmEuros(r[c.moeda]))return;
    const e=document.getElementById('sw_eur_'+i);if(e)swEuros[i]=String(e.value||'');
  });
}
// Refaz a linha da quota e a pré-visualização quando se muda o imóvel, o «Só desde» ou um valor em euros.
// Devolve: nada — redesenha no DOM.
function swRefresh(){
  swGuardarEuros();
  const c=window._swCols||swColunas(),pid=val('sw_prop');
  const q=document.getElementById('swQuota');if(q)q.innerHTML=swQuotaHtml(pid,c.pessoas.length);
  const e=document.getElementById('swPrev');if(e)e.innerHTML=swPrevHtml(swPrepare({pid,desde:val('sw_desde'),euros:swEuros}));
}
/* A chave de uma linha do Splitwise (t.swKey, D127): a data, a descrição, o
   custo total e a categoria do CSV — não muda quando a pessoa edita o
   movimento —, passada pelo dados.js:normSwKey, que é a forma em que se guarda.
   Recebe: iso — a data 'AAAA-MM-DD'; desc — a descrição; custo — o custo total
   (número); cat — a categoria do CSV.
   Devolve: o texto da chave. */
const swChave=(iso,desc,custo,cat)=>normSwKey([iso,desc,(Number(custo)||0).toFixed(2),cat].join('|'));
/* As linhas do CSV, uma a uma, com o que lhes acontece ao importar:
   · 'despesa' — entra, com o custo total (sem quota: a Declaração aplica a do
     imóvel, D122), a categoria e a subcategoria (mapCat, D123) e a chave;
   · 'moeda' — noutra moeda que não o euro: entra só com o valor em euros
     escrito (opts.euros; amount fica null sem ele, D129);
   · 'acerto' (D124), 'reembolso' — custo negativo (D125) —, 'semData';
   · 'repetida' — já está na base deste imóvel (a mesma chave, ou uma
     importada antes da chave com a mesma data, descrição e custo total),
     contada por multiplicidade e só contra a base de antes (D126): duas iguais
     no ficheiro e uma na base, entra uma;
   · 'ignorada' — apagada de propósito depois de importada
     (settings.swIgnoradas); 'antes' — de antes do «Só desde» (D127).
   O «Total balance» do fim e as linhas a zero saltam-se sem contar.
   Recebe: opts (opcional) — {pid: o imóvel; desde: 'AAAA-MM-DD' ou ''; euros:
   {índice da linha: o valor em euros escrito}}.
   Devolve: {linhas: [{i, tipo, date, label, custo, moeda, amount, category,
   sub, col, swKey}], cols: as colunas (swColunas), antigas: quantas despesas
   do Splitwise sem chave tem o imóvel}. */
function swPrepare(opts){
  const o=opts||{},c=swColunas(),pid=o.pid||'',euros=o.euros||{};
  const desde=/^\d{4}-\d{2}-\d{2}$/.test(String(o.desde||''))?String(o.desde):'';
  const ign=new Set(normSwIgnoradas(((db.settings||{}).swIgnoradas)));
  /* o que já está na base deste imóvel, antes desta importação */
  const naBase=new Map(),antigas=[];
  (db.transactions||[]).forEach(t=>{
    if(!t||t.kind!=='expense'||!pid||t.propertyId!==pid)return;
    if(t.swKey)naBase.set(t.swKey,(naBase.get(t.swKey)||0)+1);
    else if(t.src==='splitwise')antigas.push(t);
  });
  const vistas=new Map(),linhas=[];
  (swRows||[]).forEach((r,i)=>{
    const cel=k=>c[k]>-1?String(r[c[k]]==null?'':r[c[k]]).trim():'';
    const desc=cel('desc'),data=cel('data'),catCsv=cel('cat'),moeda=cel('moeda').toUpperCase()||'EUR',custoTxt=cel('custo');
    if(!data){if(custoTxt&&num(custoTxt)!==0&&!/total|saldo/i.test(desc))linhas.push({i,tipo:'semData',date:'',label:desc||'Despesa Splitwise',custo:num(custoTxt),moeda});return}
    const custo=Math.round(num(custoTxt)*100)/100;if(!custo)return;
    const iso=/^\d{4}-\d{2}-\d{2}$/.test(data)?data:isoDate(data);
    const l={i,tipo:'despesa',date:iso||'',label:desc||'Despesa Splitwise',custo,moeda,amount:custo,category:'',sub:'',col:'',swKey:''};
    if(!iso){l.tipo='semData';linhas.push(l);return}
    if(swEhAcerto(r,c,catCsv,desc,custo)){l.tipo='acerto';linhas.push(l);return}
    if(custo<0){l.tipo='reembolso';linhas.push(l);return}
    const par=swNaConta(mapCat(catCsv,desc));
    l.category=par[0];l.sub=par[1];
    l.col=irsColunaDe(normTx({kind:'expense',category:l.category,sub:l.sub,amount:1})).col;
    l.swKey=swChave(iso,desc,custo,catCsv);
    const n=(vistas.get(l.swKey)||0)+1;vistas.set(l.swKey,n);
    /* uma despesa reposta pela Declaração (fisco-avisos.js:fiscoAvChaveSplitwise) tem a chave sem a
       categoria do CSV: conta como a mesma linha */
    const ja=(naBase.get(l.swKey)||0)+(catCsv?(naBase.get(swChave(iso,desc,custo,''))||0):0)+antigas.filter(t=>t.date===iso&&t.label===l.label&&Math.abs((Number(t.amount)||0)-custo)<0.005).length;
    if(desde&&iso<desde)l.tipo='antes';
    else if(ign.has(l.swKey))l.tipo='ignorada';
    else if(n<=ja)l.tipo='repetida';
    else if(!swEmEuros(moeda)){l.tipo='moeda';const e=Math.round(num(euros[i])*100)/100;l.amount=e>0?e:null}
    linhas.push(l);
  });
  return {linhas,cols:c,antigas:antigas.length};
}
/* Uma linha da pré-visualização entra na base: uma despesa, ou uma linha
   noutra moeda com o valor em euros escrito.
   Recebe: l — uma linha do swPrepare.
   Devolve: true ou false. */
const swImporta=l=>l.tipo==='despesa'||(l.tipo==='moeda'&&l.amount>0);
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
/* Do texto de uma categoria (ou de uma descrição) do Splitwise, em inglês ou
   em português, ao par [categoria, subcategoria] de origem da app — ou null
   quando não se percebe. Os transportes (o combustível, o estacionamento…) não
   são do imóvel e ficam em «Outros» antes de o «gas» do «Gas/fuel» os levar ao
   gás; o «gás» só fora deles. A prestação do crédito vai ao «Crédito à
   habitação» (não dedutível), o mobiliário e os eletrodomésticos ao
   «Mobiliário e equipamento» (não dedutíveis), a manutenção à «Manutenção e
   reparações» (D123).
   Recebe: s — o texto, já na forma do deacc (minúsculas, sem acentos).
   Devolve: [categoria, subcategoria] ou null. */
function swCatDoTexto(s){
  if(!s)return null;
  if(/condom/.test(s))return ['Condomínio',''];
  if(/mortgage|hipoteca|\bloan\b|emprestimo|credito (a|habitacao)|\bprestacao\b/.test(s))return ['Crédito à habitação','Prestação mensal'];
  if(/fuel|combust|gasolin|gasoleo|diesel|transport|\bcar\b|carro|parking|estaciona|taxi|uber|portage|\btolls?\b|\bbus\b|autocarro|train|comboio|flight|aviao|hotel|restaura|groceries|supermercado/.test(s))return ['Outros',''];
  if(/furni|mobil|\bmove(is|l)\b|sofa|colchao|mattress/.test(s))return ['Mobiliário e equipamento','Mobiliário'];
  if(/eletrodom|electrodom|appliance|electronic|eletronic|frigorifico|maquina de lavar|esquentador/.test(s))return ['Mobiliário e equipamento','Eletrodomésticos'];
  if(/water|\bagua\b/.test(s))return ['Água, luz e gás','Água'];
  if(/electricity|eletricidade|electricidade|\bluz\b/.test(s))return ['Água, luz e gás','Eletricidade'];
  if(/heat|aquec|\bgas\b/.test(s))return ['Água, luz e gás','Gás'];
  if(/\btv\b|internet|phone|telefone|telemovel|fibra/.test(s))return ['Água, luz e gás','Internet e TV'];
  if(/utilit/.test(s))return ['Água, luz e gás',''];
  if(/repair|maint|manuten|repar|\bobras?\b|canaliz|plumb|pintur|paint|eletricista|electrician/.test(s))return ['Manutenção e reparações',''];
  if(/insur|seguro/.test(s))return ['Seguros',''];
  if(/\btax|impost|\btaxas?\b/.test(s))return ['Impostos',''];
  if(/clean|limpez/.test(s))return ['Limpeza e jardim','Limpeza'];
  if(/trash|garbage|\blixo\b/.test(s))return ['Limpeza e jardim','Recolha de lixo'];
  if(/garden|jardim/.test(s))return ['Limpeza e jardim','Jardinagem'];
  return null;
}
/* Traduz uma linha do Splitwise para o par [categoria, subcategoria] de origem
   da app (D123). O IMI e o AIMI reconhecem-se na categoria ou na descrição, e
   vão às subcategorias que o IRS lê (o IMI ao campo do IMI; o AIMI ao quadro
   9, nunca gasto). Depois manda a categoria do Splitwise (swCatDoTexto) e, se
   ela não diz nada («General», a por omissão), a descrição. O resto fica em
   «Outros», que a Declaração deixa «a confirmar»: não conta até a pessoa
   escolher a coluna.
   Recebe: c — a categoria do Splitwise (texto, pode vir vazia); d (opcional) — a descrição.
   Devolve: o par [categoria, subcategoria] (array de duas strings; a subcategoria pode ser ''). */
function mapCat(c,d){
  const cat=deacc(c),txt=cat+' '+deacc(d);
  if(/\baimi\b|adicional ao imi/.test(txt))return ['Impostos','AIMI'];
  if(/\bimi\b/.test(txt))return ['Impostos','IMI'];
  return swCatDoTexto(cat)||swCatDoTexto(deacc(d))||['Outros',''];
}
/* O par de origem com os nomes desta conta: uma categoria (ou subcategoria)
   que o IRS lê pelo id (dados.js:CATS_IRS_ORIGEM, settings.catIds) e que a
   pessoa renomeou leva o nome dela — o IMI importado para «Impostos › IMI»
   numa conta onde se chama «Taxas › IMI» chega à mesma ao campo do IMI.
   Recebe: par — [categoria, subcategoria] de origem.
   Devolve: [categoria, subcategoria] desta conta (o par tal e qual quando não há id). */
function swNaConta(par){
  const cat=par[0],sub=par[1]||'',id=CATS_IRS_ORIGEM.cats[sub?cat+' / '+sub:cat];
  const st=db.settings||{},ids=(st.catIds||{}).cats||{},arv=st.cats||{};
  if(!id||catIrsId('cats',cat,sub)===id)return par;
  const k=Object.keys(ids).find(x=>ids[x]===id);if(!k)return par;
  if(!sub)return [k,''];
  const pai=Object.keys(arv).find(n=>k.indexOf(n+' / ')===0&&(arv[n]||[]).indexOf(k.slice(n.length+3))>-1);
  return pai?[pai,k.slice(pai.length+3)]:par;
}
/* «N despesas», «1 despesa» — e as outras palavras com o plural certo.
   Recebe: n — quantas; um, varios — a palavra no singular e no plural.
   Devolve: o texto «n palavra». */
const swN=(n,um,varios)=>n+' '+(n===1?um:varios);
/* As despesas por ano, para a pré-visualização e para o «Anular» (D127, D128):
   quantas e quanto em cada ano, com a âmbar os anos cujo prazo da declaração
   já acabou (swAnoEntregue).
   Recebe: ls — as despesas ({date, amount}); verbo — o que acontece aos gastos
   desse ano ('importar muda' ou 'anular muda').
   Devolve: o HTML (texto), um <p class="small"> por ano, do mais antigo para o mais recente. */
function swPorAnoHtml(ls,verbo){
  const anos={};
  ls.forEach(l=>{const a=String(l.date||'').slice(0,4);if(!/^\d{4}$/.test(a))return;const x=anos[a]||(anos[a]={n:0,v:0});x.n++;x.v+=Number(l.amount)||0});
  return Object.keys(anos).sort().map(a=>{
    const x=anos[a],txt=`${a}: ${swN(x.n,'despesa','despesas')}, ${euro2(x.v)}`;
    return swAnoEntregue(a)?`<p class="small amber">${txt} — o prazo da declaração de ${a} já acabou: se já a entregaste, ${verbo} os gastos dela.</p>`:`<p class="small">${txt}</p>`;
  }).join('');
}
/* O HTML da pré-visualização: as despesas a importar (quantas e o total, por
   ano, D127), as que ficam «a confirmar» (D123), a categoria e a coluna do
   Anexo F de cada grupo de linhas, as primeiras seis linhas, e o que fica de
   fora — os acertos (D124), os reembolsos (D125), as repetidas (D126), as
   apagadas de propósito e as de antes do «Só desde» (D127) — e as linhas
   noutra moeda, cada uma com o campo do valor em euros (D129).
   Recebe: prep — o que o swPrepare devolve.
   Devolve: string de HTML da pré-visualização, pronta a inserir com innerHTML. */
function swPrevHtml(prep){
  const ls=(prep&&prep.linhas)||[],imp=ls.filter(swImporta),de=t=>ls.filter(l=>l.tipo===t);
  const ps=[];
  if(imp.length){
    ps.push(`<div class="hint u-mb-8px">${swN(imp.length,'despesa a importar','despesas a importar')} · total <b>${euro2(sum(imp.map(r=>r.amount)))}</b></div>`);
    ps.push(swPorAnoHtml(imp,'importar muda'));
    const conf=imp.filter(l=>l.col==='confirmar');
    if(conf.length)ps.push(`<p class="small amber">${conf.length===1?'1 fica':conf.length+' ficam'} «a confirmar»: só ${conf.length===1?'conta':'contam'} na Declaração quando escolheres a coluna na ficha da despesa.</p>`);
    const grupos={};
    imp.forEach(l=>{const k=l.category+(l.sub?' › '+l.sub:''),g=grupos[k]||(grupos[k]={n:0,v:0,col:l.col});g.n++;g.v+=l.amount});
    ps.push(`<div class="tablewrap"><table class="table"><thead><tr><th>Categoria</th><th>Coluna no Anexo F</th><th>Despesas</th><th>Total</th></tr></thead><tbody>
      ${Object.keys(grupos).sort().map(k=>`<tr><td class="u-ta-left u-ws-normal">${esc(k)}</td><td class="u-ta-left u-ws-normal${grupos[k].col==='confirmar'?' amber':grupos[k].col==='nao'?' neg':''}">${esc(grupos[k].col==='nao'?'Não dedutível':irsColunaNome(grupos[k].col))}</td><td>${grupos[k].n}</td><td>${euro2(grupos[k].v)}</td></tr>`).join('')}</tbody></table></div>`);
    ps.push(`<div class="tablewrap"><table class="table"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>
      ${imp.slice(0,6).map(r=>`<tr><td>${esc(dPT(r.date))}</td><td class="u-ta-left u-ws-normal">${esc(r.label)}</td><td class="u-ta-left u-ws-normal">${esc(r.category+(r.sub?' › '+r.sub:''))}</td><td>${euro2(r.amount)}</td></tr>`).join('')}
      ${imp.length>6?`<tr><td colspan="4" class="u-ta-left u-c-v-muted">…e mais ${imp.length-6}</td></tr>`:''}</tbody></table></div>`);
  }else ps.push(`<div class="hint">Nada para importar${ls.length?'':'. Confirma que exportaste o CSV do grupo'}.</div>`);
  const fora=[];
  const acertos=de('acerto');
  if(acertos.length)fora.push(`${swN(acertos.length,'acerto','acertos')} entre as pessoas do grupo (uma paga à outra o que lhe deve): não ${acertos.length===1?'é despesa':'são despesas'} da casa.`);
  const reemb=de('reembolso');
  if(reemb.length)fora.push(`${swN(reemb.length,'reembolso','reembolsos')} (custo negativo): ${reemb.map(l=>esc(l.label)+' '+euro2(l.custo)).join('; ')}. Um reembolso não é despesa: se abate a uma despesa (o seguro que pagou parte da obra), corrige o valor dela.`);
  const rep=de('repetida');
  if(rep.length)fora.push(`${swN(rep.length,'despesa que já estava importada','despesas que já estavam importadas')} neste imóvel.`);
  const ign=de('ignorada');
  if(ign.length)fora.push(`${swN(ign.length,'despesa que apagaste','despesas que apagaste')} depois de ${ign.length===1?'a':'as'} importar.`);
  const antes=de('antes');
  if(antes.length)fora.push(`${swN(antes.length,'despesa','despesas')} de antes do «Só desde».`);
  const sem=de('semData');
  if(sem.length)fora.push(`${swN(sem.length,'linha sem uma data que se perceba','linhas sem uma data que se perceba')}.`);
  if(fora.length)ps.push(`<p class="small"><b>Ficam de fora:</b></p>`+fora.map(f=>`<p class="small">${f}</p>`).join(''));
  if(prep&&prep.antigas&&rep.length+imp.length)ps.push(`<p class="small amber">Este imóvel tem ${swN(prep.antigas,'despesa importada','despesas importadas')} do Splitwise antes de a app guardar a linha de cada uma: se ${prep.antigas===1?'estiver':'estiverem'} no ficheiro com outro valor (cortado pela quota), volta${prep.antigas===1?'':'m'} a entrar. Confere o «Só desde».</p>`);
  const moeda=de('moeda');
  if(moeda.length){
    ps.push(`<p class="small"><b>${swN(moeda.length,'despesa noutra moeda','despesas noutra moeda')}:</b> escreve o valor em euros (o do extrato) para ${moeda.length===1?'a':'as'} importar; em branco, ${moeda.length===1?'fica':'ficam'} de fora.</p>`);
    ps.push(moeda.map(l=>`<label>${esc(l.label)} · ${esc(dPT(l.date))} · ${esc(l.custo.toFixed(2).replace('.',','))} ${esc(l.moeda)} — em euros<input id="sw_eur_${l.i}" type="text" inputmode="decimal" value="${esc(swEuros[l.i]||'')}" placeholder="Opcional" data-change="swRefresh()" autocomplete="off"></label>`).join(''));
  }
  return ps.join('');
}
/* Executa a importação: lança no imóvel escolhido as linhas que o swPrepare
   deixa entrar (swImporta), com o custo total (ou o valor em euros escrito,
   numa linha noutra moeda, e a moeda de origem nas notas), a categoria, a
   chave da linha (swKey) e o lote (batch, 'b' + o instante) que o undoImport
   anula. Não guarda nenhuma quota (D122). Um valor em euros escrito que não é
   um número maior que zero pára a importação, com o erro junto ao campo.
   Recebe: nada (lê a janela e o swRows).
   Devolve: nada — grava, fecha o modal, redesenha a vista e avisa por toast. */
function swDo(){
  if(!db.properties.length)return toast('Cria primeiro um imóvel.');
  const pid=val('sw_prop');
  if(!pid||!prop(pid))return falhaCampo('sw_prop','Escolhe o imóvel.');
  swGuardarEuros();
  const prep=swPrepare({pid,desde:val('sw_desde'),euros:swEuros}),rows=prep.linhas.filter(swImporta);
  /* só os campos que estão à vista (as linhas noutra moeda que entrariam) */
  const mal=prep.linhas.find(l=>l.tipo==='moeda'&&String(swEuros[l.i]||'').trim()&&!(num(swEuros[l.i])>0));
  if(mal)return falhaCampo('sw_eur_'+mal.i,'Escreve o valor em euros, maior que zero, ou deixa em branco.');
  if(!rows.length)return toast('Nada para importar.');
  const batch='b'+Date.now();
  rows.forEach(r=>{
    db.transactions.push(normTx({kind:'expense',label:r.label,amount:r.amount,date:r.date,propertyId:pid,category:r.category,sub:r.sub,batch,src:'splitwise',swKey:r.swKey,
      notes:swEmEuros(r.moeda)?'':'No Splitwise: '+r.custo.toFixed(2).replace('.',',')+' '+r.moeda+'.'}));
  });
  const dup=prep.linhas.filter(l=>l.tipo==='repetida').length;
  save();closeModal();render();
  toast(`${swN(rows.length,'despesa importada','despesas importadas')}${dup?` · ${swN(dup,'repetida ignorada','repetidas ignoradas')}`:''}.`);
}
/* Um movimento é meu, para o «Anular a última importação» (D128)? Numa casa
   partilhada os movimentos chegam a cada participante com o lote de quem os
   importou: é meu o que eu criei (o _createdBy do servidor, ou o _author num
   registo sem ele), e todos sem sessão — sem nuvem não há casas partilhadas.
   Recebe: t — o movimento.
   Devolve: true ou false. */
function swMeu(t){
  const eu=meuId(),a=(t&&(t._createdBy||t._author))||'';
  return !eu||!a||a===eu;
}
/* As minhas importações do Splitwise: os lotes (batch) em que todos os
   movimentos são meus (swMeu), do mais antigo para o mais recente — o id é
   'b' + o instante em que se fez.
   Recebe: nada.
   Devolve: [{batch, txs}]. */
function swLotesMeus(){
  const por=new Map();
  (db.transactions||[]).forEach(t=>{if(!t||!t.batch)return;const l=por.get(t.batch)||[];l.push(t);por.set(t.batch,l)});
  return [...por.keys()].sort().filter(b=>por.get(b).every(swMeu)).map(b=>({batch:b,txs:por.get(b)}));
}
/* Anula a minha última importação (swLotesMeus, D128): a confirmação diz
   quantas despesas e quanto saem de cada ano, a âmbar os anos cujo prazo da
   declaração já acabou. Uma importação de outra pessoa da casa não se anula
   daqui. As despesas anuladas não vão à lista das apagadas de propósito
   (settings.swIgnoradas): podem voltar a importar-se.
   Devolve: nada — se for confirmado, grava e redesenha a vista. */
function undoImport(){
  const l=swLotesMeus().pop();
  if(!l)return toast('Não há importações tuas para anular.');
  const data=dataDoInstante(String(l.batch).slice(1));
  confirmModal('Anular importação',`Apagar ${l.txs.length===1?'a despesa':'as '+l.txs.length+' despesas'} da tua última importação${data?' ('+esc(data)+')':''}? ${l.txs.length===1?'Sai':'Saem'} dos gastos de cada ano:${swPorAnoHtml(l.txs,'anular muda')}`,()=>{
    db.transactions=db.transactions.filter(t=>t.batch!==l.batch);save();render();toast('Importação anulada.');
  });
}
/* Lembra as linhas do Splitwise de movimentos apagados de propósito
   (settings.swIgnoradas, D127): a reimportação do grupo não as repõe. É quem
   apaga um movimento que chama (movimento.js) — o «Anular a última
   importação» não. Não grava: quem apaga grava.
   Recebe: ts — o movimento apagado, ou uma lista deles (os sem swKey não contam).
   Devolve: nada. */
function swIgnorar(ts){
  const ks=[].concat(ts||[]).map(t=>t?normSwKey(t.swKey):'').filter(Boolean);if(!ks.length)return;
  db.settings.swIgnoradas=normSwIgnoradas((db.settings.swIgnoradas||[]).concat(ks));
}
/* O contrário do swIgnorar, para o «Anular» de quem apagou: o movimento voltou
   e a linha dele deixa de estar entre as apagadas de propósito.
   Recebe: ts — o movimento reposto, ou uma lista deles.
   Devolve: nada. */
function swDesignorar(ts){
  const ks=new Set([].concat(ts||[]).map(t=>t?normSwKey(t.swKey):'').filter(Boolean));if(!ks.size)return;
  db.settings.swIgnoradas=normSwIgnoradas(db.settings.swIgnoradas).filter(k=>!ks.has(k));
}
