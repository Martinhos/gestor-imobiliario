/* ================= FISCO =================
   A Declaração vive em sete ficheiros, carregados por esta ordem (servicos.js):
   fisco-titulares.js (quem declara e a quota), fisco-resumo.js (o resumoFiscal),
   fisco-avisos.js (o que há a tratar), fisco-quadros.js (os cartões e os
   quadros), este (a vista e as ações da página), fisco-exportar.js (texto e CSV)
   e fisco-pdf.js (o PDF). O que se segue vale para todos. */
/* A página do IRS de um senhorio: os quadros 4.1 e 4.2 do Anexo F, linha a
   linha, com o que a app sabe e o que falta apontado ao lado, e as regras, os
   prazos e o guia do ano escolhido — que vêm da versão desse ano dos
   rendimentos (irs-AAAA.js, lida por irs.js:irsAno).

   A app RESUME, não declara. Nunca inventa um número nem um código: uma linha
   sem código de freguesia fica com a falta escrita, não com um código
   plausível. E um contrato marcado como «não declarado» é uma escolha do
   senhorio — fica fora do quadro e dos totais, listado à parte sem juízo, com
   o nome e o valor e mais nada.

   Cash basis (CIRS art. 8.º): uma renda conta no ano em que é recebida, mesmo
   que respeite a outro — a parte de anos anteriores diz-se à parte, para o
   quadro 8; um gasto conta no ano em que foi pago, e só se foi pago com o
   imóvel arrendado (as instruções do quadro 4.1), salvo o IMI e o selo, que
   contam no ano em que o imóvel deu rendas (CIRS art. 41.º n.º 5). A
   declaração é sempre a de quem tem a sessão, sem seletor (fiscoTitulares):
   só os imóveis onde essa conta tem quota, e tudo pela quota-parte dela — o
   Anexo F é por titular, e um imóvel a meias tem duas declarações (CIRS art.
   19.º). Em tributação conjunta entra também a parte do cônjuge, o
   proprietário escolhido na situação do ano, cada linha com a sua letra (a
   posição de cada um no Rosto, que não decide que rendas entram).

   O que é estimativa diz-se como tal: os gastos de um imóvel com mais do que
   um contrato no ano repartem-se pelos contratos na proporção das rendas de
   cada um — incluindo as rendas que ficam fora do quadro (não declaradas ou
   sem contrato), cuja parte não entra; o rateio que a lei pede quando o
   imóvel se arrenda por partes independentes (por VPT ou por área, CIRS art.
   41.º n.º 4) fica para quem preenche, com o VPT à mão na ficha do imóvel. E
   o imposto é a estimativa sem englobamento, à taxa de cada contrato.

   O que só o senhorio sabe vive nas definições, ano a ano
   (db.settings.irs.porAno, «A tua situação fiscal em AAAA» no topo da
   página, lida por irs-papeis.js:irsSituacao): a tributação conjunta, o
   cônjuge e a minha letra no Rosto (A ou B — sem conjunta é sempre A), a
   dispensa dos recibos eletrónicos (que obriga ao Modelo 44) e os números da
   demonstração do AIMI. O guia de como declarar, com o
   prazo e o que mudou no ano, é o público (/guias/declarar-rendas), e a
   barra leva lá. Um contrato isento (PAA, RSAA, programas municipais) fica na linha do 4.1,
   como as instruções do quadro 6D pedem («o campo do quadro 4.1, onde o
   imóvel foi identificado»), com o imposto a zero, fora do líquido e do
   imposto, e listado no 6D com o código do programa. O AIMI não é gasto: vai
   ao quadro 9, que o abate à coleta. */

/* A vista do separador IRS · Anexo F, como a prancheta D-Declaracao: o
   painel com o ano (o funil do cabeçalho — é o único sítio onde se escolhe)
   e a frase de quem é a declaração — a tua, sem seletor de proprietário
   (fiscoTitulares); a barra só com as ações da página (o guia de preenchimento,
   que é o público, e o botão de partilha com o CSV e o PDF); os cinco números
   do ano; a grelha com «A tratar antes de entregar» (que diz também quando o
   ano não tem versão própria das regras), «A tua situação fiscal» e os
   prazos da AT; um cartão por quadro, o 4.1, o 4.2 e o 4.3 (o direito real
   de habitação duradoura, D120), cada um com onde se preenche, o resumo dos
   seus contratos e os campos de cada contrato (com o 4.2A, o 4.2B e o 4.2C
   no do 4.2); o quadro 5 da sublocação (D52); os isentos do 6D, os
   benefícios do 6A, do 6B e do 6C (D117, D121, D119), as obras dos 24 meses
   (e as por confirmar), as rendas de anos anteriores, o AIMI do quadro 9, o
   Anexo J dos imóveis fora de Portugal (D133), as rendas da categoria B fora
   do Anexo F (D134), o que ficou fora por escolha e as rendas sem contrato;
   e, no fim, o aviso de responsabilidade (fiscoAvisoCard). Sem imóveis
   diz-o e aponta a saída; sem rendas no ano (nem nos quadros 4, nem no
   quadro 5, nem fora do Anexo F), diz-o e nomeia os contratos que
   estiveram em vigor nele sem nenhuma renda registada
   (fiscoContratosSemRendas) — um contrato sem rendas não tem linha, e a
   página não pode ficar só com «Sem rendas»; com imóveis à vista mas nenhum
   teu (só colaboras), diz que o Anexo F é de quem é dono, e não de quem
   recebe as rendas por conta dele (CIRS art. 19.º).
   A Declaração requer os Contratos (servicos.js, D57), e eles os Imóveis: a
   página nunca se pinta com um dos dois desligado, e nada aqui o pergunta.
   Devolve: o HTML da vista (string). */
