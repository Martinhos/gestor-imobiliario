/* ================= DADOS ================= */
/* O que o «Guardar» (e o Enter) da janela aberta pelo promptModal faz: lê o
   campo, fecha a janela e entrega o texto ao cb dela. Cada promptModal
   troca-o, e o botão chama _pm(). É um var de topo para estar na lista dos
   nomes da app (eventos.js), que fecha no arranque: um window._pm posto
   dentro da função era recusado pelas ações. */
var _pm=null;
/* O «Escolher ficheiro» abre o seletor de ficheiros escondido (#swFile). Era
   um onclick com document.getElementById('swFile').click(), e o document não
   é um nome da app: fica fora da gramática das ações (eventos.js). Faz o
   mesmo, com o mesmo id fixo — sem o elemento, rebenta como rebentava.
   Recebe: nada.
   Devolve: nada — abre o seletor de ficheiros do sistema. */
function swEscolherFicheiro(){document.getElementById('swFile').click()}
/* Um instante (milissegundos) como se escreve uma data em Portugal, no fuso
   deste aparelho: o fim de um convite, o dia de uma importação.
   Recebe: ms — o instante (número; texto com dígitos também serve).
   Devolve: «dd/mm/aaaa» (texto), ou '' sem instante válido. */
function dataDoInstante(ms){
  const n=Number(ms);if(!(n>0))return '';
  const d=new Date(n),dois=x=>String(x).padStart(2,'0');
  return dois(d.getDate())+'/'+dois(d.getMonth()+1)+'/'+d.getFullYear();
}
/* A última importação do Splitwise, para o botão de a anular dizer o que
   anula: quantos movimentos e de que dia. Cada importação é um lote com o id
   'b' + o instante em que se fez (splitwise.js:swDo), e o undoImport anula o
   mais recente — o mesmo que se conta aqui.
   Recebe: nada.
   Devolve: {n, data} — data em «dd/mm/aaaa», ou '' num id antigo —, ou null sem importações. */
function ultimaImportacao(){
  const lotes=[...new Set(db.transactions.filter(t=>t.batch).map(t=>t.batch))].sort(),ult=lotes[lotes.length-1];
  if(!ult)return null;
  return {n:db.transactions.filter(t=>t.batch===ult).length,data:dataDoInstante(String(ult).slice(1))};
}
/* A subpágina «Importar e cópias» (o canvas de 2026-10, D-DefDados): a cópia de
   segurança e a exportação lado a lado; a importação do Splitwise — escolher o
   ficheiro ou colar o texto, com o imóvel, a quota-parte e a pré-visualização
   na janela seguinte (splitwise.js:swMapModal), e o «Anular a última
   importação» a dizer quantos movimentos e de que dia —; e apagar todos os
   dados. Com sessão iniciada, apagar aqui apagava também na conta e nos
   outros aparelhos: o cartão diz porquê e dá as duas saídas certas (terminar
   a sessão, apagar a conta) em vez do botão. As cópias e as exportações levam
   só o que é teu (exportarSoMeu).
   Recebe: nada.
   Devolve: o HTML (texto) da subpágina, sem o Voltar. */
function vImport(){
  const fora=casasDeColaboracao().length>0,ult=ultimaImportacao();
  const anexo=servicoLigado('fisco');
  const ano=servicoLigado('fisco')?' '+fiscoAnoAtual():'';
  const sessao=!!(typeof window!=='undefined'&&window.CW&&CW.user);
  const copia=`<section class="card def-bloco"><h3>Cópia de segurança</h3>
    <p class="small">Um ficheiro com toda a base: imóveis, contratos, pessoas, movimentos e definições. Fotos e documentos não vão na cópia.</p>
    <div class="def-botoes"><button class="btn primary" data-toca="nada" data-click="exportarSoMeu(driveSave)">${ic('down',18)} Guardar cópia</button>
      <button class="btn" data-toca="camada" data-click="driveOpen()">Repor uma cópia</button>
      ${typeof window!=='undefined'&&window.Android?`<button class="btn ghost" data-toca="camada" data-click="bkPasteBox()">Colar cópia</button>`:''}</div>
    <p class="small">Repor substitui tudo o que está na app e mostra antes quantos registos traz.</p></section>`;
  const exportar=`<section class="card def-bloco"><h3>Exportar</h3>
    <p class="small">CSV que abre no Excel com os acentos certos.</p>
    <div class="def-botoes"><button class="btn" data-toca="nada" data-click="exportarSoMeu(downloadCsv)">Movimentos (CSV)</button>
      ${anexo?`<button class="btn" data-toca="nada" data-click="exportarSoMeu(fiscoCsv)">Anexo F${esc(ano)} (CSV)</button>`:''}</div>
    ${fora?'<p class="small">Imóveis onde só colaboras ficam de fora da cópia e da exportação.</p>':''}</section>`;
  const splitwise=`<section class="card def-bloco"><div class="def-bloco-cab"><h3>Importar do Splitwise</h3>
      ${ult?`<button class="btn sm ghost" data-toca="dados" data-risco="destroi" data-click="undoImport()">Anular a última importação (${ult.n} ${ult.n===1?'movimento':'movimentos'}${ult.data?', '+ult.data:''})</button>`:''}</div>
    <p class="small">No Splitwise: abre o grupo → <b>Export as spreadsheet</b> → guarda o CSV. A seguir escolhes o imóvel e a tua quota-parte, e vês as despesas antes de as importar.</p>
    <div class="def-ficheiro">
      <input type="file" id="swFile" class="u-d-none" data-change="swPick(this)">
      <button class="btn primary" data-toca="camada" data-click="swEscolherFicheiro()">Escolher ficheiro</button>
      <button class="btn" data-toca="camada" data-click="swPasteBox()">Colar o texto do CSV</button></div>
    <p class="small">Se o botão de escolher ficheiro não abrir nada, estás a ver a app fora do telemóvel — usa a opção de colar o texto.</p></section>`;
  const sair=sessao&&typeof CW.logout==='function'?`<button class="btn" data-toca="camada" data-click="CW.logout()">Terminar sessão</button>`:'';
  const apagarConta=sessao&&typeof CW.deleteAccount==='function'?`<button class="btn danger" data-toca="camada" data-risco="destroi" data-click="CW.deleteAccount()">Apagar a conta</button>`:'';
  const apagar=`<section class="card def-bloco def-perigo"><div class="def-perigo-txt"><h3>Apagar todos os dados</h3>
      <p class="small">${sessao
        ?'Tens sessão iniciada: apagar aqui apagava também na conta e nos teus outros aparelhos. Para limpar só este aparelho, termina a sessão e apaga depois. Para apagar tudo, apaga a conta.'
        :'Apaga imóveis, contratos, pessoas, movimentos e definições deste aparelho. Guarda antes uma cópia, se quiseres voltar a eles.'}</p></div>
    <div class="def-botoes">${sessao?sair+apagarConta:`<button class="btn danger" data-toca="dados" data-risco="destroi" data-click="wipe()">Apagar todos os dados</button>`}</div></section>`;
  return `<div class="def-par">${copia}${exportar}</div>${splitwise}${apagar}`;
}

/* Corre uma exportação (cópia de segurança, CSV) sobre a base só com o que é
   meu: os imóveis onde colaboro e os registos deles ficam de fora. As funções
   de copias.js leem a db global no momento da chamada, por isso troca-se a
   base durante a chamada e repõe-se logo a seguir — sem imóveis de
   colaboração, corre tal e qual.
   Recebe: fn — a função de exportar (sem argumentos), ex.: driveSave ou downloadCsv.
   Devolve: nada — o que fn devolver é ignorado. */
function exportarSoMeu(fn){
  if(!casasDeColaboracao().length)return void fn();
  const real=db;db=dbSoMeu();
  try{fn()}finally{db=real}
}

/* ================= DEFINIÇÕES ================= */
/* A cabeça de cada subpágina das Definições. No telemóvel é o Voltar, colado
   ao topo (nos documentos longos, os termos e a política, a meio de 300
   linhas não havia porta de saída à vista), que sobe à raiz. Os Colaboradores
   e os Grupos já não a têm: são separadores das Casas, com as abas da área
   por cima (navegacao.js:abasDaArea). No computador o Voltar some e fica a
   navegação lateral das Definições (navDasDefinicoes, o canvas de 2026-10:
   D-DefCategorias, D-DefDados), posta ao lado do conteúdo pela folha
   (estilos.css:.wrap:has(>.def-nav)). A Ajuda tem porta própria na barra
   lateral, e por isso fica sem a navegação das Definições.
   Recebe: nada (lê setPage).
   Devolve: o HTML (texto) do Voltar e da navegação lateral. */
function cabecaDaSubpagina(){
  const voltar=`<div class="toolbar def-voltar u-pos-sticky u-t-calc-57px-v-inset-top u-z-20 u-bg-v-bg u-p-8px-0 u-m-n6px-0-6px">
  <button class="btn" data-toca="ecra" data-click="goSet('')">${ic('chev',15)} Voltar</button></div>`;
  if(setPage==='ajuda')return voltar;
  try{return voltar+navDasDefinicoes()}catch(e){return voltar}
}
/* backRow: o que cada subpágina põe à cabeça — a da base e as da nuvem
   (cloud/partilha.js e cloud/novidades.js escrevem backRow+vCloud() e
   afins). Era um texto fixo, só com o Voltar; a navegação lateral muda com a
   página aberta e com o que cada conta vê, por isso o nome passou a ser lido
   na hora, pelo getter do window, sem nenhuma das subpáginas mudar. Num
   script clássico, um nome livre que não está declarado lê a propriedade do
   window — e um getter corre a cada leitura. */
Object.defineProperty(window,'backRow',{configurable:true,get:cabecaDaSubpagina});

/* Uma linha da subpágina «Valores por omissão»: o que é e para que serve à
   esquerda, o campo e a unidade à direita (o canvas, M-ValoresOmissao). O
   rótulo embrulha a linha inteira, para o campo ter nome e o toque em
   qualquer parte da linha o focar. Grava ao sair do campo, sem repintar
   (gravarValorPorOmissao), e não recusa o vazio: diz «Opcional».
   Recebe: o — {id, chave (a de db.settings), titulo, sub, valor, modo (o
   inputmode), unidade}.
   Devolve: o HTML (texto) da linha. */
function linhaDeValor(o){
  return `<label class="def-vr"><span class="def-vr-txt"><b>${esc(o.titulo)}</b><span class="small">${esc(o.sub)}</span></span>
    <span class="def-valor"><input id="${o.id}" type="text" inputmode="${o.modo}" value="${esc(o.valor)}" placeholder="Opcional" data-change="gravarValorPorOmissao(this,'${jsq(o.chave)}')"><span class="def-unidade">${esc(o.unidade)}</span></span></label>`;
}
/* O que cada valor por omissão vale a partir do que se escreveu: o aumento e
   a inflação são taxas (numTaxa: «2,5» é 2,5 e o vazio é 0); o horizonte
   fica entre 1 e 30 anos; o yield exigido é o do capTargetSet (avaliacao.js:
   maior que zero, e o vazio volta aos 5 %); o selo não desce de 0. */
const NORMA_DOS_VALORES={
  growth:t=>numTaxa(t),
  inflation:t=>numTaxa(t),
  years:t=>Math.min(30,Math.max(1,num(t))),
  capTarget:t=>Math.max(0.1,num(t)||5),
  stampPct:t=>Math.max(0,numTaxa(t))};
