/* ================= TAREFAS =================
   A lista de tarefas de um imóvel ou de um contrato: o que há para fazer
   nele (trocar o esquentador, entregar as chaves, pedir o certificado
   energético), arrumado em secções, com cada tarefa cumprida ou por cumprir.

   Vive DENTRO do registo (p.tarefas, c.tarefas; dados.js:normTarefas), e não
   num kind próprio: sobe e desce com o imóvel ou o contrato, com as mesmas
   permissões. Num imóvel, altera-a quem pode editar a ficha (house.edit), e
   quem colabora sem essa permissão nem a recebe — o servidor despe-a como
   despe as notas (worker/src/lib/permissoes.js:projetarCasa). Num contrato,
   altera-a quem pode alterar o contrato (acessos.js:podeEditar).

   A ficha do contrato mostra o resumo e a porta (tfLinhaDaFicha); a do
   imóvel um cartão com as primeiras tarefas, só de leitura, e as mesmas
   portas (tfCartaoDaFicha). A lista abre-se numa janela própria (tfAbrir),
   porque uma ficha lê-se e não tem campos (docs/design.md, «Tocar num
   registo é lê-lo»). Cada toque na lista grava logo — marcar uma tarefa não
   pede um «Guardar».

   Na lista, cada secção recolhe-se pelo cabeçalho (tfDobrar), e o que fica
   recolhido é do aparelho, como a gaveta. Quem pode alterar arrasta as
   tarefas pela pega (tfArrastar): por cima do nome de uma secção, a secção
   acende e largar põe a tarefa em 1.º lugar dela; entre duas tarefas aparece
   uma linha e largar põe-na aí. A ordem é a do array itens, e mais nada
   (tfMoverEm). Ao teclado, a pega abre o «Mover tarefa» (tfMoverTarefa). E o
   formulário escolhe a secção, ou cria uma ali mesmo («+ Criar secção…»,
   como a categoria de um movimento), que se grava com a tarefa. */

/* a janela de tarefas aberta: de que registo é ({tipo,id}), e o que a
   pesquisa e os dois filtros pedem. Volta ao início a cada tfAbrir. */
let tfAlvo=null;
let tfFiltro={q:'',seccao:'',estado:''};
/* a tarefa em edição no formulário (tfFormTarefa): o id, ou '' numa nova */
let tfEmEdicao='';
/* as secções criadas no formulário aberto pelo «+ Criar secção…», ainda por
   gravar ([{id,nome}]): entram com a tarefa, e um Cancelar deita-as fora */
let tfSecNovas=[];
/* a secção escolhida no formulário antes do «+ Criar secção…»: é a que volta
   ao seletor se o nome for cancelado */
let tfSecAntes='';
/* a tarefa que a janela «Mover tarefa» move (tfMoverTarefa): o id */
let tfMovendo='';
/* As secções recolhidas ficam no aparelho e não na conta, como as da gaveta
   (navegacao.js:LS_GAVETA): {'imovel:P1':['S1','__sem__'],…}, por registo e
   por secção ('__sem__' é o grupo das tarefas sem secção). Sem nada guardado
   — ou com o armazenamento fechado — está tudo aberto. */
const LS_TF_RECOLHIDAS='gi_tf_recolhidas';
/* o mapa das recolhidas, lido uma vez do aparelho e mantido em memória: um
   armazenamento que recusa não desfaz o toque até a página recarregar */
let _tfRec=null;
/* o arrasto em curso (tfArrastar), ou null: {tid, h — a pega, row — a linha,
   lista — o #tf_lista, rol — quem rola, y0 — onde o dedo pousou, y — onde
   está, topo0 — o topo da linha antes de mexer, alt — a altura dela,
   desloc — o translateY de agora, ativo — se já passou do limiar,
   cancelado — se o Esc o desfez, alvo — onde vai cair ({sid, depois, cab,
   sec, antes}), chave — o alvo já pintado, vel — a velocidade da
   auto-rolagem, raf} */
let tfArr=null;
/* quando acabou o último arrasto a sério (Date.now()): o clique que o browser
   dispara a seguir ao pointerup engole-se, senão largar abria o «Mover tarefa» */
let tfArrFim=0;

/* O registo de que a lista é.
   Recebe: tipo — 'imovel' ou 'contrato'; id — o id do registo.
   Devolve: o imóvel ou o contrato da base, ou undefined se já não existir. */
function tfRegisto(tipo,id){return tipo==='contrato'?contract(id):prop(id)}
/* As tarefas de um registo, normalizadas (um registo antigo não as tem).
   Recebe: r — o imóvel ou o contrato (aguenta nada).
   Devolve: {seccoes, itens}, sempre com as duas listas. */
function tarefasDe(r){return normTarefas(r&&r.tarefas)}
/* Quem pode mexer nesta lista: o mesmo que pode alterar o registo.
   Recebe: tipo — 'imovel' ou 'contrato'; id — o id do registo.
   Devolve: true se pode adicionar, marcar, mudar e remover tarefas. */
function tfPodeAlterar(tipo,id){
  const r=tfRegisto(tipo,id);if(!r)return false;
  return tipo==='contrato'?podeEditar(r.propertyId,'contract.add',r):pode(id,'house.edit');
}
/* A frase de quem não pode, para o toast de uma escrita recusada.
   Recebe: tipo — 'imovel' ou 'contrato'; id — o id do registo.
   Devolve: a frase (texto), ou '' quando pode. */
function tfRecusa(tipo,id){
  const r=tfRegisto(tipo,id);if(!r)return 'Este registo já não existe.';
  if(tipo==='contrato')return motivoRecusa(r.propertyId,'contract.add',r);
  return pode(id,'house.edit')?'':fraseSemPerm('house.edit');
}
/* O resumo de uma lista em palavras: quantas por cumprir e quantas cumpridas.
   Recebe: t — as tarefas ({seccoes, itens}).
   Devolve: o texto, ex.: «3 por cumprir · 2 cumpridas»; «Ainda não há tarefas.» sem nenhuma. */
function tfResumo(t){
  const n=t.itens.length,f=t.itens.filter(x=>x.feita).length,p=n-f;
  if(!n)return 'Ainda não há tarefas.';
  if(!p)return n===1?'A tarefa está cumprida.':'As '+n+' tarefas estão cumpridas.';
  return [p+' por cumprir',f?f+(f===1?' cumprida':' cumpridas'):''].filter(Boolean).join(' · ');
}
/* A linha das tarefas na ficha do imóvel ou do contrato: o resumo e o botão
   que abre a lista. Quem não pode alterar e não tem tarefas não a vê.
   Recebe: tipo — 'imovel' ou 'contrato'; id — o id do registo.
   Devolve: a linha para o componentes.js:ficha ({tipo:'bloco',…}), ou null. */
