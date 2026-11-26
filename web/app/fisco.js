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
   (db.settings.irs.porAno, «A tua situação fiscal em AAAA», numa linha
   depois dos quadros, lida por irs-papeis.js:irsSituacao): a tributação conjunta, o
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
   do ano; «A tratar antes de entregar» (que diz também quando o ano não tem
   versão própria das regras); um cartão por quadro, pela ordem do Anexo F
   (a maqueta 6 do D8): o 4.1, o 4.2 e o 4.3 (o direito real de habitação
   duradoura, D120), cada um com onde se preenche, o resumo dos seus
   contratos e os campos de cada contrato (com o 4.2A, o 4.2B e o 4.2C no do
   4.2); o quadro 5 da sublocação (D52); os benefícios do 6A, do 6B e do 6C
   (D117, D121, D119) e os isentos do 6D, do 6F e do 6H, as obras dos 24
   meses das linhas (e as por confirmar), as rendas de anos anteriores, o
   AIMI do quadro 9, os contratos que acabaram no quadro 10 (8, 9, 10), o
   Anexo J dos imóveis fora de Portugal (D133), as rendas da categoria B fora
   do Anexo F (D134), o que ficou fora por escolha e as rendas sem contrato;
   depois «A tua situação fiscal», fechada no resumo, no porquê e em «Mudar a
   situação fiscal» (fiscoSituacaoCard),
   os prazos da AT só quando há algum na janela de aviso (fisPrazosCard) e,
   no fim, o aviso de responsabilidade (fiscoAvisoCard). Sem imóveis
   diz-o e aponta a saída; sem rendas no ano (nem nos quadros 4, nem no
   quadro 5, nem fora do Anexo F) e sem nada no quadro 10 (os contratos que
   acabaram no ano, r.cessados, e a regularização do n.º 20,
   r.regularizacoes, que vão na declaração desse ano mesmo sem rendas nele),
   diz-o e nomeia os contratos que
   estiveram em vigor nele sem nenhuma renda registada
   (fiscoContratosSemRendas) — um contrato sem rendas não tem linha, e a
   página não pode ficar só com «Sem rendas»; com imóveis à vista mas nenhum
   teu (só colaboras), diz que o Anexo F é de quem tem direito às rendas — o
   dono ou, havendo usufruto, o usufrutuário (informação vinculativa 25058) —,
   e não de quem recebe as rendas por conta dele (CIRS art. 19.º).
   A Declaração requer os Contratos (servicos.js, D57), e eles os Imóveis: a
   página nunca se pinta com um dos dois desligado, e nada aqui o pergunta.
   Devolve: o HTML da vista (string). */
