/* ================= TAREFAS =================
   A lista de tarefas de um imóvel ou de um contrato: o que há para fazer
   nele (trocar o esquentador, entregar as chaves, pedir o certificado
   energético), arrumado em secções, com cada tarefa cumprida ou por cumprir,
   e com notas, se as tiver (texto livre, escrito no formulário dela).

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
   registo é lê-lo»).

   A janela trabalha sobre um rascunho (tfRascunho, uma cópia das tarefas
   tirada no tfAbrir): marcar, adicionar, mudar, remover, mover e as secções
   mudam só o rascunho e repintam a lista, e só o «Guardar» dela grava, tudo
   de uma vez, com um save() (tfGuardar). Cada toque gravava logo, e cada
   gravação era um envio ao servidor: quem adicionava tarefas uma a uma batia
   no limite dos envios (worker/src/rotas/sync.js). Fechar com o rascunho
   diferente do que se abriu pergunta «Sair sem guardar?», pelo mecanismo dos
   modais (tfMarcarEstado).

   O rascunho com alterações também fica no aparelho, a cada mudança
   (tfRascAcompanhar), por conta e por registo: fechar a app, recarregar ou a
   página morrer não o perde. Sai no Guardar, no «Sair sem guardar» que a
   pessoa escolhe, no «Descartar», ou ao fim de 30 dias. Abrir de novo a
   janela desse registo abre com ele, fundido a três com o que o registo tem
   agora (tfFundir), com a linha que diz que ainda não foi para o servidor e o
   selo «Por enviar» nas tarefas novas ou mudadas; a ficha mostra-as também
   (tfComRascunho). Nunca grava sozinho: só o Guardar envia.

   Na lista, cada secção recolhe-se pelo cabeçalho (tfDobrar), e o que fica
   recolhido é do aparelho, como a gaveta. Quem pode alterar arrasta as
   tarefas pela pega (tfArrastar): por cima do nome de uma secção, a secção
   acende e largar põe a tarefa em 1.º lugar dela; entre duas tarefas aparece
   uma linha e largar põe-na aí. A ordem é a do array itens, e mais nada
   (tfMoverEm). Ao teclado, a pega abre o «Mover tarefa» (tfMoverTarefa). E o
   formulário escolhe a secção, ou cria uma ali mesmo («+ Criar secção…»,
   como a categoria de um movimento), que entra no rascunho com a tarefa. */

/* a janela de tarefas aberta: de que registo é ({tipo,id}), e o que a
   pesquisa e os dois filtros pedem. Volta ao início a cada tfAbrir. */
let tfAlvo=null;
let tfFiltro={q:'',seccao:'',estado:''};
/* o rascunho da janela aberta ({seccoes, itens}, normalizado): é nele que
   todas as mudanças caem até ao «Guardar». null sem janela. */
let tfRascunho=null;
/* as tarefas como estavam ao abrir, em JSON: o rascunho igual a isto quer
   dizer «nada por guardar» (marcar e desmarcar volta a ser nada) */
let tfOriginal='';
/* a camada da janela aberta (a que o openModal devolveu): é nela que se
   marca se há alterações por guardar */
let tfCamada=null;
/* conta as janelas abertas: o «Anular» de uma remoção só vale na janela
   onde se removeu (tfAvisoRemocao) */
let tfSessao=0;
/* o retrato que diz ao closeModal «há alterações»: o componentes.js:modalSnap
   junta os valores dos campos com \x1f e nunca dá este texto */
const TF_POR_GUARDAR='\u0000tf-por-guardar';
/* o botão de baixo do formulário de uma tarefa (tfFormTarefa): leva a tarefa
   ao rascunho, e não grava — por isso não se chama «Guardar» */
const TF_BOTAO_NOVA='Adicionar';
const TF_BOTAO_EDITAR='Aplicar';
/* a tarefa em edição no formulário (tfFormTarefa): o id, ou '' numa nova */
let tfEmEdicao='';
/* as secções criadas no formulário aberto pelo «+ Criar secção…», ainda por
   levar ao rascunho ([{id,nome}]): entram com a tarefa, e um Cancelar deita-as fora */
let tfSecNovas=[];
/* a secção escolhida no formulário antes do «+ Criar secção…»: é a que volta
   ao seletor se o nome for cancelado */
let tfSecAntes='';
/* o que a janela «Mover tarefa» ou «Mover secção» move (tfMoverTarefa,
   tfMoverSeccao): o id da tarefa ou da secção */
let tfMovendo='';
/* As secções recolhidas ficam no aparelho e não na conta, como as da gaveta
   (navegacao.js:LS_GAVETA): {'imovel:P1':['S1','__sem__'],…}, por registo e
   por secção ('__sem__' é o grupo das tarefas sem secção). Sem nada guardado
   — ou com o armazenamento fechado — está tudo aberto. */
const LS_TF_RECOLHIDAS='gi_tf_recolhidas';
/* o mapa das recolhidas, lido uma vez do aparelho e mantido em memória: um
   armazenamento que recusa não desfaz o toque até a página recarregar */
let _tfRec=null;
/* o arrasto em curso (tfArrastar, tfArrastarSeccao), ou null: {tipo —
   'tarefa' ou 'seccao', tid — a tarefa, sid — a secção, h — a pega, row — a
   linha (ou o elemento da secção),
   lista — o #tf_lista, rol — quem rola, y0 — onde o dedo pousou, y — onde
   está, topo0 — o topo da linha antes de mexer, alt — a altura dela,
   desloc — o translateY de agora, ativo — se já passou do limiar,
   cancelado — se o Esc o desfez, alvo — onde vai cair ({sid, depois, cab,
   sec, antes}; de uma secção, {cab, pai, depois, sec | cont, antes}),
   chave — o alvo já pintado, vel — a velocidade da auto-rolagem, raf,
   abrir — o temporizador que abre a secção recolhida (TF_ABRIR_MS)} */
let tfArr=null;
/* quando acabou o último arrasto a sério (Date.now()): o clique que o browser
   dispara a seguir ao pointerup engole-se, senão largar abria o «Mover tarefa» */
let tfArrFim=0;
/* quanto tempo o dedo fica parado no nome de uma secção recolhida, a
   arrastar, até ela abrir (tfArrastoMarcar): o bastante para não abrir as
   que se atravessam, pouco para não parecer que não acontece nada */
const TF_ABRIR_MS=600;
/* Os rascunhos com alterações por guardar ficam no aparelho, por conta
   (acessos.js:meuId) e por registo: 'gi_tf_rascunhos:<conta>' →
   {'imovel:P1': {b, r, t}}, com b as tarefas do registo de onde o rascunho
   partiu (a base da fusão, tfFundir), r o rascunho e t a hora da última
   mudança (ms). Sem sessão não se guarda nada; com o armazenamento fechado,
   a janela trabalha como antes, só em memória. */
const LS_TF_RASCUNHOS='gi_tf_rascunhos:';
/* os dias que um rascunho fica no aparelho sem se mexer, como o do kanban */
const TF_RASCUNHO_DIAS=30;
/* a hora do rascunho guardado com que a janela aberta abriu (ms), para a
   linha do cimo (tfLinhaRascunhoHtml); 0 sem nenhum, ou depois de o descartar */
let tfRascT=0;
/* o aparelho mudou para o registo da janela aberta (guardou-se ou tirou-se o
   rascunho): ao fechar, a ficha por baixo repinta-se, para não ficar a dizer
   o que já não é verdade */
let tfRascMexeu=false;

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
  const v=tfComRascunho(tipo,id),t=v.t,ok=tfPodeAlterar(tipo,id);
  if(!t.itens.length&&!ok)return null;
  const rotulo=t.itens.length?'Ver tarefas':'Adicionar tarefas';
  const env=t.itens.filter(x=>v.por.indexOf(x.id)>-1).slice(0,3)
    .map(x=>`<div class="tf-env-linha"><span class="tf-fl-nome">${esc(x.nome||'Sem nome')}</span>${tfSeloHtml()}</div>`).join('');
  return {tipo:'bloco',rotulo:'Tarefas',valor:tfResumoHtml(v)+(env?`<div class="tf-env">${env}</div>`:'')
    +`<div class="toolbar u-m-9px-0-0"><button type="button" class="btn sm" data-toca="camada" data-click="tfAbrir('${jsq(tipo)}','${jsq(id)}')">${ic('check',14)} ${rotulo}</button></div>`};
}
/* O resumo das tarefas com o que está por enviar no fim: «· 1 por enviar»
   (as tarefas novas ou mudadas do rascunho deste aparelho), ou «·
   alterações por enviar» quando só se removeu ou mudou a ordem — na cor da
   frente, como o «Alterações por guardar» da janela.
   Recebe: v — o de tfComRascunho ({t, por, mudou}).
   Devolve: o HTML do resumo. */
function tfResumoHtml(v){
  const r=esc(tfResumo(v.t));
  if(!v.mudou)return r;
  const n=v.por.length;
  return r.replace(/\.$/,'')+` · <b class="tf-por-guardar">${n?n+' por enviar':'alterações por enviar'}</b>`;
}
/* O selo de uma tarefa que ainda não foi para o servidor: a nuvem a subir e
   «Por enviar», na cor da frente — letra e contorno, que o escuro forçado do
   Samsung não apaga como apaga um fundo (estilos.css:.tf-selo).
   Devolve: o HTML do selo. */
function tfSeloHtml(){return `<span class="tf-selo">${ic('nuvemSobe',14)}Por enviar</span>`}
/* O cartão das tarefas na ficha do imóvel (a prancheta M-Imovel): o resumo
   no cabeçalho, as primeiras por cumprir (até quatro) e as cumpridas mais
   recentes que caibam até às quatro, e o «Adicionar tarefa» e o «Ver
   todas». A ficha lê-se e não tem campos: cada tarefa é uma linha com a
   caixa desenhada, e tocar abre a lista (tfAbrir), onde se marca. Quem não
   pode alterar e não tem tarefas não o vê. Com um rascunho deste aparelho
   por enviar (tfComRascunho), mostra as tarefas dele: as novas ou mudadas
   vêm primeiro, com o selo «Por enviar» no lugar da secção, e o resumo diz
   quantas estão por enviar — quem volta à ficha vê-as logo, e tocar abre a
   janela com o rascunho.
   Recebe: tipo — 'imovel' ou 'contrato'; id — o id do registo.
   Devolve: o HTML do cartão, ou '' sem nada a mostrar. */