function vFisco(){
  const ano=fiscoAnoAtual(),auto=!fiscoAno;
  const anos=yearsWithData(null);if(anos.indexOf(ano)<0)anos.push(ano);anos.sort((a,b)=>a-b);
  const r=resumoFiscal(ano);
  /* em conjunta, a letra do cônjuge é a das linhas dele (a do Rosto, D30);
     ligada sem cônjuge escolhido, diz-se que entram só as minhas rendas */
  const sit=r.porInteiro?null:irsSituacao(ano,r.titularId);
  const outro=(r.linhas||[]).find(l=>l&&l.titularId&&l.titularId!==r.titularId);
  const conj=r.titulares.length>1?' Em tributação conjunta entra também a do titular '+esc((outro&&outro.titular)||(sit&&sit.letraConjuge)||'B')+', cada linha com a sua letra.'
    :sit&&sit.conjunta&&!(db.owners||[]).some(o=>o&&o.id&&o.id===sit.conjugeId)?' A tributação conjunta de '+ano+' está ligada sem cônjuge escolhido: entram só as tuas rendas.':'';
  const quem=r.porInteiro?(r.semSessao?'Sem sessão não se sabe qual dos proprietários és: os valores vão por inteiro.':'Sem proprietários na ficha, os valores vão por inteiro.')
    :'A declaração é a tua: rendas, retenções e gastos entram pela tua quota-parte de cada imóvel.'+conj;
  const panel=anaPanel(`<div class="u-w-100pc">${sel('fiscoSel',String(ano),anos.map(y=>({v:String(y),label:String(y)})),'onFiscoAno','vista')}</div>
    <div class="hint u-mt-9px">${quem}${auto&&ano===YEAR-1?' Até junho mostra-se o ano anterior, que é o que se está a declarar.':''}</div>`);
  if(!r.imoveis){
    const deOutros=!r.porInteiro&&pidProps(null).some(p=>pode(p.id,'report.view'));
    return panel+(esperaDoServidor()||(deOutros?`<div class="empty"><b>Nenhum imóvel teu</b>O Anexo F é de quem é dono, pela sua quota-parte (CIRS art. 19.º): aqui entram só os imóveis de que és proprietário. Quem só recebe as rendas por conta do dono não as declara.</div>`
      :`<div class="empty"><b>Sem imóveis</b>O Anexo F parte das rendas de cada imóvel.
    ${saida('Adicionar imóvel',"go('properties')",'ecra')}</div>`));
  }
  /* um ano só com sublocação (o quadro 5) tem rendas a declarar: não é «Sem
     rendas» (D52) */
  const q5=Array.isArray(r.quadro5)?r.quadro5.length:0;
  /* nem um ano só com rendas fora do Anexo F — o Anexo J de um imóvel lá
     fora (D133) ou a categoria B (D134) —, que têm cartão próprio */
  const foraDoF=(Array.isArray(r.anexoJ)?r.anexoJ.length:0)+(Array.isArray(r.categoriaB)?r.categoriaB.length:0);
  if(!r.linhas.length&&!q5&&!foraDoF&&!r.fora.length&&!r.semContrato.length){
    const outros=anos.filter(y=>y!==ano&&(db.transactions||[]).some(t=>ehRenda(t)&&String(t.date||'').startsWith(String(y))));
    return panel+`<div class="ana fis"><div class="empty"><b>Sem rendas em ${ano}</b>${fiscoFraseSemRendas(fiscoContratosSemRendas(r),ano)}${outros.length?'Há rendas em '+esc(outros.join(', '))+'. ':''}Uma renda entra aqui quando o movimento é da categoria Rendas e está ligado ao contrato.
      ${saida('Escolher outro ano','hdrFiltToggle()','vista')}</div></div>`;
  }
  /* Os cartões dos quadros empilham-se numa grelha de uma coluna com o mesmo
     intervalo que as colunas da casa (14px). A coluna é minmax(0,1fr) e não
     1fr: um item de grelha não encolhe abaixo do seu conteúdo, e a tabela do
     resumo, mais larga do que o ecrã, alargava a página em vez de rolar
     dentro do .tablewrap. */
  const Q=r.versao.quadros,q43=fiscoQuadroDhd(r);
  return panel+`<div class="ana fis">`+fisBarra()+fiscoKpis(r)
    +`<div class="fis-grelha">`+fiscoObrigacoesCard(r)+fiscoSituacaoCard(r)+fisPrazosCard()+`</div>`
    +`<div class="fiscoPilha u-d-grid u-gtc-minmax-0-1fr u-g-14px">`
    +fiscoQuadroCard(r,Q.semReducao)+fiscoQuadroCard(r,Q.comReducao)+(q43?fiscoQuadroCard(r,q43):'')+fiscoQuadro5Card(r)+fiscoIsentosCard(r)+fiscoBeneficiosCard(r)+fiscoObrasCard(r)
    +fiscoAnosAnterioresCard(r)+fiscoAimiCard(r)+fiscoAnexoJCard(r)+fiscoCategoriaBCard(r)+fiscoForaCard(r)+fiscoSemContratoCard(r)+fisNadaForaCard(r)+`</div>`
    +fiscoAvisoCard()+`</div>`;
}
/* Os contratos que estiveram em vigor no ano sem nenhuma renda registada
   nele: os que o vazio «Sem rendas em AAAA» nomeia (D04). Um contrato sem
   rendas no ano não tem linha no resumo, e sem isto a página dizia só «Sem
   rendas» de um contrato que a AT conhece pelo Modelo 2. Contam os que não
   estão marcados como não declarados, de um imóvel desta declaração (com
   quota de um dos titulares no ano, como o resumo), com o início até ao dia
   de hoje e até 31/12 do ano e o último dia em vigor (irs.js:irsFimReal) no
   ano ou depois — um ano que ainda não começou não tem meses em vigor. Um
   contrato terminado sem data de fim não diz quando acabou, e não se
   adivinha: fica de fora (como no fisco-resumo.js:fiscoHaviaContrato). Quando
   o resumo já os traz (r.contratosSemRendas, da vaga 2), usam-se esses.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: [{contratoId, nome}], pelo nome. */
function fiscoContratosSemRendas(r){
  if(Array.isArray(r.contratosSemRendas))return r.contratosSemRendas
    .map(x=>{const id=(x&&(x.contratoId||x.id))||'',c=id?contract(id):null;return {contratoId:id,nome:String((x&&x.nome)||(c?ctName(c):''))}})
    .filter(x=>x.nome);
  const A=String(r.ano),ini=A+'-01-01',fimAno=A+'-12-31',hoje=today(),ate=hoje<fimAno?hoje:fimAno;
  if(ate<ini)return [];
  const tits=r.titulares||[],props={};
  pidProps(null).forEach(p=>{if(pode(p.id,'report.view')&&(!tits.length||tits.some(o=>fiscoQuotaNoAno(p,o,r.ano)>0)))props[p.id]=p});
  const comRenda={};
  (db.transactions||[]).forEach(t=>{if(t.contractId&&ehRenda(t)&&String(t.date||'').startsWith(A))comRenda[t.contractId]=1});
  return (db.contracts||[]).filter(c=>{
    if(!c||ctNaoDeclarado(c)||comRenda[c.id]||!props[c.propertyId]||!c.start||c.start>ate)return false;
    const fim=irsFimReal(c);
    return fim?fim>=ini:c.active!==false;
  }).map(c=>({contratoId:c.id,nome:ctName(c)})).sort((a,b)=>a.nome.localeCompare(b.nome,'pt'));
}
/* A frase do vazio «Sem rendas em AAAA» com os contratos em vigor no ano sem
   rendas registadas (fiscoContratosSemRendas): os cinco primeiros pelo nome e
   «e N outros», no singular ou no plural. Não diz que as rendas faltam — a app
   não sabe o que entrou —, diz o que fazer com as que entraram.
   Recebe: sem — [{contratoId, nome}]; ano — o ano.
   Devolve: a frase (HTML, com um espaço no fim), ou '' sem contratos. */
function fiscoFraseSemRendas(sem,ano){
  if(!sem||!sem.length)return '';
  const nomes=sem.slice(0,5).map(x=>esc(x.nome)),mais=sem.length-nomes.length;
  const lista=listaE(mais>0?nomes.concat([fiscoN(mais,'outro','outros')]):nomes);
  return sem.length===1
    ?`O contrato ${lista}, em vigor em ${ano}, não tem nenhuma renda registada neste ano. Se recebeste rendas dele, regista-as ligadas ao contrato; as que não recebeste não se declaram. `
    :`Os contratos ${lista}, em vigor em ${ano}, não têm nenhuma renda registada neste ano. Se recebeste rendas deles, regista-as ligadas a cada contrato; as que não recebeste não se declaram. `;
}
/* O aviso de responsabilidade da Declaração, num cartão discreto no fim da
   página: o texto aprovado (irs.js:IRS_AVISO), à letra — o mesmo do PDF, do
   CSV, do texto copiado e do guia —, com o botão que abre o CSV e o PDF
   (fiscoPartilha) ao lado, para o aviso ficar perto do que se leva daqui.
   Devolve: o HTML do cartão (string). */
function fiscoAvisoCard(){
  return `<section class="card fis-aviso"><p class="hint">${esc(IRS_AVISO)}</p>`
    +`<button type="button" class="btn sm" data-toca="camada" data-click="fiscoPartilha()" aria-haspopup="dialog">${ic('partilhar',18)}<span>Exportar CSV ou PDF</span></button></section>`;
}
/* A barra do topo do IRS: só as ações da página, juntas à direita, numa
   linha também no telemóvel. O ano escolhe-se no painel do funil (vFisco) e
   não aqui — na barra era o mesmo filtro outra vez; o ponto do funil acende
   com ele fora do automático (fiscoAnaN). As ações: o guia
   de preenchimento, que é o público (/guias/declarar-rendas), numa página
   nova — um botão pequeno com o livro e «Guia», com o nome inteiro no
   aria-label e no title —, e o botão de partilha, só de ícone (o feitio do
   avaliacao.js:avaPartilha), que abre a janela com o CSV e o PDF
   (fiscoPartilha). Os dois são .btn.sm: 36px no rato, 44 no dedo
   (estilos.css:.fis-acoes).
   Devolve: o HTML da barra (string). */