function tfLinhaDaFicha(tipo,id){
  const r=tfRegisto(tipo,id);if(!r)return null;
  const t=tarefasDe(r),ok=tfPodeAlterar(tipo,id);
  if(!t.itens.length&&!ok)return null;
  const rotulo=t.itens.length?'Ver tarefas':'Adicionar tarefas';
  return {tipo:'bloco',rotulo:'Tarefas',valor:esc(tfResumo(t))
    +`<div class="toolbar u-m-9px-0-0"><button type="button" class="btn sm" data-toca="camada" data-click="tfAbrir('${jsq(tipo)}','${jsq(id)}')">${ic('check',14)} ${rotulo}</button></div>`};
}
/* O cartão das tarefas na ficha do imóvel (a prancheta M-Imovel): o resumo
   no cabeçalho, as primeiras por cumprir (até quatro) e as cumpridas mais
   recentes que caibam até às quatro, e o «Adicionar tarefa» e o «Ver
   todas». A ficha lê-se e não tem campos: cada tarefa é uma linha com a
   caixa desenhada, e tocar abre a lista (tfAbrir), onde se marca. Quem não
   pode alterar e não tem tarefas não o vê.
   Recebe: tipo — 'imovel' ou 'contrato'; id — o id do registo.
   Devolve: o HTML do cartão, ou '' sem nada a mostrar. */
function tfCartaoDaFicha(tipo,id){
  const r=tfRegisto(tipo,id);if(!r)return '';
  const t=tarefasDe(r),ok=tfPodeAlterar(tipo,id);
  if(!t.itens.length&&!ok)return '';
  const abrir=`tfAbrir('${jsq(tipo)}','${jsq(id)}')`;
  const por=t.itens.filter(x=>!x.feita),feitas=t.itens.filter(x=>x.feita).sort((a,b)=>String(b.feitaEm||'').localeCompare(String(a.feitaEm||'')));
  const vistas=por.slice(0,4).concat(feitas.slice(0,Math.max(0,4-Math.min(4,por.length))));
  const sec=x=>{const s=t.seccoes.find(y=>y.id===x.seccao);return s?s.nome:''};
  const linhas=vistas.map(x=>`<div class="imv-linha tap tf-fl${x.feita?' tf-feita':''}" data-toca="camada" data-click="${abrir}">
      <span class="tf-caixa" aria-hidden="true">${x.feita?ic('check',14):''}</span>
      <span class="tf-fl-nome"><span class="imv-so-leitor">${x.feita?'Cumprida: ':'Por cumprir: '}</span>${esc(x.nome||'Sem nome')}</span>
      ${x.feita&&x.feitaEm?`<span class="small num">${dPT(x.feitaEm).slice(0,5)}</span>`:sec(x)?`<span class="badge grey">${esc(sec(x))}</span>`:''}</div>`).join('');
  const mais=t.itens.length>vistas.length;
  return `<div class="card imv-sec tf-cartao"><div class="imv-sec-cab"><h3>Tarefas</h3><span class="small num">${esc(tfResumo(t))}</span></div>
    ${linhas}
    <div class="tf-fl-pe">${ok?`<button type="button" class="btn ghost tf-fl-mais" data-toca="camada" data-click="${abrir};tfNovaTarefa('')">${ic('plus',18)} Adicionar tarefa</button>`:''}
      ${t.itens.length?`<button type="button" class="btn ghost tf-fl-ver" data-toca="camada" data-click="${abrir}">${mais?'Ver todas':'Ver tarefas'}</button>`:''}</div></div>`;
}
/* Abre a janela da lista de tarefas de um imóvel ou de um contrato, com a
   pesquisa e os filtros limpos.
   Recebe: tipo — 'imovel' ou 'contrato'; id — o id do registo.
   Devolve: nada — abre a janela. */
function tfAbrir(tipo,id){
  const r=tfRegisto(tipo,id);if(!r)return;
  tfAlvo={tipo:tipo==='contrato'?'contrato':'imovel',id:id};
  tfFiltro={q:'',seccao:'',estado:''};
  openModal(tfTitulo(),tfCorpo(),tfRodape(),tfMenu());
}
/* O título da janela: «Tarefas · <nome do registo>».
   Devolve: o texto do título. */
function tfTitulo(){
  const r=tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id);
  const nome=r?(tfAlvo.tipo==='contrato'?ctName(r):r.name):'';
  return 'Tarefas'+(nome?' · '+nome:'');
}
/* O rodapé da janela: fechar e, para quem pode, adicionar uma tarefa. O
   botão diz «Nova tarefa» (o título do formulário que abre): «Adicionar
   tarefa» com o ícone não cabe em meio rodapé de um telemóvel e partia-se
   em duas linhas, com o ícone sozinho à esquerda.
   Devolve: o HTML do rodapé. */
function tfRodape(){
  const ok=tfAlvo&&tfPodeAlterar(tfAlvo.tipo,tfAlvo.id);
  return `<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>`
    +(ok?`<button type="button" class="btn primary" data-toca="camada" data-click="tfNovaTarefa('')">${ic('plus',16)} Nova tarefa</button>`:'');
}
/* O ⋯ do cabeçalho da janela: adicionar uma secção (só para quem pode).
   Devolve: o HTML do menu, ou '' sem nada a oferecer. */
function tfMenu(){
  if(!tfAlvo||!tfPodeAlterar(tfAlvo.tipo,tfAlvo.id))return '';
  return menu('tfJanela',[{label:'Adicionar secção',icon:'plus',toca:'camada',act:'tfNovaSeccao()'}]);
}
/* As opções do filtro das secções: todas, cada uma pelo nome e, quando há
   tarefas soltas e secções, «Sem secção».
   Recebe: t — as tarefas ({seccoes, itens}).
   Devolve: a lista de opções do sel() ([{v,label}]). */
function tfOpcoesDeSeccao(t){
  const o=[{v:'',label:'Todas as secções'}].concat(t.seccoes.map(s=>({v:s.id,label:s.nome||'Sem nome'})));
  if(t.seccoes.length&&t.itens.some(x=>!x.seccao))o.push({v:'__sem__',label:'Sem secção'});
  return o;
}
/* O corpo da janela: a pesquisa, os dois filtros e a lista (tfLista), que se
   repinta sozinha a cada letra para o campo da pesquisa não perder o foco.
   Devolve: o HTML do corpo. */
function tfCorpo(){
  const r=tfRegisto(tfAlvo.tipo,tfAlvo.id),t=tarefasDe(r);
  const filtros=t.itens.length?`<div class="qwrap"><input id="tf_q" class="txq" type="search" value="${esc(tfFiltro.q)}" placeholder="Pesquisar…" autocomplete="off"
      aria-label="Pesquisar por tarefa ou secção" data-input="tfPesquisar(this.value)">
      <button type="button" class="qclear${tfFiltro.q?'':' u-d-none'}" data-toca="vista" data-click="tfLimparPesquisa()" aria-label="Limpar a pesquisa">${ic('x',14)}</button></div>
    <div class="row"><label>Secção${sel('tf_fsec',tfFiltro.seccao,tfOpcoesDeSeccao(t),'tfFiltrar','vista')}</label>
      <label>Estado${sel('tf_fest',tfFiltro.estado,[{v:'',label:'Todas'},{v:'por',label:'Por cumprir'},{v:'feitas',label:'Cumpridas'}],'tfFiltrar','vista')}</label></div>`:'';
  return `<div class="form">${filtros}<div id="tf_lista">${tfLista()}</div></div>`;
}
/* Esta tarefa passa a pesquisa e os filtros? A pesquisa procura no nome da
   tarefa e no nome da secção dela, sem distinguir acentos nem maiúsculas.
   Recebe: x — a tarefa; sec — a secção dela (ou null).
   Devolve: true se fica na lista. */
