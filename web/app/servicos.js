/* ================= SERVIÇOS ================= */
/* A app em serviços: cada separador da barra lateral é um serviço com
   manifesto próprio, e as Definições são a base.

   Um serviço declara-se aqui (SERVICOS — o catálogo: ficheiros, kinds de
   registo, o que requer) e regista-se na base ao carregar (registarServico:
   as vistas, os menus de toque longo, as contribuições para a análise, os
   crachás e o que pinta depois do render). A base nunca nomeia um serviço:
   despacha pelo registo. É isso que deixa um serviço estar DESLIGADO numa
   conta — pelo suporte, no back office — sem a base dar por falta dele: o
   separador some, a vista não se despacha, o servidor não manda os registos
   dele nem aceita escritas, e os outros serviços perguntam servicoLigado()
   antes de lhe tocar.

   Todo o código continua a ser carregado pelo index.html, ligado ou não: a
   SHELL offline é uma só, e a camada da nuvem embrulha funções por
   reatribuição no carregamento (vDashboard, vTransactions, lpMenu…) — um
   carregamento condicional partia isso e o offline. O interruptor é o
   registo, não o <script>.

   O registo guarda NOMES de funções e resolve-os na hora (window[nome]):
   por referência, prendia-se a versão de antes de a nuvem a embrulhar. */

/* O catálogo. A ordem é a dos separadores (navegacao.js:TABS). `kinds` são os
   kinds de records que o serviço possui; `userKinds` os de user_records;
   `casa` marca o scope house (só os imóveis); `colab` as tabelas de cargos e
   partilha (só os colaboradores); `requer` os serviços sem os quais este não
   faz sentido — desligar um deles desliga este (fechoDesligados); `usa` os
   que enriquece quando estão ligados, e sem os quais funciona na mesma. O
   espelho no servidor é worker/src/lib/servicos.js (um teste compara os dois). */
const SERVICOS=[
  {id:'dashboard',nome:'Visão geral',ficheiros:['app/painel-geral.js'],kinds:[],userKinds:[],casa:false,colab:false,requer:[],usa:['properties','contracts','transactions','recurring','owners']},
  {id:'properties',nome:'Imóveis',ficheiros:['app/lista-imoveis.js','app/imovel.js'],kinds:[],userKinds:[],casa:true,colab:false,requer:[],usa:['contracts','credits','owners','transactions']},
  {id:'contracts',nome:'Contratos',ficheiros:['app/lista-contratos.js','app/contrato.js','app/contrato-pdf.js'],kinds:['contract'],userKinds:[],casa:false,colab:false,requer:['properties','tenants'],usa:['transactions','recurring']},
  {id:'visits',nome:'Visitas',ficheiros:['app/visitas.js'],kinds:['visit'],userKinds:[],casa:false,colab:false,requer:['properties'],usa:['tenants']},
  {id:'tenants',nome:'Inquilinos',ficheiros:['app/lista-pessoas.js','app/pessoas.js'],kinds:['tenant'],userKinds:['tenant'],casa:false,colab:false,requer:[],usa:['contracts']},
  {id:'owners',nome:'Proprietários',ficheiros:['app/lista-pessoas.js','app/pessoas.js'],kinds:[],userKinds:[],casa:false,colab:false,requer:[],usa:['properties']},
  {id:'colaboradores',nome:'Colaboradores',ficheiros:['app/lista-colaboradores.js','cloud/colaboradores.js'],kinds:[],userKinds:[],casa:false,colab:true,requer:['properties'],usa:[]},
  {id:'transactions',nome:'Movimentos',ficheiros:['app/lista-movimentos.js','app/movimento.js','cloud/selecao.js','cloud/selecao-listas.js'],kinds:['tx'],userKinds:['tx'],casa:false,colab:false,requer:[],usa:['properties','contracts','owners','credits','recurring']},
  {id:'recurring',nome:'Planeados',ficheiros:['app/planeados.js','cloud/painel.js'],kinds:['rec'],userKinds:['rec','tpl'],casa:false,colab:false,requer:['transactions'],usa:['contracts','credits']},
  {id:'calendar',nome:'Calendário',ficheiros:['app/calendario.js'],kinds:[],userKinds:[],casa:false,colab:false,requer:[],usa:['visits','recurring']},
  {id:'credits',nome:'Créditos',ficheiros:['app/creditos.js'],kinds:[],userKinds:[],casa:false,colab:false,requer:['properties'],usa:['transactions','recurring']},
  {id:'projections',nome:'Projeções',ficheiros:['app/projecoes.js'],kinds:[],userKinds:[],casa:false,colab:false,requer:[],usa:['contracts','properties','transactions']},
  {id:'reports',nome:'Avaliação',ficheiros:['app/avaliacao.js'],kinds:[],userKinds:[],casa:false,colab:false,requer:[],usa:['properties','contracts','transactions','owners']},
  {id:'fisco',nome:'Declaração',ficheiros:['app/fisco.js'],kinds:[],userKinds:[],casa:false,colab:false,requer:[],usa:['contracts','transactions','tenants','properties']},
];
/* onde o aparelho guarda os serviços desligados nesta conta, para o
   arranque os saber antes de o servidor responder */