/* Grava um valor por omissão ao sair do campo, SEM repintar a página: o
   setSet repintava tudo, e o campo para onde a pessoa ia era destruído — o
   foco caía no body (no telemóvel o teclado fechava, e o Tab perdia o
   lugar). O campo passa a mostrar o valor que ficou gravado (o horizonte em
   branco passa a 1, o yield em branco volta a 5), para não mostrar uma
   coisa e a app guardar outra. Nada mais na página depende destes números.
   Recebe: campo — o campo (o this da ação); k — a chave em db.settings
   ('growth', 'inflation', 'years', 'capTarget' ou 'stampPct').
   Devolve: nada — grava e reescreve o campo. */
function gravarValorPorOmissao(campo,k){
  const f=NORMA_DOS_VALORES[k];if(!f||!campo)return;
  const v=f(campo.value);
  db.settings[k]=v;save();
  campo.value=k==='years'?String(v):dec(v);
}
/* Subpágina «Valores por omissão»: o aumento das rendas, a inflação, o
   horizonte das projeções, o yield exigido na avaliação (só com a Avaliação
   ligada) e o imposto do selo, em duas listas — as projeções e o resto.
   Cada campo grava logo ao sair, sem repintar (gravarValorPorOmissao), e
   nenhum recusa o vazio — por isso dizem «Opcional» (a regra dos
   formulários), e a nota do fim diz o que vale em branco: o aumento, a
   inflação e o selo contam 0 %, o horizonte 1 ano, o yield volta aos 5 %.
   Recebe: nada.
   Devolve: o HTML (texto) da subpágina, sem o Voltar. */
function vDefaults(){
  const s=db.settings;
  const proj=[
    {id:'def_growth',chave:'growth',titulo:'Aumento anual das rendas',sub:'Para contratos sem aumento próprio, nas projeções',valor:dec(s.growth),modo:'decimal',unidade:'%'},
    {id:'def_inflation',chave:'inflation',titulo:'Inflação das despesas',sub:'Faz crescer as despesas previstas',valor:dec(s.inflation),modo:'decimal',unidade:'%'},
    {id:'def_years',chave:'years',titulo:'Horizonte das projeções',sub:'Entre 1 e 30 anos',valor:s.years,modo:'numeric',unidade:'anos'}];
  const resto=(servicoLigado('reports')?[{id:'def_capTarget',chave:'capTarget',titulo:'Yield exigido na avaliação',sub:'O resultado anual de cada imóvel a dividir por este yield dá o valor por rendimento',valor:dec(s.capTarget),modo:'decimal',unidade:'%'}]:[])
    .concat([{id:'def_stamp',chave:'stampPct',titulo:'Imposto do selo sobre juros',sub:'Em cada prestação, salvo nas hipotecas com o selo desligado. Em Portugal é 4 %',valor:dec(s.stampPct??4),modo:'decimal',unidade:'%'}]);
  return `<p class="def-intro">Usados quando um contrato ou uma hipoteca não diz outra coisa. Gravam ao sair do campo.</p>
  <section class="card def-lista" aria-label="Projeções">${proj.map(linhaDeValor).join('')}</section>
  <section class="card def-lista" aria-label="Avaliação e crédito">${resto.map(linhaDeValor).join('')}</section>
  <p class="hint def-nota">Em branco, o aumento e a inflação contam 0 % e o horizonte 1 ano (no máximo 30); o selo em branco conta 0 %; e o yield exigido, que tem de ser maior que zero, em branco volta aos 5 %.</p>`;
}
/* A raiz das Definições, como dados. É uma só: a base declara as secções e as
   linhas dela, e a nuvem acrescenta as suas (linhaDefinicoes) — o perfil e a
   conta, a ajuda, as perguntas frequentes, as novidades, o aviso legal e a app
   no telemóvel. Chegou a haver duas: a da base e uma que a nuvem escrevia por
   cima dela; a da nuvem esqueceu «IRS e dedução» e «Filtros comuns», e a
   página dos filtros comuns ficou sem porta nenhuma na app a sério.
   As secções são as do canvas de 2026-10 (M-Definicoes): Conta, Dinheiro e
   IRS, App. Secções seguidas com o mesmo título juntam-se numa só lista
   (seccoesVisiveis): a «App» é a 'aplicacao', a 'ajuda' e o 'sobre', e os
   ids ficam porque a nuvem pendura lá as linhas dela.
   Uma linha é {sec, ordem, page, label, icon, sub, cracha, se} — abre a
   subpágina page (ou, com ir em vez de page, o separador onde a coisa vive);
   sub pode ser uma função, lida a cada pintura; cracha (opcional) é uma
   função que devolve o número do crachá; se (opcional) é uma função que diz
   se a linha aparece agora —, {sec, ordem, page, label, linha}, uma linha
   desenhada à parte (o Tema, com o segmentado na própria raiz), ou {sec,
   ordem, html}, um cartão inteiro (html é uma função que pode devolver '').
   As que têm page ou ir são também a navegação lateral do computador
   (navDasDefinicoes). A versão do cartão Sobre é a VERSAO do avisos.js (a
   primeira entrada, que nunca se escreve à mão); ele só carrega depois da
   primeira pintura do arranque (index.html), e até lá fica um traço. As
   categorias, as etiquetas e o IRS eram três linhas e três páginas; são uma
   só (vCats), como no canvas. */
const DEF_SECCOES=[['conta','Conta'],['dinheiro','Dinheiro e IRS'],['aplicacao','App'],['ajuda','App'],['sobre','App']];
/* O resumo da linha «Categorias, etiquetas e IRS»: as categorias de
   pagamento (as que vão ao Anexo F) e as etiquetas.
   Recebe: nada.
   Devolve: o texto. */
function resumoDasCategorias(){
  const c=Object.keys(cats()).length,t=(db.settings.tags||[]).length;
  return c+(c===1?' categoria':' categorias')+' de pagamento · '+t+(t===1?' etiqueta':' etiquetas');
}
/* O resumo da linha «Valores por omissão»: os quatro números que mais se
   usam, como estão agora.
   Recebe: nada.
   Devolve: o texto. */
function resumoDosValores(){
  const s=db.settings,anos=Number(s.years)||1;
  return 'Aumento '+dec(s.growth||0)+'% · inflação '+dec(s.inflation||0)+'% · '+anos+(anos===1?' ano':' anos')+' · selo '+dec(s.stampPct??4)+'%';
}
/* O resumo da linha «Filtros comuns»: o primeiro pelo nome e quantos mais.
   Recebe: nada.
   Devolve: o texto. */
function resumoDosFiltros(){
  const fs=db.settings.filters||[];
  return fs.length?'«'+fs[0].name+'»'+(fs.length>1?' e mais '+(fs.length-1):''):'Um conjunto de escolhas, aplicado num toque';
}
/* A secção Conta é toda da nuvem (o cartão do perfil e a Segurança,
   cloud/partilha.js): os Grupos viveram aqui, e desde 2026-10-22 são uma aba
   das Casas (navegacao.js:AREAS), com o crachá deles na aba e na gaveta. */
const DEF_LINHAS=[
  {sec:'dinheiro',ordem:10,page:'cats',label:'Categorias, etiquetas e IRS',icon:'tag',sub:resumoDasCategorias},
  {sec:'dinheiro',ordem:30,page:'defaults',label:'Valores por omissão',icon:'trend',sub:resumoDosValores},
  {sec:'dinheiro',ordem:40,page:'filtros',label:'Filtros comuns',icon:'filter',sub:resumoDosFiltros},
  {sec:'aplicacao',ordem:10,page:'tema',label:'Tema',linha:linhaDoTema},
  {sec:'aplicacao',ordem:20,page:'dados',label:'Importar e cópias',icon:'down',sub:'Cópia de segurança, CSV, Splitwise'},
  {sec:'sobre',ordem:50,html:()=>card('Rendorium','',`<div class="stat"><span>Versão</span><b>${typeof VERSAO!=='undefined'?esc(VERSAO):'—'}</b></div>
    <div class="stat"><span>Imóveis · contratos</span><b>${db.properties.length} · ${db.contracts.length}</b></div>
    <div class="stat"><span>Inquilinos · proprietários</span><b>${db.tenants.length} · ${db.owners.length}</b></div>
    <div class="stat u-b-0"><span>Movimentos</span><b>${db.transactions.length}</b></div>`)},
];
/* Acrescenta uma linha à raiz das Definições. É a porta da nuvem (e de quem
   vier depois): a linha entra na secção dela, pela ordem, sem reescrever a
   página de ninguém.
   Recebe: l — uma linha (ver DEF_LINHAS): {sec, ordem, page|ir, label, icon,
   sub, cracha?, se?}, {sec, ordem, page, label, linha} ou {sec, ordem, html}.
   Devolve: nada. */
function linhaDefinicoes(l){DEF_LINHAS.push(l)}
/* As linhas de uma secção, pela ordem delas, sem as que dizem que não se
   mostram agora (o se).
   Recebe: id — o id da secção (de DEF_SECCOES).
   Devolve: array de linhas de DEF_LINHAS. */
function linhasDaSeccao(id){
  return DEF_LINHAS.filter(l=>l.sec===id&&(typeof l.se!=='function'||l.se())).sort((a,b)=>a.ordem-b.ordem);
}
/* As secções como se veem: as de DEF_SECCOES com o mesmo título seguidas
   juntam-se numa (a «App» do canvas é a aplicação, a ajuda e o sobre — os ids
   ficam, porque a nuvem pendura linhas na 'ajuda' e no 'sobre'), e uma sem
   linhas não aparece (sem a nuvem, a Conta fica vazia e some).
   Recebe: nada.
   Devolve: array de {titulo, linhas}. */
function seccoesVisiveis(){
  const out=[];
  DEF_SECCOES.forEach(([id,titulo])=>{
    const ls=linhasDaSeccao(id);if(!ls.length)return;
    const ult=out[out.length-1];
    if(ult&&ult.titulo===titulo)ult.linhas=ult.linhas.concat(ls);else out.push({titulo,linhas:ls});
  });
  return out;
}
/* A ação de uma linha que leva a algum lado: a subpágina (goSet), ou o
   separador onde a coisa vive (go).
   Recebe: l — a linha.
   Devolve: o texto da ação (para um data-click). */
function acaoDaLinha(l){return l.ir?`go('${jsq(l.ir)}')`:`goSet('${jsq(l.page)}')`}
/* Uma linha da raiz que abre uma página: o ícone num quadrado, o título e o
   resumo por baixo, o crachá quando há o que ver, e a seta (o canvas,
   M-Definicoes). É um botão de verdade, numa lista com divisórias.
   Recebe: l — {page|ir, label, icon, sub (texto ou função), cracha (função, opcional)}.
   Devolve: o HTML (texto) da linha. */
function linhaDaRaiz(l){
  const sub=typeof l.sub==='function'?l.sub():l.sub,n=typeof l.cracha==='function'?Number(l.cracha())||0:0;
  return `<button type="button" class="linha def-linha" data-toca="ecra" data-click="${acaoDaLinha(l)}">
    <span class="ic">${ic(l.icon||'dots',20)}</span>
    <span class="txt"><b class="u-d-block">${esc(l.label)}</b>${sub?`<span class="small">${esc(sub)}</span>`:''}</span>
    ${n?`<span class="badge def-cracha">${n}</span>`:''}<span class="seta">${ic('chevR',20)}</span></button>`;
}
/* Uma linha solta, num cartão só dela, que abre uma subpágina das Definições
   — para as páginas que listam outras (o aviso legal: os termos e a
   política, cloud/ajuda.js:vLegal). O mesmo desenho das linhas da raiz.
   Recebe: title — o título da linha; sub — a linha pequena por baixo; icon — o
   nome do ícone (para ic); page — a chave da subpágina a abrir com goSet.
   Devolve: o HTML (texto) do cartão com a linha. */