function fisBarra(){
  const guia='Guia de preenchimento do Anexo F';
  return `<div class="ana-barra"><div class="ana-acoes fis-acoes"><a class="btn sm fis-guia" href="/guias/declarar-rendas" target="_blank" rel="noopener" data-toca="nada" aria-label="${guia}" title="${guia}">${ic('livro',18)}<span>Guia</span></a>`
    +`<button type="button" class="btn sm so-icone" data-toca="camada" data-click="fiscoPartilha()" aria-haspopup="dialog" aria-label="Partilhar" title="Partilhar">${ic('partilhar',18)}</button></div></div>`;
}
/* A janela do botão de partilha (o da barra, fisBarra, e o do aviso no fim,
   fiscoAvisoCard): a escolha da casa (componentes.js:pickModal), com o ícone
   e uma linha a dizer o que leva cada uma — «Exportar CSV» e «Exportar PDF»
   (fisco-exportar.js:fiscoCsv, fisco-pdf.js:fiscoPdf). As duas, sempre: a
   Declaração requer os Contratos (servicos.js, D57), onde vive o escritor do
   PDF, e sem eles nem esta página abre. Escolher fecha a janela e exporta.
   Devolve: nada — abre a janela. */
function fiscoPartilha(){
  const ops=[{v:'csv',label:'Exportar CSV',sub:'Uma linha por contrato, para abrir no Excel',icon:'down'},
    {v:'pdf',label:'Exportar PDF',sub:'Os quadros campo a campo, para guardar ou imprimir',icon:'contract'}];
  pickModal('Partilhar',ops,o=>{closeModal();if(o.v==='pdf')fiscoPdf();else fiscoCsv()});
}
/* Os cinco números do ano à cabeça (a prancheta), em cartões com explicação
   ao toque: rendas ilíquidas, retenções na fonte, gastos dedutíveis (com as
   obras dos 24 meses), o rendimento líquido (sem o dos contratos isentos, que
   o rodapé diz) e o imposto estimado, em destaque — os totais dos quadros,
   antes de os ler linha a linha. O imposto é o do resumo depois de abater os
   prejuízos de anos anteriores que a app conhece (fiscoImpostoDoKpi: o
   totais.impostoDepoisDoReporte, titular a titular, nunca negativo — Q10,
   D73), com uma linha a dizer o prejuízo que abateu, de cada titular em
   conjunta (fiscoReportePorTitular); o prejuízo deste ano diz-se de cada
   titular, com a letra em conjunta (fisco-exportar.js:fiscoPrejuizos, o mesmo
   do PDF e do texto, que lê o totais.porTitular). Com o AIMI no quadro 9, uma
   linha diz o imposto depois do abate que o cartão dele estima (nunca mais do
   que o imposto depois do reporte), sem mudar o número principal. Com um
   contrato do 4.2 que acabou por motivo do senhorio (quadro 10, código 01),
   a regularização das reduções soma-se à parte, numa linha, como estimativa
   sem juros (totais.regularizacao, D10). A falta a pagar conta com os três.
   As rendas ilíquidas são a renda do recibo, antes da retenção, da comissão
   e de descontos (D112), e levam a caução do ano em que se recebe (D03), os
   reembolsos do inquilino e as indemnizações, menos as rendas devolvidas; as
   de um imóvel subarrendado (o quadro 5, D52) dizem-se numa linha à parte, e
   o imposto e as retenções delas já estão nos do resumo. As do Anexo J e da
   categoria B (D133, D134) também se dizem à parte, e não estão nos números
   nem no imposto (fiscoKpiForaDoF). Com o 6B ou o 6C, o rendimento líquido
   diz numa linha o que o imposto conta (fiscoKpiLiquidoDoImposto), e o
   porquê do imposto diz os 5 % do 6A e do 4.3 (D118). A regularização de um
   direito real de habitação duradoura cessado por acordo soma-se como a do
   quadro 10, com o quadro 4.3 a dizê-lo (D120).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML da grelha (string). */
