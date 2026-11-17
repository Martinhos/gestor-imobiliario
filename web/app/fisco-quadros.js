/* ================= FISCO · QUADROS =================
   Os cartões e os quadros da página do IRS · Anexo F, em HTML: o cartão
   genérico, o quadro 4.1 e o 4.2 com os campos de cada contrato, as
   reduções, os isentos do 6D, o AIMI do quadro 9, as obras dos 24 meses,
   as rendas de anos anteriores e o que ficou fora. Só desenham o que o
   resumo (fisco-resumo.js) já calculou; a vista que os junta é o fisco.js.
   Partiu-se do fisco.js (KAN-125). A Declaração requer os Contratos e os
   Movimentos (servicos.js): os cartões abrem sempre a ficha, sem perguntar
   pelos serviços. Os campos novos do resumo (l.campo, l.prejuizo, a
   l.taxaEscrita em número, l.naturezaAssumida, r.aConfirmar) leem-se com
   cuidado: um resumo sem eles desenha-se como antes (KAN-126). */

/* Um cartão da Análise no IRS: o título na letra dos títulos, o subtítulo ao
   lado e, à direita, o que o cartão traz no cabeçalho (o selo da contagem).
   Recebe: titulo — o título (texto já seguro); sub — o subtítulo ('' sem
   ele); corpo — o HTML do cartão; cls (opcional) — classes a mais; extra
   (opcional) — o HTML do canto direito do cabeçalho.
   Devolve: o HTML do cartão (string). */
function fisCartao(titulo,sub,corpo,cls,extra){
  return `<section class="card ana-cartao${cls?' '+cls:''}"><div class="ana-cab"><h2 class="ana-tit">${titulo}</h2>${sub?`<span class="small">${sub}</span>`:''}${extra?`<span class="ana-extra">${extra}</span>`:''}</div>${corpo}</section>`;
}
/* A taxa escrita no contrato, quando é outra que a da lei do ano. Na
   Declaração a taxa da linha é sempre a da lei (fisco-resumo.js, D17); a
   escrita fica como nota, para quem a escreveu saber que não é a que conta.
   O resumo dá-a em l.taxaEscrita (o número, ou null); um resumo antigo dava
   um booleano, e aí não há número a dizer.
   Recebe: l — a linha do resumo.
   Devolve: a taxa escrita (número), ou null quando não há ou é igual. */
function fiscoTaxaEscritaOutra(l){
  const e=l&&typeof l.taxaEscrita==='number'?l.taxaEscrita:null;
  if(e==null||!(e>0)||l.isencao)return null;
  return Math.round(e*100)===Math.round((Number(l.taxa)||0)*100)?null:e;
}
/* O prejuízo de uma linha: o líquido negativo, que não paga imposto e se diz
   como prejuízo (CIRS art. 55.º; D98). O resumo dá-o em l.prejuizo; sem ele
   (um resumo antigo), sai do líquido. Um isento não tem.
   Recebe: l — a linha do resumo.
   Devolve: o prejuízo em euros (0 quando não há). */
function fiscoPrejuizoDe(l){
  if(!l||l.isencao)return 0;
  const p=Number(l.prejuizo);
  if(p>0)return p;
  const liq=Number(l.liquido)||0;
  return liq<0?r2(-liq):0;
}
/* O mês e o ano de uma data, como as colunas das obras dos 24 meses os pedem
   («ano, mês» no impresso).
   Recebe: iso — 'AAAA-MM-DD' (ou só 'AAAA-MM').
   Devolve: 'MM/AAAA', ou '' sem data. */
function fiscoMesAno(iso){
  const m=/^(\d{4})-(\d{2})/.exec(String(iso||''));
  return m?m[2]+'/'+m[1]:'';
}
/* O quadro de rendas que a página mostra primeiro: o 4.1 quando tem linhas,
   senão o 4.2. O que se diz uma vez por página (o quadro 4.4, as despesas a
   confirmar) vai no cartão dele.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o quadro ('4.1', '4.2'). */
function fiscoPrimeiroQuadro(r){
  const Q=r.versao.quadros;
  return r.linhas.some(l=>l.quadro===Q.semReducao)?Q.semReducao:Q.comReducao;
}
/* Os campos do 4.1/4.2 onde ficou um imóvel, para os quadros que o pedem
   pelo campo (o 9, o «Campo do Q4»): os das linhas desse imóvel nesse quadro.
   Recebe: r — o resumo (resumoFiscal); pid — o id do imóvel; q — o quadro.
   Devolve: os números dos campos (array de texto; vazio sem l.campo). */
function fiscoCamposDoImovel(r,pid,q){
  const out=[];
  r.linhas.forEach(l=>{if(l.propertyId===pid&&l.quadro===q&&l.campo&&out.indexOf(l.campo)<0)out.push(l.campo)});
  return out;
}
/* O que os subquadros 4.2B e 4.2C dizem ao quadro inteiro, por baixo dos
   cartões do 4.2. Os campos do 4.2B de cada contrato (a renda dele, o n.º e a
   renda do anterior) estão no cartão do contrato (fiscoCamposDe); aqui fica o
   que o 4.2B é — a descida do n.º 24 do art. 72.º, renda nova pelo menos 5 %
   abaixo da do contrato anterior no mesmo imóvel —, quando algum contrato a
   tem. O 4.2C é uma pergunta só — os contratos do 4.2 celebrados desde 2024
   cumprem o limite do n.º 23? —, e diz-se a resposta quando todos estão
   confirmados, ou quais faltam confirmar.
   Recebe: r — o resumo (resumoFiscal); ls — as linhas do quadro 4.2.
   Devolve: o HTML (string), ou '' quando nenhum dos dois se aplica. */