function vFisco(){
  const ano=fiscoAnoAtual(),auto=!fiscoAno;
  const anos=yearsWithData(null);if(anos.indexOf(ano)<0)anos.push(ano);anos.sort((a,b)=>a-b);
  const r=resumoFiscal(ano);
  /* em conjunta, a letra do cônjuge é a das linhas dele (a do Rosto, D30);
     o cônjuge sem conta entra pelos bens comuns do casal (D5, r.conjugeFora);
     ligada sem cônjuge escolhido, diz-se que entram só as minhas rendas */
  const sit=r.porInteiro?null:irsSituacao(ano,r.titularId);
  const outro=(r.linhas||[]).find(l=>l&&l.titularId&&l.titularId!==r.titularId);
  const letraOutro=esc((outro&&outro.titular)||(r.conjugeFora&&r.conjugeFora.letra)||(sit&&sit.letraConjuge)||'B');
  const conj=r.titulares.length>1?(outro&&fiscoEhConjugeFora(outro.titularId)
      ?' Em tributação conjunta entra também a parte do teu cônjuge nos bens comuns do casal, nas linhas do titular '+letraOutro+'.'
      :' Em tributação conjunta entra também a do titular '+letraOutro+', cada linha com a sua letra.')
    :sit&&sit.conjunta&&!(db.owners||[]).some(o=>o&&o.id&&o.id===sit.conjugeId)?(fiscoBensComuns(sit)
      ?' A tributação conjunta de '+ano+' está ligada sem cônjuge com conta, com os bens comuns do casal: nenhum imóvel teu tem um só dono fora da app, e as linhas ficam todas em teu nome.'
      :' A tributação conjunta de '+ano+' está ligada sem cônjuge escolhido: entram só as tuas rendas.'):'';
  const quem=r.porInteiro?(r.semSessao?'Sem sessão não se sabe qual dos proprietários és: os valores vão por inteiro.':'Sem proprietários na ficha, os valores vão por inteiro.')
    :'A declaração é a tua: rendas, retenções e gastos entram pela tua quota-parte de cada imóvel.'+conj;
  const panel=anaPanel(`<div class="u-w-100pc">${sel('fiscoSel',String(ano),anos.map(y=>({v:String(y),label:String(y)})),'onFiscoAno','vista')}</div>
    <div class="hint u-mt-9px">${quem}${auto&&ano===YEAR-1?' Até junho mostra-se o ano anterior, que é o que se está a declarar.':''}</div>`);
  if(!r.imoveis){
    const deOutros=!r.porInteiro&&pidProps(null).some(p=>pode(p.id,'report.view'));
    return panel+(esperaDoServidor()||(deOutros?`<div class="empty"><b>Nenhum imóvel teu</b>O Anexo F é de quem tem direito às rendas, pela sua quota-parte (CIRS art. 19.º): o dono ou, havendo usufruto, o usufrutuário — e não quem tem só a nua-propriedade. Aqui entram só os imóveis de que és proprietário. Quem só recebe as rendas por conta do dono não as declara.</div>`
      :`<div class="empty"><b>Sem imóveis</b>O Anexo F parte das rendas de cada imóvel.
    ${saida('Adicionar imóvel',"go('properties')",'ecra')}</div>`));
  }
  /* um ano só com sublocação (o quadro 5) tem rendas a declarar: não é «Sem
     rendas» (D52) */
  const q5=Array.isArray(r.quadro5)?r.quadro5.length:0;
  /* nem um ano só com rendas fora do Anexo F — o Anexo J de um imóvel lá
     fora (D133) ou a categoria B (D134) —, que têm cartão próprio */
  const foraDoF=(Array.isArray(r.anexoJ)?r.anexoJ.length:0)+(Array.isArray(r.categoriaB)?r.categoriaB.length:0);
  /* nem um ano só com o quadro 10 — o contrato com redução que acabou antes
     da primeira renda do ano — ou só com a regularização do n.º 20: vão na
     declaração do ano em que o contrato acabou (CIRS art. 72.º n.º 20) */
  const q10=(Array.isArray(r.cessados)?r.cessados.filter(Boolean).length:0)+(Array.isArray(r.regularizacoes)?r.regularizacoes.filter(Boolean).length:0);
  if(!r.linhas.length&&!q5&&!foraDoF&&!q10&&!r.fora.length&&!r.semContrato.length){
    const outros=anos.filter(y=>y!==ano&&(db.transactions||[]).some(t=>ehRenda(t)&&String(t.date||'').startsWith(String(y))));
    return panel+`<div class="ana fis"><div class="empty"><b>Sem rendas em ${ano}</b>${fiscoFraseSemRendas(fiscoContratosSemRendas(r),ano)}${outros.length?'Há rendas em '+esc(outros.join(', '))+'. ':''}Uma renda entra aqui quando o movimento é da categoria Rendas e está ligado ao contrato.
      ${saida('Escolher outro ano','hdrFiltToggle()','vista')}</div></div>`;
  }
  /* Os cartões dos quadros empilham-se numa grelha de uma coluna com o mesmo
     intervalo que as colunas da casa (14px). A coluna é minmax(0,1fr) e não
     1fr: um item de grelha não encolhe abaixo do seu conteúdo, e a tabela do
     resumo, mais larga do que o ecrã, alargava a página em vez de rolar
     dentro do .tablewrap. */
  /* A ordem da maqueta 6 (D8): os números, «A tratar», os quadros pela ordem
     do Anexo F (4.1, 4.2, 4.3, 5, o 6 — 6A a 6C e depois 6D, 6F, 6H —, as
     obras dos 24 meses das linhas, 8, 9, 10), o Anexo J, a categoria B e o
     que fica fora; depois a situação fiscal fechada, com «Mudar a situação
     fiscal», e os
     prazos da AT só quando há algum na janela de aviso. */
  const Q=r.versao.quadros,q43=fiscoQuadroDhd(r),prazos=fisPrazosLista();
  return panel+`<div class="ana fis">`+fisBarra()+fiscoKpis(r)
    +`<div class="fis-grelha">`+fiscoObrigacoesCard(r,prazos.length>0)+`</div>`
    +`<div class="fiscoPilha u-d-grid u-gtc-minmax-0-1fr u-g-14px">`
    +fiscoQuadroCard(r,Q.semReducao)+fiscoQuadroCard(r,Q.comReducao)+(q43?fiscoQuadroCard(r,q43):'')+fiscoQuadro5Card(r)+fiscoBeneficiosCard(r)+fiscoIsentosCard(r)+fiscoObrasCard(r)
    +fiscoAnosAnterioresCard(r)+fiscoAimiCard(r)+fiscoQuadro10Card(r)+fiscoAnexoJCard(r)+fiscoCategoriaBCard(r)+fiscoForaCard(r)+fiscoSemContratoCard(r)+fisNadaForaCard(r)+`</div>`
    +fiscoSituacaoCard(r)+fisPrazosCard(prazos)
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
   obras dos 24 meses), o rendimento líquido (sem o dos isentos, que o rodapé
   diz) e o imposto estimado, em destaque. O imposto é o do resumo depois dos
   prejuízos de anos anteriores que a app conhece (fiscoImpostoDoKpi, Q10,
   D73), com a linha «depois dos prejuízos de anos anteriores: −4 000 € ao
   rendimento (−760 € de imposto)», de cada titular em conjunta
   (fiscoReportePorTitular) — o par de nomes das exportações (N123); o
   prejuízo deste ano diz-se de cada titular (fisco-exportar.js:
   fiscoPrejuizos). Com o AIMI no quadro 9, uma linha diz o imposto depois do
   abate (nunca mais do que o de depois do reporte); com a regularização do
   quadro 10 (código 01, D10) ou de um direito real de habitação duradoura
   cessado por acordo (o 4.3, D120), uma linha soma-a à parte, estimativa sem
   juros. A falta a pagar conta com os três. As rendas ilíquidas são a renda
   do recibo, antes da retenção, da comissão e de descontos (D112), com a
   caução do ano em que se recebe (D03), os reembolsos e as indemnizações,
   menos as devolvidas; as do quadro 5 (D52), do Anexo J e da categoria B
   (D133, D134, fiscoKpiForaDoF) dizem-se à parte. Com o 6B ou o 6C, o
   líquido diz o que o imposto conta (fiscoKpiLiquidoDoImposto); o porquê do
   imposto diz os 5 % do 6A e do 4.3 (D118). À vista, ao lado do imposto: as
   taxas do continente (nos Açores a AT aplica-as 30 % mais baixas, N120) e,
   com rendas no Anexo J ou na categoria B, que a app não as estima (N051).
   Num ano sem regras (fiscoSemRegras, N050) o imposto é «—», «sem regras de
   AAAA», sem reporte, AIMI, regularização nem falta a pagar; sem nenhuma
   linha do Anexo F e com rendas no J ou na B, «sem estimativa», e não 0 €
   (N051). O porquê diz ainda os prejuízos dos anos da janela que não estão
   na app (r.reporte.anosSemDados, N124) e que os benefícios do EBF caem com
   dívidas às Finanças ou à Segurança Social (fiscoKpiBeneficiosEbf, N151).
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
  /* a linha do reporte: o número de cima é o de depois dos prejuízos de anos
     anteriores (D73); o que abateram é ao rendimento, de cada titular em
     conjunta, e diz-se quanto desceu o imposto (N123: o mesmo par de nomes
     das exportações — «Imposto estimado» é o das linhas, «depois dos
     prejuízos de anos anteriores» o de depois) */
  const repTxt=!repUsado?'':'depois dos prejuízos de anos anteriores'
    +(!varios?': −'+euro(repUsado)
      :rep.length===1?(rep[0].letra?' do titular '+esc(rep[0].letra):'')+': −'+euro(rep[0].usado)
      :': '+rep.map(x=>(x.letra?esc(x.letra)+' ':'')+'−'+euro(x.usado)).join(' · '))
    +' ao rendimento'+(repImposto>0?' (−'+euro(repImposto)+' de imposto)':'');
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
  /* sem as regras do ano não há estimativa nenhuma (D50, N050); sem nenhuma
     linha do Anexo F (nem do quadro 5) e com rendas no Anexo J ou na
     categoria B, o imposto não é 0 € — é «sem estimativa» (N051) */
  const semRegras=fiscoSemRegras(r);
  const temF=(r.linhas||[]).some(Boolean)||(Array.isArray(r.quadro5)&&r.quadro5.some(Boolean));
  const foraNomes=(fx.anexoJ>0?['do Anexo J']:[]).concat(fx.categoriaB>0?['da categoria B']:[]);
  const semEst=!semRegras&&!temF&&foraNomes.length>0&&!(reg>0);
  const impLinhas=r2(Math.max(0,Number(T.imposto)||0));
  /* os prejuízos dos anos da janela que não estão na app (N124): só na
     explicação, nunca em «A tratar» — vale para quase todas as contas */
  const asd=(r.reporte&&Array.isArray(r.reporte.anosSemDados)?r.reporte.anosSemDados:[]).map(Number).filter(y=>y>0);
  const ebf=fiscoKpiBeneficiosEbf(r);
  const porqueImp=semRegras?'A app não tem as regras de '+r.ano+': as taxas e os quadros desse ano eram outros, e a app não estima o imposto, o que os prejuízos de anos anteriores e o AIMI abatem, a regularização nem a falta a pagar. O valor certo é o da liquidação da AT.'
    :semEst?'Não há rendas no Anexo F em '+r.ano+'. '+listaE((fx.anexoJ>0?['as rendas de imóveis fora de Portugal (Anexo J) dependem do país, da convenção e do englobamento']:[]).concat(fx.categoriaB>0?['as da categoria B (Anexo B ou C) seguem as regras da tua atividade']:[])).replace(/^./,c=>c.toUpperCase())+': a app não as estima. O valor certo é o da liquidação da AT.'
    :'O rendimento líquido de cada linha à taxa que a lei de '+r.ano+' dá ao contrato, somado titular a titular: as perdas de uma linha abatem às rendas das outras do mesmo titular, nunca às de outro titular, e o imposto nunca é negativo. '+(T5&&Number(T5.n)>0?'Conta também a diferença positiva de cada linha do quadro '+esc(Q5)+' (a sublocação). ':'')
    +(tem6A||tem43?(tem6A&&tem43?'As rendas de imóveis reabilitados (quadro 6A) e a prestação mensal de um direito real de habitação duradoura (quadro '+esc(q43)+') pagam 5 %. ':tem6A?'As rendas de imóveis reabilitados (quadro 6A) pagam 5 %. ':'A prestação mensal de um direito real de habitação duradoura (quadro '+esc(q43)+') paga 5 %. '):'')
    +(trib!=null?'No 6C as rendas contam 50 %, e no 6B as obras dos 24 meses 110 %. ':'')
    +'É uma estimativa sem englobamento, com as taxas do continente: a quem reside nos Açores a AT aplica-as 30 % mais baixas, pela residência. O valor certo é o da liquidação da AT. As retenções do inquilino abatem a isto.'
    +(ebf?' '+ebf:'')
    +(fx.anexoJ>0||fx.categoriaB>0?' Não conta '+listaE((fx.anexoJ>0?['as rendas de imóveis fora de Portugal (Anexo J)']:[]).concat(fx.categoriaB>0?['as da categoria B (Anexo B ou C)']:[]))+': a app não as estima.':'')
    +(repUsado?' O imposto estimado das linhas é '+euro(impLinhas)+'; os prejuízos de anos anteriores que a app conhece ('+euro(repUsado)+') abatem ao rendimento deste ano, o mais antigo primeiro e titular a titular (CIRS art. 55.º): o imposto desce '+euro(repImposto)+', e depois dos prejuízos de anos anteriores fica em '+euro(imposto)+' — o número de cima. Pode faltar informação — imóveis fora da app, anos sem registos, a condição dos 36 meses de rendas nos cinco anos seguintes —, e a AT faz a conta na liquidação.'
      :asd.length&&impLinhas>0?' Prejuízos de anos que não estão na app ('+fiscoKpiAnos(asd)+') não entram nesta estimativa; a AT abate-os na liquidação.':'')
    +(a?' O AIMI pago abate ao imposto (quadro '+Q9+'): a app estima a parte dos prédios arrendados e limita-a ao imposto estimado das rendas. É a leitura da app; a lei fala da coleta à taxa de 28 %, e a conta certa é a da AT.'+(abate>0&&T.retencoes?' A falta a pagar já conta com este abate.':''):'')
    +(reg>0&&reg10?' Um contrato com redução pela duração que acabou antes do prazo por motivo do senhorio (quadro '+Q10+') perde a redução do período em que acabou: a diferença para a taxa da duração que decorreu regulariza-se nesta declaração, com juros compensatórios (CIRS art. 72.º).':'')
    +(reg>0&&regDhd?' Um direito real de habitação duradoura que cessou por acordo das partes (quadro '+esc(q43)+') perde os 5 % desde o início: a diferença para a taxa base regulariza-se nesta declaração, com juros compensatórios (CIRS art. 72.º n.º 20).':'')
    +(reg>0?' A app soma a diferença à parte, sem os juros'+(T.retencoes?', e a falta a pagar já a conta.':'.'):'');
  /* o que as rendas ilíquidas são: a renda do recibo, antes da retenção, da
     comissão e de descontos (D112) */
  const porqueRendas='A renda do recibo, antes da retenção, da comissão e de descontos: o que entrou como renda mais o que o inquilino reteve na fonte, no ano em que foi recebida. Se uma gestora te transfere a renda já sem a comissão, a renda é a do recibo e a comissão é um gasto, na coluna Outros. Conta com a caução, que é renda do ano em que a recebes (a de um direito real de habitação duradoura não), os reembolsos que o inquilino te pagou, as indemnizações que compensam rendas e as outras receitas prediais, menos as rendas que devolveste. É o valor que vai aos quadros 4.1, 4.2 e 4.3; os empréstimos recebidos ficam de fora.'
    +(rec5?' As rendas de um imóvel que subarrendas vão ao quadro '+esc(Q5)+', à parte: o rendimento delas é a diferença para a renda que pagas ao senhorio.':'')
    +(fx.anexoJ>0?' As de um imóvel fora de Portugal vão ao Anexo J, e não estão aqui.':'')+(fx.categoriaB>0?' As da categoria B vão ao Anexo B ou C, e não estão aqui.':'');
  /* o cartão do imposto: sem regras, «—» e «sem regras de AAAA» (N050); sem
     linhas do Anexo F, «sem estimativa» (N051); senão o imposto, as linhas
     do reporte, do AIMI e da regularização, as rendas que não estima (N051),
     o retido e a falta, e as taxas do continente (N120) — à vista, fora do
     porquê */
  const linhaFora=foraNomes.length?`<div class="foot">sem as rendas ${listaE(foraNomes)}: a app não as estima</div>`:'';
  const retido=T.retencoes?'já retido '+euro(T.retencoes)+' · '+(aPagar>=0?'falta '+euro(aPagar):'a receber '+euro(-aPagar)):'sem englobamento';
  const acores=impLinhas>0||reg>0?'taxas do continente; nos Açores a AT aplica menos 30 %':'';
  const kpiImp=semRegras?kpi('Imposto estimado','—','','sem regras de '+r.ano,porqueImp)
    :semEst?kpi('Imposto estimado','sem estimativa','','a app não estima as rendas '+listaE(foraNomes),porqueImp)
    :kpi('Imposto estimado',euro(imposto),'',acores,porqueImp,null,null,{extra:linhaRep+linhaAimi+linhaReg+linhaFora+`<div class="foot">${retido}</div>`});
  return `<div class="grid fis-kpis">
    ${kpi('Rendas ilíquidas',euro(T.rendas),'',fiscoN(fiscoNContratos(r.linhas),'contrato','contratos')+' em '+r.ano,porqueRendas,null,null,{extra:linha5+linhaJ+linhaB})}
    ${kpi('Retenções na fonte',euro(T.retencoes),'',T.retencoes?'retidas pelos inquilinos':'nenhuma registada','O que os inquilinos retiveram na fonte e entregaram à AT por ti, como está nos movimentos'+(T5&&Number(T5.retencoes)>0?' — com as do quadro '+esc(Q5)+', a sublocação':'')+'. Já conta nas rendas ilíquidas e abate ao imposto.')}
    ${kpi('Gastos dedutíveis',euro(g),'',T.obras24?'com '+euro(T.obras24)+' de obras dos 24 meses':'conservação, condomínio, IMI, selo, taxas e outros','As colunas de gastos dos quadros, pela regra de cada categoria (Definições → Categorias, etiquetas e IRS), só do período em que o imóvel esteve arrendado — salvo o IMI e o imposto do selo, que contam os pagos no ano em que o imóvel deu rendas, mesmo com ele vazio (CIRS art. 41.º n.º 5) —, e as obras de conservação dos 24 meses antes de um contrato. Ficam fora os juros, o mobiliário, o AIMI e as obras que acrescentam valor. Para o IRS conta a quota de cada um no imóvel, e não quem pagou nem a divisão escolhida no movimento (CIRS art. 19.º).')}
    ${kpi('Rendimento líquido',euro(T.liquido),T.liquido<0?'neg':'',pePre||(T.isentos.n?'sem os '+euro(T.isentos.liquido)+' isentos (6D)':'rendas menos gastos'),porqueLiq,null,null,{extra:linhaTrib})}
    ${kpiImp}</div>`;
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
/* Os anos da janela do reporte que não estão na app, como a frase do porquê
   do imposto os diz (N124) — a mesma regra das notas do PDF e do texto: anos
   seguidos «de 2019 a 2024», um só «de 2019», com buracos a lista «de 2019,
   2021 e 2023».
   Recebe: anos — os anos (números ou 'AAAA').
   Devolve: o texto ('' sem anos). */