function navRow(title,sub,icon,page){return `<div class="card def-lista">${linhaDaRaiz({page,label:title,sub,icon})}</div>`}
/* A linha do Tema, na própria raiz (o canvas): o automático, o claro e o
   escuro num segmentado, que grava ao tocar e vale só neste aparelho; por
   cima, o que o automático está a resolver agora, e o toque leva à página do
   Tema, que explica o que fazer quando o browser não passa a preferência do
   sistema (vTema). No Samsung Internet em automático, por baixo, a nota de
   onde se muda (notaDoSamsung), ligada ao segmentado por aria-describedby.
   Recebe: nada.
   Devolve: o HTML (texto) da linha. */
function linhaDoTema(){
  const t=db.settings.theme||'auto';
  const sub=t==='auto'?'O sistema está em '+(mq().matches?'escuro':'claro'):'Vale só neste aparelho';
  const op=[['auto','Automático'],['light','Claro'],['dark','Escuro']];
  const nota=notaDoSamsung(t);
  return `<div class="def-tema">
    <button type="button" class="def-tema-cab" data-toca="ecra" data-click="goSet('tema')"><b class="u-d-block">Tema</b><span class="small">${esc(sub)}</span><span class="seta">${ic('chevR',18)}</span></button>
    <div class="segm" role="radiogroup" aria-label="Tema"${nota?' aria-describedby="defTemaSamsung"':''}>${op.map(([v,r])=>`<button type="button" id="defTema_${v}" role="radio" aria-checked="${t===v}" class="${t===v?'on':''}" data-toca="dados" data-click="temaEscolher('${jsq(v)}')">${r}</button>`).join('')}</div>${nota}</div>`;
}
/* A app está a correr no Samsung Internet? O UA dele diz «SamsungBrowser»
   (no telemóvel e no DeX); o WebView da app Android não, e lá o
   escurecimento à força já vem desligado.
   Recebe: nada (lê o navigator.userAgent).
   Devolve: verdadeiro no Samsung Internet. */
function eSamsungInternet(){
  try{return /\bSamsungBrowser\//.test(String(navigator.userAgent||''))}catch(e){return false}
}
/* A nota do Samsung Internet na linha do Tema. Com o telemóvel em escuro, o
   browser da Samsung responde à página que está em claro e escurece-a à força
   (o «modo escuro» dele, que não olha ao color-scheme): com o tema em
   Automático a app aparece clara, ou num escuro que não é o dela. Só lá e só
   em Automático — no Claro e no Escuro a escolha já não depende do browser.
   Recebe: t — o tema escolhido ('auto', 'light' ou 'dark').
   Devolve: o HTML (texto) da nota, ou '' fora desse caso. */
function notaDoSamsung(t){
  if(t!=='auto'||!eSamsungInternet())return '';
  return `<p class="def-tema-samsung" id="defTemaSamsung">O Samsung Internet escurece as páginas à força e a app pode aparecer clara. Em <b>Samsung Internet → Definições → Labs → Usar o tema escuro do site</b>, a app passa a seguir o telemóvel; ou escolhe <b>Escuro</b> aqui.</p>`;
}
/* Escolhe o tema no segmentado da raiz. O setTheme repinta a vista, e o
   botão onde estava o foco era destruído: quem usa o teclado ou o leitor de
   ecrã ficava no body. O foco volta ao botão escolhido, como nos segmentados
   das categorias e dos grupos.
   Recebe: v — 'auto', 'light' ou 'dark'.
   Devolve: nada — grava o tema, repinta e devolve o foco. */
function temaEscolher(v){
  if(v!=='auto'&&v!=='light'&&v!=='dark')return;
  setTheme(v);
  const b=document.getElementById('defTema_'+v);
  if(b)try{b.focus({preventScroll:true})}catch(e){}
}
/* A raiz das Definições (o canvas de 2026-10, M-Definicoes): Conta, Dinheiro
   e IRS, App. Cada secção com o rótulo e as linhas numa lista com
   divisórias; um cartão inteiro de uma linha {html} (o perfil, o Sobre, a app
   no telemóvel) fica à parte, entre as listas. No fim, com sessão, «Terminar
   sessão». No computador as secções correm em duas colunas.
   Recebe: nada.
   Devolve: o HTML (texto). */
function raizDasDefinicoes(){
  const secs=seccoesVisiveis().map(s=>{
    const partes=[];let lista=[];
    const fecha=()=>{if(lista.length)partes.push(`<div class="card def-lista">${lista.join('')}</div>`);lista=[]};
    s.linhas.forEach(l=>{
      if(l.html){const h=l.html();if(h){fecha();partes.push(h)}return}
      lista.push(l.linha?l.linha():linhaDaRaiz(l));
    });
    fecha();
    return partes.length?`<section class="def-sec"><h2 class="def-sec-tit">${esc(s.titulo)}</h2>${partes.join('')}</section>`:'';
  }).join('');
  const sair=typeof window!=='undefined'&&window.CW&&CW.user&&typeof CW.logout==='function'
    ?`<button type="button" class="btn def-sair" data-toca="camada" data-click="CW.logout()">Terminar sessão</button>`:'';
  return `<div class="def-raiz">${secs}${sair}</div>`;
}
/* A página das Definições aberta, para a navegação lateral a acender: o IRS
   e as etiquetas são a página das categorias; os termos e a política vivem
   no aviso legal.
   Recebe: nada (lê setPage).
   Devolve: a chave da página (texto). */
function paginaDasDefinicoes(){
  if(setPage==='irs'||setPage==='tags')return 'cats';
  if(setPage==='termos'||setPage==='privacidade')return 'legal';
  return setPage||'';
}
/* A navegação lateral das Definições, no computador (o canvas, D-DefCategorias):
   as mesmas secções e linhas da raiz, só as que abrem uma página, com a aberta
   acesa. A Ajuda fica de fora: tem porta própria na barra lateral.
   Recebe: nada.
   Devolve: o HTML (texto) do <nav>. */
function navDasDefinicoes(){
  const atual=paginaDasDefinicoes();
  const grupos=seccoesVisiveis().map(s=>{
    const itens=s.linhas.filter(l=>(l.page||l.ir)&&l.page!=='ajuda').map(l=>{
      const on=!!l.page&&l.page===atual,n=typeof l.cracha==='function'?Number(l.cracha())||0:0;
      return `<button type="button" class="def-nav-item${on?' on':''}"${on?' aria-current="page"':''} data-toca="ecra" data-click="${acaoDaLinha(l)}"><span>${esc(l.label)}</span>${n?`<span class="badge def-cracha">${n}</span>`:''}</button>`;
    }).join('');
    return itens?`<p class="lbl">${esc(s.titulo)}</p>${itens}`:'';
  }).join('');
  return `<nav class="def-nav" aria-label="Definições">${grupos}</nav>`;
}
/* A subpágina do Tema: claro, escuro ou o do telemóvel. O subtítulo do
   automático diz o que ele está a resolver agora — sem isso, um browser que
   não passa a preferência do sistema parece um erro da app —, e quando o
   browser diz «claro» explica onde se muda no da Samsung. Vale só neste
   aparelho. Viveu na nuvem, e é da base: o tema não precisa de conta.
   Recebe: nada.
   Devolve: o HTML (texto) da subpágina, sem o Voltar. */
function vTema() {
  var t = db.settings.theme;
  return card('Tema', 'Como a app se apresenta',
    '<div class="seg c3">' +
    // o subtítulo do automático diz o que ele está a resolver agora: sem
    // isso, um browser que não passa a preferência do sistema parece um
    // erro da app
    [['auto', 'auto', 'Automático', 'agora: ' + (mq().matches ? 'escuro' : 'claro')],
      ['light', 'sun', 'Claro', ''], ['dark', 'moon', 'Escuro', '']]
      .map(function (o) {
        return '<button type="button" class="opt ' + (t === o[0] ? 'on' : '') + '" data-toca="dados" data-click="setTheme(\'' + o[0] + '\')">' +
          '<span class="ic">' + ic(o[1], 18) + '</span><b>' + o[2] + '</b>' +
          (o[3] ? '<small>' + o[3] + '</small>' : '') + '</button>';
      }).join('') + '</div>' +
    '<div class="hint u-mt-11px">Vale só neste aparelho.</div>' +
    (t === 'auto' && !mq().matches
      ? '<div class="hint u-mt-9px">O automático segue o que o browser diz preferir, e este está a dizer <b>claro</b>. ' +
        'Se tens o aparelho em escuro, é o browser que não está a passar a preferência. No browser da Samsung há duas opções, ' +
        'e o modo escuro sozinho pode não chegar: <b>Definições → Visualização e deslocamento de página → Modo escuro</b>, e ' +
        '<b>Definições → Labs → Usar o tema escuro do site</b>. Se mesmo assim ficar em claro, escolhe <b>Escuro</b> aqui — ' +
        'essa opção não depende do browser e funciona sempre.</div>'
      : ''));
}
/* Os títulos e os subtítulos das subpáginas da base, como o canvas de 2026-10
   as chama — o cabeçalho lê-os de SUBPAGE (vistas.js:render). As categorias,
   as etiquetas e o IRS são uma página só; o 'irs' guarda o nome dele, porque é
   por ele que a página do IRS · Anexo F manda cá (fisco.js). */
Object.assign(SUBPAGE,{
  cats:{label:'Categorias, etiquetas e IRS',sub:'Como arrumas os movimentos e em que coluna do Anexo F cai cada despesa'},
  tags:{label:'Categorias, etiquetas e IRS',sub:'Como arrumas os movimentos e em que coluna do Anexo F cai cada despesa'},
  defaults:{label:'Valores por omissão',sub:'Quando um contrato ou uma hipoteca não diz outra coisa'},
  dados:{label:'Importar e cópias',sub:'Os teus dados à mão: uma cópia, o CSV para o Excel e as despesas do Splitwise'}});
/* Vista principal das Definições: com setPage preenchido devolve a subpágina
   respetiva (com a cabeça das subpáginas: o Voltar no telemóvel, a navegação
   lateral no computador — backRow); sem ele, a raiz (raizDasDefinicoes). A
   nuvem embrulha esta função só para as subpáginas dela (cloud/partilha.js,
   cloud/novidades.js). O IRS e as etiquetas são a página das categorias
   (vCats) — o 'irs' abre-a nos pagamentos, que é onde está a coluna do
   Anexo F; os caminhos que a app ensina (fisco.js) continuam a abrir. A
   subpágina antiga dos Grupos já não tem porta (são uma aba das Casas, e o
   goSet('groups') leva lá — navegacao.js:goSet, cloud/nucleo.js:goSet e
   restorePage): quem lá chegar por outro caminho velho vê na mesma os
   grupos, com o Voltar das subpáginas, em vez da raiz sem explicação.
   Recebe: nada (lê setPage).
   Devolve: o HTML (texto) da raiz ou da subpágina ativa. */
function vSettings(){
  if(setPage==='tema')return backRow+vTema();
  if(setPage==='defaults')return backRow+vDefaults();
  if(setPage==='cats'||setPage==='tags')return backRow+vCats();
  if(setPage==='irs')return backRow+vCats('cats');
  if(setPage==='groups')return backRow+vGrupos();
  if(setPage==='filtros')return backRow+vFiltrosComuns();
  if(setPage==='dados')return backRow+vImport();
  return raizDasDefinicoes();
}
/* cada árvore serve um grupo de tipos: receitas (rendas, dívidas recebidas) ou pagamentos (despesas, prestações, dívidas pagas)
   Recebe: tk — a árvore ('cats' ou 'catsIn').
   Devolve: os movimentos cujo tipo usa essa árvore (array). */
const treeTx=tk=>db.transactions.filter(t=>treeKey(t.kind)===tk);
/* A árvore de categorias à vista na página das categorias: os pagamentos
   ('cats', a que vai ao Anexo F, e a primeira — o canvas) ou as receitas
   ('catsIn'). Vive enquanto a app está aberta. */
let defArvore='cats';
/* As categorias com as subcategorias abertas, por 'árvore|categoria': abrir
   uma não repinta a página (defCatAbrir), e um render a seguir lembra-se. */
const defCatAbertas={};
/* Troca a árvore à vista (o segmentado Pagamentos/Receitas). Muda só o que se
   vê: repinta, e o foco volta ao segmentado. Vindo do 'irs' ou das
   'etiquetas', a página passa a ser a das categorias, para o título dizer a
   mesma coisa que o resto.
   Recebe: tk — 'cats' ou 'catsIn'.
   Devolve: nada — repinta a vista. */
function defArvoreEscolher(tk){
  if(tk!=='cats'&&tk!=='catsIn')return;
  defArvore=tk;
  if(setPage==='irs'||setPage==='tags')setPage='cats';
  render();
  const b=document.getElementById('defArv_'+tk);if(b)try{b.focus({preventScroll:true})}catch(e){}
}
/* Abre ou fecha as subcategorias de uma categoria, no sítio (nada a gravar,
   nada a repintar) — e lembra-se, para a próxima pintura.
   Recebe: botao — o botão da seta (o this da ação); tk — a árvore; k — a categoria.
   Devolve: nada — mexe no DOM da linha e das subcategorias. */
function defCatAbrir(botao,tk,k){
  const chave=tk+'|'+k,on=!defCatAbertas[chave];
  if(on)defCatAbertas[chave]=true;else delete defCatAbertas[chave];
  botao.setAttribute('aria-expanded',String(on));
  const linha=botao.closest('.def-cat');if(linha)linha.classList.toggle('aberta',on);
  const subs=document.getElementById(botao.getAttribute('aria-controls'));if(subs)subs.hidden=!on;
}
/* «Mudar o nome…» de uma categoria (o ⋯ da linha): o nome atual no campo, e
   o renameCat trata do resto — recusa o vazio e um nome que já existe, e leva
   os movimentos e as escolhas guardadas para o nome novo.
   Recebe: tk — a árvore; k — o nome atual.
   Devolve: nada — abre o prompt. */
function mudarNomeCategoria(tk,k){
  promptModal('Mudar o nome da categoria','Nome da categoria',k,v=>renameCat(tk,k,v),tk==='catsIn'?'Alojamento local':'Jardim e piscina');
}
/* A coluna do Anexo F de uma categoria ou subcategoria, na tabela: o menu de
   escolha (sel) com o nome dito ao leitor de ecrã, e a cor que diz o que é —
   laranja no «Não dedutível», apagada na subcategoria que segue a categoria.
   Os menus chamam o setIrsMapa sem argumentos, que os lê pela posição
   (irsMapaChaves).
   Recebe: m — o mapa (irsMapa()); chaves — irsMapaChaves(); chave — 'Categoria'
   ou 'Categoria / Sub'; nome — o que se lê; opts — as opções do menu; sub —
   true numa subcategoria.
   Devolve: o HTML (texto). */
function colunaDoAnexo(m,chaves,chave,nome,opts,sub){
  const v=m[chave]||'',cl=v==='nao'?' nao':(!v&&sub?' herda':'');
  return `<label class="def-cat-col${cl}"><span class="def-oculto">Coluna no Anexo F de ${esc(nome)}</span>${sel('irsm_'+chaves.indexOf(chave),v,opts,'setIrsMapa','dados')}</label>`;
}
/* A tabela de uma árvore de categorias (o canvas, D-DefCategorias): por
   categoria, a seta das subcategorias, o nome, quantos movimentos a usam, a
   coluna do Anexo F (só nos pagamentos), o interruptor «Fora dos totais» e o
   ⋯ com mudar o nome, nova subcategoria e apagar; as subcategorias por baixo,
   recolhidas, com o mesmo. Uma subcategoria de uma categoria fora dos totais
   fica fora com ela: o interruptor dela aparece ligado e parado. No telemóvel
   cada linha parte-se em duas, com os rótulos à vista.
   Recebe: tk — 'cats' ou 'catsIn'.
   Devolve: o HTML (texto) do cartão. */
function tabelaDeCategorias(tk){
  const cs=db.settings[tk]||{},txs=treeTx(tk),irs=tk==='cats',ex=db.settings.exclude||{};
  const m=irs?irsMapa():{},chaves=irs?irsMapaChaves():[];
  const cols=IRS_COLUNAS.map(([v,label])=>({v,label}));
  const optCat=[{v:'',label:'Outros gastos (por omissão)'}].concat(cols),optSub=[{v:'',label:'Como a categoria'}].concat(cols);
  /* o interruptor vai num <label> com o rótulo: o toque no rótulo chega ao
     botão (é ele o controlo do label), e a área de toque cresce para lá dos
     28px do interruptor */
  const fora=(nome,on,acao,parado)=>`<label class="def-cat-fora"><span class="def-so-tel small" aria-hidden="true">Fora dos totais</span><button type="button" class="interruptor" role="switch" aria-checked="${on}" aria-label="Fora dos totais: ${esc(nome)}"${parado?' disabled title="Fora dos totais com a categoria"':` data-toca="dados" data-click="${acao}"`}></button></label>`;
  const nomes=Object.keys(cs);
  if(!nomes.length)return `<div class="empty"><b>Ainda não há categorias de ${irs?'pagamentos':'receitas'}</b>Cria a primeira, ou repõe as de origem.<div><button class="btn primary" data-toca="camada" data-click="addCat('${jsq(tk)}')">${ic('plus',18)} Nova categoria</button></div></div>`;
  const linhas=nomes.map((k,i)=>{
    const subs=cs[k]||[],aberta=!!defCatAbertas[tk+'|'+k],offCat=!!ex[excKey(tk,k)],n=txs.filter(t=>t.category===k).length;
    const qs=`'${jsq(tk)}','${jsq(k)}'`;
    const cab=`<div class="def-cat${aberta?' aberta':''}">
      <span class="def-cat-nome">${subs.length?`<button type="button" class="def-cat-abre" aria-expanded="${aberta}" aria-controls="defsub_${tk}_${i}" aria-label="Subcategorias de ${esc(k)}" data-toca="nada" data-click="defCatAbrir(this,${qs})">${ic('chevR',18)}</button>`:'<span class="def-cat-abre" aria-hidden="true"></span>'}<b>${esc(k)}</b></span>
      <span class="def-cat-n">${n}<span class="def-so-tel"> ${n===1?'movimento':'movimentos'}</span></span>
      ${irs?colunaDoAnexo(m,chaves,k,k,optCat,false):''}
      ${fora(k,offCat,`toggleExc(${qs})`,false)}
      <span class="def-cat-menu">${menu('dc_'+tk+'_'+i,[
        {label:'Mudar o nome…',icon:'pen',toca:'camada',act:`mudarNomeCategoria(${qs})`},
        {label:'Nova subcategoria',icon:'plus',toca:'camada',act:`addSub(${qs})`},
        {label:'Apagar categoria',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delCat(${qs})`}])}</span></div>`;
    const filhos=subs.map((sb,j)=>{
      const qsb=`${qs},'${jsq(sb)}'`,nsb=txs.filter(t=>t.category===k&&t.sub===sb).length;
      return `<div class="def-cat def-sub">
        <span class="def-cat-nome"><span>${esc(sb)}</span></span>
        <span class="def-cat-n">${nsb}<span class="def-so-tel"> ${nsb===1?'movimento':'movimentos'}</span></span>
        ${irs?colunaDoAnexo(m,chaves,k+' / '+sb,k+' › '+sb,optSub,true):''}
        ${fora(k+' › '+sb,offCat||!!ex[excKey(tk,k,sb)],`toggleExc(${qsb})`,offCat)}
        <span class="def-cat-menu">${menu('ds_'+tk+'_'+i+'_'+j,[
          {label:'Mudar o nome…',icon:'pen',toca:'camada',act:`renameSub(${qsb})`},
          {label:'Apagar subcategoria',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delSub(${qsb})`}])}</span></div>`;
    }).join('');
    return cab+(subs.length?`<div class="def-subs" id="defsub_${tk}_${i}"${aberta?'':' hidden'}>${filhos}</div>`:'');
  }).join('');
  return `<section class="card def-tabela${irs?'':' sem-irs'}" aria-label="Categorias de ${irs?'pagamentos':'receitas'}">
    <div class="def-cat def-cat-tit" aria-hidden="true"><span>Categoria</span><span>Movimentos</span>${irs?'<span>Coluna no Anexo F</span>':''}<span>Fora dos totais</span><span></span></div>
    ${linhas}</section>`;
}
/* O cartão das etiquetas, na página das categorias: cada uma com quantos
   movimentos a usam e o × para a apagar (o delTag confirma com o impacto), e
   «Nova etiqueta». A «Recorrente» tem um sentido na app — a despesa já está
   prevista pelos planeados, e não conta como de uma vez nas projeções
   (tipos.js:despesaRepete) —, e a nota di-lo quando ela existe.
   Recebe: nada.
   Devolve: o HTML (texto) do cartão. */