function fiscoReducoesHtml(r,ls){
  const L23=(r.versao.taxas&&r.versao.taxas.limiteRendaAlta)||{desde:'2024-01-01'};
  const bon=ls.filter(l=>l.bonus),n23=ls.filter(l=>l.celebracao&&l.celebracao>=L23.desde);
  let h='';
  if(bon.length)h+=`<div class="flabel u-mt-12px">Quadro 4.2B · renda abaixo da do contrato anterior</div>
    <div class="hint">${esc(listaE(bon.map(l=>l.nome+(l.campo?' (campo '+l.campo+')':''))))}: o n.º 24 do art. 72.º do CIRS desce a taxa mais 5 pontos num contrato novo com a renda pelo menos 5 % abaixo da do contrato anterior no mesmo imóvel. No 4.2B escreves o campo do 4.2 e a renda deste contrato, e o n.º e a renda do anterior — estão no cartão de cada um.</div>`;
  if(n23.length){
    const porConfirmar=n23.filter(l=>l.acimaDoLimite!==false);
    h+=`<div class="flabel u-mt-12px">Quadro 4.2C · limite das rendas (n.º 23)</div>
    <div class="hint">${fiscoN(n23.length,'contrato do 4.2 celebrado','contratos do 4.2 celebrados')} desde ${dPT(L23.desde)}: o 4.2C pergunta se nenhum passa 150 % dos limites de renda por tipologia e concelho (Portaria 176/2019). Um que passe não tem redução e vai ao 4.1.
    ${porConfirmar.length?' Por confirmar na ficha do contrato: '+esc(listaE(porConfirmar.map(l=>l.nome)))+'. Confirmados todos, a resposta é «Sim» (01).':' Todos confirmados dentro do limite: responde «Sim» (01).'}</div>`;
  }
  return h;
}
/* O começo do cartão de um quadro (fiscoQuadroCard): onde se preenche — o
   quadro do Anexo F, por esta ordem, e, no 4.2, o 4.2A das datas — e o
   resumo dos contratos desse quadro só, um por linha: o contrato e o imóvel
   (com o n.º do campo, o artigo, a fração, o n.º na AT e a taxa da lei do
   ano e porquê — e a escrita no contrato, quando é outra —, e o titular
   quando as linhas são de mais do que um — a conjunta), as rendas que vão ao
   quadro e o imposto estimado (ou o prejuízo, numa linha com mais gastos do
   que rendas: um imposto negativo não existe), e o que falta (o primeiro em
   falta num selo vermelho, e quantos mais); no fim, o total do quadro (as
   rendas, o líquido e o imposto estimado, sem os isentos, que vão ao 6D) —
   a soma do imposto das linhas, que é o mesmo cálculo do KPI (o resumo já
   abateu as perdas de cada titular às rendas dele). O Anexo F pede uma linha
   por prédio ou fração, com a renda que lhe cabe: a app faz uma por contrato,
   e diz a regra (D69). O n.º do campo (4001…, 4501…) é o que o 4.2A, o 4.2B,
   o 6D, o 8 e o 9 pedem: a ordem é a destas linhas (D77). Era uma tabela só
   para o 4.1 e o 4.2, com o quadro numa coluna: lia-se como um cartão que
   falava dos dois, e não se percebia onde preencher cada contrato (o ticket
   de QA 5cbde185, e a escolha do Martinho de um cartão por quadro). Linhas e
   não uma tabela: sem rolar de lado no telemóvel. Tocar numa linha abre a
   ficha do contrato (a Declaração requer os Contratos).
   Recebe: r — o resumo (resumoFiscal); ls — as linhas do quadro; q — o
   quadro ('4.1', '4.2'); red — true no quadro com redução pela duração.
   Devolve: o HTML (string). */