function fiscoKpiAnos(anos){
  const ys=[...new Set((anos||[]).map(Number).filter(y=>y>0))].sort((a,b)=>a-b);
  if(!ys.length)return '';
  if(ys.length===1)return 'de '+ys[0];
  const seguidos=ys.every((y,i)=>!i||y===ys[i-1]+1);
  return seguidos?'de '+ys[0]+' a '+ys[ys.length-1]:'de '+listaE(ys.map(String));
}
/* A frase do porquê do imposto sobre os benefícios do EBF (N151): a taxa de
   10 % das rendas moderadas (EBF art. 45.º-C — numa linha, num troço com
   rendas ou numa entrada do quadro 5), as isenções (as linhas do 6D, do 6F e
   do 6H) e os benefícios do 6A, do 6B e do 6C só valem sem dívidas por
   regularizar às Finanças e à Segurança Social (EBF art. 14.º n.os 5 e 6;
   PIV 30751). As reduções pela duração (CIRS art. 72.º) não são do EBF, e
   não se dizem.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: a frase (texto, com ponto final), ou '' sem nenhum destes. */
function fiscoKpiBeneficiosEbf(r){
  const ls=((r&&r.linhas)||[]).filter(Boolean),q5=Array.isArray(r&&r.quadro5)?r.quadro5.filter(Boolean):[];
  const comRendas=s=>s&&(s.rendas==null||Number(s.rendas)>0);
  const mod=ls.some(l=>!l.isencao&&(l.motivoTaxa==='moderada'||(Array.isArray(l.segmentos)&&l.segmentos.some(s=>comRendas(s)&&s.motivo==='moderada'))))
    ||q5.some(x=>x.motivoTaxa==='moderada');
  const ise=ls.some(l=>l.isencao);
  const seis=[...new Set(ls.filter(l=>!l.isencao).reduce((a,l)=>a.concat(fiscoBeneficiosDe(l).map(b=>String(b.quadro))),[]))].sort();
  const tx=dec(Number((((r&&r.versao&&r.versao.taxas)||{}).rendaModerada||{}).taxa)||10);
  const bs=(mod?['a taxa de '+tx+' % das rendas moderadas']:[]).concat(ise?['as isenções']:[]).concat(seis.length?['os benefícios do quadro '+listaE(seis)]:[]);
  if(!bs.length)return '';
  const um=bs.length===1&&mod;
  const lista=listaE(bs);
  return lista.charAt(0).toUpperCase()+lista.slice(1)+(um?' é um benefício fiscal: só vale':' são benefícios fiscais: só valem')+' sem dívidas por regularizar às Finanças e à Segurança Social (EBF art. 14.º).';
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
/* O rótulo do botão de um aviso, pelo sítio que ele abre: a situação fiscal
   da página (fiscoSitAbrir), os movimentos filtrados (navegacao.js:
   goMovimentos), a despesa do selo já preenchida (txNovaDespesaCom), a
   ficha de um contrato, de um proprietário, de um inquilino, de um imóvel ou
   de um movimento, uma pergunta
   do contrato (o «Responder» de contrato.js:ctIrParaPergunta), as quotas de
   um imóvel (imovel.js:imvAbrirQuotas, a janela das quotas ou a pergunta dos
   donos fora da app), a lista dos contratos, dos imóveis ou dos movimentos,
   as definições do IRS, ou o «Marcar como enviado» do envio ao IHRU
   (prazos.js:pzIhruPergunta).
   Recebe: abrir — o código da ação do aviso.
   Devolve: o rótulo (texto). */
function fiscoRotuloDoAviso(abrir){
  const a=String(abrir||'');
  if(/^pzIhruPergunta\(/.test(a))return 'Marcar como enviado';
  if(/^fiscoAvReporSplitwise\(/.test(a))return 'Repor o total';
  if(/^imvAbrirQuotas\(/.test(a))return 'Indicar as quotas';
  if(/^ctResponderEmpresa\(/.test(a)||/^ctIrParaPergunta\(/.test(a))return 'Responder';
  if(/^fiscoSitAbrir\(/.test(a))return 'Abrir a situação fiscal';
  if(/^goMovimentos\(/.test(a))return 'Ver os movimentos';
  if(/^txNovaDespesaCom\(/.test(a))return 'Adicionar o selo';
  if(/^ctView\(/.test(a))return 'Abrir contrato';
  if(/^personView\(\s*'owner'/.test(a))return 'Abrir proprietário';
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
   nada em falta nos dados registados. Um aviso pode trazer dois botões (a
   folha dos avisos, D8): a ação que o resolve ali mesmo (a.acao com o
   rótulo a.acaoTexto — «É só meu», «Marcar como emitido» —, primário, à
   frente) e o que abre o sítio (a.abrir, com o rótulo a.abrirTexto, ou o
   do fiscoRotuloDoAviso). O fim do cartão aponta os Prazos da AT só quando
   eles estão na página (com algum prazo na janela de aviso).
   Recebe: r — o resumo (resumoFiscal); temPrazos (opcional) — true quando
   a página mostra os Prazos da AT (sem ele, pergunta-se ao fisPrazosLista).
   Devolve: o HTML do cartão (string). */
function fiscoObrigacoesCard(r,temPrazos){
  const cor={falta:'red',aviso:'amber',info:'grey'};
  if(temPrazos===undefined)temPrazos=fisPrazosLista().length>0;
  const abrir=a=>a.abrir?`<button type="button" class="btn sm" data-toca="${esc(a.toca||'camada')}" data-click="${a.abrir}">${a.abrirTexto?esc(a.abrirTexto):fiscoRotuloDoAviso(a.abrir)}</button>`:'';
  const botoes=a=>a.acao&&a.acaoTexto
    ?`<span class="chips-fila fis-ob-acoes"><button type="button" class="btn sm primary" data-toca="${esc(a.acaoToca||'camada')}" data-click="${a.acao}">${esc(a.acaoTexto)}</button>${abrir(a)}</span>`
    :abrir(a);
  const row=(a,i)=>`<div class="fis-ob"><span class="badge ${cor[a.nivel]||'amber'} fis-num">${i+1}</span><p>${esc(a.texto)}</p>${botoes(a)}</div>`;
  const nTratar=r.avisos.filter(a=>a.nivel!=='info').length;
  const corpo=r.avisos.length?`<div class="fis-obs">${r.avisos.map(row).join('')}</div>`
    :`<p class="hint">Não encontrámos nada em falta nos dados que registaste. Confirma que todas as rendas que recebeste em ${r.ano} estão registadas: as que não estão, a app não as vê.</p>`;
  /* o selo da contagem cola-se ao título (a prancheta), em vez de fugir para o canto */
  return fisCartao('A tratar antes de entregar'+(nTratar?` <span class="badge amber">${nTratar}</span>`:''),
    r.avisos.length?fiscoN(r.avisos.length,'ponto','pontos')+' de '+r.ano:'Nada encontrado em falta em '+r.ano,
    corpo+`<p class="hint">A app resume, não declara: o que falta fica escrito aqui e ao pé de cada linha dos quadros.${temPrazos?' Os prazos com data estão nos Prazos da AT, depois dos quadros.':''}</p>`,
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
   Sem nenhum prazo na janela de aviso, não se escreve (D8 h, maqueta 6: o
   cartão vazio «Nada para já» saiu).
   Recebe: lista (opcional) — os prazos (fisPrazosLista); sem ela, pede-os.
   Devolve: o HTML do cartão (string), ou '' sem prazos. */
function fisPrazosCard(lista){
  if(!Array.isArray(lista))lista=fisPrazosLista();
  if(!lista.length)return '';
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
  const corpo=`<div class="fis-pzs">${lista.slice(0,5).map(row).join('')}</div>${mais>0?`<p class="hint">E ${fiscoN(mais,'outro','outros')} nos Prazos da visão geral.</p>`:''}`;
  return fisCartao('Prazos da AT',fiscoN(lista.length,'prazo','prazos')+' na janela de aviso',corpo,'fis-prazos');
}
/* Os prazos da AT que o cartão «Prazos da AT» mostra (fisPrazosCard): os
   ativos (prazos.js:prazosAtivos) do Modelo 2, da cessação, dos recibos, da
   entrega do Anexo F, da comunicação de fevereiro, do envio ao IHRU, do
   Modelo 44 e dos elementos mínimos — nenhum antes de o estado chegar
   (espera.js:sabemosOEstado).
   Devolve: os prazos (array, pela ordem do prazosAtivos). */
function fisPrazosLista(){
  const AT={modelo2:1,cessacao:1,recibos:1,irs:1,fev15:1,rsaa:1,modelo44:1,elementos:1};
  if(!sabemosOEstado())return [];
  return prazosAtivos().filter(p=>p&&AT[p.tipo]);
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
   escolhido entram só as minhas rendas. Sem cônjuge com conta escolhido (o
   casal em que só um usa a app, D5), a escolha «Os bens são comuns do
   casal» (fiscoBensComunsHtml), e a nota de que os imóveis só do cônjuge
   se inserem à mão no Portal das Finanças. A dispensa dos recibos eletrónicos
   noutro interruptor, com quem está dispensado nesse ano — o limite com o IAS
   do ano anterior (fiscoLimiteDispensa, D111) — e o Modelo 44 que isso obriga
   a entregar (só com a dispensa ligada, ou ao tocar em «Quem tem dispensa?»
   — fiscoSitVerDispensa, N063; o arrendamento rural à parte: as rendas dele
   não pedem recibo, mas isso não dispensa os outros contratos nem obriga ao
   Modelo 44, N030). As letras que a app não escreve (D70) dizem-se onde
   contam: a F do ano do óbito do cônjuge só com a conjunta ligada; as D1,
   AF1 e DG1 das rendas de um dependente, que valem em conjunta e em
   separado, numa nota à parte. Grava logo (fiscoSetSituacao, fiscoSetConjuge) em
   settings.irs.porAno, que vai com as definições. Sem saber quem és (por
   inteiro), não há cônjuge a escolher, e diz-se.
   O cartão vem depois dos quadros e fechado (D8, maqueta 6): o título, o
   resumo do que está escolhido (fiscoSituacaoResumo — «Declaração em
   separado, és o titular A · passas recibos eletrónicos»), porque importa
   (fiscoSituacaoPorque) e o botão «Mudar a situação fiscal» (fiscoSitMudar),
   por baixo, que abre o resto no sítio; aberto, o botão diz «Fechar»
   (KAN-127-10: um «Mudar» no canto não dizia o que fazia nem porque
   importava). Abre sozinho quando há uma
   escolha por fazer — a conjunta ligada sem cônjuge, havendo quem escolher
   —, até a pessoa o fechar; o fiscoSitAbrir abre-o de um aviso. Fechado, o
   corpo fica na página com o atributo hidden (nada se grava escondido: só
   se mostra o que já lá está, e o resumo di-lo).
   Recebe: r — o resumo (resumoFiscal); aberto (opcional) — true ou false
   para o desenhar aberto ou fechado; sem ele, o estado da página
   (fiscoSitAberta).
   Devolve: o HTML do cartão (string). */
function fiscoSituacaoCard(r,aberto){
  const ano=Number(r.ano),eu=r.porInteiro?'':String(r.titularId||'');
  const s=irsSituacao(ano,eu);
  const interruptor=(id,campo,on,nome)=>`<button type="button" class="interruptor" role="switch" id="${id}" aria-checked="${on?'true':'false'}" aria-label="${nome}" data-toca="dados" data-click="fiscoSetSituacao(${ano},'${campo}',${on?'false':'true'})"></button>`;
  let conj='',escolhido='',cands=[];
  if(s.conjunta&&!eu)conj=`<p class="hint fis-sit-nota">Sem saber qual dos proprietários és, não há cônjuge a escolher: entra na tua conta para a Declaração juntar a tua parte e a do cônjuge.</p>`;
  else if(s.conjunta){
    cands=fiscoCandidatosConjuge(ano,eu);const nomeDe=o=>(owner(o)||{}).name||'';
    escolhido=s.conjugeId&&cands.indexOf(s.conjugeId)>-1?s.conjugeId:'';
    const campo=cands.length
      ?`<label class="fis-sit-nota fis-sit-campo">O teu cônjuge${sel('fiscoConjuge',escolhido,[{v:'',label:'Ninguém escolhido'}].concat(cands.map(o=>({v:o,label:nomeDe(o)}))),'fiscoSetConjuge','dados')}</label>`
      :`<p class="hint fis-sit-nota">Não há outro proprietário nesta app para escolher como cônjuge: o teu cônjuge não tem conta, ou não é proprietário de nenhum imóvel que vês aqui. Os imóveis só dele inserem-se à mão no Portal das Finanças, com a letra dele.</p>`;
    /* o cônjuge sem conta (D5): os bens comuns do casal, em vez de metade */
    const comuns=escolhido?'':fiscoBensComunsHtml(r,ano,fiscoBensComuns(s));
    const outra=s.minhaLetra==='B'?'A':'B';
    const letra=`<div class="fis-linha"><span class="fis-linha-txt"><b>A tua letra no Rosto</b><span class="small">${escolhido?esc(nomeDe(escolhido))+' fica com a '+outra:'O cônjuge fica com a outra'}</span></span><div class="segm fis-ab" role="group" id="fiscoMinhaLetra" aria-label="A tua letra no Rosto">${['A','B'].map(x=>
      `<button type="button" class="${s.minhaLetra===x?'on':''}" aria-pressed="${s.minhaLetra===x}" data-toca="dados" data-click="fiscoSetSituacao(${ano},'minhaLetra','${x}')">${x}</button>`).join('')}</div></div>`;
    conj=`<p class="lbl fis-sit-lbl">Na declaração conjunta</p><input type="hidden" id="fiscoSitAno" value="${ano}">${campo}${comuns}${letra}
    <p class="hint fis-sit-nota">A e B são a posição de cada um no Rosto da declaração: sujeito passivo A e sujeito passivo B. A letra não muda as rendas que entram: a conjunta junta as tuas e as do cônjuge, e cada linha do Anexo F leva a letra de quem é a renda. Um imóvel dos dois vai em duas linhas, uma por titular, cada uma com a sua quota-parte.</p>
    <p class="hint fis-sit-nota">${escolhido?'Entram só os imóveis do cônjuge que vês nesta app, os partilhados contigo. Os que estão só na conta do cônjuge não chegam aqui: junta-os no Portal das Finanças, a partir do PDF ou do CSV da Declaração dessa conta.'
      :fiscoBensComuns(s)?'Os imóveis só do cônjuge, que não estão nesta app, inserem-se à mão no Portal das Finanças, com a letra dele.'
      :'Sem cônjuge escolhido, a Declaração tem só as tuas rendas. Os imóveis só do cônjuge, que não estão nesta app, inserem-se à mão no Portal das Finanças, com a letra dele.'}</p>
    <p class="hint fis-sit-nota">No ano do óbito do cônjuge, com a opção pela conjunta, as rendas que eram só dele levam a letra F e um imóvel dos dois vai em A. A app só escreve A e B: essa letra muda-se no Portal das Finanças.</p>`;
  }
  const herdada=s.deAno&&s.deAno!==String(ano)?' A de '+ano+' vem de '+esc(s.deAno)+'.':'';
  /* aberto: o que se pediu, senão o estado da página; sem nenhum dos dois,
     só com uma escolha por fazer (a conjunta sem cônjuge, havendo quem) */
  const porFazer=s.conjunta&&!!eu&&!escolhido&&cands.length>0&&!fiscoBensComuns(s);
  const open=typeof aberto==='boolean'?aberto:fiscoSitAberta===true||fiscoSitAberta===false?fiscoSitAberta:porFazer;
  /* a nota da dispensa: com a dispensa ligada, ou a pedido (N063); o rural à
     parte, sem o pôr entre quem tem dispensa (N030) */
  const notaDispensa=`<p class="hint fis-sit-nota" id="fiscoSitDispensaNota" tabindex="-1">Em ${ano} tem dispensa quem a 31 de dezembro de ${ano-1} tinha 65 anos ou mais, ou quem não tem nem é obrigado a ter caixa postal eletrónica e recebeu rendas de ${ano-1} até ${fiscoLimiteDispensa(ano)} — ou não as recebeu e não conta passar esse valor em ${ano} (Portaria 98-A/2015, art. 5.º). Quem se dispensa entrega o Modelo 44, a declaração anual das rendas de ${ano}, até ao fim de fevereiro de ${ano+1}. Quem passa recibos eletrónicos na mesma fica na regra geral: deixa isto desligado.</p>
    <p class="hint fis-sit-nota">As rendas de um arrendamento rural não pedem recibo eletrónico (art. 5.º n.º 3 a)): isso marca-se no contrato, e não aqui, e não te dispensa dos recibos dos outros contratos; podes declará-las no Modelo 44, se quiseres.</p>`;
  const dispensa=s.dispensaRecibos||fiscoSitDispensaVer?notaDispensa
    :`<p class="fis-sit-nota"><button type="button" class="btn sm" id="fiscoSitQuemDispensa" data-toca="nada" data-click="fiscoSitVerDispensa()" aria-expanded="false" aria-controls="fiscoSitDispensaNota">Quem tem dispensa?</button></p>`;
  /* KAN-127-10: o porquê à vista, aberto ou fechado, e o botão diz o que faz,
     por baixo dele, e não um «Mudar» solto no canto */
  const mudar=`<p class="hint fis-sit-nota">${fiscoSituacaoPorque(ano)}</p><p class="fis-sit-nota"><button type="button" class="btn sm" id="fiscoSitMudar" data-toca="nada" data-click="fiscoSitMudar(${open?'false':'true'})" aria-expanded="${open?'true':'false'}" aria-controls="fiscoSitCorpo">${open?'Fechar':'Mudar a situação fiscal'}</button></p>`;
  /* as linhas dos interruptores são <label>: tocar no texto (a linha inteira,
     60px) chega ao botão, como nas outras listas de interruptores — o botão
     sozinho tem 28px de altura. Dentro de um <label> o texto vai em <span>. */
  return fisCartao('A tua situação fiscal em '+ano,open?'O que só tu sabes e muda o Anexo F de '+ano+'. Grava ao mexer.':fiscoSituacaoResumo(r,s),
    mudar+`<div class="fis-sit-corpo" id="fiscoSitCorpo"${open?'':' hidden'}><label class="fis-linha fis-linha-toque"><span class="fis-linha-txt"><b>Tributação conjunta</b><span class="small">Casados ou unidos de facto</span></span>${interruptor('fiscoConjunta','conjunta',s.conjunta,'Tributação conjunta')}</label>
    <p class="hint fis-sit-nota">Em conjunta há uma só declaração, e cada linha do Anexo F diz de quem é a renda: A ou B. Em separado cada um entrega o seu Anexo F, e é sempre A.</p>${conj}
    <p class="hint fis-sit-nota">As rendas de um dependente declaram-se com a letra dele — D1, AF1 ou DG1, como no quadro 6B do rosto —, em conjunta ou em separado. A app só escreve A e B: essa letra muda-se no Portal das Finanças.</p>
    <label class="fis-linha fis-linha-toque"><span class="fis-linha-txt"><b>Tenho dispensa dos recibos de renda eletrónicos</b></span>${interruptor('fiscoDispensa','dispensaRecibos',s.dispensaRecibos,'Dispensa dos recibos de renda eletrónicos')}</label>
    ${dispensa}
    <p class="hint fis-sit-nota">Cada ano tem a sua situação, a do último dia do ano (CIRS art. 13.º): o que mudas aqui vale para ${ano} e para os anos seguintes que não tenham a sua, e nunca muda os anteriores.${herdada}</p></div>`,'fis-sit'+(open?' aberta':''));
}
/* Porque importa a situação fiscal do ano, numa frase por baixo do título do
   cartão (fiscoSituacaoCard, KAN-127-10: com só «Mudar» não se percebia o que
   fazia nem a importância): a conjunta junta as rendas do cônjuge que estão
   na app às minhas, e com elas muda o imposto estimado; a dispensa dos
   recibos muda o que fica a tratar (as rendas sem recibo deixam de ser falta
   e entra o Modelo 44, que só se nomeia com a dispensa ligada — N063).
   Recebe: ano — o ano dos rendimentos.
   Devolve: o texto (string sem HTML). */
function fiscoSituacaoPorque(ano){
  return 'Daqui depende o Anexo F de '+ano+'. Em separado entram só as tuas rendas; em conjunta, as do cônjuge que estão nesta app juntam-se às tuas numa só declaração, e o imposto estimado muda com elas. A dispensa dos recibos eletrónicos muda o que fica a tratar antes de entregar.';
}
/* O resumo da situação fiscal de um ano numa linha, para o cartão fechado
   (fiscoSituacaoCard, maqueta 6): em separado ou em conjunta — com quem e a
   minha letra no Rosto, com os bens comuns do casal ou sem cônjuge
   escolhido — e se passo os recibos eletrónicos ou tenho a dispensa deles.
   Recebe: r — o resumo (resumoFiscal); s — a situação do ano (irsSituacao).
   Devolve: o texto (HTML seguro), ex.: «Declaração em separado, és o
   titular A · passas recibos eletrónicos». */
function fiscoSituacaoResumo(r,s){
  const eu=r&&!r.porInteiro?String(r.titularId||''):'';
  s=s||{};
  const letra=s.minhaLetra==='B'?'B':'A';
  const cj=s.conjunta&&eu&&s.conjugeId&&s.conjugeId!==eu&&(db.owners||[]).some(o=>o&&o.id===s.conjugeId)?s.conjugeId:'';
  const quem=!s.conjunta?'Declaração em separado, és o titular A'
    :!eu?'Declaração conjunta'
    :cj?'Declaração conjunta com '+esc((owner(cj)||{}).name||'o teu cônjuge')+', és o titular '+letra
    :fiscoBensComuns(s)?'Declaração conjunta com os bens comuns do casal, és o titular '+letra
    :'Declaração conjunta, sem o cônjuge escolhido';
  return quem+' · '+(s.dispensaRecibos?'tens dispensa dos recibos eletrónicos':'passas recibos eletrónicos');
}
/* O estado do cartão da situação fiscal na página (fiscoSituacaoCard): null
   enquanto a pessoa não o abriu nem fechou (abre sozinho só com uma escolha
   por fazer), true aberto, false fechado; e se a nota de quem tem dispensa
   dos recibos foi pedida (fiscoSitVerDispensa). Duram enquanto a janela
   estiver aberta, como as dobras (componentes.js:foldState). */
let fiscoSitAberta=null,fiscoSitDispensaVer=false;
/* O «Mudar a situação fiscal» e o «Fechar» do cartão da situação fiscal: abre-o ou fecha-o e
   redesenha a página, com o foco no mesmo botão (fisRepintar, pelo id).
   Recebe: abrir — true para abrir, false para fechar.
   Devolve: nada — muda o estado e redesenha. */
function fiscoSitMudar(abrir){
  fiscoSitAberta=abrir===true;
  fisRepintar(false);
}
/* Abre o cartão da situação fiscal a partir de outro sítio da página (um
   aviso de «A tratar» que pede uma escolha nele) e leva-o à vista.
   Devolve: nada — abre, redesenha e rola até ao cartão. */
function fiscoSitAbrir(){
  fiscoSitAberta=true;
  fisRepintar(false);
  const b=document.getElementById('fiscoSitMudar'),e=document.getElementById('fiscoSitCorpo'),c=e&&e.parentNode?e.parentNode:e;
  if(b&&typeof b.focus==='function')try{b.focus({preventScroll:true})}catch(x){}
  if(c&&typeof c.scrollIntoView==='function')try{c.scrollIntoView({block:'start'})}catch(x){}
}
/* O «Quem tem dispensa?» do cartão da situação fiscal: mostra a nota de
   quem tem dispensa dos recibos eletrónicos sem ligar a dispensa (N063), e
   redesenha com o foco na primeira linha da nota.
   Devolve: nada — muda o estado e redesenha. */
function fiscoSitVerDispensa(){
  fiscoSitDispensaVer=true;
  fisRepintar(false);
  const n=document.getElementById('fiscoSitDispensaNota');
  if(n&&typeof n.focus==='function')try{n.focus({preventScroll:true})}catch(x){}
}
/* A escolha «Os bens são comuns do casal» no cartão da situação (D5), em
   conjunta sem cônjuge com conta escolhido — o caso de um casal em que só um
   usa a app. Ligada, o resumo põe a parte do cônjuge numa linha do titular
   dele, em cada imóvel com um só dono fora da app (esse dono é o cônjuge):
   as rendas, as retenções e os gastos pela quota dele, em vez de ficarem de
   fora. Diz o que fez, pelo r.bensComuns do resumo: os imóveis com a linha
   do cônjuge (imoveis), os que têm mais do que um dono fora da app, onde não
   se sabe qual é o cônjuge (porDecidir), e os que estão todos em meu nome,
   cuja linha fica inteira na minha letra (soMeus). Grava ao mexer
   (fiscoSetSituacao, campo bensComuns).
   Recebe: r — o resumo (resumoFiscal); ano — o ano; on — a escolha de agora.
   Devolve: o HTML da linha do interruptor e das notas (string). */
function fiscoBensComunsHtml(r,ano,on){
  const s=irsSituacao(ano,r.titularId||''),cf=r.conjugeFora||null;
  const minha=s.minhaLetra==='B'?'B':'A',dele=(cf&&cf.letra)||(minha==='B'?'A':'B');
  const nomes=xs=>esc(listaE((xs||[]).map(x=>String((x&&(x.imovel||x.nome))||'')).filter(Boolean)));
  const bc=r.bensComuns&&typeof r.bensComuns==='object'?r.bensComuns:null;
  const im=bc&&Array.isArray(bc.imoveis)?bc.imoveis.filter(Boolean):[],pd=bc&&Array.isArray(bc.porDecidir)?bc.porDecidir.filter(Boolean):[],sm=bc&&Array.isArray(bc.soMeus)?bc.soMeus.filter(Boolean):[];
  /* a quota do cônjuge em fração (0 a 1); uma em % (até 100) também se lê */
  const pct=q=>{const n=Number(q);return n>0?' '+fiscoPctQuota(n>1?n/100:n):''};
  const estado=!on||!bc?'':[
    im.length?`A parte do teu cônjuge vai numa linha do titular ${dele}: ${esc(listaE(im.map(x=>String(x.imovel||'')+(x.nome||Number(x.quota)>0?' ('+[x.nome||'',pct(x.quota).trim()].filter(Boolean).join(', ')+')':'')).filter(Boolean)))}.`:'',
    pd.length?`Em ${nomes(pd)} há mais do que um dono fora da app, e a app não sabe qual é o teu cônjuge: a parte dele não entra — junta-a no Portal das Finanças, numa linha do titular ${dele} pela quota dele.`:'',
    sm.length?`${nomes(sm)} ${sm.length>1?'estão todos':'está todo'} em teu nome na app: a linha fica inteira no titular ${minha}. Se uma parte é do teu cônjuge, escreve-o na ficha do imóvel em «Há outros donos fora da app?», com a quota dele.`:''].filter(Boolean).map(t=>`<p class="hint fis-sit-nota">${t}</p>`).join('');
  return `<label class="fis-linha fis-linha-toque"><span class="fis-linha-txt"><b>Os bens são comuns do casal</b><span class="small">O teu cônjuge não tem conta nesta app</span></span><button type="button" class="interruptor" role="switch" id="fiscoBensComuns" aria-checked="${on?'true':'false'}" aria-label="Os bens são comuns do casal" data-toca="dados" data-click="fiscoSetSituacao(${ano},'bensComuns',${on?'false':'true'})"></button></label>
    <p class="hint fis-sit-nota">Liga se os imóveis que tens aqui são do casal e o teu cônjuge não usa a app. Num imóvel com um só dono fora da app, esse dono é o teu cônjuge: a parte dele vai numa linha do titular ${dele}, com as rendas, as retenções e os gastos pela quota dele, em vez de ficar de fora da declaração.</p>${estado}`;
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
   Declaração de um ano já entregue mudava). Os campos: conjunta,
   dispensaRecibos e bensComuns (os bens são comuns do casal, D5; true liga,
   o resto desliga); conjugeId (um proprietário
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
  if(campo==='conjunta'||campo==='dispensaRecibos'||campo==='bensComuns')novo=valor===true;
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
      d.porAno[A]={conjunta:h.conjunta,conjugeId:h.conjugeId,minhaLetra:h.minhaLetra,dispensaRecibos:h.dispensaRecibos,bensComuns:h.bensComuns===true,aimi:{total:null,valorTributavel:null}};
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
   leva a do fiscoLetra. O cônjuge sem conta dos bens comuns do casal (D5,
   r.conjugeFora: um titular que não é proprietário na app) leva o nome do
   dono de fora que é ele, ou «o cônjuge», e a letra do resumo.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o texto ('' por inteiro). */
function fiscoQuemDeclara(r){
  if(r.porInteiro)return '';
  const cf=r.conjugeFora&&r.conjugeFora.id?r.conjugeFora:null;
  const nome=o=>fiscoEhConjugeFora(o)?(String((cf&&o===cf.id&&cf.nome)||'').trim()||'o cônjuge'):(owner(o)||{}).name||'—';
  if(r.titulares.length<2)return nome(r.titularId);
  const letra={};(r.linhas||[]).forEach(l=>{if(l&&l.titularId&&l.titular&&!(l.titularId in letra))letra[l.titularId]=l.titular});
  return listaE(r.titulares.map(o=>nome(o)+' ('+(letra[o]||(cf&&o===cf.id&&cf.letra)||fiscoLetra(o,r.ano))+')'));
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