function cartaoDasEtiquetas(){
  const tg=db.settings.tags||[],uso=g=>db.transactions.filter(t=>(t.tags||[]).indexOf(g)>-1).length;
  return `<section class="card def-bloco" id="defEtiquetas"><div class="def-bloco-cab"><h3>Etiquetas</h3>
      <button class="btn sm" data-toca="camada" data-click="addTag()">${ic('plus',16)} Nova etiqueta</button></div>
    ${tg.length?`<div class="def-etiquetas">${tg.map(g=>`<span class="def-etiqueta">${esc(g)} <span class="n">${uso(g)}</span><button type="button" aria-label="Apagar a etiqueta ${esc(g)}" data-toca="dados" data-risco="destroi" data-click="delTag('${jsq(g)}')">${ic('x',14)}</button></span>`).join('')}</div>`
      :'<p class="small">Ainda não há etiquetas.</p>'}
    <p class="small">Marcas livres, para cruzares com qualquer categoria.${tg.indexOf('Recorrente')>-1?' «Recorrente» marca uma despesa como já prevista pelos planeados: não conta como despesa de uma vez nas projeções.':''}</p></section>`;
}
/* O que o artigo 41.º do CIRS deixa deduzir, em três linhas (o canvas):
   dedutível, não dedutível e o que depende, com o que a lei pede de cada
   gasto. É a regra por omissão: a coluna escolhida na ficha de uma despesa
   manda sobre a da categoria (irs.js:irsColunaDe).
   Recebe: nada.
   Devolve: o HTML (texto) do cartão. */