const LS_SERVICOS='gi_servicos_off';
/* o que está registado: por separador a vista, o «depois de pintar» e o
   crachá; por prefixo do toque longo os handlers e as contribuições de outros
   serviços; por separador de análise a contagem e o limpar; e o manifesto de
   registo de cada serviço */
const REGISTO={vistas:{},depois:{},cracha:{},lp:{},lpExtras:{},analise:{},manifestos:{}};
let _servicosDesligados=(function(){try{const v=JSON.parse(localStorage.getItem(LS_SERVICOS)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]}catch(e){return []}})();

/* O manifesto de um serviço do catálogo.
   Recebe: id — o id do serviço.
   Devolve: o manifesto (objeto de SERVICOS), ou null se não existe. */
function servicoDe(id){return SERVICOS.find(s=>s.id===id)||null}
/* O nome que se lê de um serviço.
   Recebe: id — o id do serviço.
   Devolve: o nome (string); o próprio id se não existir. */
function nomeDoServico(id){const s=servicoDe(id);return s?s.nome:String(id||'')}
/* O serviço a que um separador pertence. As Definições não têm: são a base.
   Recebe: tab — o id do separador.
   Devolve: o id do serviço, ou '' quando o separador é da base. */
function servicoDoSeparador(tab){return servicoDe(tab)?tab:''}
/* Este serviço está ligado nesta conta? Sem conta (modo local) está tudo
   ligado; a lista dos desligados vem do servidor e fica no aparelho.
   Recebe: id — o id do serviço.
   Devolve: true se está ligado (ou se não é um serviço do catálogo). */
function servicoLigado(id){return _servicosDesligados.indexOf(id)<0}
/* Os serviços desligados nesta conta.
   Devolve: uma cópia da lista de ids (array). */
function servicosDesligados(){return _servicosDesligados.slice()}
/* Este separador pode abrir? Os da base (settings) sempre; os de um serviço
   só com o serviço ligado.
   Recebe: tab — o id do separador.
   Devolve: true se pode. */
function separadorLigado(tab){const s=servicoDoSeparador(tab);return !s||servicoLigado(s)}
/* O primeiro separador que abre nesta conta, pela ordem do menu: para onde
   se vai quando o separador onde se estava ficou desligado.
   Devolve: um id de separador; 'settings' quando está tudo desligado. */
function primeiroSeparadorLigado(){
  const t=(typeof TABS!=='undefined'?TABS:[]).find(x=>separadorLigado(x.id));
  return t?t.id:'settings';
}
/* A lista de desligados mais os que requerem um desligado, transitivamente:
   sem Imóveis não há Contratos, e sem Contratos… a mesma regra que o
   servidor aplica ao guardar (worker/src/lib/servicos.js:fechoDesligados).
   Recebe: lista — ids de serviços desligados (array).
   Devolve: um array novo com o fecho, pela ordem do catálogo. */
function fechoDesligados(lista){
  const off=new Set((lista||[]).filter(id=>servicoDe(id)));
  let mudou=true;
  while(mudou){mudou=false;
    SERVICOS.forEach(s=>{if(!off.has(s.id)&&(s.requer||[]).some(r=>off.has(r))){off.add(s.id);mudou=true}})}
  return SERVICOS.filter(s=>off.has(s.id)).map(s=>s.id);
}
/* Fixa os serviços desligados nesta conta e guarda-os no aparelho. Quem
   chama repinta (buildNav e render), e é a nuvem quem chama, em applyState,
   com o que o servidor mandou — ou com [] quando a conta não tem nada.
   Recebe: lista — ids de serviços desligados (array; o fecho é aplicado).
   Devolve: nada — muda a lista em memória e no aparelho. */
function definirServicosDesligados(lista){
  _servicosDesligados=fechoDesligados(lista);
  try{localStorage.setItem(LS_SERVICOS,JSON.stringify(_servicosDesligados))}catch(e){}
}
/* Este kind de registo pertence a um serviço desligado? É a pergunta que a
   exportação faz antes de mandar um registo para o servidor — que o recusava.
   Recebe: kind — o kind ('tx', 'contract', 'tpl'…); scope — 'record' (kinds
   de records, por omissão) ou 'user' (kinds de user_records).
   Devolve: true se o serviço dono do kind está desligado; false se está
   ligado ou se o kind não é de serviço nenhum (é da base). */