function tfPassa(x,sec){
  const f=tfFiltro;
  if(f.estado==='por'&&x.feita)return false;
  if(f.estado==='feitas'&&!x.feita)return false;
  if(f.seccao==='__sem__'&&x.seccao)return false;
  if(f.seccao&&f.seccao!=='__sem__'&&x.seccao!==f.seccao)return false;
  const q=deacc(f.q).trim();
  return !q||deacc(x.nome).indexOf(q)>-1||(!!sec&&deacc(sec.nome).indexOf(q)>-1);
}
/* A lista, secção a secção, com o que passa a pesquisa e os filtros. As
   tarefas sem secção vêm primeiro; uma secção vazia só aparece sem filtros
   (é onde se lhe adiciona a primeira tarefa).
   Devolve: o HTML da lista (com o resumo por cima). */
function tfLista(){
  const r=tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id);if(!r)return '';
  const t=tarefasDe(r),ok=tfPodeAlterar(tfAlvo.tipo,tfAlvo.id);
  if(!t.itens.length&&!t.seccoes.length)return `<div class="hint">${ok?'Ainda não há tarefas. Adiciona a primeira; ao adicioná-la, escolhes a secção ou crias uma nova.':'Ainda não há tarefas.'}</div>`;
  const filtrado=!!(tfFiltro.q.trim()||tfFiltro.seccao||tfFiltro.estado);
  const grupos=[{s:null,itens:t.itens.filter(x=>!x.seccao)}].concat(t.seccoes.map(s=>({s:s,itens:t.itens.filter(x=>x.seccao===s.id)})));
  let mostradas=0;
  const html=grupos.map(g=>{
    const vis=g.itens.filter(x=>tfPassa(x,g.s));mostradas+=vis.length;
    if(!g.s&&!vis.length)return ok&&t.seccoes.length?tfSoltasAlvoHtml():'';
    if(g.s&&!vis.length&&filtrado)return '';
    return tfSeccaoHtml(g.s,g.itens,vis,ok,!!t.seccoes.length);
  }).join('');
  const resumo=`<div class="hint">${esc(tfResumo(t))}</div>`;
  if(!mostradas&&filtrado)return resumo+`<div class="hint">Nenhuma tarefa corresponde à pesquisa e aos filtros.</div>`;
  return resumo+html;
}
/* Uma secção da lista: o cabeçalho e as tarefas visíveis. O cabeçalho é um
   botão que recolhe e abre a secção (tfDobrar) — a seta, o nome e quantas
   estão cumpridas — e, ao lado, o ⋯ dela. Recolhida, as tarefas continuam
   no HTML e é a folha que as esconde (estilos.css:.tf-recolhida): a
   pesquisa e o arrasto contam com elas.
   Recebe: s — a secção (null para as tarefas sem secção); todas — as tarefas
   dela; vis — as que passam os filtros; ok — se quem vê pode alterar;
   comSeccoes — se a lista tem secções (sem nenhuma, as soltas não levam cabeçalho).
   Devolve: o HTML da secção. */
function tfSeccaoHtml(s,todas,vis,ok,comSeccoes){
  const sid=s?s.id:'',feitas=todas.filter(x=>x.feita).length;
  const m=s&&ok?menu('tfs_'+s.id,[
    {label:'Adicionar tarefa',icon:'plus',toca:'camada',act:`tfNovaTarefa('${jsq(s.id)}')`},
    {label:'Mudar o nome',icon:'pen',toca:'camada',act:`tfMudarNomeSeccao('${jsq(s.id)}')`},
    {label:'Remover secção',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`tfRemoverSeccao('${jsq(s.id)}')`}]):'';
  const comCab=!!(s||comSeccoes),fechada=comCab&&tfRecolhida(sid),idItens='tfi_'+(sid||'_sem');
  const conta=todas.length?feitas+' de '+todas.length+'<span class="imv-so-leitor"> cumpridas</span>':'';
  // sem ⋯ (as soltas, a quem pode), um espaço do mesmo tamanho alinha a conta com as das secções
  const fim=m||(ok?'<span class="tf-sem-menu" aria-hidden="true"></span>':'');
  const cab=comCab?`<div class="tf-cab" data-sec="${esc(sid)}"><button type="button" class="tf-dobra" aria-expanded="${!fechada}" aria-controls="${idItens}" data-toca="nada" data-click="tfDobrar('${jsq(sid)}')"><span class="tf-chev" aria-hidden="true">${ic('chevD',16)}</span><b>${esc(s?(s.nome||'Sem nome'):'Sem secção')}</b><span class="tf-conta">${conta}</span></button>${fim}</div>`:'';
  const itens=vis.map(x=>tfItemHtml(x,ok)).join('')
    ||(s?`<div class="hint">Sem tarefas nesta secção.</div>`:'');
  return `<div class="tf-seccao${fechada?' tf-recolhida':''}" data-sec="${esc(sid)}">${cab}<div class="tf-itens" id="${idItens}">${itens}</div></div>`;
}
/* O lugar das tarefas sem secção quando nenhuma está à vista: só aparece
   durante um arrasto (estilos.css:.tf-a-arrastar .tf-so-alvo), para se poder
   largar uma tarefa fora das secções. Fora do arrasto não ocupa nada.
   Devolve: o HTML do grupo. */
function tfSoltasAlvoHtml(){
  return `<div class="tf-seccao tf-so-alvo" data-sec=""><div class="tf-cab" data-sec=""><span class="tf-dobra"><b>Sem secção</b></span></div>`
    +`<div class="tf-itens"><div class="hint">Larga aqui para a tarefa ficar sem secção.</div></div></div>`;
}
/* Uma tarefa: a pega de arrastar (só a quem pode alterar), a caixa de
   marcar, que grava logo, e o nome, que abre o formulário dela a quem pode
   alterar. A pega arrasta ao dedo e ao rato (tfArrastar) e, tocada sem
   arrastar ou ao teclado, abre o «Mover tarefa» (tfPegaClique).
   Recebe: x — a tarefa; ok — se quem vê pode alterar.
   Devolve: o HTML da linha. */