function tfCartaoDaFicha(tipo,id){
  const r=tfRegisto(tipo,id);if(!r)return '';
  const v=tfComRascunho(tipo,id),t=v.t,ok=tfPodeAlterar(tipo,id);
  if(!t.itens.length&&!ok)return '';
  const abrir=`tfAbrir('${jsq(tipo)}','${jsq(id)}')`;
  const env=t.itens.filter(x=>v.por.indexOf(x.id)>-1);
  const por=t.itens.filter(x=>!x.feita),feitas=t.itens.filter(x=>x.feita).sort((a,b)=>String(b.feitaEm||'').localeCompare(String(a.feitaEm||'')));
  const vistas=env.concat(por.slice(0,4),feitas.slice(0,Math.max(0,4-Math.min(4,por.length))))
    .filter((x,i,l)=>l.indexOf(x)===i).slice(0,4);
  const sec=x=>{const s=t.seccoes.find(y=>y.id===x.seccao);return s?s.nome:''};
  const linhas=vistas.map(x=>`<div class="imv-linha tap tf-fl${x.feita?' tf-feita':''}" data-toca="camada" data-click="${abrir}">
      <span class="tf-caixa" aria-hidden="true">${x.feita?ic('check',14):''}</span>
      <span class="tf-fl-nome"><span class="imv-so-leitor">${x.feita?'Cumprida: ':'Por cumprir: '}</span>${esc(x.nome||'Sem nome')}</span>
      ${env.indexOf(x)>-1?tfSeloHtml():x.feita&&x.feitaEm?`<span class="small num">${dPT(x.feitaEm).slice(0,5)}</span>`:sec(x)?`<span class="badge grey">${esc(sec(x))}</span>`:''}</div>`).join('');
  const mais=t.itens.length>vistas.length;
  return `<div class="card imv-sec tf-cartao"><div class="imv-sec-cab"><h3>Tarefas</h3><span class="small num">${tfResumoHtml(v)}</span></div>
    ${linhas}
    <div class="tf-fl-pe">${ok?`<button type="button" class="btn ghost tf-fl-mais" data-toca="camada" data-click="${abrir};tfNovaTarefa('')">${ic('plus',18)} Adicionar tarefa</button>`:''}
      ${t.itens.length?`<button type="button" class="btn ghost tf-fl-ver" data-toca="camada" data-click="${abrir}">${mais?'Ver todas':'Ver tarefas'}</button>`:''}</div></div>`;
}
/* Abre a janela da lista de tarefas de um imóvel ou de um contrato, com a
   pesquisa e os filtros limpos e um rascunho novo, copiado do registo — ou,
   com um rascunho deste aparelho por enviar, com ele fundido com o que o
   registo tem agora (tfComRascunho), já com alterações por guardar. O que
   fica no aparelho passa a partir do registo de agora; um rascunho que,
   fundido, já é igual ao registo não conta e sai. Ao fechar, por qualquer
   caminho, o rascunho da memória deita-se fora (tfEsquecer).
   Recebe: tipo — 'imovel' ou 'contrato'; id — o id do registo.
   Devolve: nada — abre a janela. */
function tfAbrir(tipo,id){
  const r=tfRegisto(tipo,id);if(!r)return;
  tfAlvo={tipo:tipo==='contrato'?'contrato':'imovel',id:id};
  tfFiltro={q:'',seccao:'',estado:''};
  const reg=tarefasDe(r),v=tfComRascunho(tfAlvo.tipo,id);
  tfRascunho=v.mudou?v.t:tarefasDe(r);
  tfOriginal=JSON.stringify(reg);
  tfRascT=0;tfRascMexeu=false;
  if(v.mudou){tfRascGuardar(tfAlvo,reg,v.t,v.g.t);tfRascT=v.g.t}
  else if(v.g)tfRascApagar(tfAlvo);
  const sessao=++tfSessao;
  const L=openModal(tfTitulo(),tfCorpo(),tfRodape(),tfMenu());
  tfCamada=L||null;
  if(L)L.aoFechar=origem=>tfEsquecer(sessao,origem);
  if(v.mudou)tfMarcarEstado();
}
/* A janela fechou (Guardar, Cancelar, X, «Sair sem guardar»…): o rascunho
   dela sai da memória, e o «Anular» de uma remoção feita nela sai do ecrã —
   já não há rascunho onde repor. No aparelho, o rascunho só sai quando a
   pessoa escolheu «Sair sem guardar» (tfSaiuSemGuardar): fechar por mudar de
   separador, ou a página morrer, deixa-o lá para a próxima vez. Se o
   aparelho mudou, a ficha por baixo repinta-se (componentes.js:refrescarFichas).
   Recebe: sessao — o número da janela que fechou (tfSessao); origem
   (opcional) — por onde se fechou, como o closeModal a dá ('' sem ela).
   Devolve: nada. */
function tfEsquecer(sessao,origem){
  if(sessao!==tfSessao)return;
  if(tfAlvo&&tfSaiuSemGuardar(origem))tfRascApagar(tfAlvo);
  const mexeu=tfRascMexeu;
  tfRascunho=null;tfOriginal='';tfCamada=null;tfRascT=0;tfRascMexeu=false;
  const t=document.getElementById('toast');
  if(t&&t._op&&t._op.tfSessao===sessao&&t.classList)t.classList.remove('on');
  if(mexeu&&typeof refrescarFichas==='function')try{refrescarFichas()}catch(e){}
}
/* A janela fechou porque a pessoa escolheu deitar as alterações fora? É a
   resposta «Sair sem guardar» à pergunta (componentes.js:_sairSemGuardar,
   que fecha com o _forcaFecho ligado). Sob automação a pergunta não se faz
   (navigator.webdriver, componentes.js:closeModal) e um caminho de abandono
   — o X, o fundo, o Esc, o voltar, o Cancelar — vale como a resposta.
   Recebe: origem — por onde se fechou ('' sem ela: Guardar, mudar de separador…).
   Devolve: true se o rascunho do aparelho deve sair. */
function tfSaiuSemGuardar(origem){
  if(typeof _forcaFecho!=='undefined'&&_forcaFecho)return true;
  return !!origem&&typeof navigator!=='undefined'&&!!navigator.webdriver;
}
/* As tarefas que a janela mostra: as do rascunho, e sem janela as do registo.
   Devolve: {seccoes, itens}. */
function tfTarefas(){
  if(tfRascunho)return tfRascunho;
  return tarefasDe(tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id));
}
/* O rascunho é diferente do que a janela abriu?
   Devolve: true se há alterações por guardar. */
function tfMudou(){return !!tfRascunho&&JSON.stringify(normTarefas(tfRascunho))!==tfOriginal}
/* O título da janela: «Tarefas · <nome do registo>».
   Devolve: o texto do título. */
function tfTitulo(){
  const r=tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id);
  const nome=r?(tfAlvo.tipo==='contrato'?ctName(r):r.name):'';
  return 'Tarefas'+(nome?' · '+nome:'');
}
/* O rodapé da janela, o de todos os formulários: para quem pode alterar,
   «Fechar» (ou «Cancelar», com alterações por guardar — tfMarcarEstado troca
   o texto) e «Guardar»; para quem só lê, «Fechar». O «Adicionar tarefa» vive
   no topo do corpo (tfCorpo): três botões não cabem num rodapé de telemóvel.
   Devolve: o HTML do rodapé. */
function tfRodape(){
  const ok=tfAlvo&&tfPodeAlterar(tfAlvo.tipo,tfAlvo.id);
  if(!ok)return `<button type="button" class="btn primary" data-toca="camada" data-click="closeModal()">Fechar</button>`;
  return `<button type="button" class="btn" id="tf_fechar" data-toca="camada" data-click="tfFechar()">${tfMudou()?'Cancelar':'Fechar'}</button>`
    +`<button type="button" class="btn primary" data-toca="dados" data-click="tfGuardar()">Guardar</button>`;
}
/* O «Fechar»/«Cancelar» do rodapé. Sem alterações fecha logo; com elas,
   pergunta «Sair sem guardar?» (o closeModal com uma origem, como o X) — um
   dedo no Cancelar, encostado ao Guardar, deitava fora uma tarde de tarefas.
   Devolve: nada. */
function tfFechar(){
  if(tfMudou())closeModal('cancelar');else closeModal();
}
/* O «Guardar» da janela: grava o rascunho de uma vez (tfGravar), fecha a
   janela e diz «Tarefas guardadas.». Sem nada mudado só fecha, sem gravar
   nem dizer nada. Com a permissão perdida a meio, recusa com a frase e a
   janela fica (o Cancelar deita o rascunho fora); com o registo apagado,
   avisa e fecha. Gravado (ou sem nada por gravar, ou sem registo), o
   rascunho sai do aparelho; recusado, fica lá.
   Devolve: true se fechou; false se foi recusado. */
function tfGuardar(){
  if(!tfAlvo||!tfRascunho)return false;
  const alvo=tfAlvo,novas=normTarefas(tfRascunho),mudou=tfMudou();
  if(!tfRegisto(alvo.tipo,alvo.id)){toast(tfRecusa(alvo.tipo,alvo.id));tfRascApagar(alvo);closeModal();return false}
  if(!mudou){tfRascApagar(alvo);closeModal();return true}
  if(!tfGravar(alvo,novas))return false;
  tfRascApagar(alvo);
  closeModal();
  toast('Tarefas guardadas.');
  return true;
}
/* A única escrita das tarefas: reverifica a permissão no momento de gravar,
   põe a lista no registo, normalizada, e faz um save() e um render() — um
   envio ao servidor, com tudo o que a janela juntou.
   Recebe: alvo — o {tipo,id} do registo; t — as tarefas ({seccoes, itens}).
   Devolve: true se gravou; false se foi recusado (com o toast da frase). */
function tfGravar(alvo,t){
  const recusa=tfRecusa(alvo.tipo,alvo.id);if(recusa){toast(recusa);return false}
  tfRegisto(alvo.tipo,alvo.id).tarefas=normTarefas(t);
  save();render();
  return true;
}
/* O ⋯ do cabeçalho da janela: adicionar uma secção (só para quem pode).
   Devolve: o HTML do menu, ou '' sem nada a oferecer. */
function tfMenu(){
  if(!tfAlvo||!tfPodeAlterar(tfAlvo.tipo,tfAlvo.id))return '';
  return menu('tfJanela',[{label:'Adicionar secção',icon:'plus',toca:'camada',act:'tfNovaSeccao()'}]);
}
/* As opções do filtro das secções: todas, cada uma pelo caminho, pela ordem
   da árvore (escolher uma mostra também as que tem dentro) e, quando há
   tarefas soltas e secções, «Sem secção».
   Recebe: t — as tarefas ({seccoes, itens}).
   Devolve: a lista de opções do sel() ([{v,label}]). */
function tfOpcoesDeSeccao(t){
  const o=[{v:'',label:'Todas as secções'}].concat(tfOpcoesArvore(t));
  if(t.seccoes.length&&t.itens.some(x=>!x.seccao))o.push({v:'__sem__',label:'Sem secção'});
  return o;
}
/* O corpo da janela: o «Adicionar tarefa» (só para quem pode), a linha do
   rascunho do aparelho (tfLinhaRascunhoHtml, no cimo, logo à vista), a
   pesquisa, os dois filtros e a lista (tfLista), que se repinta sozinha a cada letra
   para o campo da pesquisa não perder o foco. O «Adicionar tarefa» fica
   preso ao topo enquanto a lista rola (estilos.css:.tf-barra): quem
   adiciona quinze tarefas seguidas não sobe a lista quinze vezes.
   Devolve: o HTML do corpo. */