function fiscoQuadroResumoHtml(r,ls,q,red){
  const MOTIVO={nh:'não habitacional',duracao:'pela duração',moderada:'renda moderada',base:'taxa base'};
  const cap=s=>String(s).charAt(0).toUpperCase()+String(s).slice(1);
  const linha=l=>{
    const escrita=fiscoTaxaEscritaOutra(l),pj=fiscoPrejuizoDe(l);
    const taxa=l.isencao?'isento · '+(l.isencao.quadro||'6D')+(l.isencao.codigo?' código '+l.isencao.codigo:'')
      :dec(l.taxa)+' % '+(l.taxaEscrita===true?'escrita no contrato':MOTIVO[l.motivoTaxa]||'');
    const sub=[l.campo?'campo '+l.campo:'',l.imovel,l.artigo?'art. '+l.artigo:'',l.fracao?'fr. '+l.fracao:'',l.atNumero?'n.º '+l.atNumero:'',taxa.trim(),
      escrita!=null?'escreveste '+dec(escrita)+' % no contrato':'',r.variosTitulares?'titular '+l.titular:''].filter(Boolean).map(esc).join(' · ');
    const falta=l.faltas.length?`<span class="fis-qr-falta"><span class="badge red">${esc(cap(l.faltas[0]))}</span>${l.faltas.length>1?` <span class="small">+${l.faltas.length-1}</span>`:''}</span>`:'';
    const num=l.isencao?'isento':pj>0?'prejuízo '+euro2(pj):'imposto estimado '+euro2(Math.max(0,Number(l.imposto)||0));
    return `<div class="fis-qr-linha tap" data-toca="camada" data-click="ctView('${jsq(l.contratoId)}')" aria-label="${esc(l.nome)}: abrir o contrato"><div class="fis-qr-nome"><b>${esc(l.nome)}</b><span class="small">${sub}</span>${falta}</div>
      <div class="fis-qr-num"><b>${euro2(l.rendas)}</b><span class="small">${num}</span></div></div>`;
  };
  const conta=ls.filter(l=>!l.isencao),isentos=ls.length-conta.length;
  /* o imposto do quadro é a soma do das linhas, cada uma já ≥ 0: os totais
     dos dois quadros somam o KPI (fisco.js:fiscoKpis), que é o mesmo cálculo */
  const rendas=r2(sum(ls.map(l=>l.rendas))),liquido=r2(sum(conta.map(l=>l.liquido))),imposto=r2(sum(conta.map(l=>Math.max(0,Number(l.imposto)||0))));
  /* em conjunta, um contrato dos dois cônjuges vai numa linha por titular */
  const nCt=fiscoNContratos(ls),porLinha='uma linha por prédio ou fração de cada contrato'+(ls.length>nCt?' e por titular':'')+', com a renda que lhe cabe';
  const ini=ls[0]&&ls[0].campo?ls[0].campo:'';
  const onde=`Preenche no <b>quadro ${esc(q)}</b> do Anexo F, <b>por esta ordem</b>: ${porLinha}${red?`, e no ${esc(r.versao.quadros.datas)} as datas de cada um`:''}.`
    +(ini?` O n.º do campo de cada linha (${esc(ini)}…) é o que os outros quadros pedem para a identificar.`:'');
  return `<p class="fis-onde">${onde}</p><div class="fis-qr">${ls.map(linha).join('')}
    <div class="fis-qr-linha fis-qr-total"><div class="fis-qr-nome"><b>Total do quadro ${esc(q)}</b><span class="small">${fiscoN(nCt,'contrato','contratos')} · líquido ${euro2(liquido)}</span></div>
      <div class="fis-qr-num"><b>${euro2(rendas)}</b><span class="small">imposto estimado ${euro2(imposto)}</span></div></div></div>
    ${isentos?`<p class="hint">O líquido e o imposto não contam ${fiscoN(isentos,'o contrato isento','os contratos isentos')} (quadro 6D).</p>`:''}`;
}
/* O cartão de um quadro de rendas (o 4.1 ou o 4.2), um por quadro e tudo o
   que é desse quadro lá dentro: o título diz o quadro e o que lá vai; abre
   com onde se preenche e o resumo dos contratos dele (fiscoQuadroResumoHtml);
   depois, um cartão por contrato,
   com os campos do Anexo F pela ordem do impresso (fiscoContratoHtml), e no
   fim o total do quadro — as rendas, as retenções e cada coluna de gastos —,
   e o hint do que é estimativa. Sem tabela: a tabela larga rolava de lado no
   telemóvel, e lia-se e copiava-se para o Portal aos bocados. No 4.2, cada
   cartão traz também o 4.2A do contrato (a comunicação de fevereiro e as
   datas, que a AT pede sempre com ele) e o 4.2B quando se aplica; por baixo
   dos cartões, o que o 4.2A, o 4.2B e o 4.2C dizem ao quadro inteiro
   (fiscoReducoesHtml). O que se diz uma vez por página vai no primeiro
   quadro (fiscoPrimeiroQuadro): as despesas a confirmar, que não contam em
   coluna nenhuma (r.aConfirmar), e o quadro 4.4 — a renda da casa nova a
   mais de 100 km, que a app não conhece e a pessoa pode deduzir (D106).
   Sem linhas nesse quadro, não se escreve.
   Recebe: r — o resumo (resumoFiscal); q — o quadro ('4.1', '4.2').
   Devolve: o HTML do cartão (string), ou '' sem linhas. */