function tfItemHtml(x,ok){
  const nome=esc(x.nome||'Sem nome');
  const quando=x.feita&&x.feitaEm?`<small class="tf-quando">cumprida a ${dPT(x.feitaEm)}</small>`:'';
  const pega=ok?`<button type="button" class="tf-pega" aria-label="Mover: ${nome}" data-toca="camada" data-pointerdown="tfArrastar(event,this)" data-click="tfPegaClique('${jsq(x.id)}')">${ic('grip',16)}</button>`:'';
  return `<div class="tf-item${x.feita?' tf-feita':''}" data-id="${esc(x.id)}">${pega}
    <label class="tf-marca"><input type="checkbox" id="tfc_${esc(x.id)}" ${x.feita?'checked':''} ${ok?'':'disabled'} aria-label="${x.feita?'Cumprida':'Por cumprir'}: ${nome}" data-toca="dados" data-change="tfMarcar('${jsq(x.id)}',this.checked)"></label>
    ${ok?`<button type="button" class="tf-nome" data-toca="camada" data-click="tfEditarTarefa('${jsq(x.id)}')"><span>${nome}</span>${quando}</button>`
      :`<span class="tf-nome"><span>${nome}</span>${quando}</span>`}</div>`;
}
/* Repinta a lista da janela aberta, sem tocar no campo da pesquisa nem nos
   filtros. E como cada toque já ficou gravado, a janela volta a contar como
   «sem alterações»: sem isto, fechar no X depois de pesquisar ou de marcar
   uma tarefa perguntava «Sair sem guardar?».
   Devolve: nada. */
function tfPintar(){
  const L=modalTop(),el=document.getElementById('tf_lista');
  if(!tfAlvo||!el)return;
  el.innerHTML=tfLista();
  if(typeof tornarFocavel==='function')tornarFocavel(el);
  if(L){L.snap=modalSnap(L.el);L.tocado=false}
}
/* Repinta a janela inteira (o corpo, o rodapé e o ⋯): depois de uma escrita
   que muda as secções, os filtros têm opções novas.
   Devolve: nada. */
function tfPintarTudo(){
  const L=modalTop();
  if(!tfAlvo||!L||!document.getElementById('tf_lista'))return;
  if(!tfRegisto(tfAlvo.tipo,tfAlvo.id))return closeModal();
  setModal(tfTitulo(),tfCorpo(),tfRodape(),tfMenu());
}
/* A pesquisa, a cada letra.
   Recebe: v — o texto escrito.
   Devolve: nada — repinta a lista. */
function tfPesquisar(v){
  tfFiltro.q=String(v||'');
  const b=document.querySelector('#tf_q+.qclear');if(b)b.classList.toggle('u-d-none',!tfFiltro.q);
  tfPintar();
}
/* O ✕ da pesquisa: limpa-a e devolve o foco ao campo.
   Devolve: nada. */
function tfLimparPesquisa(){
  const e=document.getElementById('tf_q');if(e){e.value='';try{e.focus()}catch(x){}}
  tfPesquisar('');
}
/* Os dois filtros (secção e estado), lidos dos sel() da janela.
   Devolve: nada — repinta a lista. */
function tfFiltrar(){
  tfFiltro.seccao=val('tf_fsec');tfFiltro.estado=val('tf_fest');
  tfPintar();
}
/* O caminho de todas as escritas: reverifica a permissão no momento de
   gravar, aplica a mudança a uma cópia da lista, normaliza-a, guarda e
   repinta a app e a janela.
   Recebe: mudar — função que recebe a cópia ({seccoes, itens}) e a altera;
   tudo (opcional) — true repinta a janela inteira (as secções mudaram).
   Devolve: true se gravou; false se foi recusado. */
function tfGravar(mudar,tudo){
  if(!tfAlvo)return false;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa){toast(recusa);tfPintar();return false}
  const r=tfRegisto(tfAlvo.tipo,tfAlvo.id),t=tarefasDe(r);
  mudar(t);
  r.tarefas=normTarefas(t);
  save();render();
  if(tudo)tfPintarTudo();else tfPintar();
  return true;
}
/* Marca ou desmarca uma tarefa como cumprida, com o dia de hoje.
   Recebe: tid — o id da tarefa; on — true para cumprida.
   Devolve: nada. */
function tfMarcar(tid,on){
  tfGravar(t=>{const x=t.itens.find(i=>i.id===tid);if(x){x.feita=!!on;x.feitaEm=on?today():''}});
}
/* O formulário de uma tarefa nova, já na secção de onde se pediu.
   Recebe: sid — o id da secção ('' para nenhuma).
   Devolve: nada — abre o formulário. */
function tfNovaTarefa(sid){tfFormTarefa(null,sid)}
/* O formulário de uma tarefa que já existe.
   Recebe: tid — o id da tarefa.
   Devolve: nada — abre o formulário. */
function tfEditarTarefa(tid){
  const t=tarefasDe(tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id)),x=t.itens.find(i=>i.id===tid);
  if(x)tfFormTarefa(x,x.seccao);
}
/* O formulário de uma tarefa: o nome (obrigatório), a secção e, numa que já
   existe, se está cumprida. O ⋯ tem o «Remover tarefa». O seletor da secção
   está sempre lá, mesmo sem secções: «Sem secção», as secções, e no fim o
   «+ Criar secção…» (tfSecMudou).
   Recebe: x — a tarefa (null numa nova); sid — a secção escolhida à partida.
   Devolve: nada — abre a janela por cima da lista. */
function tfFormTarefa(x,sid){
  if(!tfAlvo)return;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa)return toast(recusa);
  const t=tarefasDe(tfRegisto(tfAlvo.tipo,tfAlvo.id));
  tfEmEdicao=x?x.id:'';
  tfSecNovas=[];
  tfSecAntes=t.seccoes.some(s=>s.id===sid)?sid:'';
  const m=x?menu('tfTarefa',[{label:'Remover tarefa',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`tfRemoverTarefa('${jsq(x.id)}')`}]):'';
  openModal(x?'Editar tarefa':'Nova tarefa',`<div class="form">
    <label>Tarefa <span class="req">*</span><input id="tf_nome" value="${esc(x?x.nome:'')}" placeholder="Ex: Trocar o esquentador" autocomplete="off" data-keydown="tfTeclaNome(event)"></label>
    <label>Secção${tfSelSeccao(t,tfSecAntes)}</label>
    ${x?`<label class="check"><input type="checkbox" id="tf_feita" ${x.feita?'checked':''}> Cumprida</label>`:''}
  </div>`,null,m);
  onSave=tfGuardarTarefa;
  if(!x)setTimeout(()=>{const e=document.getElementById('tf_nome');if(e)try{e.focus()}catch(z){}},50);
}
/* As opções do seletor da secção no formulário: «Sem secção», as secções
   (as gravadas e as criadas neste formulário) e, no fim, «+ Criar secção…».
   Recebe: t — as tarefas ({seccoes, itens}).
   Devolve: a lista de opções do sel() ([{v,label}]). */
function tfOpcoesDoFormulario(t){
  return [{v:'',label:'Sem secção'}]
    .concat(t.seccoes.concat(tfSecNovas).map(s=>({v:s.id,label:s.nome||'Sem nome'})))
    .concat([{v:'__new__',label:'+ Criar secção…'}]);
}
/* O seletor da secção do formulário.
   Recebe: t — as tarefas; v — o id da secção escolhida ('' para nenhuma).
   Devolve: o HTML do sel(). */
function tfSelSeccao(t,v){return sel('tf_sec',v,tfOpcoesDoFormulario(t),'tfSecMudou','rascunho')}
/* Volta a desenhar o seletor da secção no formulário aberto, com uma
   escolha, sem tocar no nome que já se escreveu.
   Recebe: v — o id da secção a deixar escolhida.
   Devolve: nada. */