function tfCorpo(){
  const t=tfTarefas(),ok=tfPodeAlterar(tfAlvo.tipo,tfAlvo.id);
  const barra=ok?`<div class="tf-barra"><button type="button" class="btn ghost tf-nova" id="tf_nova" data-toca="camada" data-click="tfNovaTarefa('')">${ic('plus',18)} Adicionar tarefa</button></div>`:'';
  const filtros=t.itens.length?`<div class="qwrap"><input id="tf_q" class="txq" type="search" value="${esc(tfFiltro.q)}" placeholder="Pesquisar…" autocomplete="off"
      aria-label="Pesquisar por tarefa, notas ou secção" data-input="tfPesquisar(this.value)">
      <button type="button" class="qclear${tfFiltro.q?'':' u-d-none'}" data-toca="vista" data-click="tfLimparPesquisa()" aria-label="Limpar a pesquisa">${ic('x',14)}</button></div>
    <div class="row"><label>Secção${sel('tf_fsec',tfFiltro.seccao,tfOpcoesDeSeccao(t),'tfFiltrar','vista')}</label>
      <label>Estado${sel('tf_fest',tfFiltro.estado,[{v:'',label:'Todas'},{v:'por',label:'Por cumprir'},{v:'feitas',label:'Cumpridas'}],'tfFiltrar','vista')}</label></div>`:'';
  return `${barra}<div id="tf_rasc">${tfLinhaRascunhoHtml()}</div><div class="form">${filtros}<div id="tf_lista">${tfLista()}</div></div>`;
}
/* Esta tarefa passa a pesquisa e os filtros? A pesquisa procura no nome da
   tarefa, nas notas dela e no caminho da secção dela («Obras / Cozinha»: quem
   procura Obras encontra as da Cozinha), sem distinguir acentos nem
   maiúsculas. O filtro de uma secção deixa passar as das que ela tem dentro.
   Recebe: x — a tarefa; cam — o caminho da secção dela ('' sem secção);
   ramo (opcional) — os ids que o filtro da secção deixa passar (tfRamo).
   Devolve: true se fica na lista. */
function tfPassa(x,cam,ramo){
  const f=tfFiltro;
  if(f.estado==='por'&&x.feita)return false;
  if(f.estado==='feitas'&&!x.feita)return false;
  if(f.seccao==='__sem__'&&x.seccao)return false;
  if(f.seccao&&f.seccao!=='__sem__'&&(ramo||[f.seccao]).indexOf(x.seccao)<0)return false;
  const q=deacc(f.q).trim();
  return !q||deacc(x.nome).indexOf(q)>-1||deacc(x.notas||'').indexOf(q)>-1||(!!cam&&deacc(cam).indexOf(q)>-1);
}
/* A lista, em árvore, com o que passa a pesquisa e os filtros. As tarefas
   sem secção vêm primeiro, depois as secções do topo, cada uma com as
   tarefas dela e, recuadas, as que tem dentro (tfRamoHtml). Uma secção vazia
   só aparece sem filtros (é onde se lhe adiciona a primeira tarefa); com
   filtros, aparece se ela ou uma das de dentro tem tarefas à vista. Com o
   rascunho diferente do que se abriu, o resumo diz «Alterações por guardar»
   (tfPorGuardarHtml) e as tarefas novas ou mudadas levam o selo «Por enviar».
   Devolve: o HTML da lista (com o resumo por cima). */
function tfLista(){
  const r=tfAlvo&&tfRegisto(tfAlvo.tipo,tfAlvo.id);if(!r)return '';
  const t=tfTarefas(),ok=tfPodeAlterar(tfAlvo.tipo,tfAlvo.id);
  if(!t.itens.length&&!t.seccoes.length)return `<div class="hint">${ok?'Ainda não há tarefas. Adiciona a primeira; ao adicioná-la, escolhes a secção ou crias uma nova.':'Ainda não há tarefas.'}${tfPorGuardarHtml()}</div>`;
  const filtrado=!!(tfFiltro.q.trim()||tfFiltro.seccao||tfFiltro.estado);
  const ramo=tfFiltro.seccao&&tfFiltro.seccao!=='__sem__'?tfRamo(t,tfFiltro.seccao):null;
  const c={t:t,ok:ok,filtrado:filtrado,ramo:ramo,por:tfMudou()?tfPorEnviar(t,JSON.parse(tfOriginal)):[],mostradas:0};
  const soltas=t.itens.filter(x=>!x.seccao),vis=soltas.filter(x=>tfPassa(x,'',ramo));
  c.mostradas+=vis.length;
  const topo=!vis.length?(ok&&t.seccoes.length?tfSoltasAlvoHtml():''):tfSeccaoHtml(null,soltas,vis,ok,!!t.seccoes.length,c.por);
  const html=topo+tfFilhas(t,'').map(s=>tfRamoHtml(s,0,c)).join('');
  const resumo=`<div class="hint">${esc(tfResumo(t))}${tfPorGuardarHtml()}</div>`;
  if(!c.mostradas&&filtrado)return resumo+`<div class="hint">Nenhuma tarefa corresponde à pesquisa e aos filtros.</div>`;
  return resumo+html;
}
/* Uma secção da árvore e tudo o que tem dentro: as tarefas dela que passam
   os filtros e, por baixo, as secções filhas, cada uma pelo mesmo caminho. A
   conta do cabeçalho soma as tarefas dela e as de todas as de dentro.
   Recebe: s — a secção; nivel — a profundidade (0 no topo); c — o contexto
   da lista ({t, ok, filtrado, ramo, por, mostradas}; mostradas vai somando).
   Devolve: o HTML da secção, ou '' quando os filtros a deixam vazia. */
function tfRamoHtml(s,nivel,c){
  const t=c.t,cam=tfCaminhoTexto(t,s.id),dela=t.itens.filter(x=>x.seccao===s.id);
  const vis=dela.filter(x=>tfPassa(x,cam,c.ramo));c.mostradas+=vis.length;
  const filhas=tfFilhas(t,s.id),fh=filhas.map(f=>tfRamoHtml(f,nivel+1,c)).join('');
  if(!vis.length&&!fh&&c.filtrado)return '';
  const ids=tfRamo(t,s.id),todas=t.itens.filter(x=>ids.indexOf(x.seccao)>-1);
  return tfSeccaoHtml(s,todas,vis,c.ok,true,c.por,{filhas:fh,nivel:nivel,temFilhas:!!filhas.length});
}
/* O aviso de que o rascunho ainda não foi guardado, no fim do resumo: a cor
   da frente (o --accent-text) distingue-o também com o Samsung a escurecer a
   página à força. Com a linha do rascunho do aparelho por cima
   (tfLinhaRascunhoHtml), que já o diz, não se repete.
   Devolve: o HTML do aviso, ou '' sem nada por guardar. */
function tfPorGuardarHtml(){
  return tfMudou()&&!tfRascT?' · <b class="tf-por-guardar">Alterações por guardar</b>':'';
}
/* A linha do cimo da janela aberta com um rascunho deste aparelho: diz de
   quando é e que ainda não foi para o servidor, com «Descartar»
   (tfDescartar). Como a do cartão do kanban
   (worker/src/equipa-kanban-filtros.js:kbRascunhoLinha), contorno e letra na
   cor da frente. Sem alterações (desfeitas uma a uma, ou descartadas) sai.
   Recebe: agora (opcional) — ms, para a hora.
   Devolve: o HTML da linha, ou ''. */
function tfLinhaRascunhoHtml(agora){
  if(!tfRascT||!tfMudou())return '';
  return `<div class="tf-rascunho"><p class="tf-rascunho-txt">Alterações guardadas neste aparelho ${esc(tfQuando(tfRascT,agora))}: ainda não foram para o servidor.</p>`
    +`<button type="button" class="btn ghost" id="tf_descartar" data-toca="rascunho" data-click="tfDescartar()">Descartar</button></div>`;
}
/* Quando foi o rascunho, para a linha: hoje, ontem, ou o dia e o mês (a
   mesma forma do kanban, worker/src/equipa-kanban-filtros.js:kbRascunhoQuando).
   Recebe: t — a hora dele (ms); agora (opcional) — ms.
   Devolve: 'hoje às 09:05', 'ontem às 09:05' ou 'a 3/11 às 09:05'. */
function tfQuando(t,agora){
  const d=new Date(t),h=new Date(agora||Date.now()),vespera=new Date(h.getFullYear(),h.getMonth(),h.getDate()-1);
  const dois=n=>(n<10?'0':'')+n,dia=x=>x.getFullYear()+'-'+x.getMonth()+'-'+x.getDate();
  const hora=dois(d.getHours())+':'+dois(d.getMinutes());
  if(dia(d)===dia(h))return 'hoje às '+hora;
  if(dia(d)===dia(vespera))return 'ontem às '+hora;
  return 'a '+d.getDate()+'/'+(d.getMonth()+1)+' às '+hora;
}
/* Uma secção da lista: o cabeçalho e, no corpo, as tarefas visíveis e as
   secções de dentro (recuadas). O cabeçalho tem a pega de arrastar a secção
   (só a quem pode; tfArrastarSeccao), o botão que recolhe e abre a secção
   (tfDobrar) — a seta, o nome e quantas estão cumpridas — e, ao lado, o ⋯
   dela. Recolhida, o corpo continua no HTML e é a folha que o esconde
   (estilos.css:.tf-recolhida): a pesquisa e o arrasto contam com ele.
   Recebe: s — a secção (null para as tarefas sem secção); todas — as tarefas
   dela; vis — as que passam os filtros; ok — se quem vê pode alterar;
   comSeccoes — se a lista tem secções (sem nenhuma, as soltas não levam
   cabeçalho); por (opcional) — os ids das tarefas por enviar (tfPorEnviar);
   o (opcional) — {filhas: o HTML das secções de dentro, nivel: a
   profundidade, temFilhas: se tem secções dentro (aí, sem tarefas dela, não
   diz «Sem tarefas nesta secção.»)}.
   Devolve: o HTML da secção. */