function fiscoQuadroCard(r,q){
  const ls=r.linhas.filter(l=>l.quadro===q);if(!ls.length)return '';
  const cols=r.colunas,red=q===r.versao.quadros.comReducao,s=k=>r2(sum(ls.map(l=>k(l))));
  const primeiro=q===fiscoPrimeiroQuadro(r);
  const obras=s(l=>l.obras24.valor);
  const somas=[['Rendas (rendimento ilíquido)',s(l=>l.rendas)],['Retenções na fonte',s(l=>l.retencoes)]]
    .concat(cols.map(k=>[irsColunaNome(k)||fiscoColRotulo(k),s(l=>l.gastos[k])])).concat(obras?[['Obras dos 24 meses antes do contrato',obras]]:[]);
  const tot=`<div class="fis-ctc fis-ctc-total"><div class="fis-ctc-cab"><div class="fis-ctc-nome"><b>Total do quadro ${esc(q)}</b><span class="small">${fiscoN(fiscoNContratos(ls),'contrato','contratos')}</span></div></div>
    <dl class="fis-campos">${somas.map(x=>`<div class="fis-campo"><dt>${esc(x[0])}</dt><dd>${euro2(x[1])}</dd></div>`).join('')}</dl></div>`;
  const parte=fiscoParte(r,ls),sub=r.ano+(parte?' · '+parte:'');
  /* a comunicação de fevereiro (Portaria 110/2019), contrato a contrato: o
     4.2A pergunta SIM ou NÃO, e sem ela não há redução */
  const prazo=dPT(r.versao.prazos.comunicacaoDuracao);
  const porComunicar=ls.filter(l=>l.comunicado==='');
  const datas=red?`<div class="flabel u-mt-12px">Quadro ${esc(r.versao.quadros.datas)} · datas de cada contrato</div>
    <div class="hint">O campo «Comunicação» do ${esc(r.versao.quadros.datas)} pergunta se a duração e as renovações foram comunicadas no Portal até ${prazo} (Portaria 110/2019): «comunicada» é SIM, «por comunicar» é NÃO — e sem ela arriscas a redução.${porComunicar.length?' '+fiscoN(porComunicar.length,'contrato ainda por comunicar','contratos ainda por comunicar')+': marca a data na ficha do contrato quando o fizeres.':''}</div>`
    +fiscoReducoesHtml(r,ls):'';
  /* as despesas a confirmar não contam em coluna nenhuma (o resumo não as
     soma); um resumo antigo, sem r.aConfirmar, somava as sem regra em Outros */
  const aConf=Array.isArray(r.aConfirmar)?r.aConfirmar.length:0;
  const confirmar=!primeiro?'':aConf?' '+fiscoN(aConf,'despesa a confirmar não conta','despesas a confirmar não contam')+' em coluna nenhuma até escolheres a coluna de cada uma: estão em «A tratar antes de entregar».'
    :!Array.isArray(r.aConfirmar)&&r.semRegra?' '+fiscoN(r.semRegra,'despesa sem regra de dedução conta','despesas sem regra de dedução contam')+' em Outros.':'';
  return fisCartao('Quadro '+esc(q)+' · '+(red?'com':'sem')+' redução pela duração',sub,
    fiscoQuadroResumoHtml(r,ls,q,red)+`<p class="lbl fis-q-campos">Os campos, contrato a contrato</p>
    <div class="fis-cts">${ls.map(l=>fiscoContratoHtml(r,l)).join('')}${tot}</div>
    <div class="hint">Rendas ilíquidas: o que entrou mais o que o inquilino reteve na fonte. Os gastos de um imóvel com mais do que um contrato no ano repartem-se pelas linhas na proporção das rendas de cada uma — é uma estimativa; o rateio por VPT ou por área, quando o imóvel se arrenda por partes, fica para quem preenche.${confirmar}</div>${datas}${primeiro?fiscoMudanca100kmHtml(r):''}`,'fis-quadro');
}
/* A linha do quadro 4.4, uma vez por página (no primeiro quadro): quem mudou
   a sua casa para mais de 100 km e arrendou a antiga deduz às rendas dela a
   renda que paga na nova (CIRS art. 41.º n.º 8). A app não sabe dessa renda
   — não é um registo do portefólio —, por isso só o diz, e leva ao guia, que
   explica as condições (a parte das deduções, #pode-deduzir). O n.º do
   quadro vem da versão do ano (quadros.mudanca100km); sem ele, ou sem
   nenhuma linha de arrendamento habitacional, não se diz (D106).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML (string), ou ''. */
function fiscoMudanca100kmHtml(r){
  const q=r.versao.quadros&&r.versao.quadros.mudanca100km,hab=(r.versao.naturezas||{}).habitacional;
  if(!q||!r.linhas.some(l=>!hab||l.natureza===hab))return '';
  return `<div class="fis-q44"><p class="hint">Mudaste a tua casa para mais de 100 km e arrendaste a antiga? O quadro ${esc(q)} deduz às rendas dela as que pagas pela nova, até ao valor delas, com condições. A app não conhece essa renda: não a conta aqui.</p>`
    +`<a class="btn sm" href="/guias/declarar-rendas#pode-deduzir" target="_blank" rel="noopener" data-toca="nada">Ver no guia</a></div>`;
}
/* Os campos de um contrato no Anexo F, pela ordem do impresso e das
   instruções (a versão do ano, nos passos): o n.º do campo da linha (4001…,
   quando o resumo o dá: é o que os outros quadros pedem), o n.º do contrato
   na AT, a data de início (só no 4.1: o 4.2 não tem a coluna, a data vai no
   4.2A — D102), a freguesia (código), o tipo, o artigo, a fração ou secção
   (com a falta quando leva mais do que uma: o Anexo F quer uma por linha), o
   titular, as rendas ilíquidas, a natureza (a 07 assumida, quando a
   finalidade está por indicar, vai com a falta — D16), as retenções na fonte
   e o NIF de cada inquilino (ou o país, a quem não tem NIF português);
   depois, pelo mesmo campo, as colunas de gastos da versão; as três colunas
   das obras dos 24 meses, quando as há (o início do contrato e o dos gastos
   em mês e ano, como o impresso os pede); e, no 4.2, o 4.2A (o campo do 4.2,
   a comunicação de fevereiro, o início, o termo e a última renovação) e o
   4.2B quando há a descida do n.º 24 (o campo do 4.2, a renda deste
   contrato, o n.º e a renda do anterior). Texto simples, para quem escreve
   HTML e para quem escreve um PDF: nada inventado — o que a AT pede e falta
   vem com falta e o porquê na nota, o que não se aplica (uma fração, uma
   retenção a zero) vem vazio.
   Recebe: r — o resumo (resumoFiscal); l — a linha do contrato.
   Devolve: [{grupo, campo, sub, valor, falta, aviso, nota, nif}] — grupo ''
   para os campos da linha do quadro e o nome do subgrupo nos outros; sub o
   texto pequeno por baixo do campo (o nome do inquilino, o que a natureza
   quer dizer); valor o texto já formatado (euros, datas dd/mm/aaaa, NIF com
   espaços), '' quando não há; falta true quando a AT o pede e a app não o
   tem (ou o tem errado: o NIF que não bate certo), com a nota a dizer o quê;
   aviso true no que convém tratar (a comunicação por fazer); nif true no
   valor que é um NIF (não parte entre linhas). */