function tfRepintarSelSeccao(v){
  const t=tarefasDe(tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id));
  const w=document.getElementById('sel_tf_sec');if(w)w.outerHTML=tfSelSeccao(t,v);
  const i=document.getElementById('tf_sec');if(i)i.value=v;
}
/* Mudou a secção no formulário. O «+ Criar secção…» pede o nome (como a
   categoria de um movimento, movimento.js:onCatChange) e deixa a secção nova
   escolhida; um nome que já existe escolhe essa. A secção nova fica no
   formulário e grava-se com a tarefa (tfGuardarTarefa): cancelar a tarefa
   não deixa uma secção vazia para trás, e o que se escreveu não se perde.
   Devolve: nada — muda o seletor ou abre o nome. */
function tfSecMudou(){
  const v=val('tf_sec');
  if(v!=='__new__'){tfSecAntes=v;return}
  tfRepintarSelSeccao(tfSecAntes);   // um Cancelar no nome não deixa «+ Criar secção…» escolhido
  promptModal('Nova secção','Nome da secção','',nm=>{
    const t=tarefasDe(tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id));
    const ja=t.seccoes.concat(tfSecNovas).find(s=>deacc(s.nome).trim()===deacc(nm).trim());
    const s=ja||{id:uid(),nome:nm};
    if(!ja)tfSecNovas.push(s);
    tfSecAntes=s.id;tfRepintarSelSeccao(s.id);
    const L=modalTop();if(L)L.tocado=true;   // há trabalho por guardar: o X pergunta antes de o deitar fora
    const b=document.getElementById('selb_tf_sec');if(b)try{b.focus()}catch(e){}
    if(ja)toast('A secção «'+(ja.nome||'Sem nome')+'» já existe: fica escolhida.');
  },'Obras');
}
/* Enter no nome da tarefa guarda, como no promptModal.
   Recebe: ev — o evento do teclado.
   Devolve: nada. */
function tfTeclaNome(ev){if(ev.key==='Enter'){ev.preventDefault();tfGuardarTarefa()}}
/* Guarda o formulário da tarefa (nova ou editada) e volta à lista, com as
   secções que o formulário criou. Uma tarefa nova fica no fim da secção; uma
   que muda de secção passa para o fim da nova.
   Devolve: nada. */
function tfGuardarTarefa(){
  const nome=val('tf_nome').trim();
  if(!nome)return falhaCampo('tf_nome','Escreve a tarefa.');
  let sec=document.getElementById('tf_sec')?val('tf_sec'):'';
  if(sec==='__new__')sec='';
  const novas=tfSecNovas.slice();tfSecNovas=[];
  const feita=document.getElementById('tf_feita')?chk('tf_feita'):null,id=tfEmEdicao;
  closeModal();
  const ok=tfGravar(t=>{
    novas.forEach(s=>{if(!t.seccoes.some(y=>y.id===s.id))t.seccoes.push({id:s.id,nome:s.nome})});
    const x=id?t.itens.find(i=>i.id===id):null;
    if(!x){t.itens.push({id:uid(),nome:nome,seccao:sec,feita:false,feitaEm:''});return}
    x.nome=nome;
    if(feita!==null&&feita!==x.feita){x.feita=feita;x.feitaEm=feita?today():''}
    if(x.seccao!==sec)tfAplicar(t,tfMoverEm(t,x.id,sec,tfUltimaDe(t,sec,x.id)));
  },true);
  if(ok)toast(id?'Tarefa atualizada.':'Tarefa adicionada.');
}
/* Remove uma tarefa, com Anular durante seis segundos.
   Recebe: tid — o id da tarefa.
   Devolve: nada. */
function tfRemoverTarefa(tid){
  const alvo=tfAlvo;
  const antes=tarefasDe(alvo&&tfRegisto(alvo.tipo,alvo.id));
  if(!antes.itens.some(i=>i.id===tid))return;
  if(document.getElementById('tf_nome'))closeModal();   // removida a partir do formulário dela
  if(!tfGravar(t=>{t.itens=t.itens.filter(i=>i.id!==tid)},true))return;
  comDesfazer('Tarefa removida.',()=>tfRepor(alvo,antes));
}
/* O nome de uma secção nova, e a secção no fim da lista.
   Devolve: nada — abre a janela do nome. */
function tfNovaSeccao(){
  if(!tfAlvo)return;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa)return toast(recusa);
  promptModal('Nova secção','Nome da secção','',v=>{
    if(tfGravar(t=>{t.seccoes.push({id:uid(),nome:v})},true))toast('Secção adicionada.');
  },'Obras');
}
/* Muda o nome de uma secção.
   Recebe: sid — o id da secção.
   Devolve: nada — abre a janela do nome. */
function tfMudarNomeSeccao(sid){
  const s=tarefasDe(tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id)).seccoes.find(x=>x.id===sid);if(!s)return;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa)return toast(recusa);
  promptModal('Mudar o nome da secção','Nome da secção',s.nome,v=>{
    if(tfGravar(t=>{const y=t.seccoes.find(x=>x.id===sid);if(y)y.nome=v},true))toast('Secção atualizada.');
  },'Obras');
}
/* Remove uma secção e as tarefas dela, com Anular durante seis segundos.
   Recebe: sid — o id da secção.
   Devolve: nada. */
function tfRemoverSeccao(sid){
  const alvo=tfAlvo;
  const antes=tarefasDe(alvo&&tfRegisto(alvo.tipo,alvo.id));
  if(!antes.seccoes.some(x=>x.id===sid))return;
  const n=antes.itens.filter(i=>i.seccao===sid).length;
  if(tfFiltro.seccao===sid)tfFiltro.seccao='';
  if(!tfGravar(t=>{t.seccoes=t.seccoes.filter(x=>x.id!==sid);t.itens=t.itens.filter(i=>i.seccao!==sid)},true))return;
  comDesfazer(n?'Secção removida, com '+n+(n===1?' tarefa.':' tarefas.'):'Secção removida.',()=>tfRepor(alvo,antes));
}
/* O Anular de uma remoção: repõe a lista como estava e, se a janela dela
   ainda está aberta, repinta-a (o comDesfazer grava e repinta a app).
   Recebe: alvo — o {tipo,id} da lista; antes — as tarefas antes da remoção.
   Devolve: nada. */
function tfRepor(alvo,antes){
  const r=alvo&&tfRegisto(alvo.tipo,alvo.id);if(!r)return;
  r.tarefas=normTarefas(antes);
  if(tfAlvo&&tfAlvo.tipo===alvo.tipo&&tfAlvo.id===alvo.id)tfPintarTudo();
}

/* ---- as secções recolhidas ---- */

/* O mapa das secções recolhidas (LS_TF_RECOLHIDAS), lido do aparelho na
   primeira vez e daí em diante da memória.
   Devolve: o objeto {'tipo:id':[sid…]} (vazio sem nada guardado ou com lixo). */