function tfSeccaoHtml(s,todas,vis,ok,comSeccoes,por,o){
  o=o||{};
  const sid=s?s.id:'',feitas=todas.filter(x=>x.feita).length,nome=esc(s?(s.nome||'Sem nome'):'Sem secção');
  const m=s&&ok?menu('tfs_'+s.id,[
    {label:'Adicionar tarefa',icon:'plus',toca:'camada',act:`tfNovaTarefa('${jsq(s.id)}')`},
    {label:'Mudar o nome',icon:'pen',toca:'camada',act:`tfMudarNomeSeccao('${jsq(s.id)}')`},
    {label:'Mover secção',icon:'grip',toca:'camada',act:`tfMoverSeccao('${jsq(s.id)}')`},
    {label:'Remover secção',icon:'trash',danger:true,toca:'rascunho',act:`tfRemoverSeccao('${jsq(s.id)}')`}]):'';
  const comCab=!!(s||comSeccoes),fechada=comCab&&tfRecolhida(sid),idItens='tfi_'+(sid||'_sem');
  const conta=todas.length?feitas+' de '+todas.length+'<span class="imv-so-leitor"> cumpridas</span>':'';
  // sem ⋯ (as soltas, a quem pode), um espaço do mesmo tamanho alinha a conta com as das secções
  const fim=m||(ok?'<span class="tf-sem-menu" aria-hidden="true"></span>':'');
  const pega=s&&ok?`<button type="button" class="tf-pega" aria-label="Mover a secção: ${nome}" data-toca="camada" data-pointerdown="tfArrastarSeccao(event,this)" data-click="tfPegaSecClique('${jsq(s.id)}')">${ic('grip',16)}</button>`:'';
  const cab=comCab?`<div class="tf-cab" data-sec="${esc(sid)}">${pega}<button type="button" class="tf-dobra" aria-expanded="${!fechada}" aria-controls="${idItens}" data-toca="nada" data-click="tfDobrar('${jsq(sid)}')"><span class="tf-chev" aria-hidden="true">${ic('chevD',16)}</span><b>${nome}</b><span class="tf-conta">${conta}</span></button>${fim}</div>`:'';
  const itens=vis.map(x=>tfItemHtml(x,ok,!!por&&por.indexOf(x.id)>-1)).join('')
    ||(s&&!o.temFilhas?`<div class="hint">Sem tarefas nesta secção.</div>`:'');
  const filhas=o.filhas?`<div class="tf-filhas">${o.filhas}</div>`:'';
  const nivel=s?' tf-n'+Math.min(4,o.nivel||0):'';
  return `<div class="tf-seccao${nivel}${fechada?' tf-recolhida':''}" data-sec="${esc(sid)}">${cab}<div class="tf-corpo" id="${idItens}"><div class="tf-itens">${itens}</div>${filhas}</div></div>`;
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
   marcar, que muda o rascunho, e o nome, que abre o formulário dela a quem pode
   alterar. As notas, quando as há, vêm por baixo do nome, pequenas e na cor
   secundária, cortadas a duas linhas (estilos.css:.tf-notas); a linha toda
   abre-as no formulário. A pega arrasta ao dedo e ao rato (tfArrastar) e,
   tocada sem arrastar ou ao teclado, abre o «Mover tarefa» (tfPegaClique).
   Uma tarefa nova ou mudada e por guardar leva o selo «Por enviar» logo por
   baixo do nome (tfSeloHtml).
   Recebe: x — a tarefa; ok — se quem vê pode alterar; porEnviar (opcional)
   — true se ainda não foi para o servidor.
   Devolve: o HTML da linha. */
function tfItemHtml(x,ok,porEnviar){
  const nome=esc(x.nome||'Sem nome'),notas=String(x.notas||'').trim();
  const quando=x.feita&&x.feitaEm?`<small class="tf-quando">cumprida a ${dPT(x.feitaEm)}</small>`:'';
  const nt=notas?`<small class="tf-notas">${esc(notas)}</small>`:'';
  const selo=porEnviar?tfSeloHtml():'';
  const pega=ok?`<button type="button" class="tf-pega" aria-label="Mover: ${nome}" data-toca="camada" data-pointerdown="tfArrastar(event,this)" data-click="tfPegaClique('${jsq(x.id)}')">${ic('grip',16)}</button>`:'';
  return `<div class="tf-item${x.feita?' tf-feita':''}${notas?' tf-com-notas':''}" data-id="${esc(x.id)}">${pega}
    <label class="tf-marca"><input type="checkbox" id="tfc_${esc(x.id)}" ${x.feita?'checked':''} ${ok?'':'disabled'} aria-label="${x.feita?'Cumprida':'Por cumprir'}: ${nome}" data-toca="rascunho" data-change="tfMarcar('${jsq(x.id)}',this.checked)"></label>
    ${ok?`<button type="button" class="tf-nome" data-toca="camada" data-click="tfEditarTarefa('${jsq(x.id)}')"><span>${nome}</span>${selo}${nt}${quando}</button>`
      :`<span class="tf-nome"><span>${nome}</span>${selo}${nt}${quando}</span>`}</div>`;
}
/* Repinta a lista da janela aberta e a linha do rascunho do aparelho, sem
   tocar no campo da pesquisa nem nos filtros, e volta a marcar se há
   alterações por guardar (tfMarcarEstado).
   Devolve: nada. */
function tfPintar(){
  const el=document.getElementById('tf_lista');
  if(!tfAlvo||!el)return;
  const ln=document.getElementById('tf_rasc'),lh=tfLinhaRascunhoHtml();
  if(ln&&ln.innerHTML!==lh)ln.innerHTML=lh;
  el.innerHTML=tfLista();
  if(typeof tornarFocavel==='function')tornarFocavel(el);
  tfMarcarEstado();
}
/* Repinta a janela inteira (o corpo, o rodapé e o ⋯): depois de uma mudança
   nas secções, os filtros têm opções novas. O setModal tira um retrato novo
   e esquece o «mexido»; o tfMarcarEstado devolve-lhe o que o rascunho diz.
   Devolve: nada. */
function tfPintarTudo(){
  const L=modalTop();
  if(!tfAlvo||!L||!document.getElementById('tf_lista'))return;
  if(!tfRegisto(tfAlvo.tipo,tfAlvo.id))return closeModal();
  setModal(tfTitulo(),tfCorpo(),tfRodape(),tfMenu());
  tfMarcarEstado();
}
/* Diz à camada da janela se fechar deita trabalho fora, pelo mecanismo de
   todos os modais (componentes.js:closeModal compara o retrato L.snap com os
   campos, e só pergunta com L.tocado): com o rascunho diferente do que se
   abriu, um retrato que nenhum campo dá (TF_POR_GUARDAR) e o «mexido» ligado;
   sem diferenças, o retrato de agora e o «mexido» desligado — pesquisar,
   filtrar ou marcar e desmarcar a mesma tarefa não pergunta nada. O botão
   da esquerda do rodapé diz «Cancelar» com alterações e «Fechar» sem elas.
   Devolve: nada. */
function tfMarcarEstado(){
  const L=tfCamada;if(!L||!L.el)return;
  const mudou=tfMudou();
  L.snap=mudou?TF_POR_GUARDAR:modalSnap(L.el);
  L.tocado=mudou;
  const b=L.el.querySelector('#tf_fechar,[data-mid="tf_fechar"]');
  if(b)b.textContent=mudou?'Cancelar':'Fechar';
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
/* O caminho de todas as mudanças da janela: reverifica a permissão (quem a
   perdeu a meio sabe-o já, e não só no Guardar), aplica a mudança ao
   rascunho, normaliza-o, leva-o ao aparelho (tfRascAcompanhar) e repinta a
   janela. Não grava no registo nem envia: isso é do tfGuardar.
   Recebe: mudar — função que recebe o rascunho ({seccoes, itens}) e o altera;
   tudo (opcional) — true repinta a janela inteira (as secções mudaram).
   Devolve: true se mudou o rascunho; false se foi recusado. */
function tfMudar(mudar,tudo){
  if(!tfAlvo||!tfRascunho)return false;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa){toast(recusa);tfPintar();return false}
  mudar(tfRascunho);
  tfRascunho=normTarefas(tfRascunho);
  tfRascAcompanhar();
  if(tudo)tfPintarTudo();else tfPintar();
  return true;
}
/* Marca ou desmarca uma tarefa como cumprida, com o dia de hoje. Voltar a
   marcar uma que já estava cumprida ao abrir devolve-lhe o dia de então:
   desmarcar e marcar de novo não é uma alteração.
   Recebe: tid — o id da tarefa; on — true para cumprida.
   Devolve: nada. */
function tfMarcar(tid,on){
  const antes=JSON.parse(tfOriginal||'{"itens":[]}').itens.find(i=>i.id===tid);
  tfMudar(t=>{const x=t.itens.find(i=>i.id===tid);if(x){x.feita=!!on;x.feitaEm=on?(antes&&antes.feita&&antes.feitaEm?antes.feitaEm:today()):''}});
}
/* Leva à vista uma linha da lista (uma tarefa adicionada ou mudada, uma
   secção nova), sem animar: o «Adicionar tarefa» fica preso no topo, e a
   linha nova pode ter caído fora do ecrã.
   Recebe: sel — o seletor da linha dentro do #tf_lista.
   Devolve: nada. */
function tfMostrar(sel){
  const lista=document.getElementById('tf_lista'),el=lista&&lista.querySelector&&lista.querySelector(sel);
  if(el&&el.scrollIntoView)try{el.scrollIntoView({block:'nearest'})}catch(e){}
}
/* O formulário de uma tarefa nova, já na secção de onde se pediu.
   Recebe: sid — o id da secção ('' para nenhuma).
   Devolve: nada — abre o formulário. */
function tfNovaTarefa(sid){tfFormTarefa(null,sid)}
/* O formulário de uma tarefa que já existe.
   Recebe: tid — o id da tarefa.
   Devolve: nada — abre o formulário. */
function tfEditarTarefa(tid){
  const x=tfTarefas().itens.find(i=>i.id===tid);
  if(x)tfFormTarefa(x,x.seccao);
}
/* O formulário de uma tarefa: o nome (obrigatório), a secção, as notas
   (texto livre, opcional — o Enter nelas muda de linha) e, numa que já
   existe, se está cumprida. O ⋯ tem o «Remover tarefa». O seletor da secção
   está sempre lá, mesmo sem secções: «Sem secção», as secções, e no fim o
   «+ Criar secção…» (tfSecMudou). O botão de baixo diz o que faz: numa
   tarefa nova «Adicionar» (à lista da janela, que só o Guardar dela grava),
   numa que existe «Aplicar» — um segundo «Guardar» fazia crer que já estava
   gravado.
   Recebe: x — a tarefa (null numa nova); sid — a secção escolhida à partida.
   Devolve: nada — abre a janela por cima da lista. */
function tfFormTarefa(x,sid){
  if(!tfAlvo||!tfRascunho)return;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa)return toast(recusa);
  const t=tfTarefas();
  tfEmEdicao=x?x.id:'';
  tfSecNovas=[];
  tfSecAntes=t.seccoes.some(s=>s.id===sid)?sid:'';
  const m=x?menu('tfTarefa',[{label:'Remover tarefa',icon:'trash',danger:true,toca:'rascunho',act:`tfRemoverTarefa('${jsq(x.id)}')`}]):'';
  openModal(x?'Editar tarefa':'Nova tarefa',`<div class="form">
    <label>Tarefa <span class="req">*</span><input id="tf_nome" value="${esc(x?x.nome:'')}" placeholder="Ex: Trocar o esquentador" autocomplete="off" data-keydown="tfTeclaNome(event)"></label>
    <label>Secção${tfSelSeccao(t,tfSecAntes)}</label>
    <label>Notas<textarea id="tf_notas" placeholder="Opcional">${esc(x?x.notas||'':'')}</textarea></label>
    ${x?`<label class="check"><input type="checkbox" id="tf_feita" ${x.feita?'checked':''}> Cumprida</label>`:''}
  </div>`,`<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button type="button" class="btn primary" data-toca="rascunho" data-click="onSave&&onSave()">${x?TF_BOTAO_EDITAR:TF_BOTAO_NOVA}</button>`,m);
  onSave=tfGuardarTarefa;
  if(!x)setTimeout(()=>{const e=document.getElementById('tf_nome');if(e)try{e.focus()}catch(z){}},50);
}
/* As opções do seletor da secção no formulário: «Sem secção», as secções
   (as do rascunho e as criadas neste formulário), cada uma pelo caminho e
   pela ordem da árvore, e, no fim, «+ Criar secção…».
   Recebe: t — as tarefas ({seccoes, itens}).
   Devolve: a lista de opções do sel() ([{v,label}]). */