function fiscoCamposDe(r,l){
  const out=[];
  const add=(grupo,campo,valor,o)=>{o=o||{};out.push({grupo:grupo,campo:campo,sub:o.sub||'',valor:valor==null?'':String(valor),
    falta:!!o.falta,aviso:!!o.aviso,nota:o.nota||'',nif:!!o.nif})};
  const eur=x=>x?euro2(x):'',Q=r.versao.quadros,nat=r.versao.naturezas||{},red=l.quadro===Q.comReducao;
  const porIndicar=!l.estado&&!l.atNumero;
  if(l.campo)add('','Campo',l.campo,{sub:'linha do quadro '+l.quadro});
  add('','N.º do contrato',l.atNumero,{falta:!l.atNumero&&(porIndicar||l.estado==='declarado'),nota:porIndicar?'por indicar se foi declarado':'falta'});
  if(!red)add('','Data de início',dPT(l.inicio),{falta:!l.inicio});
  add('','Freguesia (código)',l.freguesiaCodigo,{falta:!l.freguesiaCodigo});
  add('','Tipo',l.tipoPredio,{falta:!l.tipoPredio});
  add('','Artigo',l.artigo,{falta:!l.artigo});
  /* «C e AB» num campo só: o resumo aponta a falta, que começa por «fração:» */
  const variasFracoes=(l.faltas||[]).some(f=>/^fração:/.test(f));
  add('','Fração ou secção',l.fracao,{falta:variasFracoes,nota:'uma fração por linha'});
  add('','Titular',l.titular||'A');
  add('','Rendas (rendimento ilíquido)',euro2(l.rendas));
  const assumida=!!l.naturezaAssumida;
  add('','Natureza',assumida&&l.natureza?l.natureza+' (assumida)':l.natureza,{sub:l.natureza===nat.naoHabitacional?'não habitacional':l.natureza===nat.habitacional?'habitacional':'',
    falta:assumida,nota:'finalidade por indicar'});
  add('','Retenções na fonte',eur(l.retencoes));
  if(!l.inquilinos.length)add('','NIF do inquilino','',{falta:true});
  l.inquilinos.forEach(t=>{
    const ok=nifValido(t.nif);
    if(t.nif)add('','NIF do inquilino',fmtNIF(t.nif),{sub:t.nome,nif:true,falta:ok===false,nota:'não bate certo'});
    else if(String(t.pais||'').trim())add('','País do inquilino',t.pais,{sub:t.nome});
    else add('','NIF do inquilino','',{sub:t.nome,falta:true,nota:'falta o NIF ou o país'});
  });
  r.colunas.forEach(k=>add('Gastos',irsColunaNome(k)||fiscoColRotulo(k),eur(l.gastos[k])));
  if(l.obras24.valor>0){
    const g='Obras dos 24 meses antes do contrato';
    add(g,'Início do contrato',fiscoMesAno(l.inicio),{falta:!l.inicio});
    add(g,'Mês do primeiro pagamento',fiscoMesAno(l.obras24.inicioGastos));
    add(g,'Valor',euro2(l.obras24.valor));
  }
  if(red){
    const g='Quadro '+Q.datas;
    if(l.campo)add(g,'Campo do quadro '+Q.comReducao,l.campo);
    add(g,'Comunicação',l.comunicado?'comunicada a '+dPT(l.comunicado):'por comunicar',{aviso:!l.comunicado});
    add(g,'Início',dPT(l.datas.inicio),{falta:!l.datas.inicio});
    add(g,'Termo',dPT(l.datas.fim));
    add(g,'Última renovação',l.datas.renovacaoInicio?dPT(l.datas.renovacaoInicio)+' a '+(dPT(l.datas.renovacaoFim)||'—'):'');
    if(l.bonus){
      const a=l.contratoAnterior,b='Quadro '+Q.comReducao+'B';
      if(l.campo)add(b,'Campo do quadro '+Q.comReducao,l.campo);
      add(b,'Renda deste contrato',euro2(l.renda),{sub:'por mês'});
      add(b,'N.º do contrato anterior',a&&a.numero?a.numero:'',{sub:a?a.nome:'',falta:!(a&&a.numero),nota:a?'sem n.º na AT':'por identificar'});
      add(b,'Renda do contrato anterior',eur(l.rendaAnterior),{sub:'por mês',falta:!l.rendaAnterior});
    }
  }
  return out;
}
/* O cartão de um contrato num quadro: à cabeça o nome, o imóvel (o titular,
   quando as linhas são de mais do que um, e a quota-parte, quando não é
   inteiro) e a taxa da lei do ano e porquê (ou «isento», com o quadro e o
   código do programa); a taxa escrita no contrato, quando é outra, numa nota
   à parte — na Declaração conta a da lei (D17); e as faltas por extenso; por
   baixo os campos do fiscoCamposDe, campo à esquerda e valor à direita, em
   grupos (a linha do quadro, os gastos, as obras, o 4.2A, o 4.2B). O que
   falta leva o selo vermelho com a falta, o que convém tratar o âmbar, o que
   não se aplica um «—». O NIF não parte entre linhas (lê-se e copia-se para o
   Portal de uma vez). Tocar abre a ficha do contrato (a Declaração requer os
   Contratos: sem eles não há página).
   Recebe: r — o resumo (resumoFiscal); l — a linha do contrato.
   Devolve: o HTML do cartão (string). */