function fiscoKpis(r){
  const T=r.totais,g=sum(r.colunas.map(k=>T.gastos[k]))+T.obras24;
  const imposto=fiscoImpostoDoKpi(r),pre=fiscoPrejuizos(r);
  const varios=!!r.variosTitulares;
  const rep=fiscoReportePorTitular(r),repUsado=r2(sum(rep.map(x=>x.usado))),repImposto=r2(Math.max(0,r2(Math.max(0,Number(T.imposto)||0))-imposto));
  const a=r.aimi||null,abate=a&&Number(a.abate)>0?r2(Math.min(Number(a.abate),imposto)):0,depois=r2(Math.max(0,imposto-abate));
  const reg=fiscoRegularizacao(r);
  const aPagar=r2(depois+reg-(Number(T.retencoes)||0));
  const Q9=esc((r.versao&&r.versao.quadros&&r.versao.quadros.aimi)||'9');
  /* o quadro 5 (a sublocação, D52): as rendas dele não estão nas dos quadros
     4.1 e 4.2, e diz-se à parte; o imposto delas já está no estimado
     (totais.imposto) e as retenções nas retenções (totais.retencoes) */
  const Q5=(r.versao&&r.versao.quadros&&r.versao.quadros.sublocacao)||'5',T5=T.quadro5||null;
  const rec5=T5&&Number(T5.rendaRecebida)>0?r2(Number(T5.rendaRecebida)):0;
  const linha5=rec5?`<div class="foot">mais ${euro(rec5)} recebidos no quadro ${esc(Q5)} (sublocação)</div>`:'';
  /* as rendas fora do Anexo F (D133, D134): não estão nos quadros nem no
     imposto estimado; dizem-se à parte, com o anexo onde vão */
  const fx=fiscoKpiForaDoF(r),QJ=esc(((r.versao&&r.versao.anexoJ)||{}).quadro||'7A');
  const linhaJ=fx.anexoJ>0?`<div class="foot">mais ${euro(fx.anexoJ)} no Anexo J, quadro ${QJ} (imóveis fora de Portugal)</div>`:'';
  const linhaB=fx.categoriaB>0?`<div class="foot">mais ${euro(fx.categoriaB)} na categoria B (Anexo B ou C)</div>`:'';
  /* com o 6B ou o 6C o imposto conta outro líquido que o dos quadros */
  const trib=fiscoKpiLiquidoDoImposto(r);
  const linhaTrib=trib!=null?`<div class="foot">no imposto: ${euro(trib)} (quadro 6)</div>`:'';
  /* os 5 % do imóvel reabilitado (6A) e do direito real de habitação
     duradoura (4.3), quando há linhas com eles (D118) */
  const q43=fiscoQuadroDhd(r),tem6A=r.linhas.some(l=>l&&fiscoBeneficiosDe(l).some(b=>b.taxa!=null)),tem43=!!q43&&r.linhas.some(l=>l&&l.quadro===q43);
  /* o rodapé e a explicação do rendimento líquido: com prejuízo, de quem é e
     a condição do reporte (n.º 8: 36 meses de rendas nos cinco anos seguintes) */
  const reporte='O resultado negativo não se perde: abate às rendas dos seis anos seguintes, desde que os imóveis desses gastos deem rendas durante pelo menos 36 meses, seguidos ou não, nos cinco anos seguintes (CIRS art. 55.º). É de cada titular e só abate às rendas dele; a AT faz a conta.';
  const pePre=!pre.length?'':!varios?'prejuízo a reportar'
    :pre.length===1?'prejuízo a reportar'+(pre[0].letra?' do titular '+esc(pre[0].letra):'')+': '+euro(pre[0].valor)
    :'prejuízos a reportar: '+pre.map(x=>(x.letra?esc(x.letra)+' ':'')+euro(x.valor)).join(' · ');
  const seis=trib!=null?' Com os benefícios do quadro 6 o imposto conta outro valor: no 6C as rendas contam 50 % e no 6B as obras dos 24 meses 110 % — o imposto estimado parte de '+euro(trib)+'. Os quadros levam os valores por inteiro, e é a AT que aplica o fator pelo campo do quadro 6.':'';
  const porqueLiq=(!pre.length?'As rendas ilíquidas menos os gastos dedutíveis, linha a linha.'+(trib!=null?'':' É sobre isto que se paga o imposto.')
    :(varios?'Cada titular tem o seu resultado: o prejuízo de um não abate às rendas do outro, e o imposto sai só das rendas de quem não teve prejuízo. ':'As rendas não chegaram para os gastos. ')+reporte)+seis;
  /* a linha do reporte: o prejuízo de anos anteriores que abateu, de cada
     titular em conjunta (rev6 §6.1: «Prejuízos de anos anteriores: −X €») */
  const repTxt=!repUsado?'':!varios?'prejuízos de anos anteriores: −'+euro(repUsado)
    :rep.length===1?'prejuízos de anos anteriores'+(rep[0].letra?' do titular '+esc(rep[0].letra):'')+': −'+euro(rep[0].usado)
    :'prejuízos de anos anteriores: '+rep.map(x=>(x.letra?esc(x.letra)+' ':'')+'−'+euro(x.usado)).join(' · ');
  const linhaRep=repTxt?`<div class="foot">${repTxt}</div>`:'';
  /* a linha do AIMI: o imposto depois do abate, ou que falta um VPT para o estimar */
  const linhaAimi=!a?'':a.abate==null?`<div class="foot">abate do AIMI por estimar: falta um VPT</div>`
    :abate>0?`<div class="foot">depois do AIMI: ~${euro(depois)} (estimativa)</div>`:'';
  /* a linha da regularização do quadro 10 (D10) e da cessação por acordo de
     um direito real de habitação duradoura (o 4.3, D120), somada à parte */
  const Q10=esc((r.versao&&r.versao.quadros&&r.versao.quadros.cessados)||'10');
  const regs=Array.isArray(r.regularizacoes)?r.regularizacoes.filter(x=>x&&Number(x.total)>0):[];
  const regDhd=regs.some(x=>x.dhd),reg10=!regs.length||regs.some(x=>!x.dhd);
  const qsReg=listaE((reg10?[Q10]:[]).concat(regDhd&&q43?[esc(q43)]:[]));
  const linhaReg=reg>0?`<div class="foot">com a regularização ${qsReg.indexOf(' e ')>-1?'dos quadros':'do quadro'} ${qsReg}: ~${euro(r2(depois+reg))} (+${euro(reg)}, estimativa sem juros)</div>`:'';
  const porqueImp='O rendimento líquido de cada linha à taxa que a lei de '+r.ano+' dá ao contrato, somado titular a titular: as perdas de uma linha abatem às rendas das outras do mesmo titular, nunca às de outro titular, e o imposto nunca é negativo. '+(T5&&Number(T5.n)>0?'Conta também a diferença positiva de cada linha do quadro '+esc(Q5)+' (a sublocação). ':'')
    +(tem6A||tem43?(tem6A&&tem43?'As rendas de imóveis reabilitados (quadro 6A) e a prestação mensal de um direito real de habitação duradoura (quadro '+esc(q43)+') pagam 5 %. ':tem6A?'As rendas de imóveis reabilitados (quadro 6A) pagam 5 %. ':'A prestação mensal de um direito real de habitação duradoura (quadro '+esc(q43)+') paga 5 %. '):'')
    +(trib!=null?'No 6C as rendas contam 50 %, e no 6B as obras dos 24 meses 110 %. ':'')
    +'É uma estimativa sem englobamento, com as taxas nacionais: quem reside nos Açores tem as taxas 30 % mais baixas, e a AT aplica-as pela residência. O valor certo é o da liquidação da AT. As retenções do inquilino abatem a isto.'
    +(fx.anexoJ>0||fx.categoriaB>0?' Não conta '+listaE((fx.anexoJ>0?['as rendas de imóveis fora de Portugal (Anexo J)']:[]).concat(fx.categoriaB>0?['as da categoria B (Anexo B ou C)']:[]))+': a app não as estima.':'')
    +(repUsado?' Os prejuízos de anos anteriores que a app conhece ('+euro(repUsado)+') abatem ao rendimento deste ano, o mais antigo primeiro e titular a titular (CIRS art. 55.º): o imposto estimado desce '+euro(repImposto)+'. Pode faltar informação — imóveis fora da app, anos sem registos, a condição dos 36 meses de rendas nos cinco anos seguintes —, e a AT faz a conta na liquidação.':'')
    +(a?' O AIMI pago abate ao imposto (quadro '+Q9+'): a app estima a parte dos prédios arrendados e limita-a ao imposto estimado das rendas. É a leitura da app; a lei fala da coleta à taxa de 28 %, e a conta certa é a da AT.'+(abate>0&&T.retencoes?' A falta a pagar já conta com este abate.':''):'')
    +(reg>0&&reg10?' Um contrato com redução pela duração que acabou antes do prazo por motivo do senhorio (quadro '+Q10+') perde a redução do período em que acabou: a diferença para a taxa da duração que decorreu regulariza-se nesta declaração, com juros compensatórios (CIRS art. 72.º).':'')
    +(reg>0&&regDhd?' Um direito real de habitação duradoura que cessou por acordo das partes (quadro '+esc(q43)+') perde os 5 % desde o início: a diferença para a taxa base regulariza-se nesta declaração, com juros compensatórios (CIRS art. 72.º n.º 20).':'')
    +(reg>0?' A app soma a diferença à parte, sem os juros'+(T.retencoes?', e a falta a pagar já a conta.':'.'):'');
  /* o que as rendas ilíquidas são: a renda do recibo, antes da retenção, da
     comissão e de descontos (D112) */
  const porqueRendas='A renda do recibo, antes da retenção, da comissão e de descontos: o que entrou como renda mais o que o inquilino reteve na fonte, no ano em que foi recebida. Se uma gestora te transfere a renda já sem a comissão, a renda é a do recibo e a comissão é um gasto, na coluna Outros. Conta com a caução, que é renda do ano em que a recebes (a de um direito real de habitação duradoura não), os reembolsos que o inquilino te pagou, as indemnizações que compensam rendas e as outras receitas prediais, menos as rendas que devolveste. É o valor que vai aos quadros 4.1, 4.2 e 4.3; os empréstimos recebidos ficam de fora.'
    +(rec5?' As rendas de um imóvel que subarrendas vão ao quadro '+esc(Q5)+', à parte: o rendimento delas é a diferença para a renda que pagas ao senhorio.':'')
    +(fx.anexoJ>0?' As de um imóvel fora de Portugal vão ao Anexo J, e não estão aqui.':'')+(fx.categoriaB>0?' As da categoria B vão ao Anexo B ou C, e não estão aqui.':'');
  return `<div class="grid fis-kpis">
    ${kpi('Rendas ilíquidas',euro(T.rendas),'',fiscoN(fiscoNContratos(r.linhas),'contrato','contratos')+' em '+r.ano,porqueRendas,null,null,{extra:linha5+linhaJ+linhaB})}
    ${kpi('Retenções na fonte',euro(T.retencoes),'',T.retencoes?'retidas pelos inquilinos':'nenhuma registada','O que os inquilinos retiveram na fonte e entregaram à AT por ti, como está nos movimentos'+(T5&&Number(T5.retencoes)>0?' — com as do quadro '+esc(Q5)+', a sublocação':'')+'. Já conta nas rendas ilíquidas e abate ao imposto.')}
    ${kpi('Gastos dedutíveis',euro(g),'',T.obras24?'com '+euro(T.obras24)+' de obras dos 24 meses':'conservação, condomínio, IMI, selo, taxas e outros','As colunas de gastos dos quadros, pela regra de cada categoria (Definições → Categorias, etiquetas e IRS), só do período em que o imóvel esteve arrendado, e as obras de conservação dos 24 meses antes de um contrato. Ficam fora os juros, o mobiliário, o AIMI e as obras que acrescentam valor. Para o IRS conta a quota de cada um no imóvel, e não quem pagou nem a divisão escolhida no movimento (CIRS art. 19.º).')}
    ${kpi('Rendimento líquido',euro(T.liquido),T.liquido<0?'neg':'',pePre||(T.isentos.n?'sem os '+euro(T.isentos.liquido)+' isentos (6D)':'rendas menos gastos'),porqueLiq,null,null,{extra:linhaTrib})}
    ${kpi('Imposto estimado',euro(imposto),'',T.retencoes?'já retido '+euro(T.retencoes)+' · '+(aPagar>=0?'falta '+euro(aPagar):'a receber '+euro(-aPagar)):'sem englobamento',porqueImp,null,null,{extra:linhaRep+linhaAimi+linhaReg})}</div>`;
}
/* As rendas do ano que saem do Anexo F, para o KPI das rendas: as do Anexo J
   (imóveis fora de Portugal, totais.anexoJ — D133) e as da categoria B
   (totais.categoriaB — D134); sem os totais, a soma das entradas de
   r.anexoJ e r.categoriaB; um resumo sem nada disto dá zeros.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: {anexoJ, categoriaB} — euros (≥ 0, ao cêntimo). */