function tfOpcoesDoFormulario(t){
  return [{v:'',label:'Sem secção'}]
    .concat(tfOpcoesArvore({seccoes:t.seccoes.concat(tfSecNovas),itens:[]}))
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
  const t=tfTarefas();
  const w=document.getElementById('sel_tf_sec');if(w)w.outerHTML=tfSelSeccao(t,v);
  const i=document.getElementById('tf_sec');if(i)i.value=v;
}
/* Mudou a secção no formulário. O «+ Criar secção…» pede o nome (como a
   categoria de um movimento, movimento.js:onCatChange) e deixa a secção nova
   escolhida. O nome pode ser um caminho, a partir do topo («Obras/Cozinha»):
   as secções que faltam criam-se, umas dentro das outras (tfResolverCaminho),
   e um caminho que já existe todo escolhe essa secção. As secções novas ficam
   no formulário e entram no rascunho com a tarefa (tfGuardarTarefa): cancelar
   a tarefa não deixa secções vazias para trás, e o que se escreveu não se perde.
   Devolve: nada — muda o seletor ou abre o nome. */
function tfSecMudou(){
  const v=val('tf_sec');
  if(v!=='__new__'){tfSecAntes=v;return}
  tfRepintarSelSeccao(tfSecAntes);   // um Cancelar no nome não deixa «+ Criar secção…» escolhido
  promptModal('Nova secção','Nome da secção','',nm=>{
    const t=tfTarefas(),partes=tfPartes(nm);
    if(!partes.length)return;
    const todas=t.seccoes.concat(tfSecNovas),r=tfResolverCaminho(todas,partes);
    r.novas.forEach(s=>tfSecNovas.push(s));
    tfSecAntes=r.id;tfRepintarSelSeccao(r.id);
    const L=modalTop();if(L)L.tocado=true;   // há trabalho por guardar: o X pergunta antes de o deitar fora
    const b=document.getElementById('selb_tf_sec');if(b)try{b.focus()}catch(e){}
    if(r.ja)toast('A secção «'+tfCaminhoTexto({seccoes:todas},r.id)+'» já existe: fica escolhida.');
  },'Obras/Cozinha',TF_BOTAO_NOVA);
}
/* Enter no nome da tarefa guarda, como no promptModal.
   Recebe: ev — o evento do teclado.
   Devolve: nada. */
function tfTeclaNome(ev){if(ev.key==='Enter'){ev.preventDefault();tfGuardarTarefa()}}
/* Leva o formulário da tarefa (nova ou editada) ao rascunho e volta à lista,
   com as secções que o formulário criou, as notas (aparadas nas pontas) e a
   linha da tarefa à vista.
   Uma tarefa nova fica no fim da secção; uma que muda de secção passa para
   o fim da nova. Não grava: isso é do «Guardar» da janela (tfGuardar).
   Devolve: nada. */
function tfGuardarTarefa(){
  const nome=val('tf_nome').trim();
  if(!nome)return falhaCampo('tf_nome','Escreve a tarefa.');
  let sec=document.getElementById('tf_sec')?val('tf_sec'):'';
  if(sec==='__new__')sec='';
  const novas=tfSecNovas.slice();tfSecNovas=[];
  const feita=document.getElementById('tf_feita')?chk('tf_feita'):null,id=tfEmEdicao,nid=id||uid();
  const notas=document.getElementById('tf_notas')?val('tf_notas').trim():null;
  closeModal();
  const ok=tfMudar(t=>{
    novas.forEach(s=>{if(!t.seccoes.some(y=>y.id===s.id))t.seccoes.push({id:s.id,nome:s.nome,pai:s.pai||''})});
    const x=id?t.itens.find(i=>i.id===id):null;
    if(!x){t.itens.push({id:nid,nome:nome,seccao:sec,feita:false,feitaEm:'',notas:notas||''});return}
    x.nome=nome;
    if(notas!==null)x.notas=notas;
    if(feita!==null&&feita!==x.feita){x.feita=feita;x.feitaEm=feita?today():''}
    if(x.seccao!==sec)tfAplicar(t,tfMoverEm(t,x.id,sec,tfUltimaDe(t,sec,x.id)));
  },true);
  if(ok)tfMostrar('.tf-item[data-id="'+nid+'"]');
}
/* Remove uma tarefa do rascunho, com Anular (tfAvisoRemocao).
   Recebe: tid — o id da tarefa.
   Devolve: nada. */
function tfRemoverTarefa(tid){
  const t=tfTarefas(),i=t.itens.findIndex(x=>x.id===tid);
  if(i<0)return;
  const x=Object.assign({},t.itens[i]);
  const L=modalTop();if(L&&tfCamada&&L!==tfCamada)closeModal();   // removida a partir do formulário dela, por cima da janela
  if(!tfMudar(c=>{c.itens=c.itens.filter(y=>y.id!==tid)},true))return;
  tfAvisoRemocao('Tarefa removida.',c=>{
    if(c.itens.some(y=>y.id===x.id))return;
    if(x.seccao&&!c.seccoes.some(s=>s.id===x.seccao))x.seccao='';
    c.itens.splice(Math.min(i,c.itens.length),0,x);
  });
}
/* O nome de uma secção nova, e a secção no fim das irmãs (no rascunho). O
   nome pode ser um caminho a partir do topo («Obras/Cozinha»): as que faltam
   criam-se, umas dentro das outras (tfResolverCaminho); um caminho que já
   existe todo não cria nada e diz que já existe.
   Devolve: nada — abre a janela do nome. */
function tfNovaSeccao(){
  if(!tfAlvo||!tfRascunho)return;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa)return toast(recusa);
  promptModal('Nova secção','Nome da secção','',v=>{
    const partes=tfPartes(v);if(!partes.length)return;
    const r=tfResolverCaminho(tfTarefas().seccoes,partes);
    if(r.ja){tfMostrar('.tf-seccao[data-sec="'+r.id+'"]');return toast('A secção «'+tfCaminhoTexto(tfTarefas(),r.id)+'» já existe.')}
    if(tfMudar(t=>{r.novas.forEach(s=>t.seccoes.push(Object.assign({},s)))},true))tfMostrar('.tf-seccao[data-sec="'+r.id+'"]');
  },'Obras/Cozinha',TF_BOTAO_NOVA);
}
/* Muda o nome de uma secção (no rascunho). A janela abre com o caminho
   inteiro («Obras/Cozinha»): mudar só a última parte muda o nome; mudar o
   resto leva a secção, com tudo o que tem dentro, para o sítio do caminho —
   as mães que faltam criam-se, e sem mãe («Cozinha») vai para o topo, para o
   fim das irmãs. Não pode ir para dentro dela própria nem de uma das que tem
   dentro, nem ficar com o caminho de outra secção: aí recusa com um aviso.
   Recebe: sid — o id da secção.
   Devolve: nada — abre a janela do nome. */
function tfMudarNomeSeccao(sid){
  if(!tfAlvo||!tfRascunho)return;
  const t0=tfTarefas(),s=t0.seccoes.find(x=>x.id===sid);if(!s)return;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa)return toast(recusa);
  promptModal('Mudar o nome da secção','Nome da secção',tfCaminhoTexto(t0,sid,true),v=>{
    const t=tfTarefas(),partes=tfPartes(v);if(!partes.length)return;
    const nome=partes.pop(),ramo=tfRamo(t,sid);
    // as mães procuram-se sem a própria secção e as de dentro: um caminho que passe por elas é recusado
    const r=tfResolverCaminho(t.seccoes.filter(x=>ramo.indexOf(x.id)<0),partes);
    const porDentro=partes.length&&tfResolverCaminho(t.seccoes,partes).id;
    if(porDentro&&ramo.indexOf(porDentro)>-1)return toast('Uma secção não pode ficar dentro dela própria.');
    const outra=t.seccoes.find(x=>x.id!==sid&&(x.pai||'')===r.id&&!r.novas.length&&deacc(x.nome).trim()===deacc(nome).trim());
    if(outra)return toast('Já existe a secção «'+tfCaminhoTexto(t,outra.id)+'».');
    tfMudar(c=>{
      r.novas.forEach(n=>c.seccoes.push(Object.assign({},n)));
      if((s.pai||'')!==r.id)tfAplicar(c,tfMoverSeccaoEm(c,sid,r.id,tfUltimaIrma(c,r.id,sid)));
      const y=c.seccoes.find(x=>x.id===sid);if(y)y.nome=nome;
    },true);
  },'Obras/Cozinha',TF_BOTAO_EDITAR);
}
/* A última secção dentro de uma mãe (ou no topo), sem contar com uma.
   Recebe: t — as tarefas; pai — a mãe ('' para o topo); excepto — o id a não contar.
   Devolve: o id da última, ou '' sem nenhuma. */
function tfUltimaIrma(t,pai,excepto){
  const l=tfFilhas(t,pai).filter(s=>s.id!==excepto);
  return l.length?l[l.length-1].id:'';
}
/* Remove uma secção, as que tem dentro e as tarefas de todas do rascunho,
   com Anular (tfAvisoRemocao), que devolve tudo ao lugar onde estava.
   Recebe: sid — o id da secção.
   Devolve: nada. */
function tfRemoverSeccao(sid){
  const t=tfTarefas(),ramo=tfRamo(t,sid);
  if(!ramo.length)return;
  const secs=t.seccoes.map((s,i)=>({i:i,s:Object.assign({},s)})).filter(o=>ramo.indexOf(o.s.id)>-1);
  const levadas=t.itens.map((x,i)=>({i:i,x:Object.assign({},x)})).filter(o=>ramo.indexOf(o.x.seccao)>-1);
  const n=levadas.length,ns=secs.length-1;
  if(ramo.indexOf(tfFiltro.seccao)>-1)tfFiltro.seccao='';
  if(!tfMudar(c=>{c.seccoes=c.seccoes.filter(x=>ramo.indexOf(x.id)<0);c.itens=c.itens.filter(i=>ramo.indexOf(i.seccao)<0)},true))return;
  const partes=[ns?ns+(ns===1?' subsecção':' subsecções'):'',n?n+(n===1?' tarefa':' tarefas'):''].filter(Boolean);
  tfAvisoRemocao(partes.length?'Secção removida, com '+partes.join(' e ')+'.':'Secção removida.',c=>{
    secs.forEach(o=>{if(!c.seccoes.some(x=>x.id===o.s.id))c.seccoes.splice(Math.min(o.i,c.seccoes.length),0,o.s)});
    levadas.forEach(o=>{if(!c.itens.some(y=>y.id===o.x.id))c.itens.splice(Math.min(o.i,c.itens.length),0,o.x)});
  });
}
/* O aviso de uma remoção, com «Anular» durante seis segundos. O Anular
   devolve ao rascunho só o que se removeu, no lugar onde estava — o resto
   do que se fez entretanto fica —, e só na janela onde se removeu: fechada
   ela (tfEsquecer tira o aviso do ecrã), não há rascunho onde repor. Não é o
   componentes.js:comDesfazer, que grava ao anular.
   Recebe: msg — o texto do aviso; repor — função que recebe o rascunho e
   lhe devolve o que se removeu.
   Devolve: nada — mostra o aviso. */
function tfAvisoRemocao(msg,repor){
  const sessao=tfSessao;
  toast(msg,{rotulo:'Anular',ms:6000,tfSessao:sessao,fn(){
    if(sessao!==tfSessao||!tfRascunho)return;
    tfMudar(repor,true);
  }});
}

/* ---- o rascunho no aparelho ---- */