function cartaoDoArt41(){
  return `<section class="card def-bloco def-art41"><h3>O que o art. 41.º do CIRS deixa deduzir</h3>
    <p><b class="pos">Dedutível:</b> conservação e manutenção, condomínio, IMI, imposto do selo do contrato, taxas autárquicas, seguro de renda, comissão da imobiliária, certificado energético.</p>
    <p><b class="neg">Não dedutível:</b> juros e outros gastos do crédito, depreciações, mobiliário, eletrodomésticos, decoração, o Adicional ao IMI (abate ao imposto, no quadro 9) e beneficiações — uma cozinha nova, uma remodelação que acrescenta valor.</p>
    <p><b class="amber">Depende:</b> o seguro multirriscos facultativo e a água, a luz e o gás pagos por ti — na dúvida, segundo a AT.</p>
    <p class="small">Conta o que pagaste enquanto o imóvel esteve arrendado, com fatura com o teu NIF e a identificação do imóvel. A coluna escolhida na ficha de uma despesa manda sobre a da categoria; a página do IRS · Anexo F diz quais caíram em «Outros gastos» só por omissão.</p></section>`;
}
/* A página «Categorias, etiquetas e IRS» (o canvas de 2026-10,
   D-DefCategorias): as duas árvores num segmentado — Pagamentos e Receitas,
   com quantas categorias cada —, «Repor as de origem» e «Nova categoria»
   (na árvore à vista); a tabela (tabelaDeCategorias), com a coluna do Anexo F
   nos pagamentos; e, lado a lado, as etiquetas e o que o artigo 41.º deixa
   deduzir. Eram três páginas: os tipos de movimento, o IRS e as etiquetas.
   Recebe: forcar (opcional) — 'cats' ou 'catsIn', a árvore a mostrar (o
   'irs' abre nos pagamentos); sem ele, a que estava à vista.
   Devolve: o HTML (texto) da página, sem o Voltar. */
function vCats(forcar){
  const tk=forcar==='cats'||forcar==='catsIn'?forcar:(defArvore==='catsIn'?'catsIn':'cats');
  const aba=(k,r)=>`<button type="button" id="defArv_${k}" class="${tk===k?'on':''}" aria-pressed="${tk===k}" data-toca="vista" data-click="defArvoreEscolher('${jsq(k)}')">${r} <span class="n">${Object.keys(db.settings[k]||{}).length}</span></button>`;
  return `<div class="def-cab">
    <div class="segm def-abas" role="group" aria-label="Árvore de categorias">${aba('cats','Pagamentos')}${aba('catsIn','Receitas')}</div>
    <span class="def-cab-acoes"><button class="btn ghost" data-toca="dados" data-risco="destroi" data-click="resetCats()">Repor as de origem</button>
    <button class="btn primary" data-toca="camada" data-click="addCat('${jsq(tk)}')">${ic('plus',18)} Nova categoria</button></span></div>
  ${tabelaDeCategorias(tk)}
  <p class="hint def-nota">O número é quantos movimentos usam a categoria. Apagar uma categoria não apaga movimentos — ficam sem categoria. «Fora dos totais» deixa-os na lista, mas não somam.</p>
  ${tk==='cats'?`<div class="def-repor"><button type="button" class="def-ligacao" data-toca="dados" data-risco="destroi" data-click="resetIrsMapa()">Repor as colunas do Anexo F</button></div>`:''}
  <div class="def-par">${cartaoDasEtiquetas()}${cartaoDoArt41()}</div>`;
}
/* ===== grupos ===== */
const GKIND={prop:{label:'Imóveis',icon:'building',one:'imóvel'},owner:{label:'Proprietários',icon:'crown',one:'proprietário'},contract:{label:'Contratos',icon:'contract',one:'contrato'}};
// Nome legível de um membro de grupo a partir do tipo e do id; '' se já não existir.
// Num proprietário, o meu leva « (eu)» (acessos.js:rotuloDoDono): nos chips e no cartão.
// Recebe: kind — o tipo do grupo: 'prop', 'owner' ou 'contract'; id — o id do membro.
// Devolve: o nome (texto); '' se o membro já não existir.
function gMemberName(kind,id){
  if(kind==='prop')return propName(id);
  if(kind==='owner')return rotuloDoDono(owner(id),db.owners.length);
  const c=contract(id);return c?ctName(c):'';
}
/* A nuvem dos grupos partilhados está carregada? A base não conhece a nuvem
   por garantia (cloud/grupos.js carrega depois, e os testes da base correm
   sem ela): um grupo _partilhado só existe com ela, e as portas para as
   janelas dela (CW.grupoModal, CW.grupoPartilhar, CW.grupoNovo) só se
   escrevem quando ela está.
   Devolve: true com cloud/grupos.js carregado. */
function nuvemDosGrupos(){return typeof window!=='undefined'&&!!window.CW&&typeof CW.grupoModal==='function'}
/* Posso partilhar grupos de imóveis agora: com a nuvem dos grupos, com
   sessão e com o serviço Colaboradores ligado nesta conta — as três
   condições do servidor (worker/src/rotas/grupos.js). Decide o que vem do
   servidor no separador dos Imóveis (vGroups): «Novo grupo partilhado» e os
   pedidos que fiz para entrar. O «Partilhar» de cada grupo não depende
   disto: está sempre que a nuvem dos grupos está, e o toque diz o que falta
   (cloud/grupos.js:CW.grupoPartilhar).
   Recebe: nada.
   Devolve: true se posso. */
function podePartilharGrupos(){return nuvemDosGrupos()&&!!CW.user&&servicoLigado('colaboradores')}
/* O tipo de grupo à vista no separador Grupos (o segmentado Imóveis,
   Proprietários, Contratos — o canvas, M-Grupos). Vive enquanto a app está
   aberta. */
let grpTipo='prop';
/* Troca o tipo de grupo à vista. Muda só o que se vê: repinta, e o foco volta
   ao segmentado.
   Recebe: k — 'prop', 'owner' ou 'contract'.
   Devolve: nada — repinta a vista. */
function grupoTipoEscolher(k){
  if(!GKIND[k])return;
  grpTipo=k;render();
  const b=document.getElementById('grpTipo_'+k);if(b)try{b.focus({preventScroll:true})}catch(e){}
}
/* O cartão de um grupo privado: o nome, «Privado» nos de imóveis (os únicos
   que se partilham), os membros por extenso, e os botões — «Editar» (a
   janela de edição, groupModal) e, num grupo de imóveis, «Partilhar», que
   está SEMPRE com a nuvem dos grupos carregada: com sessão ou sem ela, com
   imóveis meus ou sem eles, o toque (cloud/grupos.js:CW.grupoPartilhar) diz
   o que falta em cada caso. Chegou a esconder-se, e quem só tinha grupos
   assim não sabia porquê. Sem a nuvem (a base sozinha) não há «Partilhar»:
   não haveria quem o atendesse.
   Recebe: g — o grupo.
   Devolve: o HTML (texto) do cartão. */
function cartaoDoGrupo(g){
  const k=g.kind,nomes=(g.ids||[]).map(id=>gMemberName(k,id)).filter(Boolean),n=(g.ids||[]).length;
  const partilhar=k==='prop'&&!g._partilhado&&nuvemDosGrupos();
  return `<section class="card grp-cartao">
    <div class="grp-cab"><h3>${esc(g.name)}</h3>${k==='prop'?'<span class="badge grey">Privado</span>':''}</div>
    <p class="small">${nomes.length?esc(nomes.join(' · ')):'Sem membros'}${n>nomes.length?' · '+(n-nomes.length)+(n-nomes.length===1?' apagado':' apagados'):''}</p>
    <div class="grp-acoes"><button type="button" class="btn sm" data-toca="camada" data-click="groupModal('${jsq(k)}','${jsq(g.id)}')">${ic('pen',16)} Editar</button>
      ${partilhar?`<button type="button" class="btn sm" data-toca="camada" data-click="CW.grupoPartilhar('${jsq(g.id)}')">${ic('users',16)} Partilhar</button>`:''}</div></section>`;
}
/* Os cartões dos grupos de um tipo, no separador Grupos: os privados
   (cartaoDoGrupo) e, nos de imóveis, os partilhados com o que o servidor
   diz deles — a ligação de convite, os pedidos para entrar, os membros
   (cloud/grupos.js:cartaoDoGrupoPartilhado) — e os pedidos que fiz para
   entrar no grupo de outra pessoa (cloud/grupos.js:pedidosQueFizHtml). Sem
   nada, o vazio com o botão de criar o primeiro.
   Recebe: kind (opcional) — 'prop', 'owner' ou 'contract'; sem ele, os de imóveis.
   Devolve: o HTML (texto). */
function vGroups(kind){
  if(!GKIND[kind])kind='prop';
  const nuvem=nuvemDosGrupos(),gs=grpsOf(kind),nome=GKIND[kind].label.toLowerCase();
  const cartoes=gs.map(g=>g._partilhado&&nuvem&&typeof cartaoDoGrupoPartilhado==='function'?cartaoDoGrupoPartilhado(g):cartaoDoGrupo(g)).join('');
  const pedidos=kind==='prop'&&podePartilharGrupos()&&typeof pedidosQueFizHtml==='function'?pedidosQueFizHtml():'';
  if(!cartoes&&!pedidos)return `<div class="empty"><b>Ainda não há grupos de ${nome}</b>${kind==='prop'?'Junta imóveis num grupo para filtrares e repartires as despesas por eles de uma vez.':kind==='owner'?'Junta proprietários num grupo para os filtrares de uma vez — uma família, um casal.':'Junta contratos num grupo para os filtrares de uma vez.'}
    <div><button type="button" class="btn primary" data-toca="camada" data-click="groupModal('${jsq(kind)}')">${ic('plus',18)} Novo grupo de ${nome}</button></div></div>`;
  return `<div class="grp-lista">${cartoes}${pedidos}</div>`;
}
/* O separador «Grupos» (navegacao.js:TABS), da base como as Definições: uma
   aba das Casas, logo a seguir aos Imóveis (navegacao.js:AREAS — as abas da
   área por cima põe-nas o render, vistas.js:render). É o canvas M-Grupos: o
   que os grupos são, o segmentado dos tipos com quantos há de
   cada, «Novo grupo de …» do tipo à vista e, nos imóveis e quando posso
   partilhar, «Novo grupo partilhado» (cloud/grupos.js:CW.grupoNovo); os
   cartões (vGroups) e, nos imóveis com a nuvem, o que partilhar quer dizer.
   Os grupos são filtros de toda a app, e só a parte partilhada é do serviço
   Colaboradores.
   Recebe: nada (lê grpTipo).
   Devolve: o HTML (texto) da vista. */
function vGrupos(){
  const kind=GKIND[grpTipo]?grpTipo:'prop',nome=GKIND[kind].label.toLowerCase();
  const aba=k=>`<button type="button" id="grpTipo_${k}" class="${kind===k?'on':''}" aria-pressed="${kind===k}" data-toca="vista" data-click="grupoTipoEscolher('${jsq(k)}')">${GKIND[k].label} <span class="n">${grpsOf(k).length}</span></button>`;
  const partilhado=kind==='prop'&&podePartilharGrupos()?`<button type="button" class="btn" data-toca="camada" data-click="CW.grupoNovo()">${ic('users',18)} Novo grupo partilhado</button>`:'';
  const lista=vGroups(kind);
  /* sem grupos deste tipo (nem pedidos meus à espera), o «Novo grupo de …» é
     o do vazio — não dois iguais */
  const vazio=!grpsOf(kind).length&&!(kind==='prop'&&podePartilharGrupos()&&typeof pedidosQueFizHtml==='function'&&pedidosQueFizHtml());
  const novo=vazio?'':`<button type="button" class="btn primary" data-toca="camada" data-click="groupModal('${jsq(kind)}')">${ic('plus',18)} Novo grupo de ${nome}</button>`;
  return `<p class="def-intro">Servem de filtro em toda a app. Um movimento lançado num grupo de imóveis divide-se por eles.</p>
  <div class="def-cab"><div class="segm def-abas" role="group" aria-label="Tipo de grupo">${aba('prop')}${aba('owner')}${aba('contract')}</div>
    ${partilhado||novo?`<span class="def-cab-acoes">${partilhado}${novo}</span>`:''}</div>
  ${lista}
  ${kind==='prop'&&nuvemDosGrupos()?'<p class="hint def-nota">Partilhar um grupo é para sempre: não volta a ser privado. Quem entra pela ligação, e tu aceitas, fica comproprietário de todos os imóveis do grupo. Só entram os imóveis teus.</p>':''}`;
}
let gForm=null;
/* Abre o modal de criar (só kind) ou editar (com id) um grupo. Trabalha numa
   cópia (gForm) — nada é gravado até Guardar, que exige nome e pelo menos um
   membro antes de escrever em db.groups. Um grupo partilhado não se edita
   aqui: a janela é a da nuvem (CW.grupoModal). Num grupo de imóveis privado
   já guardado, com a nuvem dos grupos, o menu tem sempre «Partilhar este
   grupo…» — e o corpo o mesmo como botão à vista (groupBody): no ⋯ ninguém
   o achava. Sem sessão, com o serviço desligado, num grupo vazio ou só com
   imóveis dos outros, o toque explica (cloud/grupos.js:CW.grupoPartilhar).
   O guardar recusa o nome vazio e o grupo sem membros: os dois levam o
   asterisco (groupBody), e o erro diz-se no próprio campo — o contorno
   vermelho e a frase por baixo (componentes.js:falhaCampo), o dos membros na
   caixa deles (#g_membros).
   Recebe: kind — o tipo do grupo: 'prop', 'owner' ou 'contract'; id (opcional)
   — o id do grupo a editar; sem ele cria um novo.
   Devolve: nada — abre o modal. */