function tfLerRecolhidas(){
  if(_tfRec)return _tfRec;
  try{const o=JSON.parse(localStorage.getItem(LS_TF_RECOLHIDAS)||'{}');_tfRec=o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch(e){_tfRec={}}
  return _tfRec;
}
/* As secções recolhidas de um registo, só as que são texto.
   Recebe: alvo — o {tipo,id} do registo.
   Devolve: a lista dos ids ('__sem__' para as tarefas sem secção). */
function tfRecolhidasDe(alvo){
  const l=alvo&&tfLerRecolhidas()[alvo.tipo+':'+alvo.id];
  return Array.isArray(l)?l.filter(x=>typeof x==='string'):[];
}
/* Esta secção da janela aberta está recolhida?
   Recebe: sid — o id da secção ('' para as tarefas sem secção).
   Devolve: true se está recolhida. */
function tfRecolhida(sid){return tfRecolhidasDe(tfAlvo).indexOf(sid||'__sem__')>-1}
/* Recolhe ou abre uma secção da janela, pelo botão do cabeçalho dela. Guarda
   no aparelho (só os ids que ainda existem) e muda a secção no ecrã sem
   repintar a lista — o foco fica no botão.
   Recebe: sid — o id da secção ('' para as tarefas sem secção).
   Devolve: nada. */
function tfDobrar(sid){
  const r=tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id);if(!r)return;
  const o=tfLerRecolhidas(),k=tfAlvo.tipo+':'+tfAlvo.id,c=sid||'__sem__';
  const vivas=['__sem__'].concat(tarefasDe(r).seccoes.map(s=>s.id));
  let l=tfRecolhidasDe(tfAlvo).filter(x=>vivas.indexOf(x)>-1);
  const fechar=l.indexOf(c)<0;
  l=fechar?l.concat([c]):l.filter(x=>x!==c);
  if(l.length)o[k]=l;else delete o[k];
  try{localStorage.setItem(LS_TF_RECOLHIDAS,JSON.stringify(o))}catch(e){}
  const lista=document.getElementById('tf_lista');
  const sec=lista&&[].slice.call(lista.querySelectorAll('.tf-seccao')).find(x=>x.getAttribute('data-sec')===(sid||''));
  if(!sec)return;
  sec.classList.toggle('tf-recolhida',fechar);
  const b=sec.querySelector('.tf-dobra');if(b)b.setAttribute('aria-expanded',String(!fechar));
}

/* ---- mover: a regra, e o «Mover tarefa» do teclado ---- */

/* Move uma tarefa para uma secção e uma posição. A ordem é a do array itens:
   a tarefa sai de onde está e entra logo a seguir à tarefa `depois` (da
   secção de destino), ou antes da primeira da secção com `depois` vazio — o
   1.º lugar. Um `depois` que já não está nessa secção põe-na no fim dela.
   Não mexe na lista que recebe.
   Recebe: t — as tarefas ({seccoes, itens}); tid — o id da tarefa; sid — o
   id da secção de destino ('' para nenhuma; uma que não existe vale ''); depois
   — o id da tarefa que fica antes dela, ou '' para o 1.º lugar.
   Devolve: as tarefas novas ({seccoes, itens}), com cópias das tarefas. */
function tfMoverEm(t,tid,sid,depois){
  const seccoes=t.seccoes.map(s=>Object.assign({},s)),itens=t.itens.map(x=>Object.assign({},x));
  const i=itens.findIndex(x=>x.id===tid);
  if(i<0||(depois&&depois===tid))return {seccoes:seccoes,itens:itens};
  sid=sid&&seccoes.some(s=>s.id===sid)?sid:'';
  const x=itens.splice(i,1)[0];x.seccao=sid;
  let j;
  if(!depois){j=itens.findIndex(y=>y.seccao===sid);if(j<0)j=itens.length}
  else{
    j=itens.findIndex(y=>y.id===depois&&y.seccao===sid)+1;
    if(!j){j=itens.length;for(let k=itens.length-1;k>=0;k--)if(itens[k].seccao===sid){j=k+1;break}}
  }
  itens.splice(j,0,x);
  return {seccoes:seccoes,itens:itens};
}
/* Troca o conteúdo da cópia de trabalho do tfGravar pelo de outra lista.
   Recebe: t — a cópia ({seccoes, itens}); n — a lista nova.
   Devolve: nada — muda t. */
function tfAplicar(t,n){t.seccoes=n.seccoes;t.itens=n.itens}
/* A mesma ordem e as mesmas secções em duas listas?
   Recebe: a, b — as tarefas ({itens}).
   Devolve: true se nada mudou. */
function tfMesmaOrdem(a,b){
  return a.itens.map(x=>x.id+'|'+x.seccao).join(',')===b.itens.map(x=>x.id+'|'+x.seccao).join(',');
}
/* A tarefa que vem antes desta na secção dela.
   Recebe: t — as tarefas; tid — o id da tarefa.
   Devolve: o id da anterior, ou '' se é a primeira (ou não existe). */
function tfAntesDe(t,tid){
  const x=t.itens.find(i=>i.id===tid);if(!x)return '';
  const da=t.itens.filter(i=>i.seccao===x.seccao),k=da.indexOf(x);
  return k>0?da[k-1].id:'';
}
/* A última tarefa de uma secção, sem contar com uma.
   Recebe: t — as tarefas; sid — o id da secção ('' para nenhuma); excepto —
   o id da tarefa a não contar.
   Devolve: o id da última, ou '' com a secção vazia. */
function tfUltimaDe(t,sid,excepto){
  const da=t.itens.filter(i=>i.seccao===sid&&i.id!==excepto);
  return da.length?da[da.length-1].id:'';
}
/* As posições onde a tarefa pode ficar numa secção: em primeiro lugar, ou
   depois de cada uma das outras.
   Recebe: t — as tarefas; tid — o id da tarefa a mover; sid — a secção.
   Devolve: a lista de opções do sel() ([{v,label}]), com v = o «depois». */
function tfOpcoesDePosicao(t,tid,sid){
  return [{v:'',label:'Em primeiro lugar'}].concat(t.itens.filter(i=>i.seccao===sid&&i.id!==tid)
    .map(i=>({v:i.id,label:'Depois de «'+(i.nome||'Sem nome')+'»'})));
}
/* O seletor da posição do «Mover tarefa».
   Recebe: t — as tarefas; tid — a tarefa; sid — a secção; depois — a escolhida.
   Devolve: o HTML do sel(). */
function tfSelPosicao(t,tid,sid,depois){return sel('tf_mpos',depois,tfOpcoesDePosicao(t,tid,sid),'','rascunho')}
/* O toque (ou o Enter) na pega. Logo a seguir a um arrasto é o clique que o
   browser dispara depois do pointerup, e engole-se; senão abre o «Mover
   tarefa», que é o caminho do teclado e de quem não arrasta.
   Recebe: tid — o id da tarefa.
   Devolve: nada. */
function tfPegaClique(tid){
  if(tfArr||Date.now()-tfArrFim<700)return;
  tfMoverTarefa(tid);
}
/* A janela «Mover tarefa»: a secção e a posição, por escolha, em vez de
   arrastar. Abre com a secção e o lugar de agora.
   Recebe: tid — o id da tarefa.
   Devolve: nada — abre a janela por cima da lista. */
