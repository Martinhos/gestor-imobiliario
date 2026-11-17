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
   proprietário marcado como B, cada linha com a sua letra.

   O que é estimativa diz-se como tal: os gastos de um imóvel com mais do que
   um contrato no ano repartem-se pelos contratos na proporção das rendas de
   cada um — incluindo as rendas que ficam fora do quadro (não declaradas ou
   sem contrato), cuja parte não entra; o rateio que a lei pede quando o
   imóvel se arrenda por partes independentes (por VPT ou por área, CIRS art.
   41.º n.º 4) fica para quem preenche, com o VPT à mão na ficha do imóvel. E
   o imposto é a estimativa sem englobamento, à taxa de cada contrato.

   O que só o senhorio sabe vive nas definições (db.settings.irs, «A tua
   situação» no topo da página): a tributação conjunta e a letra de cada
   proprietário (A ou B — sem conjunta é sempre A) e a dispensa dos recibos
   eletrónicos (que obriga ao Modelo 44). O guia de como declarar, com o
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
   prazos da AT; um cartão por quadro, o 4.1 e o 4.2, cada um com onde se
   preenche, o resumo dos seus contratos e os campos de cada contrato (com
   o 4.2A, o 4.2B e o 4.2C no do 4.2); os
   isentos do 6D, as obras dos 24 meses, as rendas de anos anteriores, o AIMI
   do quadro 9, o que ficou fora por escolha e as rendas sem contrato. Sem
   imóveis, ou sem rendas no ano, diz-o e aponta a saída; com imóveis à vista
   mas nenhum teu (só colaboras), diz que o Anexo F não é deles.
   Devolve: o HTML da vista (string). */