function fiscoKpiForaDoF(r){
  const T=(r&&r.totais)||{};
  const de=(k,lista)=>{const t=T[k]&&T[k].rendas;if(t!=null&&isFinite(Number(t)))return r2(Math.max(0,Number(t)));
    return r2(Math.max(0,sum((Array.isArray(lista)?lista:[]).map(x=>Number(x&&x.rendas)||0))))};
  return {anexoJ:de('anexoJ',r&&r.anexoJ),categoriaB:de('categoriaB',r&&r.categoriaB)};
}
/* O líquido sobre que o imposto se estima, quando é outro que o dos quadros
   (o KPI do rendimento líquido): com o 6C as rendas contam 50 % e com o 6B as
   obras dos 24 meses 110 % (l.liquidoTributavel, fisco-quadros.js:
   fiscoLiquidoDoImpostoOutro). Sem os isentos, como o totais.liquido.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: euros, ou null quando nenhuma linha tem outro (o do KPI é o do
   imposto). */
function fiscoKpiLiquidoDoImposto(r){
  const ls=((r&&r.linhas)||[]).filter(l=>l&&!l.isencao);
  if(!ls.some(l=>fiscoLiquidoDoImpostoOutro(l)!=null))return null;
  return r2(sum(ls.map(l=>{const t=fiscoLiquidoDoImpostoOutro(l);return t!=null?t:Number(l.liquido)||0})));
}
/* O imposto do KPI: o do resumo depois de abater os prejuízos de anos
   anteriores (totais.impostoDepoisDoReporte, rev6 §6.1). O resumo de antes do
   reporte não o traz: aí é o totais.imposto menos o r.reporte.imposto, se
   houver, e sem nenhum dos dois o totais.imposto. Nunca negativo.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: euros (≥ 0, ao cêntimo). */
function fiscoImpostoDoKpi(r){
  const T=(r&&r.totais)||{},dr=T.impostoDepoisDoReporte;
  if(dr!=null&&dr!==''&&isFinite(Number(dr)))return r2(Math.max(0,Number(dr)));
  const base=Math.max(0,Number(T.imposto)||0),rep=Math.max(0,Number(((r&&r.reporte)||{}).imposto)||0);
  return r2(Math.max(0,base-rep));
}
/* O prejuízo de anos anteriores que abate ao rendimento deste ano, por
   titular (r.reporte.porTitular[id].usado, rev6 §6.1), com a letra de cada
   um tirada das linhas, como o fisco-exportar.js:fiscoPrejuizos; sem o
   porTitular, o r.reporte.usado inteiro, sem letra.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: [{letra, usado}] só com os que abatem alguma coisa, pela letra;
   letra '' com um titular só, ou quando não se sabe. */
function fiscoReportePorTitular(r){
  const rep=(r&&r.reporte)||null;if(!rep||typeof rep!=='object')return [];
  const pt=rep.porTitular;
  if(pt&&typeof pt==='object'&&Object.keys(pt).length){
    const letra={};((r&&r.linhas)||[]).forEach(l=>{if(l&&!(l.titularId in letra))letra[l.titularId]=l.titular||''});
    return Object.keys(pt).filter(k=>pt[k]&&Number(pt[k].usado)>0)
      .map(k=>({letra:r.variosTitulares?(letra[k]||''):'',usado:r2(Number(pt[k].usado))}))
      .sort((a,b)=>String(a.letra).localeCompare(String(b.letra)));
  }
  return Number(rep.usado)>0?[{letra:'',usado:r2(Number(rep.usado))}]:[];
}
/* A regularização das reduções de um contrato que acabou por motivo do
   senhorio (quadro 10, D10), estimada sem juros: o totais.regularizacao do
   resumo; sem ele, a soma dos r.regularizacoes[].total.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: euros (≥ 0, ao cêntimo). */
function fiscoRegularizacao(r){
  const T=(r&&r.totais)||{};
  if(T.regularizacao!=null&&isFinite(Number(T.regularizacao)))return r2(Math.max(0,Number(T.regularizacao)));
  const rs=Array.isArray(r&&r.regularizacoes)?r.regularizacoes:[];
  return r2(Math.max(0,sum(rs.map(x=>Number(x&&x.total)||0))));
}
/* O rótulo do botão de um aviso, pelo sítio que ele abre: a ficha de um
   contrato, de um inquilino, de um imóvel ou de um movimento, uma pergunta
   do contrato (o «Responder» de contrato.js:ctIrParaPergunta), a lista dos
   contratos, dos imóveis ou dos movimentos, as definições do IRS, ou o
   «Marcar como enviado» do envio ao IHRU (prazos.js:pzIhruPergunta).
   Recebe: abrir — o código da ação do aviso.
   Devolve: o rótulo (texto). */