/* A chave do aparelho com os rascunhos desta conta: o de uma conta nunca
   aparece a outra que entre no mesmo aparelho.
   Devolve: 'gi_tf_rascunhos:<id>', ou '' sem sessão (aí não se guarda nada). */
function tfRascChave(){
  const id=typeof meuId==='function'?meuId():'';
  return id?LS_TF_RASCUNHOS+id:'';
}
/* Os rascunhos desta conta no aparelho, sem os caducados (mais de 30 dias
   sem mexer) nem o que não tem a forma de um; os que caem saem do aparelho.
   Recebe: agora (opcional) — ms.
   Devolve: {'tipo:id': {b, r, t}} — vazio sem sessão, sem nada guardado ou
   com o armazenamento fechado. */
function tfRascTodos(agora){
  const k=tfRascChave();if(!k)return {};
  let o=null;
  try{o=JSON.parse(localStorage.getItem(k)||'{}')}catch(e){return {}}
  if(!o||typeof o!=='object'||Array.isArray(o))o={};
  const lim=(agora||Date.now())-TF_RASCUNHO_DIAS*864e5,out={},obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  let caiu=false;
  Object.keys(o).forEach(c=>{
    const x=o[c];
    if(/^(imovel|contrato):./.test(c)&&obj(x)&&typeof x.t==='number'&&x.t>=lim&&obj(x.b)&&obj(x.r))out[c]=x;else caiu=true;
  });
  if(caiu)tfRascEscrever(out);
  return out;
}
/* Grava os rascunhos desta conta no aparelho (sem nenhum, a chave sai);
   calado quando o aparelho não deixa.
   Recebe: todos — {'tipo:id': {b, r, t}}.
   Devolve: true se gravou. */
function tfRascEscrever(todos){
  const k=tfRascChave();if(!k)return false;
  try{
    if(Object.keys(todos).length)localStorage.setItem(k,JSON.stringify(todos));else localStorage.removeItem(k);
    return true;
  }catch(e){return false}
}
/* O rascunho guardado neste aparelho para um registo.
   Recebe: alvo — o {tipo,id} do registo.
   Devolve: {b, r, t}, ou null sem nenhum. */
function tfRascDe(alvo){return alvo?tfRascTodos()[alvo.tipo+':'+alvo.id]||null:null}
/* Guarda no aparelho o rascunho de um registo, com a base de onde partiu e a hora.
   Recebe: alvo — o {tipo,id}; base — as tarefas do registo de onde partiu;
   r — o rascunho; t (opcional) — a hora (ms; por omissão, agora).
   Devolve: a hora gravada, ou 0 se o aparelho não deixou. */
function tfRascGuardar(alvo,base,r,t){
  const todos=tfRascTodos(),h=t||Date.now();
  todos[alvo.tipo+':'+alvo.id]={b:normTarefas(base),r:normTarefas(r),t:h};
  tfRascMexeu=true;
  return tfRascEscrever(todos)?h:0;
}
/* Tira do aparelho o rascunho de um registo (sem nenhum, não mexe em nada).
   Recebe: alvo — o {tipo,id}.
   Devolve: nada. */
function tfRascApagar(alvo){
  const todos=tfRascTodos(),c=alvo.tipo+':'+alvo.id;
  if(!todos[c])return;
  delete todos[c];
  tfRascMexeu=true;
  tfRascEscrever(todos);
}
/* A janela mudou o rascunho: com alterações por guardar, leva-o ao aparelho
   com a hora (e a linha do cimo, se a há, passa a dizer a hora nova); sem
   elas (desfeitas uma a uma), tira-o.
   Devolve: nada. */
function tfRascAcompanhar(){
  if(!tfAlvo||!tfRascunho)return;
  if(!tfMudou()){tfRascApagar(tfAlvo);tfRascT=0;return}
  const t=tfRascGuardar(tfAlvo,JSON.parse(tfOriginal),tfRascunho);
  if(t&&tfRascT)tfRascT=t;
}
/* Um rascunho juntado com o que o registo tem agora: a fusão a três da casa
   (cloud/nucleo.js:fundirTres), com a base de onde o rascunho partiu. O que
   outra pessoa ou outro aparelho mudou entretanto fica; o que se mudou aqui
   também; só sai o que se removeu aqui; a mesma tarefa mudada dos dois lados
   fica com o que se mudou aqui, campo a campo. Sem a fusão carregada, o
   rascunho tal e qual.
   Recebe: base — as tarefas de onde o rascunho partiu; r — o rascunho;
   agora — as tarefas do registo agora.
   Devolve: as tarefas fundidas, normalizadas. */
function tfFundir(base,r,agora){
  if(typeof fundirTres!=='function')return normTarefas(r);
  return normTarefas(fundirTres(normTarefas(base),normTarefas(r),normTarefas(agora)));
}
/* As tarefas por enviar: as que a base não tem, ou tem diferentes (o nome,
   a secção, cumprida, as notas). Mudar só a ordem não conta.
   Recebe: t — as tarefas; base — as de onde partiram.
   Devolve: a lista dos ids. */
function tfPorEnviar(t,base){
  const b=new Map(base.itens.map(x=>[x.id,JSON.stringify(x)]));
  return t.itens.filter(x=>b.get(x.id)!==JSON.stringify(x)).map(x=>x.id);
}
/* O que um registo mostra com o rascunho deste aparelho por cima: o
   rascunho fundido com o registo (tfFundir), as tarefas por enviar, e se
   há alterações por enviar. Só para quem pode alterar a lista; um rascunho
   que, fundido, é igual ao registo não conta (o tfAbrir tira-o).
   Recebe: tipo — 'imovel' ou 'contrato'; id — o id do registo.
   Devolve: {t — as tarefas a mostrar, por — os ids das por enviar, mudou —
   true com alterações por enviar, g — o rascunho guardado ({b, r, t}) ou null}. */
function tfComRascunho(tipo,id){
  const reg=tarefasDe(tfRegisto(tipo,id)),nada={t:reg,por:[],mudou:false,g:null};
  if(!tfRegisto(tipo,id)||!tfPodeAlterar(tipo,id))return nada;
  const g=tfRascDe({tipo:tipo,id:id});if(!g)return nada;
  const f=tfFundir(g.b,g.r,reg);
  if(JSON.stringify(f)===JSON.stringify(reg))return {t:reg,por:[],mudou:false,g:g};
  return {t:f,por:tfPorEnviar(f,reg),mudou:true,g:g};
}
/* O «Descartar» da linha do rascunho: as alterações saem do aparelho e da
   janela, que fica com o que o registo tem, e o aviso traz o «Anular»
   durante seis segundos, que as devolve — juntas com o que se fez entretanto
   (tfFundir) — à janela e ao aparelho. Como o Anular de uma remoção, só vale
   na janela onde se descartou.
   Devolve: nada. */