function fiscoContratoHtml(r,l){
  const escrita=fiscoTaxaEscritaOutra(l);
  const taxa=l.isencao?'isento · '+(l.isencao.quadro||'6D')+(l.isencao.codigo?' código '+l.isencao.codigo:'')
    :'taxa '+dec(l.taxa)+' %'+(l.taxaEscrita===true?'':' · '+({nh:'não habitacional',duracao:'pela duração',moderada:'renda moderada',base:'base'}[l.motivoTaxa]||''));
  const sub=[l.imovel,r.variosTitulares?'titular '+l.titular:'',l.quota<1?'quota-parte '+pct(l.quota,0):'',taxa].filter(Boolean).join(' · ');
  const valor=c=>{
    const v=c.nif?`<span class="u-ws-nowrap">${esc(c.valor)}</span>`:esc(c.valor);
    if(c.falta)return (c.valor?v+' ':'')+`<span class="badge red">${esc(c.nota||'falta')}</span>`;
    if(c.aviso)return `<span class="badge amber">${v}</span>`;
    return c.valor?v:'—';
  };
  let grupo='',corpo='';
  fiscoCamposDe(r,l).forEach(c=>{
    if(c.grupo!==grupo){grupo=c.grupo;corpo+=`</dl><p class="lbl fis-ctc-grupo">${esc(grupo)}</p><dl class="fis-campos">`}
    corpo+=`<div class="fis-campo"><dt>${esc(c.campo)}${c.sub?`<span class="small">${esc(c.sub)}</span>`:''}</dt><dd>${valor(c)}</dd></div>`;
  });
  const nota=escrita==null?'':`<p class="fis-ctc-nota">Escreveste ${esc(dec(escrita))} % no contrato; a lei de ${esc(String(r.ano))} dá ${esc(dec(l.taxa))} %, e é essa que conta aqui.</p>`;
  return `<div class="fis-ctc tap" data-toca="camada" data-click="ctView('${jsq(l.contratoId)}')">
    <div class="fis-ctc-cab"><div class="fis-ctc-nome"><b>${esc(l.nome)}</b><span class="small">${esc(sub)}</span></div>${ic('chevR',18)}</div>
    ${nota}${l.faltas.length?`<p class="fis-ctc-falta">Falta: ${esc(l.faltas.join(', '))}.</p>`:''}
    <dl class="fis-campos">${corpo}</dl></div>`;
}
/* O cartão do quadro 6D: os contratos isentos (PAA, programas municipais,
   RSAA) com rendas no ano, cada um com o n.º, o programa e o código, e o
   rendimento líquido isento. Ficam também na linha do 4.1, que é o que o 6D
   pede — pelo n.º do campo dessa linha, que vai ao lado de cada um (D77);
   não pagam imposto, e no englobamento contam só para a taxa. Sem
   isentos, não se escreve.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem isentos. */