function kindDesligado(kind,scope){
  const chave=scope==='user'?'userKinds':'kinds';
  const s=SERVICOS.find(x=>(x[chave]||[]).indexOf(kind)>-1);
  return !!s&&!servicoLigado(s.id);
}
/* Resolve uma função de topo DA APP pelo nome, na hora. É assim que o
   registo apanha a versão embrulhada pela nuvem, e não a de antes. O nome
   pode vir de uma ação injetada (o chamarServico chama-se de uma): passa
   pelo funcaoDaApp do eventos.js, que nunca devolve uma função do browser
   (o alert, o fetch, o eval…) nem um nome que não seja da app.
   Recebe: nome — o nome da função (string); vazio devolve null; rebenta
   (opcional) — true para rebentar quando o nome existe e é recusado.
   Devolve: a função, ou null se não existe, não é função ou é recusada
   (sem o eventos.js carregado não há como saber o que é da app: null). */
function funcaoDeTopo(nome,rebenta){
  if(!nome||typeof funcaoDaApp!=='function')return null;
  return funcaoDaApp(nome,rebenta);
}
/* Um serviço regista o que tem para a base despachar. Os valores são NOMES
   de funções de topo: `vistas` {separador: nome}, `depois` {separador: nome}
   (corre a seguir ao render desse separador), `cracha` {separador: nome} (a
   função devolve {n, aviso} para o crachá do menu), `lp` {prefixo do
   data-lp: nome} (o handler do toque longo, chamado com as partes do valor),
   `lpExtras` {prefixo: nome} (opções que este serviço acrescenta ao menu de
   OUTRO — a função recebe as mesmas partes e devolve [{label, icon, act}]),
   `analise` {separador: {n, limpar, alternar, aberto, fechar}} (quantos
   filtros próprios estão ativos, como se limpam, e — para quem tem painel
   próprio — como se alterna, se está aberto e como se fecha no estado), e
   `aoMudar` (nome; corre em cada mudança de separador, para o serviço
   arrumar o que é passageiro). Registar não liga: o que está desligado fica
   registado e não se despacha. Registar duas vezes junta.
   Recebe: m — o manifesto de registo, com `id` obrigatório e do catálogo.
   Devolve: true se o serviço está ligado nesta conta, false se não. */
function registarServico(m){
  if(!m||!servicoDe(m.id))throw new Error('registarServico: serviço desconhecido «'+(m&&m.id)+'»');
  const antes=REGISTO.manifestos[m.id]||{};
  REGISTO.manifestos[m.id]=Object.assign({},antes,m);
  Object.keys(m.vistas||{}).forEach(t=>{REGISTO.vistas[t]={servico:m.id,nome:m.vistas[t]}});
  Object.keys(m.depois||{}).forEach(t=>{REGISTO.depois[t]={servico:m.id,nome:m.depois[t]}});
  Object.keys(m.cracha||{}).forEach(t=>{REGISTO.cracha[t]={servico:m.id,nome:m.cracha[t]}});
  Object.keys(m.lp||{}).forEach(p=>{(REGISTO.lp[p]=REGISTO.lp[p]||[]).push({servico:m.id,nome:m.lp[p]})});
  Object.keys(m.lpExtras||{}).forEach(p=>{(REGISTO.lpExtras[p]=REGISTO.lpExtras[p]||[]).push({servico:m.id,nome:m.lpExtras[p]})});
  Object.keys(m.analise||{}).forEach(t=>{REGISTO.analise[t]=Object.assign({servico:m.id},m.analise[t])});
  return servicoLigado(m.id);
}
/* A vista de um separador: a registada pelo serviço, se ele está ligado; as
   Definições são a base e resolvem sempre para vSettings.
   Recebe: tab — o id do separador.
   Devolve: a função da vista, ou null (sem registo, ou serviço desligado). */
function vistaDoSeparador(tab){
  if(tab==='settings')return funcaoDeTopo('vSettings');
  const r=REGISTO.vistas[tab];
  if(!r||!servicoLigado(r.servico))return null;
  return funcaoDeTopo(r.nome);
}
/* O «depois de pintar» de um separador (a lista dos movimentos, as rendas
   dos grupos, a criação rápida do painel, as miniaturas dos imóveis), se o
   serviço está ligado.
   Recebe: tab — o id do separador.
   Devolve: a função, ou null. */