function vFisco(){
  const ano=fiscoAnoAtual(),auto=!fiscoAno;
  const anos=yearsWithData(null);if(anos.indexOf(ano)<0)anos.push(ano);anos.sort((a,b)=>a-b);
  const r=resumoFiscal(ano);
  const quem=r.porInteiro?(r.semSessao?'Sem sessão não se sabe qual dos proprietários és: os valores vão por inteiro.':'Sem proprietários na ficha, os valores vão por inteiro.')
    :'A declaração é a tua: rendas, retenções e gastos entram pela tua quota-parte de cada imóvel.'+(r.titulares.length>1?' Em tributação conjunta entra também a do titular B, cada linha com a sua letra.':'');
  const panel=anaPanel(`<div class="u-w-100pc">${sel('fiscoSel',String(ano),anos.map(y=>({v:String(y),label:String(y)})),'onFiscoAno','vista')}</div>
    <div class="hint u-mt-9px">${quem}${auto&&ano===YEAR-1?' Até junho mostra-se o ano anterior, que é o que se está a declarar.':''}</div>`);
  /* a saída do vazio leva aos Imóveis: com esse serviço desligado nesta conta
     o botão não se escreve, e a frase diz quem o liga */
  if(!r.imoveis){
    const deOutros=!r.porInteiro&&pidProps(null).some(p=>pode(p.id,'report.view'));
    return panel+(esperaDoServidor()||(deOutros?`<div class="empty"><b>Nenhum imóvel teu</b>O Anexo F é de quem recebe as rendas: aqui entram só os imóveis de que és proprietário, pela tua quota-parte.</div>`
      :`<div class="empty"><b>Sem imóveis</b>O Anexo F parte das rendas de cada imóvel.
    ${servicoLigado('properties')?saida('Adicionar imóvel',"go('properties')",'ecra'):vazioServicoDesligado('properties')}</div>`));
  }
  if(!r.linhas.length&&!r.fora.length&&!r.semContrato.length){
    const outros=anos.filter(y=>y!==ano&&(db.transactions||[]).some(t=>ehRenda(t)&&String(t.date||'').startsWith(String(y))));
    return panel+`<div class="ana fis"><div class="empty"><b>Sem rendas em ${ano}</b>${outros.length?'Há rendas em '+esc(outros.join(', '))+'. ':''}Uma renda entra aqui quando o movimento é da categoria Rendas e está ligado ao contrato.
      ${saida('Escolher outro ano','hdrFiltToggle()','vista')}</div></div>`;
  }
  /* Os cartões dos quadros empilham-se numa grelha de uma coluna com o mesmo
     intervalo que as colunas da casa (14px). A coluna é minmax(0,1fr) e não
     1fr: um item de grelha não encolhe abaixo do seu conteúdo, e a tabela do
     resumo, mais larga do que o ecrã, alargava a página em vez de rolar
     dentro do .tablewrap. */
  const Q=r.versao.quadros;
  return panel+`<div class="ana fis">`+fisBarra()+fiscoKpis(r)
    +`<div class="fis-grelha">`+fiscoObrigacoesCard(r)+fiscoSituacaoCard(r)+fisPrazosCard()+`</div>`
    +`<div class="fiscoPilha u-d-grid u-gtc-minmax-0-1fr u-g-14px">`
    +fiscoQuadroCard(r,Q.semReducao)+fiscoQuadroCard(r,Q.comReducao)+fiscoIsentosCard(r)+fiscoObrasCard(r)
    +fiscoAnosAnterioresCard(r)+fiscoAimiCard(r)+fiscoForaCard(r)+fiscoSemContratoCard(r)+fisNadaForaCard(r)+`</div></div>`;
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
/* A janela do botão de partilha da barra (fisBarra): a escolha da casa
   (componentes.js:pickModal), com o ícone e uma linha a dizer o que leva cada
   uma — «Exportar CSV» e, só com o serviço Contratos ligado (é lá que vive o
   escritor do PDF; o servicoLigado, o idioma de guarda da casa), «Exportar
   PDF» (fisco-pdf.js:fiscoPdf). Escolher fecha a janela e exporta.
   Devolve: nada — abre a janela. */
function fiscoPartilha(){
  const ops=[{v:'csv',label:'Exportar CSV',sub:'Uma linha por contrato, para abrir no Excel',icon:'down'}];
  if(servicoLigado('contracts'))ops.push({v:'pdf',label:'Exportar PDF',sub:'Os quadros campo a campo, para guardar ou imprimir',icon:'contract'});
  pickModal('Partilhar',ops,o=>{closeModal();if(o.v==='pdf')fiscoPdf();else fiscoCsv()});
}
/* Os cinco números do ano à cabeça (a prancheta), em cartões com explicação
   ao toque: rendas ilíquidas, retenções na fonte, gastos dedutíveis (com as
   obras dos 24 meses), o rendimento líquido (sem o dos contratos isentos, que
   o rodapé diz) e o imposto estimado, em destaque — os totais dos quadros,
   antes de os ler linha a linha.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML da grelha (string). */
function fiscoKpis(r){
  const T=r.totais,g=sum(r.colunas.map(k=>T.gastos[k]))+T.obras24;
  const aPagar=r2(T.imposto-T.retencoes);
  return `<div class="grid fis-kpis">
    ${kpi('Rendas ilíquidas',euro(T.rendas),'',fiscoN(fiscoNContratos(r.linhas),'contrato','contratos')+' em '+r.ano,'O que entrou como renda mais o que o inquilino reteve na fonte, no ano em que foi recebido. É o valor que vai aos quadros 4.1 e 4.2; cauções e empréstimos recebidos ficam de fora.')}
    ${kpi('Retenções na fonte',euro(T.retencoes),'',T.retencoes?'retidas pelos inquilinos':'nenhuma registada','O que os inquilinos retiveram na fonte e entregaram à AT por ti, como está nos movimentos. Já conta nas rendas ilíquidas e abate ao imposto.')}
    ${kpi('Gastos dedutíveis',euro(g),'',T.obras24?'com '+euro(T.obras24)+' de obras dos 24 meses':'conservação, condomínio, IMI, selo, taxas e outros','As colunas de gastos dos quadros, pela regra de cada categoria (Definições → Categorias, etiquetas e IRS), só do período em que o imóvel esteve arrendado, e as obras de conservação dos 24 meses antes de um contrato. Ficam fora os juros, o mobiliário, o AIMI e as obras que acrescentam valor.')}
    ${kpi('Rendimento líquido',euro(T.liquido),T.liquido<0?'neg':'',T.prejuizo?'prejuízo a reportar':T.isentos.n?'sem os '+euro(T.isentos.liquido)+' isentos (6D)':'rendas menos gastos',T.prejuizo?'As rendas não chegaram para os gastos. O resultado negativo não se perde: abate às rendas dos seis anos seguintes (CIRS art. 55.º), se o imóvel voltar a dar rendas.':'As rendas ilíquidas menos os gastos dedutíveis, linha a linha. É sobre isto que se paga o imposto.')}
    ${kpi('Imposto estimado',euro(T.imposto),'',T.retencoes?'já retido '+euro(T.retencoes)+' · '+(aPagar>=0?'falta '+euro(aPagar):'a receber '+euro(-aPagar)):'sem englobamento','O rendimento líquido de cada contrato à taxa dele em '+r.ano+' (a escrita no contrato, ou a estimativa da versão do ano), somado. É uma estimativa sem englobamento: o valor certo é o da liquidação da AT. As retenções do inquilino abatem a isto.')}</div>`;
}
/* O rótulo do botão de um aviso, pelo sítio que ele abre: a ficha de um
   contrato, de um inquilino, de um imóvel ou de um movimento, a lista dos
   contratos ou dos movimentos, ou as definições do IRS.
   Recebe: abrir — o código da ação do aviso.
   Devolve: o rótulo (texto). */
function fiscoRotuloDoAviso(abrir){
  const a=String(abrir||'');
  if(/^ctView\(/.test(a))return 'Abrir contrato';
  if(/^personView\(/.test(a))return 'Abrir inquilino';
  if(/^propView\(/.test(a))return 'Abrir imóvel';
  if(/^txView\(/.test(a))return 'Abrir movimento';
  if(/go\('contracts'\)/.test(a))return 'Ver contratos';
  if(/go\('transactions'\)/.test(a))return 'Ver movimentos';
  if(/go\('settings'\)/.test(a))return 'Abrir definições';
  return 'Abrir';
}
/* O cartão «A tratar antes de entregar» (a prancheta): os avisos do resumo,
   numerados, com o selo do nível (vermelho o que falta à AT, âmbar o que
   convém tratar, cinzento o que só se diz) e o botão que abre o sítio onde se
   trata; o dos não declarados fica sem botão, que não há nada a tratar.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string). */
function fiscoObrigacoesCard(r){
  const cor={falta:'red',aviso:'amber',info:'grey'};
  const row=(a,i)=>`<div class="fis-ob"><span class="badge ${cor[a.nivel]||'amber'} fis-num">${i+1}</span><p>${esc(a.texto)}</p>${a.abrir
    ?`<button type="button" class="btn sm" data-toca="${esc(a.toca||'camada')}" data-click="${a.abrir}">${fiscoRotuloDoAviso(a.abrir)}</button>`:''}</div>`;
  const nTratar=r.avisos.filter(a=>a.nivel!=='info').length;
  const corpo=r.avisos.length?`<div class="fis-obs">${r.avisos.map(row).join('')}</div>`
    :`<p class="hint">Com o que a app sabe, não falta nada para preencher os quadros de ${r.ano}.</p>`;
  /* o selo da contagem cola-se ao título (a prancheta), em vez de fugir para o canto */
  return fisCartao('A tratar antes de entregar'+(nTratar?` <span class="badge amber">${nTratar}</span>`:''),
    r.avisos.length?fiscoN(r.avisos.length,'ponto','pontos')+' de '+r.ano:'Nada em falta em '+r.ano,
    corpo+`<p class="hint">A app resume, não declara: o que falta fica escrito aqui e ao pé de cada linha dos quadros. Os prazos com data estão nos Prazos da AT.</p>`,
    'fis-tratar');
}
/* O cartão «Prazos da AT»: os prazos da AT que já entraram na janela de aviso
   (prazos.js:prazosAtivos — o Modelo 2, a cessação, os recibos, a entrega do
   Anexo F, a comunicação de fevereiro, o envio ao IHRU e o Modelo 44), do
   mais urgente para o menos, cada um com o selo da urgência — «Passou há N
   dias» e «Faltam N dias» até sete dias a vermelho, até trinta a âmbar, o
   resto a cinzento — e o toque que abre a ficha certa (o do próprio Anexo F,
   que é esta página, não se escreve). Mostra os cinco primeiros; os outros
   estão nos Prazos da visão geral. Nada antes de o estado chegar
   (espera.js:sabemosOEstado): um prazo silenciado noutro aparelho voltava.
   Devolve: o HTML do cartão (string). */
function fisPrazosCard(){
  const AT={modelo2:1,cessacao:1,recibos:1,irs:1,fev15:1,rsaa:1,modelo44:1};
  if(!sabemosOEstado())return '';
  const lista=prazosAtivos().filter(p=>AT[p.tipo]);
  const selo=p=>{const d=p.dias,cls=p.urg==='info'?'grey':p.urg==='breve'?'amber':'red';
    const txt=d<0?'Passou há '+fiscoN(-d,'dia','dias'):d===0?'Hoje':(d===1?'Falta 1 dia':'Faltam '+d+' dias');
    return `<span class="badge ${cls}">${txt}</span>`};
  const row=p=>{const abre=p.abrir&&p.abrir!=="go('fisco')";
    return `<div class="fis-pz${abre?' tap':''}"${abre?` data-toca="${/^go\(/.test(p.abrir)?'ecra':'camada'}" data-click="${p.abrir}"`:''}><div><b>${esc(p.titulo)}</b><span class="small">${esc(p.sub)}</span></div>${selo(p)}</div>`};
  const mais=lista.length-5;
  const corpo=lista.length?`<div class="fis-pzs">${lista.slice(0,5).map(row).join('')}</div>${mais>0?`<p class="hint">E ${fiscoN(mais,'outro','outros')} nos Prazos da visão geral.</p>`:''}`
    :`<p class="hint">Nenhum prazo da AT na janela de aviso. Os da entrega, do Modelo 2 e dos recibos aparecem aqui com antecedência.</p>`;
  return fisCartao('Prazos da AT',lista.length?fiscoN(lista.length,'prazo','prazos')+' na janela de aviso':'Nada para já',corpo,'fis-prazos');
}
/* Os proprietários dos imóveis com rendas no ano que vejo com a Avaliação
   aberta pelo cargo, pela ordem em que aparecem: os que «A tua situação
   fiscal» lista para a letra A/B. Não só os desta declaração: o cônjuge com
   um imóvel só dele tem de estar na lista para se poder marcar como B.
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
/* O cartão «A tua situação fiscal» (a prancheta M-SituacaoFiscal): o que só
   o senhorio sabe e muda o que vai a cada quadro, em linhas que gravam ao
   mexer — a tributação conjunta num interruptor e, com ela, a letra de cada
   proprietário dos imóveis com rendas no ano num segmentado A/B (eu à
   cabeça, com « (eu)»; fiscoDonosDoAno: não só os desta declaração, que o
   cônjuge com um imóvel só dele só entra depois de marcado como B); e a dispensa
   dos recibos eletrónicos noutro interruptor, com quem está dispensado e o
   Modelo 44 que isso obriga a entregar. Grava logo (fiscoSetIrs,
   fiscoSetTitular), em db.settings.irs, que vai com as definições.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string). */
function fiscoSituacaoCard(r){
  const d=fiscoIrsDefs(),ids=fiscoDonosDoAno(r.ano);
  if(r.titularId)ids.sort((a,b)=>(b===r.titularId)-(a===r.titularId));
  const interruptor=(id,campo,on,nome)=>`<button type="button" class="interruptor" role="switch" id="${id}" aria-checked="${on?'true':'false'}" aria-label="${nome}" data-toca="dados" data-click="fiscoSetIrs('${campo}',${on?'false':'true'})"></button>`;
  const ab=o=>{const l=fiscoLetra(o,r.ano,d),nome=esc(rotuloDoDono(owner(o)||{},ids.length));
    return `<div class="fis-linha"><span class="fis-linha-txt">${nome}</span><div class="segm fis-ab" role="group" id="fiscoTit_${esc(o)}" aria-label="Titular de ${nome}">${['A','B'].map(x=>
      `<button type="button" class="${l===x?'on':''}" aria-pressed="${l===x}" data-toca="dados" data-click="fiscoSetTitular('${jsq(o)}','${x}')">${x}</button>`).join('')}</div></div>`};
  const titulares=!d.conjunta?'':ids.length?`<p class="lbl fis-sit-lbl">Titular de cada proprietário</p>${ids.map(ab).join('')}
    <p class="hint fis-sit-nota">A: sujeito passivo A. B: o cônjuge (sujeito passivo B). Marca o cônjuge como B: a parte dele entra nesta declaração, e cada linha dos quadros leva a letra de quem é a renda. Um imóvel dos dois vai em duas linhas, uma por titular, cada uma com a sua quota-parte.</p>`
    :`<p class="hint fis-sit-nota">Os imóveis com rendas em ${r.ano} não têm proprietários na ficha: as linhas ficam em A.</p>`;
  /* as linhas dos interruptores são <label>: tocar no texto (a linha inteira,
     60px) chega ao botão, como nas outras listas de interruptores — o botão
     sozinho tem 28px de altura. Dentro de um <label> o texto vai em <span>. */
  return fisCartao('A tua situação fiscal','O que só tu sabes e muda o Anexo F. Grava ao mexer.',
    `<label class="fis-linha fis-linha-toque"><span class="fis-linha-txt"><b>Tributação conjunta</b><span class="small">Casados ou unidos de facto</span></span>${interruptor('fiscoConjunta','conjunta',d.conjunta,'Tributação conjunta')}</label>
    <p class="hint fis-sit-nota">Em conjunta há uma só declaração, e cada linha do Anexo F diz de quem é a renda: A ou B. Em separado cada um entrega o seu Anexo F, e é sempre A.</p>${titulares}
    <label class="fis-linha fis-linha-toque"><span class="fis-linha-txt"><b>Tenho dispensa dos recibos de renda eletrónicos</b></span>${interruptor('fiscoDispensa','dispensaRecibos',d.dispensaRecibos,'Dispensa dos recibos de renda eletrónicos')}</label>
    <p class="hint fis-sit-nota">Tem dispensa quem a 31 de dezembro do ano anterior tinha 65 anos ou mais, ou quem não tem nem é obrigado a ter caixa postal eletrónica e no ano anterior recebeu rendas até duas vezes o IAS (${euro2(1074.26)} em 2026) — e o arrendamento rural (Portaria 98-A/2015, art. 5.º). Quem se dispensa entrega o Modelo 44, a declaração anual das rendas, até ao fim de fevereiro do ano seguinte. Quem passa recibos eletrónicos na mesma fica na regra geral: deixa isto desligado.</p>`,'fis-sit');
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
/* Liga ou desliga uma escolha de «A tua situação»: a tributação conjunta ou a
   dispensa dos recibos. Outro campo não mexe em nada.
   Recebe: campo — 'conjunta' ou 'dispensaRecibos'; valor — ligado ou não.
   Devolve: nada — grava e redesenha (fiscoGravarIrs). */
function fiscoSetIrs(campo,valor){
  if(campo!=='conjunta'&&campo!=='dispensaRecibos')return;
  fiscoGravarIrs(d=>{d[campo]=!!valor});
}
/* Grava a letra de um proprietário (o segmentado A/B de «A tua situação
   fiscal»). Só de um proprietário que existe: o id vem da página, e um
   objeto indexado por um id qualquer ganhava chaves que ninguém lê.
   Recebe: oid — o id do proprietário; letra — 'A' ou 'B' (outra coisa é A).
   Devolve: nada — grava e redesenha (fiscoGravarIrs). */
function fiscoSetTitular(oid,letra){
  if(!(db.owners||[]).some(o=>o.id===oid))return;
  fiscoGravarIrs(d=>{d.titulares[oid]=letra==='B'?'B':'A'});
}
/* Quem declara, por extenso, para o cabeçalho do texto e do PDF: o nome de
   quem tem a sessão e, em conjunta com o titular B, os dois, cada um com a
   sua letra.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o texto ('' por inteiro). */
function fiscoQuemDeclara(r){
  if(r.porInteiro)return '';
  const nome=o=>(owner(o)||{}).name||'—';
  if(r.titulares.length<2)return nome(r.titularId);
  return listaE(r.titulares.map(o=>nome(o)+' ('+fiscoLetra(o,r.ano)+')'));
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