function fiscoRotuloDoAviso(abrir){
  const a=String(abrir||'');
  if(/^pzIhruPergunta\(/.test(a))return 'Marcar como enviado';
  if(/^fiscoAvReporSplitwise\(/.test(a))return 'Repor o total';
  if(/^ctResponderEmpresa\(/.test(a)||/^ctIrParaPergunta\(/.test(a))return 'Responder';
  if(/^ctView\(/.test(a))return 'Abrir contrato';
  if(/^personView\(/.test(a))return 'Abrir inquilino';
  if(/^propView\(/.test(a))return 'Abrir imóvel';
  if(/^txView\(/.test(a))return 'Abrir movimento';
  if(/go\('contracts'\)/.test(a))return 'Ver contratos';
  if(/go\('transactions'\)/.test(a))return 'Ver movimentos';
  if(/go\('properties'\)/.test(a))return 'Ver imóveis';
  if(/go\('settings'\)/.test(a))return 'Abrir definições';
  return 'Abrir';
}
/* O cartão «A tratar antes de entregar» (a prancheta): os avisos do resumo,
   numerados, com o selo do nível (vermelho o que falta à AT, âmbar o que
   convém tratar, cinzento o que só se diz) e o botão que abre o sítio onde se
   trata; o dos não declarados fica sem botão, que não há nada a tratar. Sem
   avisos não afirma que não falta nada — a app só vê o que se registou (uma
   renda que entrou e não se registou não se vê) —: diz que não encontrou
   nada em falta nos dados registados.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string). */
function fiscoObrigacoesCard(r){
  const cor={falta:'red',aviso:'amber',info:'grey'};
  const row=(a,i)=>`<div class="fis-ob"><span class="badge ${cor[a.nivel]||'amber'} fis-num">${i+1}</span><p>${esc(a.texto)}</p>${a.abrir
    ?`<button type="button" class="btn sm" data-toca="${esc(a.toca||'camada')}" data-click="${a.abrir}">${fiscoRotuloDoAviso(a.abrir)}</button>`:''}</div>`;
  const nTratar=r.avisos.filter(a=>a.nivel!=='info').length;
  const corpo=r.avisos.length?`<div class="fis-obs">${r.avisos.map(row).join('')}</div>`
    :`<p class="hint">Não encontrámos nada em falta nos dados que registaste. Confirma que todas as rendas que recebeste em ${r.ano} estão registadas: as que não estão, a app não as vê.</p>`;
  /* o selo da contagem cola-se ao título (a prancheta), em vez de fugir para o canto */
  return fisCartao('A tratar antes de entregar'+(nTratar?` <span class="badge amber">${nTratar}</span>`:''),
    r.avisos.length?fiscoN(r.avisos.length,'ponto','pontos')+' de '+r.ano:'Nada encontrado em falta em '+r.ano,
    corpo+`<p class="hint">A app resume, não declara: o que falta fica escrito aqui e ao pé de cada linha dos quadros. Os prazos com data estão nos Prazos da AT.</p>`,
    'fis-tratar');
}
/* O cartão «Prazos da AT»: os prazos da AT que já entraram na janela de aviso
   (prazos.js:prazosAtivos — o Modelo 2, a cessação, os recibos, a entrega do
   Anexo F, a comunicação de fevereiro, o envio ao IHRU, o Modelo 44 e o
   registo dos elementos mínimos de um contrato de antes de abril de 2015, que
   não tem data), do mais urgente para o menos e os sem data no fim, cada um
   com o selo da urgência como o cartão da Visão geral o diz e pinta
   (prazos.js:pzQuando e pzSelo — «Passou há N dias», «É hoje», «Faltam N
   dias», «Sem prazo»; até sete dias a vermelho, até trinta a âmbar, o resto a
   cinzento) e o toque que abre a ficha certa (o do próprio Anexo F, que é esta
   página, não se escreve). Um prazo que se resolve no próprio aviso (o
   «Marcar como comunicada» de fevereiro, o «Marcar como enviado» do IHRU —
   o mesmo botão do prazos.js:prazosCard) deixa de ser uma linha que se toca
   inteira (um toque no botão corria também o da linha): leva o botão da ação
   e o que abre a ficha, por baixo do texto. Mostra os cinco primeiros; os
   outros estão nos Prazos da visão geral. Nada antes de o estado chegar
   (espera.js:sabemosOEstado): um prazo silenciado noutro aparelho voltava.
   Devolve: o HTML do cartão (string). */
function fisPrazosCard(){
  const AT={modelo2:1,cessacao:1,recibos:1,irs:1,fev15:1,rsaa:1,modelo44:1,elementos:1};
  if(!sabemosOEstado())return '';
  const lista=prazosAtivos().filter(p=>AT[p.tipo]);
  /* o selo pelo prazos.js, que é da base (um aviso sem data diz «Sem prazo», e não «Hoje») */
  const selo=p=>`<span class="badge ${pzSelo(p)}">${esc(pzQuando(p))}</span>`;
  const tocaDe=a=>/^go\(/.test(a)?'ecra':'camada';
  const row=p=>{const abre=p.abrir&&p.abrir!=="go('fisco')";
    const txt=`<b>${esc(p.titulo)}</b><span class="small">${esc(p.sub)}</span>`;
    if(p.acao&&typeof p.acao==='string'){
      const acao=`<button type="button" class="btn sm primary" data-toca="camada" aria-label="${esc(p.acaoTexto||'Marcar')}: ${esc(p.titulo)}" data-click="${p.acao}">${esc(p.acaoTexto||'Marcar')}</button>`;
      const ver=abre?`<button type="button" class="btn sm" data-toca="${tocaDe(p.abrir)}" data-click="${p.abrir}">${fiscoRotuloDoAviso(p.abrir)}</button>`:'';
      return `<div class="fis-pz"><div>${txt}<span class="chips-fila fis-pz-acoes">${acao}${ver}</span></div>${selo(p)}</div>`;
    }
    return `<div class="fis-pz${abre?' tap':''}"${abre?` data-toca="${tocaDe(p.abrir)}" data-click="${p.abrir}"`:''}><div>${txt}</div>${selo(p)}</div>`};
  const mais=lista.length-5;
  const corpo=lista.length?`<div class="fis-pzs">${lista.slice(0,5).map(row).join('')}</div>${mais>0?`<p class="hint">E ${fiscoN(mais,'outro','outros')} nos Prazos da visão geral.</p>`:''}`
    :`<p class="hint">Nenhum prazo da AT na janela de aviso. Os da entrega, do Modelo 2 e dos recibos aparecem aqui com antecedência.</p>`;
  return fisCartao('Prazos da AT',lista.length?fiscoN(lista.length,'prazo','prazos')+' na janela de aviso':'Nada para já',corpo,'fis-prazos');
}
/* Os proprietários dos imóveis com rendas no ano que vejo com a Avaliação
   aberta pelo cargo, pela ordem em que aparecem: os primeiros da escolha do
   cônjuge em «A tua situação fiscal» (fiscoCandidatosConjuge).
   Recebe: ano — o ano.
   Devolve: os ids (array de strings). */
function fiscoDonosDoAno(ano){
  const A=String(ano),ids=[],visto={};
  (db.transactions||[]).forEach(t=>{
    if(!ehRenda(t)||!String(t.date||'').startsWith(A))return;
    const c=t.contractId?contract(t.contractId):null,pid=(c&&c.propertyId)||t.propertyId||'';
    const p=pid?prop(pid):null;if(!p||!pode(p.id,'report.view'))return;
    ownersOfProp(p).forEach(o=>{if(!visto[o]){visto[o]=1;ids.push(o)}});
  });
  return ids;
}
/* Quem se pode escolher como cônjuge na situação de um ano: os proprietários
   que não sou eu — primeiro os dos imóveis com rendas no ano
   (fiscoDonosDoAno), depois os outros pelo nome. Não só os desta declaração:
   o cônjuge pode ter rendas só em imóveis que não são meus.
   Recebe: ano — o ano; eu — o meu id.
   Devolve: os ids (array de strings). */
function fiscoCandidatosConjuge(ano,eu){
  const existe=new Map();(db.owners||[]).forEach(o=>{if(o&&o.id&&o.id!==eu)existe.set(o.id,o)});
  const out=fiscoDonosDoAno(ano).filter(id=>existe.has(id));
  const resto=[...existe.keys()].filter(id=>out.indexOf(id)<0)
    .sort((a,b)=>String(existe.get(a).name||'').localeCompare(String(existe.get(b).name||''),'pt'));
  return out.concat(resto);
}
/* O limite da dispensa dos recibos eletrónicos de um ano (D111): as rendas
   do ano anterior até duas vezes o IAS desse ano anterior (Portaria
   98-A/2015, art. 5.º n.º 2; o folheto do Modelo 44 da AT faz a conta com o
   IAS do ano das rendas — INCERTO pela FAQ 5937). O IAS vem da versão das
   regras desse ano (irs-AAAA.js, ias); sem versão própria, não há número.
   Recebe: ano — o ano dos rendimentos.
   Devolve: o texto do limite (HTML), «1 045,00 € (duas vezes o IAS de 2025)»
   ou «duas vezes o IAS de 2024». */
function fiscoLimiteDispensa(ano){
  const ant=Number(ano)-1,ias=Number(irsAno(ant).ias);
  return ias>0?euro2(r2(2*ias))+' (duas vezes o IAS de '+ant+')':'duas vezes o IAS de '+ant;
}
/* O cartão «A tua situação fiscal em AAAA» (a prancheta M-SituacaoFiscal): o
   que só o senhorio sabe e muda o Anexo F desse ano, em linhas que gravam ao
   mexer, na situação desse ano (irs-papeis.js:irsSituacao, D91 — a de 31 de
   dezembro, CIRS art. 13.º; mudar um ano não muda os anteriores). A
   tributação conjunta num interruptor e, com ela, o cônjuge — um proprietário
   escolhido numa lista (fiscoCandidatosConjuge) — e a minha letra no Rosto
   num segmentado A/B, ficando o cônjuge com a outra (D30: as letras são só a
   posição no Rosto e não decidem que rendas entram); a nota de que só entram
   os imóveis do cônjuge que estão nesta app (D31), ou de que sem cônjuge
   escolhido entram só as minhas rendas. A dispensa dos recibos eletrónicos
   noutro interruptor, com quem está dispensado nesse ano — o limite com o IAS
   do ano anterior (fiscoLimiteDispensa, D111) — e o Modelo 44 que isso obriga
   a entregar. Uma nota fixa diz as letras que a app não escreve (F no ano do
   óbito do cônjuge, D1/AF1/DG1 dos dependentes, D70): a correção faz-se no
   Portal. Outra diz que as rendas da categoria B (a opção do CIRS art. 4.º
   n.º 1 n), ou o imóvel afeto à atividade, art. 3.º n.º 2 a)) não vão ao
   Anexo F, e que se marcam no contrato (D134). Grava logo (fiscoSetSituacao, fiscoSetConjuge) em
   settings.irs.porAno, que vai com as definições. Sem saber quem és (por
   inteiro), não há cônjuge a escolher, e diz-se.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string). */
function fiscoSituacaoCard(r){
  const ano=Number(r.ano),eu=r.porInteiro?'':String(r.titularId||'');
  const s=irsSituacao(ano,eu);
  const interruptor=(id,campo,on,nome)=>`<button type="button" class="interruptor" role="switch" id="${id}" aria-checked="${on?'true':'false'}" aria-label="${nome}" data-toca="dados" data-click="fiscoSetSituacao(${ano},'${campo}',${on?'false':'true'})"></button>`;
  let conj='';
  if(s.conjunta&&!eu)conj=`<p class="hint fis-sit-nota">Sem saber qual dos proprietários és, não há cônjuge a escolher: entra na tua conta para a Declaração juntar a tua parte e a do cônjuge.</p>`;
  else if(s.conjunta){
    const cands=fiscoCandidatosConjuge(ano,eu),nomeDe=o=>(owner(o)||{}).name||'';
    const escolhido=s.conjugeId&&cands.indexOf(s.conjugeId)>-1?s.conjugeId:'';
    const campo=cands.length
      ?`<label class="fis-sit-nota fis-sit-campo">O teu cônjuge${sel('fiscoConjuge',escolhido,[{v:'',label:'Ninguém escolhido'}].concat(cands.map(o=>({v:o,label:nomeDe(o)}))),'fiscoSetConjuge','dados')}</label>`
      :`<p class="hint fis-sit-nota">Não há outro proprietário nesta app para escolher como cônjuge: a parte do cônjuge só entra quando ele for proprietário de um imóvel que vês aqui.</p>`;
    const outra=s.minhaLetra==='B'?'A':'B';
    const letra=`<div class="fis-linha"><span class="fis-linha-txt"><b>A tua letra no Rosto</b><span class="small">${escolhido?esc(nomeDe(escolhido))+' fica com a '+outra:'O cônjuge fica com a outra'}</span></span><div class="segm fis-ab" role="group" id="fiscoMinhaLetra" aria-label="A tua letra no Rosto">${['A','B'].map(x=>
      `<button type="button" class="${s.minhaLetra===x?'on':''}" aria-pressed="${s.minhaLetra===x}" data-toca="dados" data-click="fiscoSetSituacao(${ano},'minhaLetra','${x}')">${x}</button>`).join('')}</div></div>`;
    conj=`<p class="lbl fis-sit-lbl">Na declaração conjunta</p><input type="hidden" id="fiscoSitAno" value="${ano}">${campo}${letra}
    <p class="hint fis-sit-nota">A e B são a posição de cada um no Rosto da declaração: sujeito passivo A e sujeito passivo B. A letra não muda as rendas que entram: a conjunta junta as tuas e as do cônjuge, e cada linha do Anexo F leva a letra de quem é a renda. Um imóvel dos dois vai em duas linhas, uma por titular, cada uma com a sua quota-parte.</p>
    <p class="hint fis-sit-nota">${escolhido?'Entram só os imóveis do cônjuge que vês nesta app, os partilhados contigo. Os que estão só na conta do cônjuge não chegam aqui: junta-os no Portal das Finanças, a partir do PDF ou do CSV da Declaração dessa conta.':'Sem cônjuge escolhido, a Declaração tem só as tuas rendas.'}</p>`;
  }
  const herdada=s.deAno&&s.deAno!==String(ano)?' A de '+ano+' vem de '+esc(s.deAno)+'.':'';
  /* as linhas dos interruptores são <label>: tocar no texto (a linha inteira,
     60px) chega ao botão, como nas outras listas de interruptores — o botão
     sozinho tem 28px de altura. Dentro de um <label> o texto vai em <span>. */
  return fisCartao('A tua situação fiscal em '+ano,'O que só tu sabes e muda o Anexo F de '+ano+'. Grava ao mexer.',
    `<label class="fis-linha fis-linha-toque"><span class="fis-linha-txt"><b>Tributação conjunta</b><span class="small">Casados ou unidos de facto</span></span>${interruptor('fiscoConjunta','conjunta',s.conjunta,'Tributação conjunta')}</label>
    <p class="hint fis-sit-nota">Em conjunta há uma só declaração, e cada linha do Anexo F diz de quem é a renda: A ou B. Em separado cada um entrega o seu Anexo F, e é sempre A.</p>${conj}
    <p class="hint fis-sit-nota">A app só escreve as letras A e B. No ano do óbito do cônjuge, com a opção pela conjunta, as rendas que eram só dele levam F e um imóvel dos dois vai em A; as rendas de um dependente levam D1, AF1 ou DG1, como no quadro 6B do rosto. Nesses casos, muda a letra no Portal das Finanças.</p>
    <label class="fis-linha fis-linha-toque"><span class="fis-linha-txt"><b>Tenho dispensa dos recibos de renda eletrónicos</b></span>${interruptor('fiscoDispensa','dispensaRecibos',s.dispensaRecibos,'Dispensa dos recibos de renda eletrónicos')}</label>
    <p class="hint fis-sit-nota">Em ${ano} tem dispensa quem a 31 de dezembro de ${ano-1} tinha 65 anos ou mais, ou quem não tem nem é obrigado a ter caixa postal eletrónica e recebeu rendas de ${ano-1} até ${fiscoLimiteDispensa(ano)} — e o arrendamento rural (Portaria 98-A/2015, art. 5.º). Quem se dispensa entrega o Modelo 44, a declaração anual das rendas de ${ano}, até ao fim de fevereiro de ${ano+1}. Quem passa recibos eletrónicos na mesma fica na regra geral: deixa isto desligado.</p>
    <p class="hint fis-sit-nota">As rendas na categoria B — porque optaste por ela (CIRS art. 4.º n.º 1 n)) ou porque o imóvel está afeto à tua atividade empresarial ou profissional (art. 3.º n.º 2 a)) — não vão ao Anexo F: marca-as em cada contrato, em «Rendas tributadas na categoria B», e a Declaração mostra-as à parte, para o Anexo B ou C.</p>
    <p class="hint fis-sit-nota">Cada ano tem a sua situação, a do último dia do ano (CIRS art. 13.º): o que mudas aqui vale para ${ano} e para os anos seguintes que não tenham a sua, e nunca muda os anteriores.${herdada}</p>`,'fis-sit');
}
/* Grava uma mudança no bloco irs das definições e redesenha: lê-o completo
   (normIrsDefs), deixa fn mudá-lo, e guarda-o normalizado outra vez. A
   escrita é sempre já; o redesenho vai pelo fisRepintar, que devolve o foco a
   quem o tinha.
   Recebe: fn — chamada com o bloco, para o mudar no sítio; adiar (opcional) —
   verdadeiro quando quem grava é o change de um campo (o foco ainda vai a
   caminho do campo seguinte).
   Devolve: nada — grava em db.settings.irs, guarda e redesenha. */
function fiscoGravarIrs(fn,adiar){
  db.settings=db.settings||{};
  const d=normIrsDefs(db.settings.irs);fn(d);
  db.settings.irs=normIrsDefs(d);save();fisRepintar(!!adiar);
}
/* Redesenha a página sem tirar o foco a quem usa o teclado. O render troca a
   vista inteira, e o elemento com o foco desaparecia: o foco caía no <body> e
   o Tab seguinte voltava ao topo. Guarda-se quem o tem — pelo id, ou pelo
   data-click (os botões do A/B não têm id, e o data-click de cada um não muda
   ao redesenhar) — e devolve-se-lhe depois do render. Num clique (o
   interruptor, o A/B) é já, com o botão focado; no change de um campo, o foco
   só chega ao campo seguinte depois do evento, e o redesenho espera que ele
   assente (setTimeout). O render é lido aqui, ao agendar (é o que os testes
   trocam).
   Recebe: adiar — verdadeiro para esperar que o foco assente.
   Devolve: nada — redesenha (já, ou agendado). */
function fisRepintar(adiar){
  const pinta=render;
  const faz=()=>{
    const a=document.activeElement,dono=a&&a!==document.body?a:null;
    const id=dono&&dono.id||'',clique=!id&&dono&&dono.getAttribute?dono.getAttribute('data-click')||'':'';
    pinta();
    let e=id?document.getElementById(id):null;
    if(!e&&clique)e=[...view().querySelectorAll('[data-click]')].find(x=>x.getAttribute('data-click')===clique)||null;
    if(e&&e!==document.activeElement)try{e.focus({preventScroll:true})}catch(x){}
  };
  if(adiar)setTimeout(faz,0);else faz();
}
/* Grava um campo da situação de um ano dos rendimentos (D30, D71, D91) em
   settings.irs.porAno[ano]. Na primeira escrita desse ano a entrada nasce com
   a situação que o ano herdava (irs-papeis.js:irsSituacao: a do ano anterior
   mais perto, ou a dos campos de topo antigos, com o cônjuge que eles davam),
   sem os números do AIMI, que são de cada ano. Os campos de topo não se tocam:
   valem para os anos sem entrada, e mudá-los refazia os anos anteriores (a
   Declaração de um ano já entregue mudava). Os campos: conjunta e
   dispensaRecibos (true liga, o resto desliga); conjugeId (um proprietário
   que não sou eu, ou '' para nenhum); minhaLetra ('A' ou 'B'); aimi
   ({total, valorTributavel} da demonstração de liquidação — só mudam as
   chaves que vêm; € ≥ 0, ou null ou '' por indicar —, que o cartão do AIMI,
   fisco-quadros.js, grava). Outro campo, um ano que não é de quatro dígitos,
   um cônjuge que não é proprietário (ou sou eu) e uma letra que não é A nem B
   não gravam nada. Grava já e redesenha (fiscoGravarIrs); o AIMI vem do
   change de um campo, e o redesenho espera que o foco assente.
   Recebe: ano — o ano dos rendimentos (número ou 'AAAA'); campo — o nome do
   campo; valor — o valor novo.
   Devolve: true se gravou, false se não. */
function fiscoSetSituacao(ano,campo,valor){
  const A=String(ano==null?'':ano);
  if(!/^\d{4}$/.test(A))return false;
  const eu=fiscoEu();
  let novo;
  if(campo==='conjunta'||campo==='dispensaRecibos')novo=valor===true;
  else if(campo==='minhaLetra'){if(valor!=='A'&&valor!=='B')return false;novo=valor}
  else if(campo==='conjugeId'){
    novo=valor==null?'':String(valor);
    if(novo&&(novo===eu||!(db.owners||[]).some(o=>o&&o.id===novo)))return false;
  }
  else if(campo==='aimi'){if(!valor||typeof valor!=='object'||Array.isArray(valor))return false;novo=valor}
  else return false;
  fiscoGravarIrs(d=>{
    if(!Object.prototype.hasOwnProperty.call(d.porAno,A)){
      const h=irsSituacao(A,eu);
      d.porAno[A]={conjunta:h.conjunta,conjugeId:h.conjugeId,minhaLetra:h.minhaLetra,dispensaRecibos:h.dispensaRecibos,aimi:{total:null,valorTributavel:null}};
    }
    const e=d.porAno[A];
    if(campo==='aimi'){
      const a=Object.assign({total:null,valorTributavel:null},e.aimi);
      ['total','valorTributavel'].forEach(k=>{if(Object.prototype.hasOwnProperty.call(novo,k))a[k]=novo[k]===''?null:novo[k]});
      e.aimi=a;
    }else e[campo]=novo;
  },campo==='aimi');
  return true;
}
/* A escolha do cônjuge no cartão da situação (o onchange do sel
   fiscoConjuge), no ano do cartão (o fiscoSitAno escondido ao lado; sem ele,
   o ano da página).
   Devolve: nada — grava e redesenha (fiscoSetSituacao). */
function fiscoSetConjuge(){
  fiscoSetSituacao(val('fiscoSitAno')||String(fiscoAnoAtual()),'conjugeId',val('fiscoConjuge')||'');
}
/* Quem declara, por extenso, para o cabeçalho do texto e do PDF: o nome de
   quem tem a sessão e, em conjunta com o cônjuge, os dois, cada um com a
   sua letra — a das linhas do resumo (a do Rosto, D30); um titular sem linhas
   leva a do fiscoLetra.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o texto ('' por inteiro). */
function fiscoQuemDeclara(r){
  if(r.porInteiro)return '';
  const nome=o=>(owner(o)||{}).name||'—';
  if(r.titulares.length<2)return nome(r.titularId);
  const letra={};(r.linhas||[]).forEach(l=>{if(l&&l.titularId&&l.titular&&!(l.titularId in letra))letra[l.titularId]=l.titular});
  return listaE(r.titulares.map(o=>nome(o)+' ('+(letra[o]||fiscoLetra(o,r.ano))+')'));
}
/* aplica o ano escolhido no seletor e volta a desenhar
   Devolve: nada — guarda o ano e redesenha a vista. */
function onFiscoAno(){fiscoAno=val('fiscoSel')||'';render()}
/* ---- registo do serviço (servicos.js) ---- */
// nº de filtros ativos no painel de análise do IRS · Anexo F: o ano, quando
// foi escolhido e não é o automático (fiscoAnoAuto) — o ano já não está à
// vista na barra, e o ponto do funil diz que a página está noutro. Não há
// titular a escolher: a declaração é a de quem tem a sessão (fiscoTitulares).
// Devolve: número de filtros ativos (0 ou 1).
function fiscoAnaN(){return fiscoAno&&Number(fiscoAno)!==fiscoAnoAuto()?1:0}
// limpa o ano em foco do IRS · Anexo F (o «Limpar» do painel, vistas.js:anaClear)
// Devolve: nada — limpa o filtro; quem chama repinta.
function fiscoAnaLimpar(){fiscoAno=''}
registarServico({id:'fisco',vistas:{fisco:'vFisco'},analise:{fisco:{n:'fiscoAnaN',limpar:'fiscoAnaLimpar'}}});