function depoisDoSeparador(tab){
  const r=REGISTO.depois[tab];
  if(!r||!servicoLigado(r.servico))return null;
  return funcaoDeTopo(r.nome);
}
/* O crachá de um separador, se o serviço dele registou um e está ligado.
   Recebe: tab — o id do separador.
   Devolve: {n, aviso} (n a contagem; aviso se pinta na cor de aviso), ou null. */
function crachaDe(tab){
  const r=REGISTO.cracha[tab];
  if(!r||!servicoLigado(r.servico))return null;
  const f=funcaoDeTopo(r.nome);if(!f)return null;
  const c=f();
  return c&&typeof c==='object'?c:null;
}
/* O handler do toque longo de um prefixo (prop, tx, ct, per, vis, rec, tpl,
   mort): o do primeiro serviço ligado que o registou (as pessoas registam o
   mesmo handler pelos inquilinos e pelos proprietários).
   Recebe: prefixo — a primeira parte do data-lp.
   Devolve: a função, ou null (ninguém registou, ou está tudo desligado). */
function lpDe(prefixo){
  const r=(REGISTO.lp[prefixo]||[]).find(x=>servicoLigado(x.servico));
  return r?funcaoDeTopo(r.nome):null;
}
/* As opções que outros serviços, ligados, acrescentam ao menu de toque longo
   de um prefixo — «Novo contrato» no menu de um imóvel vem dos Contratos.
   Recebe: prefixo — a primeira parte do data-lp; a — as partes do valor
   (o array que o handler recebe).
   Devolve: um array de {label, icon, act}, possivelmente vazio. */
function lpExtrasDe(prefixo,a){
  const out=[];
  (REGISTO.lpExtras[prefixo]||[]).forEach(r=>{
    if(!servicoLigado(r.servico))return;
    const f=funcaoDeTopo(r.nome);if(!f)return;
    /* um serviço que rebenta não parte o menu dos outros — mas também não
       desaparece sem rasto: fica na consola, com o serviço e a função */
    let itens=null;
    try{itens=f(a)}catch(e){itens=null;try{console.error('lpExtras «'+r.nome+'» ('+r.servico+') rebentou no menu de «'+prefixo+'»:',e)}catch(x){}}
    (itens||[]).forEach(it=>{if(it&&it.label)out.push(it)});
  });
  return out;
}
/* A análise de um separador (a contagem dos filtros próprios, o limpar, e o
   painel próprio de quem o tem), se o serviço está ligado.
   Recebe: tab — o id do separador.
   Devolve: {n, limpar, alternar, aberto, fechar} com funções (ou null em
   cada uma), ou null quando o separador não regista análise. */
function analiseDe(tab){
  const r=REGISTO.analise[tab];
  if(!r||!servicoLigado(r.servico))return null;
  return {n:funcaoDeTopo(r.n),limpar:funcaoDeTopo(r.limpar),alternar:funcaoDeTopo(r.alternar),aberto:funcaoDeTopo(r.aberto),fechar:funcaoDeTopo(r.fechar)};
}
/* Fecha, no estado, os painéis de filtros próprios dos serviços que os têm
   (o dos movimentos). Quem chama é fecharFiltros, ao mudar de separador.
   Devolve: nada — só o estado; o render seguinte pinta-os fechados. */
function fecharFiltrosDosServicos(){
  Object.keys(REGISTO.analise).forEach(t=>{const f=funcaoDeTopo(REGISTO.analise[t].fechar);if(f)f()});
}
/* Avisa cada serviço registado de que o separador mudou, para arrumar o que
   é passageiro (o donut aberto na visão geral). Ligado ou não: arrumar não
   custa e evita restos.
   Devolve: nada. */
function aoMudarDeSeparador(){
  Object.keys(REGISTO.manifestos).forEach(id=>{const f=funcaoDeTopo(REGISTO.manifestos[id].aoMudar);if(f)f()});
}
/* O ecrã de um separador cujo serviço está desligado nesta conta: chega-se
   aqui por um endereço guardado ou por um atalho antigo. Diz o nome, diz
   quem liga, e não julga.
   Recebe: tab — o id do separador.
   Devolve: o HTML do .empty (string). */
function servicoDesligadoHtml(tab){
  const id=servicoDoSeparador(tab)||tab,nome=nomeDoServico(id);
  return `<div class="empty"><b>${esc(nome)} está desligado nesta conta</b>Este serviço não está ativo para ti. ${QUEM_LIGA}
    <div class="toolbar u-jc-center u-mt-16px"><button type="button" class="btn primary" data-toca="ecra" data-click="go(primeiroSeparadorLigado())">Voltar</button></div></div>`;
}
/* Os separadores cuja vista falhou e já foram relatados, para o relato sair
   uma vez e não a cada pintura (o render corre de três em três minutos). */