function tfMoverTarefa(tid){
  if(!tfAlvo)return;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa)return toast(recusa);
  const t=tarefasDe(tfRegisto(tfAlvo.tipo,tfAlvo.id)),x=t.itens.find(i=>i.id===tid);if(!x)return;
  tfMovendo=tid;
  const secs=[{v:'',label:'Sem secção'}].concat(t.seccoes.map(s=>({v:s.id,label:s.nome||'Sem nome'})));
  openModal('Mover tarefa',`<div class="form">
    <div class="hint">${esc(x.nome||'Sem nome')}</div>
    <label>Secção${sel('tf_msec',x.seccao,secs,'tfMoverSecMudou','rascunho')}</label>
    <label>Posição${tfSelPosicao(t,tid,x.seccao,tfAntesDe(t,tid))}</label>
  </div>`);
  onSave=tfGuardarMover;
}
/* Mudou a secção no «Mover tarefa»: as posições passam a ser as dessa
   secção, com o fim escolhido (ou o lugar de agora, de volta à secção dela).
   Devolve: nada. */
function tfMoverSecMudou(){
  const t=tarefasDe(tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id)),x=t.itens.find(i=>i.id===tfMovendo);if(!x)return;
  const sid=val('tf_msec'),d=sid===x.seccao?tfAntesDe(t,x.id):tfUltimaDe(t,sid,x.id);
  const w=document.getElementById('sel_tf_mpos');if(w)w.outerHTML=tfSelPosicao(t,x.id,sid,d);
  const i=document.getElementById('tf_mpos');if(i)i.value=d;
}
/* Guarda o «Mover tarefa» e volta à lista, com o foco na pega da tarefa
   movida: ao teclado, continua-se de onde ela ficou.
   Devolve: nada. */
function tfGuardarMover(){
  const tid=tfMovendo,sid=val('tf_msec'),depois=val('tf_mpos');
  closeModal();
  if(!tfGravar(t=>tfAplicar(t,tfMoverEm(t,tid,sid,depois))))return;
  toast('Tarefa movida.');
  const lista=document.getElementById('tf_lista');
  const linha=lista&&[].slice.call(lista.querySelectorAll('.tf-item')).find(x=>x.getAttribute('data-id')===tid);
  const pega=linha&&linha.querySelector('.tf-pega');if(pega)try{pega.focus()}catch(e){}
}

/* ---- arrastar ----
   A pega (tfItemHtml) é a única coisa com touch-action:none: arrastar no
   resto da linha continua a rolar a lista. O dedo pousa, e a partir de 5px
   na vertical a linha levanta-se e segue-o, logo acima dele (tfArrastoPintar). Por cima do
   cabeçalho de uma secção — ou de uma secção recolhida, ou vazia — a secção
   inteira acende (.tf-alvo) e largar põe a tarefa em 1.º lugar; entre duas
   tarefas aparece a linha (.tf-linha) e largar põe-na aí. Perto das bordas a
   lista rola sozinha. O Esc e o pointercancel desfazem. */

/* Pousou o dedo (ou o rato) na pega: fica à escuta do resto do gesto.
   Recebe: e — o PointerEvent do pointerdown; h — a pega.
   Devolve: nada — liga os ouvintes do documento. */
function tfArrastar(e,h){
  if(tfArr||(e.button!=null&&e.button>0)||e.isPrimary===false)return;
  const row=h.closest('.tf-item'),lista=document.getElementById('tf_lista');
  if(!row||!lista||!tfAlvo||!tfPodeAlterar(tfAlvo.tipo,tfAlvo.id))return;
  e.preventDefault();
  tfArr={tid:row.getAttribute('data-id'),h:h,row:row,lista:lista,rol:tfRolante(lista),y0:e.clientY,y:e.clientY,
    topo0:0,desloc:0,ativo:false,cancelado:false,alvo:null,chave:'',vel:0,raf:0};
  try{h.setPointerCapture(e.pointerId)}catch(x){}
  document.addEventListener('pointermove',tfArrastoMove);
  document.addEventListener('pointerup',tfArrastoFim);
  document.addEventListener('pointercancel',tfArrastoCancelar);
  window.addEventListener('keydown',tfArrastoTecla,true);
}
/* Quem rola a lista: o primeiro antepassado com scroll vertical (na janela, o
   .body dela).
   Recebe: el — o elemento de onde se parte.
   Devolve: o elemento que rola. */
function tfRolante(el){
  for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){
    const o=getComputedStyle(p).overflowY;
    if((o==='auto'||o==='scroll')&&p.scrollHeight>p.clientHeight)return p;
  }
  return el.closest('.body')||document.scrollingElement;
}
/* O dedo andou: passado o limiar, levanta a linha; depois leva-a com ele e
   procura onde vai cair.
   Recebe: e — o PointerEvent do pointermove.
   Devolve: nada. */
function tfArrastoMove(e){
  const a=tfArr;if(!a||a.cancelado)return;
  if(!a.row.isConnected)return tfArrastoCancelar();
  a.y=e.clientY;
  if(!a.ativo){if(Math.abs(a.y-a.y0)<5)return;tfArrastoComecar()}
  tfArrastoRolagem();
  tfArrastoPintar();
}
/* Levanta a linha: mostra o lugar das tarefas sem secção (se o há) e rola o
   que ele empurrou, para nada saltar debaixo do dedo.
   Devolve: nada. */
function tfArrastoComecar(){
  const a=tfArr;a.ativo=true;
  const r0=a.row.getBoundingClientRect();a.topo0=r0.top;a.alt=r0.height;
  a.row.classList.add('tf-agarrada');
  a.lista.classList.add('tf-a-arrastar');
  const agora=a.row.getBoundingClientRect().top;
  if(a.rol&&agora!==a.topo0)a.rol.scrollTop+=agora-a.topo0;
}
/* Leva a tarefa agarrada com o dedo, a flutuar logo ACIMA dele (contando com
   o que a lista rolou): o dedo aponta o sítio, e o que lá está — a linha, o
   nome da secção acesa — fica à vista, em vez de tapado pela tarefa. Pinta o
   alvo de agora.
   Devolve: nada. */
function tfArrastoPintar(){
  const a=tfArr;if(!a||!a.ativo)return;
  const natural=a.row.getBoundingClientRect().top-a.desloc;
  a.desloc=Math.round(a.y-a.alt-10-natural);
  a.row.style.transform='translateY('+a.desloc+'px)';
  tfArrastoMarcar(tfArrastoAlvo(a.y));
}
/* Onde vai cair a tarefa com o dedo à altura y: a secção mais perto; por
   cima do cabeçalho dela, recolhida ou sem outras tarefas, é o 1.º lugar
   (cab); senão, o intervalo entre as linhas pelo meio de cada uma.
   Recebe: y — a altura do dedo (clientY).
   Devolve: {sid, depois, cab, sec, antes} — antes é a linha que fica a seguir
   à linha indicativa (null no fim) —, ou null sem secções à vista. */
