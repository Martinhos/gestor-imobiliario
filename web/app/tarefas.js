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
   pede um «Guardar». */

/* a janela de tarefas aberta: de que registo é ({tipo,id}), e o que a
   pesquisa e os dois filtros pedem. Volta ao início a cada tfAbrir. */
let tfAlvo=null;
let tfFiltro={q:'',seccao:'',estado:''};
/* a tarefa em edição no formulário (tfFormTarefa): o id, ou '' numa nova */
let tfEmEdicao='';

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
  if(!t.itens.length&&!t.seccoes.length)return `<div class="hint">${ok?'Ainda não há tarefas. Adiciona a primeira, e arruma-as em secções se forem muitas (no ⋯ em cima).':'Ainda não há tarefas.'}</div>`;
  const filtrado=!!(tfFiltro.q.trim()||tfFiltro.seccao||tfFiltro.estado);
  const grupos=[{s:null,itens:t.itens.filter(x=>!x.seccao)}].concat(t.seccoes.map(s=>({s:s,itens:t.itens.filter(x=>x.seccao===s.id)})));
  let mostradas=0;
  const html=grupos.map(g=>{
    const vis=g.itens.filter(x=>tfPassa(x,g.s));mostradas+=vis.length;
    if(!g.s&&!vis.length)return '';
    if(g.s&&!vis.length&&filtrado)return '';
    return tfSeccaoHtml(g.s,g.itens,vis,ok,!!t.seccoes.length);
  }).join('');
  const resumo=`<div class="hint">${esc(tfResumo(t))}</div>`;
  if(!mostradas&&filtrado)return resumo+`<div class="hint">Nenhuma tarefa corresponde à pesquisa e aos filtros.</div>`;
  return resumo+html;
}
/* Uma secção da lista: o cabeçalho (nome, quantas cumpridas, e o ⋯ dela) e
   as tarefas visíveis.
   Recebe: s — a secção (null para as tarefas sem secção); todas — as tarefas
   dela; vis — as que passam os filtros; ok — se quem vê pode alterar;
   comSeccoes — se a lista tem secções (sem nenhuma, as soltas não levam cabeçalho).
   Devolve: o HTML da secção. */
function tfSeccaoHtml(s,todas,vis,ok,comSeccoes){
  const feitas=todas.filter(x=>x.feita).length;
  const m=s&&ok?menu('tfs_'+s.id,[
    {label:'Adicionar tarefa',icon:'plus',toca:'camada',act:`tfNovaTarefa('${jsq(s.id)}')`},
    {label:'Mudar o nome',icon:'pen',toca:'camada',act:`tfMudarNomeSeccao('${jsq(s.id)}')`},
    {label:'Remover secção',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`tfRemoverSeccao('${jsq(s.id)}')`}]):'';
  const cab=s||comSeccoes?`<div class="tf-cab"><b>${esc(s?(s.nome||'Sem nome'):'Sem secção')}</b><span class="tf-conta">${todas.length?feitas+' de '+todas.length:''}</span>${m}</div>`:'';
  const itens=vis.map(x=>tfItemHtml(x,ok)).join('')
    ||(s?`<div class="hint">Sem tarefas nesta secção.</div>`:'');
  return `<div class="tf-seccao">${cab}<div class="tf-itens">${itens}</div></div>`;
}
/* Uma tarefa: a caixa de marcar, que grava logo, e o nome, que abre o
   formulário dela a quem pode alterar.
   Recebe: x — a tarefa; ok — se quem vê pode alterar.
   Devolve: o HTML da linha. */
function tfItemHtml(x,ok){
  const nome=esc(x.nome||'Sem nome');
  const quando=x.feita&&x.feitaEm?`<small class="tf-quando">cumprida a ${dPT(x.feitaEm)}</small>`:'';
  return `<div class="tf-item${x.feita?' tf-feita':''}">
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
   existe, se está cumprida. O ⋯ tem o «Remover tarefa».
   Recebe: x — a tarefa (null numa nova); sid — a secção escolhida à partida.
   Devolve: nada — abre a janela por cima da lista. */
function tfFormTarefa(x,sid){
  if(!tfAlvo)return;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa)return toast(recusa);
  const t=tarefasDe(tfRegisto(tfAlvo.tipo,tfAlvo.id));
  tfEmEdicao=x?x.id:'';
  const secs=[{v:'',label:'Sem secção'}].concat(t.seccoes.map(s=>({v:s.id,label:s.nome||'Sem nome'})));
  const m=x?menu('tfTarefa',[{label:'Remover tarefa',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`tfRemoverTarefa('${jsq(x.id)}')`}]):'';
  openModal(x?'Editar tarefa':'Nova tarefa',`<div class="form">
    <label>Tarefa <span class="req">*</span><input id="tf_nome" value="${esc(x?x.nome:'')}" placeholder="Ex: Trocar o esquentador" autocomplete="off" data-keydown="tfTeclaNome(event)"></label>
    ${t.seccoes.length?`<label>Secção${sel('tf_sec',sid||'',secs,'','rascunho')}</label>`
      :`<div class="hint">Para arrumar as tarefas em secções, adiciona uma no ⋯ da lista.</div>`}
    ${x?`<label class="check"><input type="checkbox" id="tf_feita" ${x.feita?'checked':''}> Cumprida</label>`:''}
  </div>`,null,m);
  onSave=tfGuardarTarefa;
  if(!x)setTimeout(()=>{const e=document.getElementById('tf_nome');if(e)try{e.focus()}catch(z){}},50);
}
/* Enter no nome da tarefa guarda, como no promptModal.
   Recebe: ev — o evento do teclado.
   Devolve: nada. */
function tfTeclaNome(ev){if(ev.key==='Enter'){ev.preventDefault();tfGuardarTarefa()}}
/* Guarda o formulário da tarefa (nova ou editada) e volta à lista.
   Devolve: nada. */
function tfGuardarTarefa(){
  const nome=val('tf_nome').trim();
  if(!nome)return falhaCampo('tf_nome','Escreve a tarefa.');
  const sec=document.getElementById('tf_sec')?val('tf_sec'):'';
  const feita=document.getElementById('tf_feita')?chk('tf_feita'):null,id=tfEmEdicao;
  closeModal();
  const ok=tfGravar(t=>{
    const x=id?t.itens.find(i=>i.id===id):null;
    if(!x){t.itens.push({id:uid(),nome:nome,seccao:sec,feita:false,feitaEm:''});return}
    x.nome=nome;x.seccao=sec;
    if(feita!==null&&feita!==x.feita){x.feita=feita;x.feitaEm=feita?today():''}
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