function fiscoIsentosCard(r){
  const ls=r.linhas.filter(l=>l.isencao);if(!ls.length)return '';
  return fisCartao('Quadro 6D — rendimentos isentos',fiscoN(fiscoNContratos(ls),'contrato isento','contratos isentos')+' em '+r.ano,
    `<div>${ls.map(l=>`<div class="stat"><span class="u-minw-0">${esc(l.nome)}<div class="small">${l.campo?'campo '+esc(l.campo)+' do '+esc(l.quadro)+' · ':''}${esc(l.imovel)}${l.imovel?' · ':''}n.º ${l.atNumero?esc(l.atNumero):'—'} · ${esc(l.isencao.nome||l.isencao.curto)} · ${l.isencao.codigo?'código '+esc(l.isencao.codigo):'código por conhecer'}${r.variosTitulares?' · titular '+l.titular:''}</div></span><b>${euro2(l.rendas)}</b></div>`).join('')}
    <div class="stat"><span><b>Rendimento líquido isento</b></span><b>${euro2(r.totais.isentos.liquido)}</b></div></div>
    <div class="hint">Estas rendas vão na linha do quadro 4.1 como as outras, e no 6D indicas o campo do 4.1 onde ficaram${ls.some(l=>l.campo)?' (o n.º ao lado de cada um)':''}, o n.º do contrato e o código do programa (01 PAA, 02 programa municipal, 03 alojamento estudantil municipal). Não pagam imposto e ficam fora do imposto estimado; se englobares, entram só para achar a taxa dos outros rendimentos.${ls.some(l=>!l.isencao.codigo)?' O código do RSAA só se sabe quando sair o Anexo F de '+r.ano+'.':''}</div>`);
}
/* O cartão do quadro 9: o AIMI pago no ano (fiscoAimi), os prédios que deram
   rendas com o VPT e o campo do 4.1/4.2 onde cada um ficou (o «Campo do Q4»
   que o 9 pede — D77), o 9101 e o 9102, e a parte que abate à coleta — ou,
   sem o VPT de algum prédio, qual falta. Sem AIMI no ano, não se escreve.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem AIMI. */
function fiscoAimiCard(r){
  const a=r.aimi;if(!a)return '';
  const Q=r.versao.quadros.aimi||'9';
  const onde=p=>{const cs=fiscoCamposDoImovel(r,p.propertyId,p.quadro);
    return cs.length?(cs.length>1?'campos ':'campo ')+listaE(cs)+' do quadro '+p.quadro:'campo do quadro '+p.quadro};
  return fisCartao('Quadro '+esc(Q)+' — AIMI','Adicional ao IMI pago em '+r.ano+' · '+fiscoN(a.n,'pagamento','pagamentos'),
    `<div>${a.predios.map(p=>`<div class="stat"><span class="u-minw-0">${esc(p.imovel)}<div class="small">${esc(onde(p))} · valor patrimonial tributário</div></span><b>${p.vpt?euro2(p.vpt):'sem VPT'}</b></div>`).join('')}
    <div class="stat"><span>9101 · AIMI liquidado</span><b>${euro2(a.total)}</b></div>
    <div class="stat"><span>9102 · VPT dos prédios urbanos sujeitos ao AIMI</span><b>${a.semVpt.length?'—':euro2(a.vptTotal)}</b></div>
    <div class="stat"><span><b>Parte que abate ao imposto (estimativa)</b></span><b>${a.abate==null?'—':euro2(a.abate)}</b></div></div>
    <div class="hint">${a.semVpt.length?'Falta o VPT de '+esc(listaE(a.semVpt))+' na ficha do imóvel: sem ele não se calcula a parte que abate. ':''}O AIMI não é gasto das rendas (CIRS art. 41.º): abate ao imposto na proporção do VPT dos prédios que deram rendas sobre o de todos os prédios urbanos sujeitos ao AIMI (CIMI art. 135.º-I), e nunca mais do que o imposto das rendas.${a.parte!=null&&a.abate<a.parte?' A parte dos prédios arrendados ('+euro2(a.parte)+') passa o imposto estimado das rendas: abate só até lá.':''} Os valores certos estão na demonstração de liquidação do AIMI — o 9101 é o imposto total e o 9102 o valor tributável de todos os prédios, mesmo os que não estão na app.</div>`);
}
/* O cartão das obras dos 24 meses anteriores ao arrendamento — só quando as
   há. Vão na declaração do ano em que o contrato começa (as instruções do
   Anexo F); um contrato sem rendas no ano do início leva-as no primeiro ano
   com rendas (fisco-resumo.js:resumoFiscal), e a linha di-lo, com o ano do
   início — o subtítulo não diz «os contratos que começaram em AAAA», que era
   falso nesse caso (D63). Cada linha com o campo do 4.1/4.2 onde vão.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem obras. */
function fiscoObrasCard(r){
  const ls=r.linhas.filter(l=>l.obras24.valor>0);if(!ls.length)return '';
  const A=String(r.ano);
  const outroAno=l=>{const y=String(l.inicio||'').slice(0,4);return /^\d{4}$/.test(y)&&y!==A?y:''};
  const linha=l=>{const y=outroAno(l);
    return `<div class="stat"><span>${esc(l.nome)}<div class="small">${esc(l.imovel)} · quadro ${esc(l.quadro)}${l.campo?' · campo '+esc(l.campo):''}${r.variosTitulares?' · titular '+esc(l.titular):''} · contrato desde ${dPT(l.inicio)} · gastos desde ${dPT(l.obras24.inicioGastos)}${y?' · começou em '+y+', sem rendas nesse ano: vão no primeiro ano com rendas':''}</div></span><b>${euro2(l.obras24.valor)}</b></div>`};
  return fisCartao('Obras antes do arrendamento','Gastos dos 24 meses antes do início de cada contrato',
    '<div>'+ls.map(linha).join('')
    +`<div class="stat"><span><b>Total</b></span><b>${euro2(r.totais.obras24)}</b></div></div>
    <div class="hint">Conservação e manutenção pagas antes de o contrato começar, nos 24 meses anteriores, quando o imóvel não tinha contrato em vigor — e o que marcaste à mão como obras dos 24 meses. Vão nas três colunas próprias da linha do contrato (o mês e o ano do início do contrato e do primeiro pagamento, e o valor), na declaração do ano em que o contrato começa, e não se repetem noutro ano.</div>`);
}
/* O cartão das rendas recebidas no ano que respeitam a anos anteriores (pelo
   mês a que a renda respeita, no movimento) — só quando as há. Já estão no
   valor das linhas; o quadro 8 diz que parte é de que ano, pelo quadro e o
   campo da linha (D77). O 8B obriga a entregar as declarações de
   substituição desses anos até 30 dias depois do fim do prazo da entrega
   (CIRS art. 74.º n.º 8 e art. 60.º n.º 2): a data sai do prazo da versão
   do ano (entrega.ate), e diz-se (D84).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem rendas de anos anteriores. */
