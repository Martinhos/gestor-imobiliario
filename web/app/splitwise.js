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
    <textarea id="swText" style="min-height:120px;font:13px/1.5 ui-monospace,Menlo,monospace" placeholder="Date,Description,Category,Cost,Currency,..."></textarea></div>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="swParse(val('swText'))">Continuar</button>`);
}
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
    <label>A minha quota-parte (%)<input id="sw_quota" type="text" inputmode="decimal" value="${dec(db.settings.quota||100)}" oninput="swRefresh()"></label>
    <div class="hint">O Splitwise exporta o custo total. Se divides a casa a meias, põe 50 e a app lança só metade.</div>
    <div class="divider"></div><div id="swPrev">${swPrevHtml(swPrepare(iDate,iDesc,iCost,iCat,100,db.settings.quota||100))}</div></div>`,
    `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="swDo(${iDate},${iDesc},${iCost},${iCat})">Importar</button>`);
}
// Refaz a pré-visualização (#swPrev) quando o utilizador mexe na quota-parte.
// Devolve: nada — redesenha a pré-visualização no DOM.
function swRefresh(){const[a,b,c,d]=window._swCols;document.getElementById('swPrev').innerHTML=swPrevHtml(swPrepare(a,b,c,d,100,num(val('sw_quota'))))}
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
  return `<div class="hint" style="margin-bottom:8px">${rows.length} despesas · total <b>${euro2(sum(rows.map(r=>r.amount)))}</b></div>
    <div class="tablewrap"><table class="table"><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>
    ${rows.slice(0,6).map(r=>`<tr><td>${r.date}</td><td style="text-align:left;white-space:normal">${esc(r.label)}</td><td>${euro2(r.amount)}</td></tr>`).join('')}
    ${rows.length>6?`<tr><td colspan="3" style="text-align:left;color:var(--muted)">…e mais ${rows.length-6}</td></tr>`:''}</tbody></table></div>`;
}
/* Executa a importação: guarda a quota nas definições, lança as despesas no imóvel
   escolhido saltando duplicados (mesma data, imóvel, valor e descrição) e marca o
   lote com um id para o undoImport poder anular. Grava e volta a renderizar.
   Recebe: iDate, iDesc, iCost, iCat — índices (números) das colunas de data,
   descrição, custo e categoria detetados no CSV.
   Devolve: nada — grava, fecha o modal, redesenha a vista e avisa por toast. */