function tfArrastoAlvo(y){
  const a=tfArr;
  const secs=[].slice.call(a.lista.querySelectorAll('.tf-seccao')).filter(s=>s.getClientRects().length);
  let s=null,dist=Infinity;
  secs.forEach(x=>{const r=x.getBoundingClientRect(),d=y<r.top?r.top-y:y>r.bottom?y-r.bottom:0;if(d<dist){dist=d;s=x}});
  if(!s)return null;
  const sid=s.getAttribute('data-sec')||'',cab=s.querySelector('.tf-cab'),rc=cab&&cab.getBoundingClientRect();
  const linhas=[].slice.call(s.querySelectorAll('.tf-item')).filter(x=>x!==a.row);
  if((rc&&y>=rc.top&&y<=rc.bottom)||s.classList.contains('tf-recolhida')||!linhas.length)return {sid:sid,depois:'',cab:true,sec:s,antes:null};
  let antes=null,depois='';
  for(const x of linhas){const r=x.getBoundingClientRect();if(y<r.top+r.height/2){antes=x;break}depois=x.getAttribute('data-id')||''}
  return {sid:sid,depois:depois,cab:false,sec:s,antes:antes};
}
/* Pinta o alvo: a secção acesa, ou a linha entre as duas tarefas. Só mexe no
   DOM quando o alvo muda.
   Recebe: alvo — o de tfArrastoAlvo, ou null para limpar.
   Devolve: nada. */
function tfArrastoMarcar(alvo){
  const a=tfArr;if(!a)return;
  const chave=alvo?(alvo.cab?'c':'l')+'|'+alvo.sid+'|'+alvo.depois:'';
  a.alvo=alvo;if(chave===a.chave)return;a.chave=chave;
  [].slice.call(a.lista.querySelectorAll('.tf-alvo')).forEach(x=>x.classList.remove('tf-alvo'));
  const velha=a.lista.querySelector('.tf-linha');if(velha)velha.remove();
  if(!alvo)return;
  if(alvo.cab){alvo.sec.classList.add('tf-alvo');return}
  const linha=document.createElement('div');linha.className='tf-linha';linha.setAttribute('aria-hidden','true');
  const itens=alvo.sec.querySelector('.tf-itens');if(!itens)return;
  if(alvo.antes)itens.insertBefore(linha,alvo.antes);else itens.appendChild(linha);
}
/* Perto da borda de cima ou de baixo da lista, ela rola sozinha, mais
   depressa quanto mais perto.
   Devolve: nada — arranca ou pára o passo da auto-rolagem. */
function tfArrastoRolagem(){
  const a=tfArr;if(!a||!a.rol)return;
  const r=a.rol.getBoundingClientRect(),cima=Math.max(r.top,0),baixo=Math.min(r.bottom,window.innerHeight),zona=56;
  let v=0;
  if(a.y<cima+zona)v=-Math.ceil(14*(cima+zona-a.y)/zona);
  else if(a.y>baixo-zona)v=Math.ceil(14*(a.y-(baixo-zona))/zona);
  a.vel=Math.max(-18,Math.min(18,v));
  if(a.vel&&!a.raf)a.raf=requestAnimationFrame(tfArrastoPasso);
}
/* Um passo da auto-rolagem: rola, volta a pôr a linha debaixo do dedo, e
   continua enquanto houver para onde rolar.
   Devolve: nada. */
function tfArrastoPasso(){
  const a=tfArr;if(!a)return;a.raf=0;
  if(!a.vel||!a.ativo||!a.rol)return;
  const antes=a.rol.scrollTop;a.rol.scrollTop+=a.vel;
  if(a.rol.scrollTop===antes)return;
  tfArrastoPintar();
  a.raf=requestAnimationFrame(tfArrastoPasso);
}
/* Desfaz o desenho do arrasto: a linha volta ao sítio, o alvo apaga-se e o
   lugar das soltas esconde-se, rolando o que ele tinha empurrado.
   Recebe: a — o estado do arrasto.
   Devolve: nada. */
function tfArrastoDesfazer(a){
  if(a.raf){cancelAnimationFrame(a.raf);a.raf=0}
  a.vel=0;
  if(!a.ativo)return;
  a.ativo=false;
  const antes=a.row.getBoundingClientRect().top-a.desloc;
  a.row.style.transform='';a.row.classList.remove('tf-agarrada');a.desloc=0;
  [].slice.call(a.lista.querySelectorAll('.tf-alvo')).forEach(x=>x.classList.remove('tf-alvo'));
  const linha=a.lista.querySelector('.tf-linha');if(linha)linha.remove();
  a.lista.classList.remove('tf-a-arrastar');
  const agora=a.row.getBoundingClientRect().top;
  if(a.rol&&a.row.isConnected&&agora!==antes)a.rol.scrollTop+=agora-antes;
}
/* Tira os ouvintes e esquece o arrasto.
   Devolve: nada. */
function tfArrastoSoltar(){
  const a=tfArr;tfArr=null;if(!a)return;
  document.removeEventListener('pointermove',tfArrastoMove);
  document.removeEventListener('pointerup',tfArrastoFim);
  document.removeEventListener('pointercancel',tfArrastoCancelar);
  window.removeEventListener('keydown',tfArrastoTecla,true);
}
/* O dedo saiu: sem ter arrastado, é um toque (o clique que se segue abre o
   «Mover tarefa»); arrastado, a tarefa cai no alvo e grava-se. Largada numa
   secção recolhida, onde não se vê, um aviso diz para onde foi.
   Devolve: nada. */
function tfArrastoFim(){
  const a=tfArr;if(!a)return;
  const arrastou=a.ativo||a.cancelado,alvo=a.cancelado?null:a.alvo,ligada=a.row.isConnected;
  const recolhida=!!(alvo&&alvo.sec.classList.contains('tf-recolhida'));
  tfArrastoDesfazer(a);tfArrastoSoltar();
  if(!arrastou)return;
  tfArrFim=Date.now();
  if(!alvo||!ligada||!tfAlvo)return;
  const t=tarefasDe(tfRegisto(tfAlvo.tipo,tfAlvo.id));
  if(tfMesmaOrdem(t,tfMoverEm(t,a.tid,alvo.sid,alvo.depois)))return;
  if(!tfGravar(c=>tfAplicar(c,tfMoverEm(c,a.tid,alvo.sid,alvo.depois))))return;
  if(recolhida){const s=t.seccoes.find(x=>x.id===alvo.sid);toast('Tarefa movida para «'+(s?(s.nome||'Sem nome'):'Sem secção')+'».')}
}
/* O pointercancel (o browser tomou o gesto) desfaz o arrasto, sem mover nada.
   Devolve: nada. */
function tfArrastoCancelar(){
  const a=tfArr;if(!a)return;
  if(a.ativo)tfArrFim=Date.now();
  tfArrastoDesfazer(a);tfArrastoSoltar();
}
/* O Esc a meio de um arrasto desfaz-o e não fecha a janela (é apanhado antes
   do ouvinte do arranque.js). O resto do gesto fica à escuta até o dedo sair,
   para o clique que se segue também se engolir.
   Recebe: e — o KeyboardEvent.
   Devolve: nada. */
function tfArrastoTecla(e){
  const a=tfArr;if(!a||e.key!=='Escape')return;
  e.preventDefault();e.stopPropagation();
  tfArrastoDesfazer(a);a.cancelado=true;
}