function fiscoAnosAnterioresCard(r){
  const ls=r.linhas.filter(l=>l.anosAnteriores.length);if(!ls.length)return '';
  const Q8=r.versao.quadros.anosAnteriores,ate=r.versao.entrega&&r.versao.entrega.ate?irsSomaDias(r.versao.entrega.ate,30):'';
  const prazo=ate?' até '+dPT(ate)+', 30 dias depois do fim do prazo da entrega (CIRS art. 74.º n.º 8)':' até 30 dias depois do fim do prazo da entrega (CIRS art. 74.º n.º 8)';
  return fisCartao('Rendas de anos anteriores','Recebidas em '+r.ano+' · quadro '+esc(Q8),
    '<div>'+ls.map(l=>l.anosAnteriores.map(a=>`<div class="stat"><span>${esc(l.nome)}<div class="small">quadro ${esc(l.quadro)}${l.campo?' · campo '+esc(l.campo):''}${r.variosTitulares?' · titular '+esc(l.titular):''} · respeitam a ${a.ano}</div></span><b>${euro2(a.valor)}</b></div>`).join('')).join('')+'</div>'
    +`<div class="hint">Já estão nas rendas da linha, porque contam no ano em que se recebem. No quadro ${esc(Q8)} dizes de que ano é cada parte: no 8A se optares pelo englobamento (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares as declarações de substituição desses anos (até cinco anos para trás)${prazo}.</div>`);
}
/* O cartão «Fora da declaração»: os contratos marcados como não declarados com
   rendas no ano, com o valor, sem juízo. Tocar abre o contrato (a Declaração
   requer os Contratos: sem eles não há página, e não há lista só de leitura).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem contratos fora. */
function fiscoForaCard(r){
  if(!r.fora.length)return '';
  const linha=f=>`<div class="card tap u-p-11px-13px" data-toca="camada" data-click="ctView('${jsq(f.contratoId)}')">
      <div class="row-between u-ai-center u-g-10px"><div class="u-minw-0"><b>${esc(f.nome)}</b><div class="small">${esc(f.imovel)}${f.imovel?' · ':''}${fiscoN(f.n,'renda','rendas')} em ${r.ano}</div></div><b>${euro2(f.rendas)}</b></div></div>`;
  return fisCartao('Fora da declaração',fiscoN(r.fora.length,'contrato marcado como não declarado','contratos marcados como não declarados'),
    `<div class="list u-g-8px">${r.fora.map(linha).join('')}</div>
    <div class="hint">As rendas destes contratos não entram no quadro nem nos totais, e a parte deles nos gastos do imóvel também não. O estado muda-se na ficha do contrato.</div>`);
}
/* O cartão «Rendas sem contrato»: as rendas do ano que não dizem de que
   contrato são, por imóvel, com a saída para as ligar — que é dos Movimentos
   (a Declaração requer-os: estão sempre ligados aqui).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem rendas soltas. */
function fiscoSemContratoCard(r){
  if(!r.semContrato.length)return '';
  const n=sum(r.semContrato.map(s=>s.n));
  return fisCartao('Rendas sem contrato',fiscoN(n,'renda','rendas')+' de '+r.ano+' sem contrato ligado',
    '<div>'+r.semContrato.map(s=>`<div class="stat"><span>${esc(s.imovel)}<div class="small">${fiscoN(s.n,'movimento','movimentos')}</div></span><b>${euro2(s.rendas)}</b></div>`).join('')+'</div>'
    +`<div class="hint">Estas rendas declaram-se na mesma, mas só entram numa linha do quadro quando o movimento diz de que contrato são. Abre o movimento e liga-o ao contrato.</div>`
    +(n===1?saida('Abrir o movimento',`txView('${jsq(r.semContrato[0].ids[0])}')`,'camada'):saida('Ver movimentos',"go('transactions')",'ecra')));
}
/* «Fora da declaração» quando não há nada fora (a prancheta): nenhum contrato
   marcado como não declarado e nenhuma renda sem contrato no ano — diz-se,
   para não se ficar a pensar se faltou ver. Com algum dos dois, quem fala são
   os cartões deles (fiscoForaCard, fiscoSemContratoCard).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou ''. */
function fisNadaForaCard(r){
  if(r.fora.length||r.semContrato.length)return '';
  return fisCartao('Fora da declaração','',`<p class="hint">Nenhum contrato marcado «não declarado» e nenhuma renda sem contrato em ${r.ano}.</p>`,'fis-nada-fora');
}