function swDo(iDate,iDesc,iCost,iCat){
  const pid=val('sw_prop'),quota=num(val('sw_quota'))||100;
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


/* modelo do contrato (ver contrato-modelo.xml) */
const CONTRACT_XML=`<?xml version="1.0" encoding="utf-8"?>
<!--
  Modelo de contrato de arrendamento urbano para habitação com prazo certo.
  Derivado do documento Word fornecido.

  Marcadores {{...}} são substituídos pelos dados da aplicação.
  Se um marcador não tiver valor, a frase que o contém é omitida (opcional="1")
  ou o parágrafo inteiro desaparece (quando todo o parágrafo é opcional).

  Marcadores disponíveis:
    imovel.nome, imovel.morada, imovel.freguesia
    imovel.registo, imovel.matriz, imovel.licenca
    imovel.certificado, imovel.classe, imovel.validadeCert
    senhorios.identificacao   inquilinos.identificacao
    senhorios.representante   senhorios.morada
    contacto.email            contacto.telefone
    contrato.renda            contrato.rendaLetras
    contrato.caucao           contrato.caucaoLetras
    contrato.total            contrato.totalLetras
    contrato.iban             contrato.diaPagamento
    contrato.inicio           contrato.fim            contrato.prazo
    data.hoje                 local
-->
<contrato tipo="arrendamento-habitacao-prazo-certo">

  <titulo>CONTRATO DE ARRENDAMENTO URBANO PARA HABITAÇÃO COM PRAZO CERTO</titulo>
  <subtitulo>{{imovel.nome}} · {{imovel.morada}}</subtitulo>

  <secao titulo="IDENTIFICAÇÃO DAS PARTES">
    <p>SENHORIOS — {{senhorios.identificacao}}, adiante designados conjuntamente por SENHORIOS.</p>
    <p>INQUILINOS — {{inquilinos.identificacao}}, adiante designados conjuntamente por INQUILINOS.</p>
    <p>É celebrado o presente contrato de arrendamento urbano para habitação com prazo certo, regido pelo Código Civil, pelo Novo Regime do Arrendamento Urbano (NRAU) e pelas cláusulas seguintes.</p>
  </secao>

  <clausula titulo="OBJETO">
    <n>Os SENHORIOS dão de arrendamento aos INQUILINOS, que aceitam, o imóvel destinado a habitação sito em {{imovel.morada}}{{#imovel.freguesia}}, {{imovel.freguesia}}{{/}}.</n>
    <n opcional="imovel.registo">O imóvel encontra-se descrito na Conservatória do Registo Predial sob o n.º {{imovel.registo}}{{#imovel.matriz}} e inscrito na matriz predial urbana sob o artigo {{imovel.matriz}}{{/}}.</n>
    <n opcional="imovel.licenca">A utilização para habitação encontra-se titulada por {{imovel.licenca}}.</n>
    <n opcional="imovel.certificado">O imóvel dispõe do Certificado Energético n.º {{imovel.certificado}}{{#imovel.validadeCert}}, válido até {{imovel.validadeCert}}{{/}}{{#imovel.classe}}, com classe energética {{imovel.classe}}{{/}}.</n>
    <n>O arrendamento inclui o imóvel, os bens e equipamentos identificados no Inventário e as chaves registadas no Auto de Entrega, anexos ao presente contrato.</n>
  </clausula>

  <clausula titulo="FINALIDADE E OCUPAÇÃO">
    <n>O imóvel destina-se exclusivamente à habitação permanente dos INQUILINOS.</n>
    <n>É proibida a utilização para alojamento local, hospedagem, atividade profissional aberta ao público ou outra finalidade distinta da habitação, salvo autorização prévia e escrita dos SENHORIOS e desde que legalmente admissível.</n>
    <n>Os INQUILINOS não poderão subarrendar, ceder, emprestar ou dar em comodato, total ou parcialmente, o imóvel, nem permitir a sua ocupação habitual por terceiros não identificados no contrato, sem autorização prévia e escrita dos SENHORIOS.</n>
  </clausula>

  <clausula titulo="PRAZO, RENOVAÇÃO E CESSAÇÃO">
    <n>O contrato é celebrado pelo prazo certo de {{contrato.prazo}}, com início em {{contrato.inicio}} e termo em {{contrato.fim}}.</n>
    <n>No termo do prazo inicial, o contrato renova-se automaticamente pelo período legalmente aplicável. À data da celebração deste contrato, tratando-se de prazo inicial inferior a três anos, a renovação automática opera por períodos de três anos, sem prejuízo de alteração legislativa imperativa que venha a ser aplicável.</n>
    <n>Os SENHORIOS podem opor-se à renovação mediante comunicação aos INQUILINOS com a antecedência legalmente exigida. Num contrato com prazo inicial de um ano, a antecedência é, à data da celebração, de 120 dias; a oposição à primeira renovação pelo senhorio apenas produz efeitos após decorridos três anos da celebração, salvo as exceções previstas na lei.</n>
    <n>Os INQUILINOS podem opor-se à renovação do contrato de um ano mediante comunicação aos SENHORIOS com a antecedência legalmente exigida, que à data da celebração é de 90 dias.</n>
    <n>Decorrido um terço do prazo de duração inicial ou da renovação, os INQUILINOS podem denunciar o contrato a todo o tempo, mediante o pré-aviso legal aplicável. Para prazo igual ou superior a um ano, o pré-aviso é, à data da celebração, de 120 dias.</n>
    <n>A simples saída ou desocupação do imóvel não faz cessar o contrato nem extingue a obrigação de pagamento de renda. As rendas mantêm-se devidas até à data em que a cessação produza legalmente efeitos. A falta do pré-aviso devido obriga ao pagamento das rendas correspondentes ao período de pré-aviso em falta, sem prejuízo das exceções legalmente previstas.</n>
  </clausula>

  <clausula titulo="RENDA, PAGAMENTO E ATUALIZAÇÃO">
    <n>A renda mensal é de {{contrato.renda}} ({{contrato.rendaLetras}}).</n>
    <n>A renda é paga por transferência bancária para o IBAN {{contrato.iban}}, devendo o montante estar disponível na conta dos SENHORIOS até ao dia {{contrato.diaPagamento}} do mês a que respeita.</n>
    <n>Na assinatura, os INQUILINOS pagam antecipadamente {{contrato.renda}} ({{contrato.rendaLetras}}), correspondentes à renda do primeiro mês do arrendamento.</n>
    <n>Após o mês abrangido pelo pagamento antecipado, o pagamento mensal da renda retoma-se nos termos do número anterior.</n>
    <n>O comprovativo bancário constitui prova do pagamento, sem prejuízo da emissão do respetivo recibo de renda pelos SENHORIOS.</n>
    <n>A renda pode ser atualizada anualmente nos termos legais. A primeira atualização só pode ser exigida decorrido um ano de vigência e será comunicada por escrito com a antecedência legalmente exigida.</n>
  </clausula>

  <clausula titulo="CAUÇÃO" opcional="contrato.caucao">
    <n>Na assinatura, os INQUILINOS entregam aos SENHORIOS {{contrato.caucao}} ({{contrato.caucaoLetras}}), a título de caução destinada a garantir o cumprimento das obrigações emergentes do contrato.</n>
    <n>A caução pode ser aplicada a rendas, consumos ou encargos em dívida, indemnizações, despesas de limpeza, substituição de chaves ou fechaduras e reparação de danos imputáveis aos INQUILINOS, sem prejuízo do direito dos SENHORIOS a exigir o remanescente quando a caução seja insuficiente.</n>
    <n>A caução não substitui o pagamento das últimas rendas, salvo acordo escrito e expresso dos SENHORIOS.</n>
    <n>Após a restituição do imóvel e das chaves, os SENHORIOS verificarão o estado do imóvel e as obrigações pendentes. O saldo da caução será devolvido depois dessa verificação, deduzidas apenas as quantias identificadas e justificadas.</n>
    <n>Se existirem faturas de consumos ainda não emitidas, orçamentos pendentes ou danos cujo custo não possa ser apurado de imediato, os SENHORIOS podem reter provisoriamente a quantia razoavelmente necessária, comunicando por escrito a respetiva fundamentação.</n>
  </clausula>

  <destaque opcional="contrato.total">VALOR TOTAL A ENTREGAR NA ASSINATURA: {{contrato.total}} — {{contrato.renda}} de renda antecipada + {{contrato.caucao}} de caução</destaque>

  <clausula titulo="ENCARGOS E SERVIÇOS">
    <n>São da responsabilidade dos INQUILINOS os consumos e contratos de água, eletricidade, gás, telecomunicações e demais serviços utilizados no imóvel durante o arrendamento.</n>
    <n>Sempre que possível, os contratos de fornecimento serão colocados em nome dos INQUILINOS no prazo de 10 dias após a entrega das chaves.</n>
    <n>No final do arrendamento, os INQUILINOS apresentarão, quando solicitado, comprovativos de pagamento e de cessação ou transferência dos contratos de fornecimento.</n>
    <n>O IMI e os encargos relativos à propriedade e à administração, conservação e fruição das partes comuns são suportados pelos SENHORIOS, sem prejuízo dos encargos que a lei ou o presente contrato atribuam ao utilizador.</n>
  </clausula>

  <clausula titulo="ESTADO, INVENTÁRIO E ENTREGA INICIAL">
    <n>O imóvel é entregue em condições de habitabilidade e conservação, no estado descrito no Inventário, no Auto de Entrega e no registo fotográfico anexos, que fazem parte integrante do contrato.</n>
    <n>Os INQUILINOS dispõem de 10 dias após a entrega das chaves para comunicar por escrito anomalias preexistentes não registadas nos anexos, juntando fotografias sempre que possível.</n>
    <n>A ausência dessa comunicação não impede a invocação de defeitos ocultos, mas presume-se que os elementos visíveis foram recebidos no estado documentado no inventário e nas fotografias.</n>
    <n>No Auto de Entrega serão registadas as chaves entregues aos INQUILINOS.</n>
  </clausula>

  <clausula titulo="UTILIZAÇÃO, CONSERVAÇÃO E AVARIAS">
    <n>Os INQUILINOS obrigam-se a utilizar o imóvel e os equipamentos de forma prudente, diligente e de acordo com a respetiva finalidade.</n>
    <n>Os INQUILINOS comunicarão de imediato qualquer infiltração, fuga de água, avaria elétrica, risco estrutural ou outra situação suscetível de agravar danos, respondendo pelo prejuízo adicional causado por atraso injustificado nessa comunicação.</n>
    <n>São da responsabilidade dos INQUILINOS as pequenas reparações decorrentes do uso corrente e a reparação de danos causados por si, pelos visitantes e prestadores por si contratados ou animais autorizados.</n>
    <n>São da responsabilidade dos SENHORIOS as obras de conservação legalmente a seu cargo e as reparações de avarias não imputáveis aos INQUILINOS.</n>
  </clausula>

  <clausula titulo="OBRAS, FUROS, PINTURA E ALTERAÇÕES">
    <n>É expressamente proibido fazer furos nas paredes, azulejos, pedra, caixilharias ou quaisquer outros elementos do imóvel sem autorização prévia e escrita dos SENHORIOS.</n>
    <n>É igualmente proibido pintar, repintar, aplicar papel de parede ou alterar a cor, acabamento ou revestimento das paredes sem autorização prévia e escrita dos SENHORIOS.</n>
    <n>Os INQUILINOS não podem realizar obras, instalar equipamentos fixos, alterar fechaduras, redes técnicas, fachadas ou a disposição permanente do imóvel sem autorização prévia e escrita dos SENHORIOS.</n>
    <n>As benfeitorias autorizadas que não possam ser retiradas sem dano ficam integradas no imóvel, sem direito a indemnização ou retenção, salvo acordo escrito em contrário.</n>
    <n>Em situação urgente destinada a evitar dano iminente, os INQUILINOS deverão contactar os SENHORIOS e atuar apenas na medida estritamente necessária, conservando comprovativos e documentação da ocorrência.</n>
  </clausula>

  <clausula titulo="FUMO E ANIMAIS">
    <n>É proibido fumar no interior da habitação, incluindo cigarros eletrónicos, dispositivos de tabaco aquecido e produtos semelhantes.</n>
    <n>Os custos de limpeza, desodorização, pintura ou reparação decorrentes do incumprimento são suportados pelos INQUILINOS.</n>
    <n>A permanência de animais no imóvel depende de autorização prévia e escrita dos SENHORIOS, sem prejuízo das situações legalmente protegidas.</n>
    <n>Os INQUILINOS respondem pelos danos, ruídos, odores, falta de higiene ou prejuízos causados pelos animais.</n>
  </clausula>

  <clausula titulo="BOA VIZINHANÇA E SEGURANÇA">
    <n>Os INQUILINOS comprometem-se a respeitar as regras de boa vizinhança, o descanso dos moradores, as normas de segurança e, quando aplicável, o regulamento do condomínio.</n>
    <n>É proibido armazenar no imóvel substâncias perigosas ou inflamáveis em quantidade incompatível com o uso doméstico normal.</n>
    <n>Os INQUILINOS não podem alterar ou inutilizar detetores, ventilação ou equipamentos de segurança existentes.</n>
  </clausula>

  <clausula titulo="ACESSO, INSPEÇÕES E VISITAS">
    <n>Mediante marcação prévia, motivo legítimo e horário razoável, os INQUILINOS permitirão o acesso dos SENHORIOS ou de técnicos por estes indicados para verificar o estado do imóvel, executar obras ou realizar reparações necessárias.</n>
    <n>Em caso de emergência, risco para pessoas ou bens, fuga de água, incêndio ou situação semelhante, deverá ser facultado acesso tão rapidamente quanto razoavelmente possível.</n>
    <n>Nos três meses anteriores à cessação do contrato, os INQUILINOS permitirão visitas de potenciais arrendatários ou adquirentes, mediante marcação prévia e conciliação razoável de horários.</n>
    <n>As visitas e inspeções não podem ser utilizadas de forma abusiva nem perturbar injustificadamente a vida privada dos INQUILINOS.</n>
  </clausula>

  <clausula titulo="RESTITUIÇÃO DO IMÓVEL">
    <n>Na cessação do contrato, o imóvel será entregue livre de pessoas e bens, limpo, com todos os equipamentos e chaves, e em estado equivalente ao da entrega inicial, ressalvado o desgaste normal de uma utilização prudente.</n>
    <n>Caso o imóvel não seja entregue com nível de limpeza equivalente ao documentado no início, os SENHORIOS podem contratar a limpeza necessária e imputar o respetivo custo aos INQUILINOS.</n>
    <n>A entrega será formalizada, sempre que possível, por Auto de Restituição, com registo fotográfico, identificação de danos e entrega das chaves.</n>
    <n>A perda ou não devolução de chaves obriga ao pagamento da respetiva substituição e, quando razoavelmente necessário por razões de segurança, da substituição das fechaduras.</n>
    <n>A não restituição atempada do imóvel produz as consequências indemnizatórias previstas na lei.</n>
  </clausula>

  <clausula titulo="INCUMPRIMENTO E MORA">
    <n>A falta de pagamento pontual da renda ou de outros valores devidos constitui mora e confere aos SENHORIOS os direitos e indemnizações previstos na lei.</n>
    <n>O incumprimento grave ou reiterado das obrigações contratuais pode fundamentar a resolução do contrato nos termos legais.</n>
    <n>A aceitação de pagamentos posteriores não constitui, por si só, renúncia aos direitos relativos a incumprimentos anteriores.</n>
    <n>Os INQUILINOS suportarão os custos razoáveis e comprovados diretamente causados pelo seu incumprimento, dentro dos limites legalmente admissíveis.</n>
  </clausula>

  <clausula titulo="COMUNICAÇÕES, DOMICÍLIO E ALTERAÇÕES">
    <n>Para receção de comunicações dirigidas aos SENHORIOS, estes designam {{senhorios.representante}} como representante comum{{#senhorios.morada}}, no endereço {{senhorios.morada}}{{/}}{{#contacto.email}}, e no e-mail {{contacto.email}}{{/}}{{#contacto.telefone}}. Contacto telefónico: {{contacto.telefone}}{{/}}.</n>
    <n>Para efeitos de comunicações formais, os INQUILINOS indicam como domicílio o imóvel arrendado, salvo se comunicarem por escrito outro endereço.</n>
    <n>As comunicações legalmente exigíveis relativas à cessação do arrendamento, atualização da renda e obras serão efetuadas pela forma legalmente prevista, designadamente por escrito assinado e carta registada com aviso de receção quando essa seja a forma exigida pelo NRAU.</n>
    <n>As comunicações correntes podem ser efetuadas por correio eletrónico. Qualquer alteração ou aditamento ao presente contrato só será válido se reduzido a escrito e expressamente aceite por todas as partes, podendo a aceitação ser comprovada por correio registado ou por correio eletrónico com prova de envio e receção, sem prejuízo de formalidade legal imperativa.</n>
    <n>Cada parte comunicará por escrito qualquer alteração de morada ou endereço eletrónico. Até essa comunicação, serão utilizados os contactos constantes do contrato.</n>
  </clausula>

  <clausula titulo="DISPOSIÇÕES FINAIS">
    <n>A invalidade ou ineficácia de uma disposição não determina a invalidade das restantes, aplicando-se em sua substituição a solução legalmente admissível que mais se aproxime da finalidade pretendida.</n>
    <n>Em tudo o que esteja omisso aplicam-se o Código Civil, o NRAU e a demais legislação portuguesa em vigor.</n>
    <n>Os litígios serão submetidos aos tribunais e demais meios legalmente competentes, sem prejuízo de resolução por acordo entre as partes.</n>
    <n>Os SENHORIOS comunicarão o contrato e os factos legalmente relevantes à Autoridade Tributária e emitirão os recibos de renda nos termos aplicáveis.</n>
  </clausula>

  <secao titulo="ANEXOS">
    <lista>
      <item>Anexo I — Inventário e estado de conservação</item>
      <item>Anexo II — Registo fotográfico</item>
      <item>Anexo III — Auto de entrega de chaves</item>
    </lista>
  </secao>

  <secao titulo="ASSINATURA E FORMALIZAÇÃO">
    <p>Celebrado em {{local}}, no dia {{data.hoje}}, em exemplares destinados a cada uma das partes.</p>
    <assinaturas parte="senhorios"/>
    <assinaturas parte="inquilinos"/>
  </secao>

  <anexo titulo="ANEXO I — INVENTÁRIO E ESTADO DE CONSERVAÇÃO">
    <p>O inventário identifica os bens, equipamentos e principais elementos fixos entregues com o imóvel. O estado deverá ser confirmado na entrega e complementado pelo registo fotográfico anexo. A indicação “Novo” significa que o elemento é entregue sem uso anterior; “Usado” identifica um elemento já utilizado, prevalecendo sempre o estado efetivamente documentado na data da entrega.</p>
    <tabela fonte="inventario" colunas="N.º|Elemento / equipamento|Qt.|Estado"/>
  </anexo>

  <anexo titulo="ANEXO II — REGISTO FOTOGRÁFICO" opcional="fotos">
    <p>As fotografias seguintes integram o presente contrato e documentam o estado geral do imóvel na data da entrega.</p>
    <tabela fonte="fotos" colunas="N.º|Fotografia"/>
  </anexo>

  <anexo titulo="ANEXO III — AUTO DE ENTREGA DE CHAVES">
    <p>Na data de início do contrato, os INQUILINOS declaram receber as seguintes chaves:</p>
    <tabela fonte="chaves" colunas="Tipo|Quantidade"/>
    <p opcional="contrato.inicio">Entregue em {{contrato.inicio}}.</p>
    <assinaturas parte="senhorios"/>
    <assinaturas parte="inquilinos"/>
  </anexo>

</contrato>
`;

/* ================= GERADOR DE PDF =================
   Escritor de PDF mínimo, sem bibliotecas: fontes Helvetica padrão,
   codificação WinAnsi (cobre todos os acentos portugueses) e quebra de
   linha calculada com as larguras reais dos glifos.
   O HW é a tabela de larguras da Helvetica normal, construída uma vez pelo IIFE.
   Devolve: objeto {código do carácter → largura em milésimos de em}. */
const HW=(function(){
  const w={},a=(s,v)=>{for(const c of s)w[c.charCodeAt(0)]=v};
  a(' ',278);a('!',278);a('"',355);a('#',556);a('$',556);a('%',889);a('&',667);a("'",191);
  a('()',333);a('*',389);a('+',584);a(',',278);a('-',333);a('.',278);a('/',278);
  a('0123456789',556);a(':;',278);a('<=>',584);a('?',556);a('@',1015);
  a('A',667);a('B',667);a('C',722);a('D',722);a('E',667);a('F',611);a('G',778);a('H',722);
  a('I',278);a('J',500);a('K',667);a('L',556);a('M',833);a('N',722);a('O',778);a('P',667);
  a('Q',778);a('R',722);a('S',667);a('T',611);a('U',722);a('V',667);a('W',944);a('X',667);
  a('Y',667);a('Z',611);a('[]',278);a('\\',278);a('^',469);a('_',556);a('`',333);
  a('a',556);a('b',556);a('c',500);a('d',556);a('e',556);a('f',278);a('g',556);a('h',556);
  a('i',222);a('j',222);a('k',500);a('l',222);a('m',833);a('n',556);a('o',556);a('p',556);
  a('q',556);a('r',333);a('s',500);a('t',278);a('u',556);a('v',500);a('w',722);a('x',500);
  a('y',500);a('z',500);a('{',334);a('|',260);a('}',334);a('~',584);
  return w;
})();
// Larguras dos glifos da Helvetica-Bold — o par negrito da tabela HW acima.
// Devolve: objeto {código do carácter → largura em milésimos de em}, construído uma vez pelo IIFE.
const HWB=(function(){
  const w={},a=(s,v)=>{for(const c of s)w[c.charCodeAt(0)]=v};
  a(' ',278);a('!',333);a('"',474);a('#',556);a('$',556);a('%',889);a('&',722);a("'",238);
  a('()',333);a('*',389);a('+',584);a(',',278);a('-',333);a('.',278);a('/',278);
  a('0123456789',556);a(':;',333);a('<=>',584);a('?',611);a('@',975);
  a('A',722);a('B',722);a('C',722);a('D',722);a('E',667);a('F',611);a('G',778);a('H',722);
  a('I',278);a('J',556);a('K',722);a('L',611);a('M',833);a('N',722);a('O',778);a('P',667);
  a('Q',778);a('R',722);a('S',667);a('T',611);a('U',722);a('V',667);a('W',944);a('X',667);
  a('Y',667);a('Z',611);a('[]',333);a('\\',278);a('^',584);a('_',556);a('`',333);
  a('a',556);a('b',611);a('c',556);a('d',611);a('e',556);a('f',333);a('g',611);a('h',611);
  a('i',278);a('j',278);a('k',556);a('l',278);a('m',889);a('n',611);a('o',611);a('p',611);
  a('q',611);a('r',389);a('s',556);a('t',333);a('u',611);a('v',556);a('w',778);a('x',556);
  a('y',556);a('z',500);a('{',389);a('|',280);a('}',389);a('~',584);
  return w;
})();
/* acentuados: a largura é a da letra base */
const BASE={192:'A',193:'A',194:'A',195:'A',196:'A',197:'A',199:'C',200:'E',201:'E',202:'E',
  203:'E',204:'I',205:'I',206:'I',207:'I',209:'N',210:'O',211:'O',212:'O',213:'O',214:'O',
  217:'U',218:'U',219:'U',220:'U',221:'Y',224:'a',225:'a',226:'a',227:'a',228:'a',229:'a',
  231:'c',232:'e',233:'e',234:'e',235:'e',236:'i',237:'i',238:'i',239:'i',241:'n',242:'o',
  243:'o',244:'o',245:'o',246:'o',249:'u',250:'u',251:'u',252:'u',253:'y',186:'o',170:'a',
  8364:'E',8220:'"',8221:'"',8216:"'",8217:"'",8212:'-',8211:'-',183:'.',176:'o'};
// Largura de um carácter (milésimos de em) na fonte pedida; acentuados usam a letra base, desconhecidos levam uma largura média.
// Recebe: code — o código do carácter (charCodeAt); bold — true para a Helvetica-Bold.
// Devolve: a largura em milésimos de em (número).
function charW(code,bold){
  const w=bold?HWB:HW;
  if(w[code]!==undefined)return w[code];
  const b=BASE[code];
  if(b)return w[b.charCodeAt(0)]||500;
  return bold?611:556;
}
// Largura de uma linha de texto em pontos, para o tamanho e peso dados — é isto que decide as quebras de linha.
// Recebe: s — o texto; size — o tamanho da fonte em pontos; bold — true para negrito.
// Devolve: a largura do texto em pontos (número).
const textW=(s,size,bold)=>{let t=0;for(let i=0;i<s.length;i++)t+=charW(s.charCodeAt(i),bold);return t*size/1000};

/* WinAnsi: mapeia o que precisamos e substitui o resto */
const WIN={8364:128,8218:130,8222:132,8230:133,8224:134,8225:135,8216:145,8217:146,
  8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,8250:155};
/* Prepara texto para uma string literal do PDF: converte os símbolos tipográficos
   via tabela WIN, reduz o resto do não-latin-1 à letra base (ou "?") e escapa
   parênteses e barra invertida.
   Recebe: s — o texto a escrever no PDF.
   Devolve: a string pronta para o literal do PDF (só latin-1, com escapes). */
function pdfEsc(s){
  let out='';
  for(let i=0;i<s.length;i++){
    let c=s.charCodeAt(i);
    if(WIN[c]!==undefined)c=WIN[c];
    else if(c>255){const b=BASE[c];c=b?b.charCodeAt(0):63}
    const ch=String.fromCharCode(c);
    out+=(ch==='('||ch===')'||ch==='\\')?'\\'+ch:ch;
  }
  return out;
}

/* Cria um documento A4 e devolve o escritor: text() escreve parágrafos com quebra
   de linha calculada e mudança de página automática, line() faz linhas de tabela,
   photo() coloca um JPEG com legenda, rule()/gap() separam, e build() devolve o
   ficheiro completo como string latin-1 (um carácter = um byte).
   Devolve: o objeto escritor, com esses métodos (e image/draw/need/newPage/gap),
   já com a primeira página aberta. */
function PDF(){
  const P={pages:[],cur:null,y:0,W:595.28,H:841.89,ML:56,MR:56,MT:64,MB:64,images:[]};
  P.newPage=()=>{P.cur=[];P.pages.push(P.cur);P.y=P.H-P.MT};
  /* imagem JPEG (bytes numa string latin-1); devolve o número para desenhar */
  P.image=(bin,w,h)=>{P.images.push({bin,w,h});return P.images.length};
  P.draw=(n,x,y,w,h)=>{P.cur.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${n} Do Q`)};
  /* desenha uma fotografia com legenda, ajustada à largura e a uma altura máxima */
  P.photo=(n,iw,ih,caption,maxH)=>{
    const full=P.W-P.ML-P.MR,k=Math.min(full/iw,(maxH||300)/ih),w=iw*k,h=ih*k;
    P.need(h+24);
    P.draw(n,P.ML,P.y-h,w,h);P.y-=h+4;
    P.text(caption,{size:9.5,after:10});
  };
  P.space=()=>P.y-P.MB;
  P.need=h=>{if(P.y-h<P.MB)P.newPage()};
  P.text=(s,o)=>{
    o=o||{};
    const size=o.size||10,bold=!!o.bold,lead=o.lead||size*1.42;
    const x0=P.ML+(o.indent||0),maxW=P.W-P.ML-P.MR-(o.indent||0)-(o.right||0);
    const words=String(s).split(/\s+/).filter(Boolean);
    const lines=[];let line='';
    words.forEach(w=>{
      const cand=line?line+' '+w:w;
      if(textW(cand,size,bold)>maxW&&line){lines.push(line);line=w}else line=cand;
    });
    if(line)lines.push(line);
    lines.forEach((ln,i)=>{
      P.need(lead);
      let x=x0;
      if(o.center)x=(P.W-textW(ln,size,bold))/2;
      P.cur.push(`BT /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(2)} ${(P.y-size).toFixed(2)} Td (${pdfEsc(ln)}) Tj ET`);
      P.y-=lead;
    });
    if(o.after)P.y-=o.after;
  };
  P.rule=(o)=>{o=o||{};P.need(6);
    P.cur.push(`0.75 w 0.7 0.7 0.7 RG ${(P.ML+(o.indent||0)).toFixed(2)} ${P.y.toFixed(2)} m ${(P.W-P.MR).toFixed(2)} ${P.y.toFixed(2)} l S`);
    P.y-=(o.after===undefined?8:o.after);};
  P.gap=h=>{P.y-=h};
  P.line=(cols,widths,o)=>{                        /* linha de tabela */
    o=o||{};const size=o.size||9.5,lead=size*1.5;
    P.need(lead+2);
    let x=P.ML;
    cols.forEach((c,i)=>{
      const w=widths[i];
      let s=String(c==null?'':c);
      while(textW(s,size,o.bold)>w-6&&s.length>1)s=s.slice(0,-1);
      const tx=o.right&&o.right.indexOf(i)>-1?x+w-6-textW(s,size,o.bold):x+3;
      P.cur.push(`BT /${o.bold?'F2':'F1'} ${size} Tf ${tx.toFixed(2)} ${(P.y-size).toFixed(2)} Td (${pdfEsc(s)}) Tj ET`);
      x+=w;
    });
    P.y-=lead;
    if(o.rule)P.rule({after:3});
  };
  P.build=()=>{
    const objs=[];
    const push=s=>{objs.push(s);return objs.length};
    const kids=[];
    const fontA=push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontB=push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const imIds=P.images.map(im=>push(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bin.length} >>\nstream\n${im.bin}\nendstream`));
    const xobj=imIds.length?` /XObject << ${imIds.map((id,i)=>`/Im${i+1} ${id} 0 R`).join(' ')} >>`:'';
    const pagesId=push('');                        /* reservado */
    P.pages.forEach(ops=>{
      const stream=ops.join('\n');
      const cid=push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pid=push(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${P.W.toFixed(2)} ${P.H.toFixed(2)}] `+
        `/Resources << /Font << /F1 ${fontA} 0 R /F2 ${fontB} 0 R >>${xobj} >> /Contents ${cid} 0 R >>`);
      kids.push(pid);
    });
    objs[pagesId-1]=`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(k=>k+' 0 R').join(' ')}] >>`;
    const catId=push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let out='%PDF-1.4\n';const offs=[];
    objs.forEach((o,i)=>{offs.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});
    const xref=out.length;
    out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
    offs.forEach(o=>{out+=String(o).padStart(10,'0')+' 00000 n \n'});
    out+=`trailer\n<< /Size ${objs.length+1} /Root ${catId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return out;
  };
  P.newPage();
  return P;
}

/* fotografia guardada em IndexedDB -> JPEG redimensionado, em string de bytes (para o PDF)
   Recebe: meta — os metadados da fotografia (usa meta.id como chave no IndexedDB);
   maxPx (opcional) — lado máximo da imagem em píxeis (por omissão 1200).
   Devolve: Promise de {bin, w, h} — os bytes JPEG numa string latin-1 e as
   dimensões em píxeis — ou de null se a foto faltar ou a conversão falhar. */
function photoJpeg(meta,maxPx){
  return idbGet(meta.id).then(blob=>{
    if(!blob)return null;
    return new Promise(res=>{
      const url=URL.createObjectURL(blob),img=new Image();
      const done=v=>{try{URL.revokeObjectURL(url)}catch(e){}res(v)};
      img.onload=()=>{
        try{
          const k=Math.min(1,(maxPx||1200)/Math.max(1,img.naturalWidth,img.naturalHeight));
          const w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k));
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;
          const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
          const b64=cv.toDataURL('image/jpeg',0.82).split(',')[1];
          done({bin:atob(b64),w,h});
        }catch(e){done(null)}
      };
      img.onerror=()=>done(null);
      img.src=url;
    });
  }).catch(()=>null);
}