function tfDescartar(){
  if(!tfAlvo||!tfRascunho)return;
  const alvo=tfAlvo,sessao=tfSessao,antes=normTarefas(tfRascunho),quando=tfRascT||Date.now();
  tfRascApagar(alvo);
  tfRascunho=JSON.parse(tfOriginal);tfRascT=0;
  tfPintarTudo();
  toast('Alterações descartadas.',{rotulo:'Anular',ms:6000,tfSessao:sessao,fn(){
    if(sessao!==tfSessao||!tfRascunho)return;
    const base=JSON.parse(tfOriginal);
    tfRascunho=tfFundir(base,antes,tfRascunho);
    if(tfMudou()){tfRascGuardar(alvo,base,tfRascunho,quando);tfRascT=quando}
    tfPintarTudo();
  }});
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
  const vivas=['__sem__'].concat(tfTarefas().seccoes.map(s=>s.id));
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

/* ---- a árvore das secções ----
   As secções são como pastas: cada uma tem a mãe (pai, '' no topo) e a ordem
   entre irmãs é a do array seccoes (dados.js:normTarefas garante que não há
   ciclos nem mães que não existem). O caminho escreve-se com «/» e é sempre a
   partir do topo: «Obras/Cozinha» é a Cozinha que está dentro de Obras. */

/* As secções que estão logo dentro de outra (ou no topo), pela ordem.
   Recebe: t — as tarefas ({seccoes}); pai — o id da mãe ('' para o topo).
   Devolve: a lista das secções filhas. */
function tfFilhas(t,pai){return t.seccoes.filter(s=>(s.pai||'')===(pai||''))}
/* Todas as secções pela ordem da árvore (cada mãe seguida das filhas dela,
   em profundidade), com o nível de cada uma.
   Recebe: t — as tarefas ({seccoes}).
   Devolve: [{s, nivel}], com nivel 0 no topo. */
function tfArvore(t){
  const out=[],vai=(pai,n)=>tfFilhas(t,pai).forEach(s=>{out.push({s:s,nivel:n});vai(s.id,n+1)});
  vai('',0);
  return out;
}
/* Uma secção e todas as que tem dentro, a qualquer profundidade.
   Recebe: t — as tarefas ({seccoes}); sid — o id da secção.
   Devolve: a lista dos ids, a começar pelo dela ([] se não existe). */
function tfRamo(t,sid){
  if(!sid||!t.seccoes.some(s=>s.id===sid))return [];
  const out=[sid];
  for(let i=0;i<out.length;i++)tfFilhas(t,out[i]).forEach(s=>out.push(s.id));
  return out;
}
/* Os nomes do caminho até uma secção, do topo para ela.
   Recebe: t — as tarefas ({seccoes}); sid — o id da secção.
   Devolve: a lista dos nomes ([] sem secção). */
function tfCaminho(t,sid){
  const out=[],vistos=new Set();
  for(let s=t.seccoes.find(x=>x.id===sid);s&&!vistos.has(s.id);s=t.seccoes.find(x=>x.id===s.pai)){
    vistos.add(s.id);out.unshift(s.nome||'Sem nome');
  }
  return out;
}
/* O caminho de uma secção para ler: «Obras / Cozinha» (os rótulos dos
   seletores); para escrever, «Obras/Cozinha» (o que o «Mudar o nome» abre).
   Recebe: t — as tarefas; sid — o id da secção; escrever (opcional) — true
   para a forma sem espaços.
   Devolve: o texto ('' sem secção). */
function tfCaminhoTexto(t,sid,escrever){return tfCaminho(t,sid).join(escrever?'/':' / ')}
/* As partes de um caminho escrito: separadas por «/», aparadas, e sem as
   vazias («Obras//Cozinha/» é Obras e Cozinha).
   Recebe: v — o texto escrito.
   Devolve: a lista dos nomes. */
function tfPartes(v){return String(v||'').split('/').map(x=>x.trim()).filter(Boolean)}
/* Resolve um caminho a partir do topo: cada parte é a irmã com o mesmo nome
   (sem olhar a acentos nem a maiúsculas) dentro da anterior, e a que falta
   cria-se. Não mexe na lista que recebe.
   Recebe: seccoes — as secções onde procurar; partes — os nomes (tfPartes).
   Devolve: {id — a última secção do caminho ('' sem partes), novas — as
   secções a criar, pela ordem ([{id,nome,pai}]), ja — true se já existia toda}. */
function tfResolverCaminho(seccoes,partes){
  const todas=seccoes.slice(),novas=[];
  let pai='';
  partes.forEach(nm=>{
    let s=todas.find(x=>(x.pai||'')===pai&&deacc(x.nome).trim()===deacc(nm).trim());
    if(!s){s={id:uid(),nome:nm,pai:pai};todas.push(s);novas.push(s)}
    pai=s.id;
  });
  return {id:pai,novas:novas,ja:!!partes.length&&!novas.length};
}
/* As opções das secções para um seletor: cada uma pelo caminho, pela ordem
   da árvore.
   Recebe: t — as tarefas; fora (opcional) — ids a deixar de fora.
   Devolve: [{v,label}]. */
function tfOpcoesArvore(t,fora){
  return tfArvore(t).filter(o=>!fora||fora.indexOf(o.s.id)<0).map(o=>({v:o.s.id,label:tfCaminhoTexto(t,o.s.id)}));
}
/* Move uma secção (com tudo o que tem dentro) para dentro de outra, ou para
   o topo, e para uma posição entre as irmãs: logo a seguir à irmã `depois`,
   ou antes da primeira com `depois` vazio. Não pode ir para dentro dela
   própria nem de uma das que tem dentro: aí nada muda. Um `depois` que não é
   irmã no destino põe-na no fim. Não mexe na lista que recebe.
   Recebe: t — as tarefas; sid — a secção a mover; pai — a mãe de destino
   ('' para o topo; uma que não existe vale ''); depois — a irmã que fica antes.
   Devolve: as tarefas novas ({seccoes, itens}), com cópias. */
function tfMoverSeccaoEm(t,sid,pai,depois){
  const seccoes=t.seccoes.map(s=>Object.assign({},s)),itens=t.itens.map(x=>Object.assign({},x));
  const k=seccoes.findIndex(s=>s.id===sid);
  pai=pai&&seccoes.some(s=>s.id===pai)?pai:'';
  if(k<0||tfRamo(t,sid).indexOf(pai)>-1||(depois&&depois===sid))return {seccoes:seccoes,itens:itens};
  const s=seccoes.splice(k,1)[0];s.pai=pai;
  const irmas=seccoes.filter(x=>(x.pai||'')===pai);
  let j;
  if(!depois)j=irmas.length?seccoes.indexOf(irmas[0]):seccoes.length;
  else{
    const d=irmas.find(x=>x.id===depois),ultima=irmas[irmas.length-1];
    j=d?seccoes.indexOf(d)+1:ultima?seccoes.indexOf(ultima)+1:seccoes.length;
  }
  seccoes.splice(j,0,s);
  return {seccoes:seccoes,itens:itens};
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
/* Troca o conteúdo do rascunho (a cópia que o tfMudar entrega) pelo de outra lista.
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
   arrastar. Abre com a secção e o lugar de agora. O botão diz «Mover»: muda
   o rascunho, e só o «Guardar» da janela grava.
   Recebe: tid — o id da tarefa.
   Devolve: nada — abre a janela por cima da lista. */
function tfMoverTarefa(tid){
  if(!tfAlvo)return;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa)return toast(recusa);
  const t=tfTarefas(),x=t.itens.find(i=>i.id===tid);if(!x)return;
  tfMovendo=tid;
  const secs=[{v:'',label:'Sem secção'}].concat(tfOpcoesArvore(t));
  openModal('Mover tarefa',`<div class="form">
    <div class="hint">${esc(x.nome||'Sem nome')}</div>
    <label>Secção${sel('tf_msec',x.seccao,secs,'tfMoverSecMudou','rascunho')}</label>
    <label>Posição${tfSelPosicao(t,tid,x.seccao,tfAntesDe(t,tid))}</label>
  </div>`,`<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button type="button" class="btn primary" data-toca="rascunho" data-click="onSave&&onSave()">Mover</button>`);
  onSave=tfGuardarMover;
}
/* Mudou a secção no «Mover tarefa»: as posições passam a ser as dessa
   secção, com o fim escolhido (ou o lugar de agora, de volta à secção dela).
   Devolve: nada. */
function tfMoverSecMudou(){
  const t=tfTarefas(),x=t.itens.find(i=>i.id===tfMovendo);if(!x)return;
  const sid=val('tf_msec'),d=sid===x.seccao?tfAntesDe(t,x.id):tfUltimaDe(t,sid,x.id);
  const w=document.getElementById('sel_tf_mpos');if(w)w.outerHTML=tfSelPosicao(t,x.id,sid,d);
  const i=document.getElementById('tf_mpos');if(i)i.value=d;
}
/* Aplica o «Mover tarefa» ao rascunho e volta à lista, com o foco na pega da tarefa
   movida: ao teclado, continua-se de onde ela ficou.
   Devolve: nada. */
function tfGuardarMover(){
  const tid=tfMovendo,sid=val('tf_msec'),depois=val('tf_mpos');
  closeModal();
  if(!tfMudar(t=>tfAplicar(t,tfMoverEm(t,tid,sid,depois))))return;
  const lista=document.getElementById('tf_lista');
  const linha=lista&&[].slice.call(lista.querySelectorAll('.tf-item')).find(x=>x.getAttribute('data-id')===tid);
  const pega=linha&&linha.querySelector('.tf-pega');if(pega)try{pega.focus()}catch(e){}
}

/* ---- o «Mover secção» (o ⋯ da secção, e a pega dela ao toque ou ao teclado) ---- */

/* As mães para onde uma secção pode ir: o topo e todas as secções que não
   são ela nem estão dentro dela, cada uma pelo caminho.
   Recebe: t — as tarefas; sid — a secção a mover.
   Devolve: [{v,label}] do sel(). */
function tfOpcoesDeMae(t,sid){return [{v:'',label:'No topo'}].concat(tfOpcoesArvore(t,tfRamo(t,sid)))}
/* As posições entre as irmãs de destino: em primeiro lugar, ou depois de cada uma.
   Recebe: t — as tarefas; sid — a secção a mover; pai — a mãe de destino.
   Devolve: [{v,label}] do sel(), com v = o «depois». */
function tfOpcoesDePosicaoSec(t,sid,pai){
  return [{v:'',label:'Em primeiro lugar'}].concat(tfFilhas(t,pai).filter(s=>s.id!==sid)
    .map(s=>({v:s.id,label:'Depois de «'+(s.nome||'Sem nome')+'»'})));
}
/* A irmã que vem antes desta secção.
   Recebe: t — as tarefas; sid — o id da secção.
   Devolve: o id, ou '' se é a primeira. */
function tfIrmaAntes(t,sid){
  const s=t.seccoes.find(x=>x.id===sid);if(!s)return '';
  const l=tfFilhas(t,s.pai),k=l.indexOf(s);
  return k>0?l[k-1].id:'';
}
/* O toque (ou o Enter) na pega de uma secção: logo a seguir a um arrasto
   engole-se; senão abre o «Mover secção».
   Recebe: sid — o id da secção.
   Devolve: nada. */
function tfPegaSecClique(sid){
  if(tfArr||Date.now()-tfArrFim<700)return;
  tfMoverSeccao(sid);
}
/* A janela «Mover secção»: «Dentro de» (o topo, ou outra secção que não seja
   ela nem uma das que tem dentro) e a posição entre as irmãs, com o sítio de
   agora escolhido. O botão diz «Mover»: muda o rascunho, e só o «Guardar» da
   janela grava. Leva com ela tudo o que tem dentro.
   Recebe: sid — o id da secção.
   Devolve: nada — abre a janela por cima da lista. */
function tfMoverSeccao(sid){
  if(!tfAlvo)return;
  const recusa=tfRecusa(tfAlvo.tipo,tfAlvo.id);if(recusa)return toast(recusa);
  const t=tfTarefas(),s=t.seccoes.find(x=>x.id===sid);if(!s)return;
  tfMovendo=sid;
  openModal('Mover secção',`<div class="form">
    <div class="hint">${esc(tfCaminhoTexto(t,sid))}</div>
    <label>Dentro de${sel('tf_smae',s.pai||'',tfOpcoesDeMae(t,sid),'tfMoverMaeMudou','rascunho')}</label>
    <label>Posição${sel('tf_spos',tfIrmaAntes(t,sid),tfOpcoesDePosicaoSec(t,sid,s.pai||''),'','rascunho')}</label>
  </div>`,`<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button type="button" class="btn primary" data-toca="rascunho" data-click="onSave&&onSave()">Mover</button>`);
  onSave=tfGuardarMoverSeccao;
}
/* Mudou o «Dentro de» no «Mover secção»: as posições passam a ser as das
   irmãs dessa mãe, com o fim escolhido (ou o lugar de agora, de volta à mãe dela).
   Devolve: nada. */
function tfMoverMaeMudou(){
  const t=tfTarefas(),s=t.seccoes.find(x=>x.id===tfMovendo);if(!s)return;
  const pai=val('tf_smae'),d=pai===(s.pai||'')?tfIrmaAntes(t,s.id):tfUltimaIrma(t,pai,s.id);
  const w=document.getElementById('sel_tf_spos');
  if(w)w.outerHTML=sel('tf_spos',d,tfOpcoesDePosicaoSec(t,s.id,pai),'','rascunho');
  const i=document.getElementById('tf_spos');if(i)i.value=d;
}
/* Aplica o «Mover secção» ao rascunho e volta à lista, com a secção à vista
   e o foco na pega dela.
   Devolve: nada. */
function tfGuardarMoverSeccao(){
  const sid=tfMovendo,pai=val('tf_smae'),depois=val('tf_spos');
  closeModal();
  if(!tfMudar(t=>tfAplicar(t,tfMoverSeccaoEm(t,sid,pai,depois)),true))return;
  tfMostrar('.tf-seccao[data-sec="'+sid+'"]');
  const lista=document.getElementById('tf_lista');
  const sec=lista&&[].slice.call(lista.querySelectorAll('.tf-seccao')).find(x=>x.getAttribute('data-sec')===sid);
  const pega=sec&&sec.querySelector('.tf-pega');if(pega)try{pega.focus()}catch(e){}
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
function tfArrastar(e,h){tfArrastoLigar(e,h,'.tf-item')}
/* Pousou o dedo (ou o rato) na pega de uma secção: o mesmo gesto, com a
   secção inteira — que se levanta recolhida, só o cabeçalho a flutuar — no
   lugar da tarefa.
   Recebe: e — o PointerEvent do pointerdown; h — a pega do cabeçalho.
   Devolve: nada — liga os ouvintes do documento. */
function tfArrastarSeccao(e,h){tfArrastoLigar(e,h,'.tf-seccao')}
/* O começo dos dois arrastos: guarda o estado (tfArr) e fica à escuta do
   resto do gesto no documento.
   Recebe: e — o PointerEvent; h — a pega; qual — '.tf-item' (uma tarefa) ou
   '.tf-seccao' (uma secção).
   Devolve: nada. */
function tfArrastoLigar(e,h,qual){
  if(tfArr||(e.button!=null&&e.button>0)||e.isPrimary===false)return;
  const row=h.closest(qual),lista=document.getElementById('tf_lista');
  if(!row||!lista||!tfAlvo||!tfPodeAlterar(tfAlvo.tipo,tfAlvo.id))return;
  e.preventDefault();
  const sec=qual==='.tf-seccao';
  tfArr={tipo:sec?'seccao':'tarefa',tid:sec?'':row.getAttribute('data-id'),sid:sec?row.getAttribute('data-sec'):'',
    h:h,row:row,lista:lista,rol:tfRolante(lista),y0:e.clientY,y:e.clientY,
    topo0:0,desloc:0,ativo:false,cancelado:false,alvo:null,chave:'',vel:0,raf:0,abrir:0};
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
  if(a.tipo==='seccao')a.row.classList.add('tf-a-levar');   // a secção levanta-se recolhida: só o cabeçalho flutua
  const r0=a.row.getBoundingClientRect();a.topo0=r0.top;a.alt=r0.height;
  a.row.classList.add('tf-agarrada');
  a.lista.classList.add('tf-a-arrastar');
  if(a.tipo==='seccao')a.lista.classList.add('tf-arr-sec');   // as secções não vão para «Sem secção»: o lugar das soltas não aparece
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
/* As tarefas que são mesmo desta secção (e não das que tem dentro), sem a agarrada.
   Recebe: s — o elemento da secção; fora — a linha a não contar.
   Devolve: a lista das linhas. */
function tfLinhasDe(s,fora){
  return [].slice.call(s.querySelectorAll('.tf-item')).filter(x=>x!==fora&&(!x.closest||x.closest('.tf-seccao')===s));
}
/* Onde vai cair o que se arrasta com o dedo à altura y: uma tarefa
   (tfArrastoAlvoTarefa) ou uma secção (tfArrastoAlvoSeccao).
   Recebe: y — a altura do dedo (clientY).
   Devolve: o alvo, ou null. */
function tfArrastoAlvo(y){return tfArr&&tfArr.tipo==='seccao'?tfArrastoAlvoSeccao(y):tfArrastoAlvoTarefa(y)}
/* Onde vai cair a tarefa com o dedo à altura y. Cada secção à vista conta
   com o que é dela — o cabeçalho e as tarefas dela, não as das secções de
   dentro, que contam por si —, e ganha a mais perto (a mais funda, numa
   árvore, porque as de dentro vêm a seguir às tarefas da mãe). Por cima do
   cabeçalho, recolhida ou sem outras tarefas, é o 1.º lugar (cab); senão, o
   intervalo entre as linhas pelo meio de cada uma.
   Recebe: y — a altura do dedo (clientY).
   Devolve: {sid, depois, cab, sec, antes} — antes é a linha que fica a seguir
   à linha indicativa (null no fim) —, ou null sem secções à vista. */
function tfArrastoAlvoTarefa(y){
  const a=tfArr;
  const secs=[].slice.call(a.lista.querySelectorAll('.tf-seccao')).filter(s=>s.getClientRects().length);
  let s=null,dist=Infinity,linhas=[];
  secs.forEach(x=>{
    const cab=x.querySelector('.tf-cab'),rec=x.classList.contains('tf-recolhida');
    const ls=rec?[]:tfLinhasDe(x,a.row),r=(cab||x).getBoundingClientRect();
    const fim=ls.length?Math.max(r.bottom,ls[ls.length-1].getBoundingClientRect().bottom):cab?r.bottom:x.getBoundingClientRect().bottom;
    const d=y<r.top?r.top-y:y>fim?y-fim:0;
    if(d<dist){dist=d;s=x;linhas=ls}
  });
  if(!s)return null;
  const sid=s.getAttribute('data-sec')||'',cab=s.querySelector('.tf-cab'),rc=cab&&cab.getBoundingClientRect();
  if((rc&&y>=rc.top&&y<=rc.bottom)||s.classList.contains('tf-recolhida')||!linhas.length)return {sid:sid,depois:'',cab:true,sec:s,antes:null};
  let antes=null,depois='';
  for(const x of linhas){const r=x.getBoundingClientRect();if(y<r.top+r.height/2){antes=x;break}depois=x.getAttribute('data-id')||''}
  return {sid:sid,depois:depois,cab:false,sec:s,antes:antes};
}
/* Onde vai cair a secção agarrada com o dedo à altura y. Por cima do nome
   de outra secção (que não seja ela nem uma das de dentro dela), fica dentro
   dessa, em 1.º lugar, e ela acende (cab). Senão é uma linha entre irmãs: o
   nível é o da lista de secções mais funda que está à altura do dedo (as
   filhas de uma secção, ou o topo), e a linha fica antes da primeira irmã
   cujo nome está abaixo do dedo (ou no fim).
   Recebe: y — a altura do dedo (clientY).
   Devolve: {cab:true, pai, depois:'', sec} ou {cab:false, pai, depois, cont,
   antes} — cont é a lista onde a linha entra, antes o elemento que fica a
   seguir a ela (null no fim) —, ou null sem para onde ir. */
function tfArrastoAlvoSeccao(y){
  const a=tfArr,D=a.row,dentro=x=>x===D||(!!D.contains&&D.contains(x));
  const secs=[].slice.call(a.lista.querySelectorAll('.tf-seccao')).filter(s=>s.getAttribute('data-sec')&&!dentro(s)&&s.getClientRects().length);
  for(const s of secs){
    const cab=s.querySelector('.tf-cab'),r=cab&&cab.getBoundingClientRect();
    if(r&&y>=r.top&&y<=r.bottom)return {cab:true,pai:s.getAttribute('data-sec'),depois:'',sec:s};
  }
  let cont=a.lista,pai='';
  [].slice.call(a.lista.querySelectorAll('.tf-filhas')).forEach(f=>{
    if(dentro(f)||!f.getClientRects().length)return;
    const r=f.getBoundingClientRect();
    if(y>=r.top&&y<=r.bottom){const dona=f.closest&&f.closest('.tf-seccao');cont=f;pai=dona?dona.getAttribute('data-sec')||'':''}
  });
  const irmas=secs.filter(s=>s.parentElement===cont);
  if(!irmas.length&&cont===a.lista&&!secs.length)return null;
  let antes=null,depois='';
  for(const s of irmas){
    const cab=s.querySelector('.tf-cab'),r=(cab||s).getBoundingClientRect();
    if(y<r.top+r.height/2){antes=s;break}
    depois=s.getAttribute('data-sec')||'';
  }
  return {cab:false,pai:pai,depois:depois,cont:cont,antes:antes};
}
/* Pinta o alvo: a secção acesa, ou a linha entre as duas tarefas (ou entre
   duas secções). Só mexe no DOM quando o alvo muda. Com o alvo no cabeçalho
   de uma secção recolhida, conta 600 ms: se o dedo ainda lá estiver, a
   secção abre (tfArrastoAbrir), para se poder largar lá dentro onde se quer.
   Recebe: alvo — o de tfArrastoAlvo, ou null para limpar.
   Devolve: nada. */
function tfArrastoMarcar(alvo){
  const a=tfArr;if(!a)return;
  const chave=!alvo?'':a.tipo==='seccao'?(alvo.cab?'c':'l')+'|'+alvo.pai+'|'+alvo.depois:(alvo.cab?'c':'l')+'|'+alvo.sid+'|'+alvo.depois;
  a.alvo=alvo;if(chave===a.chave)return;a.chave=chave;
  if(a.abrir){clearTimeout(a.abrir);a.abrir=0}
  [].slice.call(a.lista.querySelectorAll('.tf-alvo')).forEach(x=>x.classList.remove('tf-alvo'));
  const velha=a.lista.querySelector('.tf-linha');if(velha)velha.remove();
  if(!alvo)return;
  if(alvo.cab){
    alvo.sec.classList.add('tf-alvo');
    if(alvo.sec.classList.contains('tf-recolhida'))a.abrir=setTimeout(()=>tfArrastoAbrir(a,chave,alvo.sec),TF_ABRIR_MS);
    return;
  }
  const linha=document.createElement('div');linha.className='tf-linha';linha.setAttribute('aria-hidden','true');
  const onde=a.tipo==='seccao'?alvo.cont:alvo.sec.querySelector('.tf-itens');if(!onde)return;
  if(alvo.antes)onde.insertBefore(linha,alvo.antes);else onde.appendChild(linha);
}
/* Passados os 600 ms com o dedo parado no nome de uma secção recolhida: abre-a
   como o toque no cabeçalho (fica aberta, e o aparelho lembra-se — tfDobrar)
   e volta a medir o alvo, agora com as tarefas e as secções dela à vista. Se
   o arrasto acabou ou o alvo mudou entretanto, não faz nada.
   Recebe: a — o estado do arrasto que pediu; chave — o alvo de então; sec —
   o elemento da secção.
   Devolve: nada. */
function tfArrastoAbrir(a,chave,sec){
  if(a!==tfArr)return;
  a.abrir=0;
  if(!a.ativo||a.cancelado||a.chave!==chave||!sec.classList.contains('tf-recolhida'))return;
  tfDobrar(sec.getAttribute('data-sec')||'');
  a.chave='';   // o mesmo alvo, agora aberto: volta a pintar-se
  tfArrastoPintar();
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
  if(a.abrir){clearTimeout(a.abrir);a.abrir=0}
  a.vel=0;
  if(!a.ativo)return;
  a.ativo=false;
  const antes=a.row.getBoundingClientRect().top-a.desloc;
  a.row.style.transform='';a.row.classList.remove('tf-agarrada');a.row.classList.remove('tf-a-levar');a.desloc=0;
  [].slice.call(a.lista.querySelectorAll('.tf-alvo')).forEach(x=>x.classList.remove('tf-alvo'));
  const linha=a.lista.querySelector('.tf-linha');if(linha)linha.remove();
  a.lista.classList.remove('tf-a-arrastar');a.lista.classList.remove('tf-arr-sec');
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
   «Mover tarefa»); arrastado, a tarefa cai no alvo, no rascunho. Largada numa
   secção recolhida, onde não se vê, um aviso diz para onde foi.
   Devolve: nada. */
function tfArrastoFim(){
  const a=tfArr;if(!a)return;
  const arrastou=a.ativo||a.cancelado,alvo=a.cancelado?null:a.alvo,ligada=a.row.isConnected;
  const recolhida=!!(alvo&&alvo.sec&&alvo.sec.classList.contains('tf-recolhida'));
  tfArrastoDesfazer(a);tfArrastoSoltar();
  if(!arrastou)return;
  tfArrFim=Date.now();
  if(!alvo||!ligada||!tfAlvo)return;
  const t=tfTarefas();
  if(a.tipo==='seccao'){
    const n=tfMoverSeccaoEm(t,a.sid,alvo.pai,alvo.depois),forma=l=>l.seccoes.map(s=>s.id+'|'+(s.pai||'')).join(',');
    if(forma(n)===forma(t))return;
    if(!tfMudar(c=>tfAplicar(c,tfMoverSeccaoEm(c,a.sid,alvo.pai,alvo.depois)),true))return;
    if(recolhida){const m=t.seccoes.find(x=>x.id===alvo.pai);toast('Secção movida para dentro de «'+(m?tfCaminhoTexto(t,m.id):'')+'».')}
    return;
  }
  if(tfMesmaOrdem(t,tfMoverEm(t,a.tid,alvo.sid,alvo.depois)))return;
  if(!tfMudar(c=>tfAplicar(c,tfMoverEm(c,a.tid,alvo.sid,alvo.depois))))return;
  if(recolhida){const s=t.seccoes.find(x=>x.id===alvo.sid);toast('Tarefa movida para «'+(s?tfCaminhoTexto(t,s.id):'Sem secção')+'».')}
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