function groupModal(kind,id){
  const g0=id?grp(id):null;
  if(g0&&g0._partilhado&&nuvemDosGrupos())return CW.grupoModal(id);
  gForm=normGroup(id?JSON.parse(JSON.stringify(grp(id))):{kind});
  const itens=[];
  if(g0&&g0.kind==='prop'&&!g0._partilhado&&nuvemDosGrupos())itens.push({label:'Partilhar este grupo…',icon:'users',toca:'camada',act:`CW.grupoPartilhar('${jsq(id)}')`});
  if(id)itens.push({label:'Apagar grupo',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delGroup('${jsq(id)}')`});
  const m=id?menu('grp',itens):'';
  openModal(id?'Editar grupo':'Novo grupo de '+GKIND[kind].label.toLowerCase(),groupBody(),null,m);
  onSave=()=>{
    gForm.name=val('g_name').trim();
    if(!gForm.name)return falhaCampo('g_name','Dá um nome ao grupo.');
    if(gForm.ids.length<1)return falhaCampo('g_membros','Escolhe pelo menos um membro.');
    db.groups=db.groups||[];
    const i=db.groups.findIndex(x=>x.id===gForm.id);
    if(i<0)db.groups.push(gForm);else db.groups[i]=gForm;
    save();closeModal();render();toast('Grupo guardado.');
  };
}
/* Corpo do modal do grupo, gerado a partir de gForm: nome e membros em chips,
   os dois com o asterisco vermelho — o guardar recusa um nome vazio e um
   grupo sem membros (groupModal) — e o nome com um exemplo do tipo dele. Num
   grupo de imóveis privado já guardado, com a nuvem dos grupos, «Partilhar
   este grupo» à vista no fim, sempre, com o que isso quer dizer; quando não
   dá (sem sessão, sem o serviço, sem imóveis meus), o toque explica
   (CW.grupoPartilhar). Partilha-se o grupo como está guardado: a
   confirmação fecha esta janela, e o que se mudou aqui sem guardar fica
   para trás — a nota di-lo. Um grupo novo ainda não está em db.groups e não
   tem o botão. Os chips dos membros vivem em #g_membros, onde o guardar diz
   o erro de um grupo sem membros.
   Recebe: nada (lê gForm).
   Devolve: o HTML (texto) do corpo do modal. */
function groupBody(){
  const g=gForm,tags=g.ids.map(id=>({id,label:gMemberName(g.kind,id)||'?'}));
  const partilhar=g.kind==='prop'&&!g._partilhado&&!!grp(g.id)&&nuvemDosGrupos();
  return `<div class="form">
    <label>Nome do grupo <span class="req">*</span><input id="g_name" value="${esc(g.name)}" placeholder="Ex: ${g.kind==='prop'?'Casas de Lisboa':g.kind==='owner'?'Família':'Contratos T2'}" autocomplete="off"></label>
    <div><div class="flabel">${GKIND[g.kind].label} no grupo <span class="req">*</span></div><div id="g_membros">${tagField(tags,'Adicionar','addGroupMember()','delGroupMember')}</div></div>
    ${g.kind==='prop'?`<div class="hint">Um movimento atribuído a este grupo divide-se pelos imóveis (em partes iguais, pelo valor, por percentagens…).</div>`:''}
    ${partilhar?`<div><div class="flabel">Partilhar</div>
      <button type="button" class="btn sm" data-toca="camada" data-click="CW.grupoPartilhar('${jsq(g.id)}')">${ic('users',14)} Partilhar este grupo</button>
      <div class="hint u-mt-6px">Quem entrar pela ligação, e tu aceitares, fica comproprietário dos imóveis do grupo; só entram os imóveis teus — os de outras pessoas ficam de fora. Partilha-se o grupo como está guardado.</div></div>`:''}</div>`;
}
// Redesenha o corpo do modal do grupo depois de mexer nos membros, sem o fechar.
// Devolve: nada — redesenha o corpo do modal.
function repaintGroup(){const b=modalBodyEl();if(b)b.innerHTML=groupBody()}
/* Seletor com os candidatos que ainda não estão no grupo (imóveis,
   proprietários ou contratos, conforme o tipo). Entre os proprietários, o meu
   leva « (eu)» (acessos.js:rotuloDoDono) e o avatar fica com as iniciais do
   nome. Recolhe primeiro o nome já escrito para gForm, para o repinte não o
   perder.
   Devolve: nada — ao escolher, junta o membro a gForm e repinta o modal. */
function addGroupMember(){
  gForm.name=val('g_name');
  const g=gForm;
  let cands=[];
  if(g.kind==='prop')cands=db.properties.filter(p=>g.ids.indexOf(p.id)<0).map(p=>({v:p.id,label:p.name,icon:'building'}));
  else if(g.kind==='owner')cands=db.owners.filter(o=>g.ids.indexOf(o.id)<0).map(o=>({v:o.id,label:rotuloDoDono(o,db.owners.length),nome:o.name,avatar:true}));
  else cands=db.contracts.filter(c=>g.ids.indexOf(c.id)<0).map(c=>({v:c.id,label:ctName(c),sub:propName(c.propertyId),icon:'contract'}));
  pickModal('Adicionar ao grupo',cands,o=>{g.ids.push(o.v);closeModal();repaintGroup()});
}
// Tira um membro do grupo em edição (só em gForm) e repinta; recolhe antes o nome escrito.
// Recebe: id — o id do membro a tirar.
// Devolve: nada — atualiza gForm e repinta o corpo do modal.
function delGroupMember(id){gForm.name=val('g_name');gForm.ids=gForm.ids.filter(x=>x!==id);repaintGroup()}
/* Apaga o grupo depois de confirmar com o impacto. Os movimentos registados no
   grupo já estão partidos por imóvel (movimento.js:partirMovimento) e ficam
   como estão, cada parte no seu imóvel; só os do formato antigo, ainda por
   partir (um registo só, com o grupo), ficam sem grupo — «Sem imóvel», a
   contar só nos totais — e a frase di-lo antes. Os filtros ativos que
   apontavam para ele são limpos. Grava e repinta. Um grupo partilhado é do
   servidor: o dono apaga-o lá (CW.grupoApagar), quem não é dono sai dele
   (CW.grupoSair).
   Recebe: id — o id do grupo a apagar.
   Devolve: nada — abre a confirmação; só ao confirmar apaga e grava. */
function delGroup(id){
  const g=grp(id),used=db.transactions.filter(t=>t.groupId===id).length;
  const partidos=new Set(db.transactions.filter(t=>t.lote&&t.lote.alvo==='g:'+id).map(t=>t.lote.id)).size;
  if(g&&g._partilhado&&nuvemDosGrupos())return g._meu?CW.grupoApagar(id):CW.grupoSair(id);
  confirmModal('Apagar grupo',`Apagar o grupo “${esc((g||{}).name||'')}”?`+
    (partidos?` ${partidos===1?'O movimento já registado':'Os '+partidos+' movimentos já registados'} neste grupo ${partidos===1?'fica em cada imóvel, como está':'ficam em cada imóvel, como estão'}.`:'')+
    (used?` ${used===1?'Um movimento antigo, ainda por dividir pelos imóveis, fica':used+' movimentos antigos, ainda por dividir pelos imóveis, ficam'} sem grupo: passa${used===1?'':'m'} a «Sem imóvel» e conta${used===1?'':'m'} só nos totais.`:''),()=>{
    db.transactions.forEach(t=>{if(t.groupId===id){t.groupId=null;t.psplit=null}});
    if(String(txProp).slice(2)===id)txProp='';
    db.groups=(db.groups||[]).filter(x=>x.id!==id);
    save();closeAllModals();render();toast('Grupo apagado.');
  });
}
/* O Enter no campo do promptModal vale por Guardar. Era um onkeydown com um
   if, que fica fora da gramática das ações (eventos.js); a ação passa-lhe o
   event e ela faz o mesmo, pela mesma ordem.
   Recebe: ev — o evento de teclado.
   Devolve: nada — no Enter, trava o comportamento do browser e guarda. */
function pmTecla(ev){if(ev.key==='Enter'){ev.preventDefault();_pm()}}
/* Modal genérico de um só campo de texto. Enter equivale a Guardar; o cb só é
   chamado se sobrar texto depois do trim — o campo é sempre obrigatório, e
   por isso leva sempre o asterisco vermelho, como os outros formulários. Sem
   texto, a janela fica aberta e o erro diz-se no campo (falhaCampo): fechava
   calada, sem criar nada nem dizer porquê. Todos os rótulos são «Nome…». O
   exemplo, quando o há, começa por «Ex: » (a regra dos placeholders).
   Foca o campo ao abrir.
   Recebe: title — o título do modal; label — o rótulo do campo; value — o
   texto inicial (pode vir null); cb — a função chamada com o texto (já com
   trim) quando se guarda com algo escrito; exemplo (opcional) — o texto do
   exemplo, sem o «Ex: » (ex.: 'Obras'), para o placeholder.
   Devolve: nada — abre o modal. */
function promptModal(title,label,value,cb,exemplo){
  const ph=exemplo?` placeholder="Ex: ${esc(exemplo)}"`:'';
  openModal(title,`<div class="form"><label>${esc(label)} <span class="req">*</span><input id="pm_v" value="${esc(value||'')}"${ph} autocomplete="off" data-keydown="pmTecla(event)"></label></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="_pm()">Guardar</button>`);
  _pm=()=>{const v=val('pm_v').trim();if(!v)return falhaCampo('pm_v','Escreve um nome.');closeModal();cb(v)};
  setTimeout(()=>{const e=document.getElementById('pm_v');if(e)e.focus()},50);
}
// Pede o nome (com um exemplo da árvore) e cria uma categoria vazia na árvore tk; grava e repinta.
// Recebe: tk — a árvore: 'cats' (pagamentos) ou 'catsIn' (receitas).
// Devolve: nada — abre o prompt; só ao guardar cria e grava.
function addCat(tk){promptModal('Nova categoria','Nome da categoria',null,v=>{const cs=db.settings[tk]||(db.settings[tk]={});if(!cs[v])cs[v]=[];save();render();toast('Categoria criada.')},tk==='catsIn'?'Alojamento local':'Jardim e piscina')}
/* Leva as escolhas guardadas por categoria (as exclusões dos totais, as colunas do
   Anexo F) das chaves antigas para as novas, ou tira-as. Vai chave a chave, e não
   por prefixo: «Obras/» apanhava também uma categoria chamada «Obras/Casa», que é
   outra.
   Recebe: o — o objeto das escolhas (pode faltar); pares — array de [antiga, nova],
   com nova null para tirar.
   Devolve: nada — muda o objeto. */
function moverChaves(o,pares){
  if(!o)return;
  pares.forEach(([a,n])=>{if(!Object.prototype.hasOwnProperty.call(o,a))return;if(n!=null)o[n]=o[a];delete o[a]});
}
/* Leva as escolhas de categorias e subcategorias para os nomes novos, ou tira-as, em
   cada objeto de escolhas pela chave dele. O Anexo F só existe na árvore dos
   pagamentos.
   Recebe: tk — a árvore ('cats' ou 'catsIn'); pares — array de [de, para], cada um
   [categoria] ou [categoria, sub], com para null para tirar.
   Devolve: nada — muda db.settings.exclude e .irsMapa. */
function moverEscolhas(tk,pares){
  const st=db.settings,com=f=>pares.map(([a,n])=>[f(a[0],a[1]),n?f(n[0],n[1]):null]);
  moverChaves(st.exclude,com((c,sb)=>excKey(tk,c,sb)));
  if(tk!=='cats')return;
  moverChaves(st.irsMapa,com((c,sb)=>c+(sb?' / '+sb:'')));
}
/* Os pares de moverEscolhas para uma categoria inteira: ela e cada subcategoria dela.
   Recebe: tk — a árvore; cat — a categoria; nova — o nome novo, ou null para tirar.
   Devolve: array de [de, para]. */
const paresDaCategoria=(tk,cat,nova)=>[[[cat],nova==null?null:[nova]]]
  .concat(((db.settings[tk]||{})[cat]||[]).map(sb=>[[cat,sb],nova==null?null:[nova,sb]]));
/* Renomeia uma categoria mantendo a ordem (reconstrói o objeto) e atualiza os
   movimentos dessa árvore que a usavam e as escolhas guardadas por nome (fora dos
   totais, coluna do Anexo F). Nome vazio ou igual só repinta; o nome de
   outra categoria que já existe não se aceita — fundia as duas e perdia as subcategorias.
   Recebe: tk — a árvore: 'cats' ou 'catsIn'; oldName — o nome atual;
   newName — o nome novo, tal como vem do campo (é-lhe feito trim).
   Devolve: nada — grava e repinta. */
function renameCat(tk,oldName,newName){
  newName=String(newName||'').trim();
  if(!newName||newName===oldName)return render();
  const cs=db.settings[tk]||{},out={};
  if(Object.prototype.hasOwnProperty.call(cs,newName)){render();return toast('Já há uma categoria com esse nome.')}
  moverEscolhas(tk,paresDaCategoria(tk,oldName,newName));
  Object.keys(cs).forEach(k=>{out[k===oldName?newName:k]=cs[k]});
  db.settings[tk]=out;
  treeTx(tk).forEach(t=>{if(t.category===oldName)t.category=newName});
  save();render();toast('Categoria renomeada.');
}
// Apaga a categoria depois de confirmar com o impacto: os movimentos que a
// usavam ficam sem categoria nem subcategoria (não se apagam), e as escolhas
// dela (fora dos totais, coluna do Anexo F) saem com ela. A frase diz quantos,
// no singular ou no plural.
// Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria.
// Devolve: nada — abre a confirmação; só ao confirmar apaga e grava.
function delCat(tk,k){
  const used=treeTx(tk).filter(t=>t.category===k).length;
  confirmModal('Apagar categoria',`Apagar “${esc(k)}”?${used?` ${used===1?'1 movimento fica':used+' movimentos ficam'} sem categoria.`:''}`,()=>{
    moverEscolhas(tk,paresDaCategoria(tk,k,null));
    delete db.settings[tk][k];
    treeTx(tk).forEach(t=>{if(t.category===k){t.category='';t.sub=''}});
    save();render();toast('Categoria apagada.');
  });
}
// Pede o nome e junta uma subcategoria à categoria k (ignora repetidas); grava e repinta.
// Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria.
// Devolve: nada — abre o prompt; só ao guardar cria e grava.
function addSub(tk,k){promptModal('Nova subcategoria','Nome da subcategoria',null,v=>{
  const cs=db.settings[tk]||(db.settings[tk]={}),l=cs[k]||(cs[k]=[]);
  if(l.indexOf(v)<0)l.push(v);save();render();toast('Subcategoria criada.')},'Canalização')}
/* Muda o nome de uma subcategoria via prompt: atualiza a lista, os movimentos
   que a usavam e leva as escolhas dela (fora dos totais, coluna do Anexo F)
   para o nome novo. O nome de outra subcategoria da mesma categoria
   não se aceita: ficavam duas iguais.
   Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria;
   old — o nome atual da subcategoria.
   Devolve: nada — abre o prompt; só ao guardar renomeia e grava. */
function renameSub(tk,k,old){
  promptModal('Mudar o nome da subcategoria','Nome da subcategoria',old,nn=>{
    nn=String(nn||'').trim();if(!nn||nn===old)return;
    const cs2=db.settings[tk]||{},l=cs2[k]||[];
    if(l.indexOf(nn)>-1)return toast('Já há uma subcategoria com esse nome.');
    const i=l.indexOf(old);if(i>-1)l[i]=nn;
    treeTx(tk).forEach(t=>{if(t.category===k&&t.sub===old)t.sub=nn});
    moverEscolhas(tk,[[[k,old],[k,nn]]]);
    save();render();toast('Subcategoria renomeada.');
  },'Canalização');
}
// Apaga a subcategoria depois de confirmar com o impacto: sai da lista, dos
// movimentos que a usavam (ficam só sem subcategoria) e das escolhas guardadas.
// A frase diz quantos, no singular ou no plural.
// Recebe: tk — a árvore: 'cats' ou 'catsIn'; k — o nome da categoria;
// sb — o nome da subcategoria.
// Devolve: nada — abre a confirmação; só ao confirmar apaga e grava.
function delSub(tk,k,sb){
  /* apagar categoria e etiqueta confirmam com o impacto; a subcategoria
     executava logo — a mesma ação, na mesma página, ora protegia ora não */
  const usados=treeTx(tk).filter(t=>t.category===k&&t.sub===sb).length;
  confirmModal('Apagar subcategoria',`“${esc(sb)}” sai de ${esc(k)}${usados?` e de ${usados===1?'1 movimento que a usa':usados+' movimentos que a usam'}`:''}.`,()=>{
    moverEscolhas(tk,[[[k,sb],null]]);
    const cs=db.settings[tk]||{};cs[k]=(cs[k]||[]).filter(x=>x!==sb);
    treeTx(tk).forEach(t=>{if(t.category===k&&t.sub===sb)t.sub=''});
    save();render();toast('Subcategoria apagada.');
  });
}
// Repõe as duas árvores nas listas de origem, após confirmação; os movimentos
// mantêm o texto de categoria que já tinham.
// Devolve: nada — abre a confirmação; só ao confirmar repõe e grava.
function resetCats(){
  confirmModal('Repor categorias','Volta às listas de origem (receitas e pagamentos). As categorias que criaste desaparecem; os movimentos mantêm o texto.',()=>{
    db.settings.cats=JSON.parse(JSON.stringify(CATS0));db.settings.catsIn=JSON.parse(JSON.stringify(CATS_IN0));save();render();toast('Categorias repostas.');
  });
}
/* ===== IRS e dedução ===== */
/* As chaves do mapa categoria → coluna, pela ordem em que a subpágina as
   desenha: a categoria, e logo a seguir cada «Categoria / Sub». É a mesma
   lista dos dois lados (a tabela das categorias desenha um menu por chave —
   colunaDoAnexo —, setIrsMapa lê-os pela posição), porque o sel chama o
   onchange pelo nome e sem dizer qual foi.
   Devolve: a lista de chaves (array de strings), pela ordem das categorias de pagamentos. */
const irsMapaChaves=()=>{const cs=cats(),l=[];Object.keys(cs).forEach(k=>{l.push(k);(cs[k]||[]).forEach(sb=>l.push(k+' / '+sb))});return l};
/* Grava a coluna do Anexo F de uma categoria ou subcategoria no mapa das
   definições. Vazio apaga a regra: a categoria volta a «Outros gastos», a
   subcategoria volta a seguir a categoria. Sem argumentos — é assim que os
   menus da subpágina chamam, porque o sel chama o onchange pelo nome e sem
   dizer qual foi (componentes.js:selPick) — lê todos os menus pela posição
   (irsMapaChaves) e grava o que mudou, como imovel.js:liveLoanAll faz com as
   hipotecas. Só toca nos menus que existem no ecrã: fora da subpágina não
   apaga nada.
   Recebe: chave (opcional) — 'Categoria' ou 'Categoria / Sub'; col (opcional)
   — o id da coluna (de IRS_COLUNAS), ou '' para apagar a regra.
   Devolve: nada — grava em db.settings.irsMapa e redesenha. */
function setIrsMapa(chave,col){
  db.settings.irsMapa=db.settings.irsMapa||JSON.parse(JSON.stringify(IRS_MAPA0));
  const m=db.settings.irsMapa,valida=v=>!v||IRS_COLUNAS.some(c=>c[0]===v);
  const poe=(k,v)=>{if(v)m[k]=v;else delete m[k]};
  if(chave!==undefined){if(!valida(col))return;poe(chave,col||'')}
  else irsMapaChaves().forEach((k,i)=>{
    const e=document.getElementById('irsm_'+i);if(!e)return;
    const v=e.value||'';if(valida(v)&&(m[k]||'')!==v)poe(k,v);
  });
  save();render();
}
/* Repõe o mapa de origem (IRS_MAPA0) depois de confirmar: as regras que
   mudaste aqui desaparecem; as colunas escolhidas na ficha de cada despesa
   ficam, porque são do movimento e não do mapa.
   Devolve: nada — abre a confirmação; só ao confirmar repõe e grava. */
function resetIrsMapa(){
  confirmModal('Repor colunas','Volta às regras de origem do Anexo F. As colunas que mudaste aqui desaparecem; as escolhidas na ficha de cada despesa ficam.',()=>{
    db.settings.irsMapa=JSON.parse(JSON.stringify(IRS_MAPA0));save();render();toast('Colunas repostas.');
  });
}
// Pede o nome e cria uma etiqueta (ignora repetidas); grava e repinta.
// Devolve: nada — abre o prompt; só ao guardar cria e grava.
function addTag(){promptModal('Nova etiqueta','Nome da etiqueta',null,v=>{
  const l=db.settings.tags||(db.settings.tags=[]);
  if(l.indexOf(v)<0)l.push(v);save();render();toast('Etiqueta criada.')},'Obras de 2026')}
// Apaga a etiqueta depois de confirmar com o impacto: sai das definições e de
// todos os movimentos que a tinham. A frase diz de quantos, no singular ou no
// plural.
// Recebe: g — o nome da etiqueta.
// Devolve: nada — abre a confirmação; só ao confirmar apaga e grava.
function delTag(g){
  const used=db.transactions.filter(t=>(t.tags||[]).indexOf(g)>-1).length;
  confirmModal('Apagar etiqueta',`Apagar “${esc(g)}”?${used?` Sai de ${used===1?'1 movimento':used+' movimentos'}.`:''}`,()=>{
    db.settings.tags=(db.settings.tags||[]).filter(x=>x!==g);
    db.transactions.forEach(t=>{t.tags=(t.tags||[]).filter(x=>x!==g)});
    // e sai do filtro dos Movimentos, se estava escolhida (lista-movimentos.js:txEtiq)
    if(typeof txEtiq!=='undefined')txEtiq=txEtiq.filter(x=>x!==g);
    save();render();toast('Etiqueta apagada.');
  });
}


/* ======================= FILTROS COMUNS =======================
   Um conjunto de escolhas com nome — "T2 Lisboa · rendas", "Só despesas do
   Manel" — definido uma vez e aplicado onde há o que aplicar: os Movimentos
   usam tudo (os chips do painel e da fila), a visão geral só o imóvel (o
   seletor do painel dela). Não guarda proprietário: o filtro global de
   proprietário saiu (ambito.js); um filtro de antes com «owner» guarda-o
   ainda, mas ninguém o lê, e ao editá-lo a chave sai (fcGuardar). */

// A lista de filtros comuns guardada nas definições ([] enquanto não houver).
// Devolve: o array de filtros de db.settings.filters ([] novo se ainda não houver).
function filtrosComuns(){return db.settings.filters||[]}

/* Subpágina «Filtros comuns»: o que são, «Novo filtro comum», e cada filtro
   numa lista — o nome e o resumo das escolhas (tocar abre a edição) e o
   botão de apagar, que apaga logo com «Anular» (delFiltroComum). Sem nenhum,
   o vazio com o botão de criar o primeiro.
   Recebe: nada.
   Devolve: o HTML (texto) da subpágina, sem o Voltar. */
function vFiltrosComuns(){
  const list=filtrosComuns();
  const novo=`<button type="button" class="btn primary" data-toca="camada" data-click="fcModal()">${ic('plus',18)} Novo filtro comum</button>`;
  if(!list.length)return `<p class="def-intro">Um filtro comum guarda um conjunto de escolhas — imóvel, tipo, categoria, datas — para aplicares num toque, nos filtros dos Movimentos e da visão geral.</p>
    <div class="empty"><b>Ainda não tens nenhum</b>Define-o uma vez e aplica-o em qualquer vista que filtre.<div>${novo}</div></div>`;
  return `<div class="def-cab"><p class="def-intro">Aplicam-se nos filtros dos Movimentos e da visão geral; cada vista usa só o que lhe diz respeito.</p><span class="def-cab-acoes">${novo}</span></div>
    <section class="card def-lista">${list.map(f=>`<div class="def-filtro">
      <button type="button" class="linha def-linha" data-toca="camada" data-click="fcModal('${jsq(f.id)}')">
        <span class="ic">${ic('filter',20)}</span>
        <span class="txt"><b class="u-d-block">${esc(f.name)}</b><span class="small">${esc(fcResumo(f)||'Sem escolhas — aplicá-lo limpa os filtros')}</span></span></button>
      <button type="button" class="btn so-icone ghost" aria-label="Apagar o filtro ${esc(f.name)}" data-toca="dados" data-risco="destroi" data-click="delFiltroComum('${jsq(f.id)}')">${ic('trash',18)}</button></div>`).join('')}</section>`;
}

// Resumo das escolhas de um filtro numa linha, separadas por «·»;
// devolve '' quando o filtro não fixa nada.
// Um «owner» de um filtro de antes não entra: já não se aplica.
// Recebe: f — o filtro comum (objeto {kind,prop,cat,sub,de,ate,…}).
// Devolve: o resumo em texto; '' se o filtro não fixar nada.
function fcResumo(f){
  const p=[];
  if(f.kind)p.push(nomeDoTipo(f.kind));
  if(f.prop){const pr=prop(f.prop);p.push(pr?pr.name:f.prop)}
  if(f.cat)p.push(f.cat);
  if(f.sub)p.push(f.sub);
  if(f.de||f.ate)p.push(f.de&&f.ate?dPT(f.de)+' → '+dPT(f.ate):f.de?'desde '+dPT(f.de):'até '+dPT(f.ate));
  return p.join(' · ');
}

let fcForm=null;
// Abre o modal de criar (sem id) ou editar um filtro comum; trabalha numa
// cópia (fcForm) — nada é gravado até fcGuardar.
// Recebe: id (opcional) — o id do filtro a editar; sem ele cria um novo.
// Devolve: nada — abre o modal.
function fcModal(id){
  const f=filtrosComuns().find(x=>x.id===id);
  fcForm=f?JSON.parse(JSON.stringify(f)):{id:uid(),name:'',kind:'',prop:'',cat:'',sub:'',de:'',ate:''};
  openModal(f?'Editar filtro comum':'Novo filtro comum',fcCorpo(),
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="fcGuardar()">Guardar</button>`);
}
/* Corpo do modal do filtro: nome, tipo, imóvel, categoria, subcategoria e
   datas (sem proprietário: ver FILTROS COMUNS). As categorias dependem do
   tipo escolhido (as dívidas usam a árvore das despesas), daí mudar o tipo
   repintar o formulário.
   Devolve: o HTML (texto) do corpo do modal, gerado a partir de fcForm. */
function fcCorpo(){
  const kinds=[{v:'',label:'Todos os tipos'},{v:'income',label:'Receitas'},{v:'expense',label:'Despesas'},{v:'loan',label:'Pagamentos de crédito'},{v:'debt',label:'Dívidas'}];
  const props=[{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p=>({v:p.id,label:p.name})));
  const tree=allCats(fcForm.kind==='debt'?'expense':fcForm.kind);
  const catOpts=[{v:'',label:'Todas as categorias'}].concat(Object.keys(tree).map(c=>({v:c,label:c})));
  const subs=fcForm.cat?(tree[fcForm.cat]||[]):[];
  /* a categoria vai sozinha, a toda a largura; com subcategorias, as duas lado a lado */
  const cat=`<label>Categoria${sel('fc_cat',fcForm.cat,catOpts,'fcColher','rascunho')}</label>`;
  return `<div class="form">
    <label>Nome <span class="req">*</span><input id="fc_name" value="${esc(fcForm.name)}" placeholder="Ex: T2 Lisboa · rendas" autocomplete="off" data-input="fcColher(1)"></label>
    <div class="row"><label>Tipo${sel('fc_kind',fcForm.kind,kinds,'fcColher','rascunho')}</label>
      <label>Imóvel${sel('fc_prop',fcForm.prop,props,'fcColher','rascunho')}</label></div>
    ${subs.length?'<div class="row">'+cat+`<label>Subcategoria${sel('fc_sub',fcForm.sub,[{v:'',label:'Todas'}].concat(subs.map(x=>({v:x,label:x}))),'fcColher','rascunho')}</label></div>`:cat}
    <div class="row lado-a-lado"><label>De<input id="fc_de" type="date" value="${fcForm.de||''}" data-change="fcColher()"></label>
      <label>Até<input id="fc_ate" type="date" value="${fcForm.ate||''}" data-change="fcColher()"></label></div>
    <div class="hint">Deixa em branco o que não quiseres fixar. Cada vista aplica só o que lhe diz respeito.</div>
  </div>`;
}
/* soFormulario: escrever no nome não repinta (perdia o foco a cada tecla);
   mudar tipo ou categoria repinta, porque as opções seguintes dependem
   Recebe: soFormulario (opcional) — verdadeiro quando a chamada vem de
   escrever no nome: colhe sem repintar.
   Devolve: nada — copia os campos do modal para fcForm (e repinta o corpo
   se o tipo ou a categoria mudarem). */
function fcColher(soFormulario){
  fcForm.name=val('fc_name');
  const kindNovo=val('fc_kind')||'',catNova=val('fc_cat')||'';
  const repinta=!soFormulario&&(kindNovo!==fcForm.kind||catNova!==fcForm.cat);
  if(catNova!==fcForm.cat)fcForm.sub='';
  fcForm.kind=kindNovo;fcForm.cat=catNova;
  fcForm.prop=val('fc_prop')||'';
  fcForm.sub=val('fc_sub')||fcForm.sub||'';fcForm.de=val('fc_de')||'';fcForm.ate=val('fc_ate')||'';
  if(repinta){const t=modalTop();if(t){const b=modalBodyEl();if(b){b.innerHTML=fcCorpo();marcarDatasVazias(b)}}}
}
// Guarda o filtro do modal: colhe o formulário, exige nome, tira o «owner»
// de um filtro de antes, substitui (ou acrescenta) em db.settings.filters e
// fecha com um toast.
// Devolve: nada — grava nas definições e fecha o modal (ou avisa se faltar o nome).
function fcGuardar(){
  fcColher();
  if(!String(fcForm.name||'').trim())return falhaCampo('fc_name','Dá um nome ao filtro.');
  delete fcForm.owner;
  db.settings.filters=filtrosComuns().filter(x=>x.id!==fcForm.id).concat([fcForm]);
  save();closeModal();render();toast('Filtro comum guardado.');
}
// Apaga um filtro comum sem pedir confirmação — o toast traz Desfazer,
// que repõe a cópia guardada.
// Recebe: id — o id do filtro a apagar.
// Devolve: nada — apaga, grava e mostra o toast com Desfazer.
function delFiltroComum(id){
  const f=filtrosComuns().find(x=>x.id===id);if(!f)return;
  const copia=JSON.parse(JSON.stringify(f));
  db.settings.filters=filtrosComuns().filter(x=>x.id!==id);
  save();render();
  comDesfazer('Filtro comum apagado.',()=>{db.settings.filters=(db.settings.filters||[]).concat([copia])});
}

/* O aplicador: cada vista pega no que lhe diz respeito — os Movimentos tudo,
   a visão geral o imóvel. O «owner» de um filtro de antes ignora-se: não há
   filtro de proprietário (ambito.js).
   Recebe: id — o id do filtro comum a aplicar.
   Devolve: nada — muda os filtros da vista ativa e repinta. */
function aplicarFiltroComum(id){
  const f=filtrosComuns().find(x=>x.id===id);if(!f)return;
  if(tab==='transactions'){
    txFilter=f.kind||'';txProp=f.prop||'';
    // um filtro comum não guarda etiquetas: as escolhidas saem, senão somavam-se a ele
    if(typeof txEtiq!=='undefined')txEtiq=[];
    txCat=f.cat||'';txSub=f.sub||'';txDe=f.de||'';txAte=f.ate||'';
    if(typeof txRerender==='function')txRerender();else render();   // a repintura curta é dos Movimentos
    toast('Filtro «'+f.name+'» aplicado.');return;
  }
  // a visão geral (o seletor do painel dela): aplica-se o imóvel
  if(tab==='dashboard')dashProp=f.prop||'';
  render();toast('Filtro «'+f.name+'» aplicado — '+(f.cat||f.kind||f.de||f.ate?'esta vista usa só o imóvel.':'feito.'));
}
// Selector "aplicar um filtro comum" para meter num funil de filtros; devolve
// '' enquanto não houver filtros. fn é o onchange (por omissão onFcAplicar).
// Recebe: fn (opcional) — o nome (texto) da função global a chamar no onchange;
// por omissão 'onFcAplicar'.
// Devolve: o HTML (texto) do seletor; '' enquanto não houver filtros.
function fcSelector(fn){
  const list=filtrosComuns();
  if(!list.length)return '';
  return `<label>Filtro comum${sel('fcAplicar','',[{v:'',label:'— aplicar um filtro comum —'}].concat(list.map(f=>({v:f.id,label:f.name}))),fn||'onFcAplicar','vista')}</label>`;
}
// onchange do selector: aplica o filtro escolhido (a opção vazia não faz nada).
// Devolve: nada — aplica o filtro escolhido na vista ativa.
function onFcAplicar(){const v=val('fcAplicar');if(v)aplicarFiltroComum(v)}