const _vistasPartidas={};
/* O ecrã de um separador cujo serviço está LIGADO e cuja vista não resolve: um
   defeito da app, e não uma escolha do suporte. Acontece quando o ficheiro do
   serviço não carregou, ou quando uma vista registada deixou de ser uma função
   que o window vê — um `function vX(){}` passado a `const vX=()=>`, que o
   funcaoDeTopo não encontra. Dizer «está desligado nesta conta» era mentir a
   quem lê e esconder o erro de quem programa: diz-se que não carregou, e
   relata-se uma vez (na consola sempre; ao servidor pelo reportErr da nuvem,
   cloud/ajuda.js, quando ela existe).
   Recebe: tab — o id do separador.
   Devolve: o HTML do .empty (string). */
function vistaNaoCarregouHtml(tab){
  const r=REGISTO.vistas[tab],nome=r?r.nome:'',chave=tab+'|'+nome;
  if(!_vistasPartidas[chave]){
    _vistasPartidas[chave]=1;
    const msg='A vista do separador «'+tab+'» não resolve: '+(nome?'«'+nome+'» não é uma função de topo':'nenhum serviço a registou');
    try{console.error(msg)}catch(e){}
    if(typeof reportErr==='function')try{reportErr(msg,'servicos.js:vistaNaoCarregouHtml')}catch(e){}
  }
  const t=(typeof TABS!=='undefined'?TABS:[]).find(x=>x.id===tab);
  return `<div class="empty"><b>${esc(servicoDoSeparador(tab)?nomeDoServico(tab):(t?t.label:tab))} não carregou</b>É um problema da app, e não da tua conta. Recarregar costuma resolver.
    <div class="toolbar u-jc-center u-mt-16px"><button type="button" class="btn primary" data-toca="ecra" data-click="recarregarApp()">Recarregar</button></div></div>`;
}
/* Recarrega a página — o botão «Recarregar» do ecrã de uma vista que não
   carregou. Era um location.reload() em linha, e o location é do browser: a
   gramática das ações não o deixa passar, e uma função com nome é também o
   único sítio onde isto se pode ler.
   Recebe: nada.
   Devolve: nada — a página recomeça. */
function recarregarApp(){location.reload()}
/* A frase para um botão que ficou escondido porque o serviço que ele abre
   está desligado. É a mesma que o servidor devolve ao recusar.
   Recebe: id — o id do serviço.
   Devolve: a frase (string). */
function hintServicoDesligado(id){return 'O serviço '+nomeDoServico(id)+' está desligado nesta conta.'}
/* Quem liga um serviço, dito sempre da mesma maneira e sem juízo. Uma frase
   só, para mudar num sítio: estava escrita à mão em seis vazios. */
const QUEM_LIGA='O suporte pode ligá-lo quando quiseres.';
/* A frase de um serviço desligado com quem o liga, para o meio de um texto (o
   vazio da visão geral, as notas da Declaração).
   Recebe: id — o id do serviço.
   Devolve: a frase (texto). */
function fraseServicoDesligado(id){return hintServicoDesligado(id)+' '+QUEM_LIGA}
/* A mesma frase numa nota, para o fim de um vazio cuja saída levava a um
   serviço desligado: o botão não se escreve, e a nota diz porquê.
   Recebe: id — o id do serviço.
   Devolve: o HTML da nota (.hint). */
function vazioServicoDesligado(id){return `<div class="hint u-mt-9px">${esc(fraseServicoDesligado(id))}</div>`}
/* Chama uma função de outro serviço só se ele está ligado; senão avisa e
   não faz nada. É a guarda das chamadas cruzadas (abrir a ficha de um
   contrato a partir de um inquilino, registar uma renda a partir de um
   contrato…).
   Recebe: id — o id do serviço dono da função; nome — o nome da função de
   topo da app; args — os argumentos (o resto).
   Devolve: o que a função devolver; undefined quando não correu; rebenta
   com um Error «ação: recusado: …» quando o nome não é de uma função da app
   (uma nativa como o fetch, um nome do browser, um posto depois do arranque). */
function chamarServico(id,nome,...args){
  if(!servicoLigado(id)){if(typeof toast==='function')toast(hintServicoDesligado(id));return undefined}
  const f=funcaoDeTopo(nome,true);
  if(!f){if(typeof toast==='function')toast('Essa ação não está disponível.');return undefined}
  return f.apply(null,args);
}
