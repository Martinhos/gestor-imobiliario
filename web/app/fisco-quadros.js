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
   cuidado: um resumo sem eles desenha-se como antes (KAN-126). Os da vaga 2
   (KAN-127) também: l.comunicacao (o 4.2A do período), l.segmentos (a taxa
   por período), l.elegivel24 (o 4.2B), as retenções e os gastos de cada ano
   em l.anosAnteriores, r.cessados e r.regularizacoes (o quadro 10),
   r.semRegrasDoAno e, no AIMI, r.aimi.demonstracao e r.aimi.excluidos. */
/* Sem as regras do ano dos rendimentos: o ano é anterior à primeira versão
   das regras (irs-AAAA.js), e a taxa, o imposto e a regularização não se
   estimam — as taxas e os quadros desse ano eram outros (D50). O resumo
   di-lo em r.semRegrasDoAno; um resumo sem o campo deduz-se da versão
   emprestada a um ano antes da primeira.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: true sem regras do ano. */
function fiscoSemRegras(r){
  if(!r)return false;
  if(typeof r.semRegrasDoAno==='boolean')return r.semRegrasDoAno;
  const v=r.versao||{},anos=typeof irsAnosConhecidos==='function'?irsAnosConhecidos():[];
  return v.exato===false&&anos.length>0&&Number(r.ano)<anos[0];
}
/* O dia e o mês de uma data, para dizer onde um ano se parte («até 28/02»).
   Recebe: iso — 'AAAA-MM-DD'.
   Devolve: 'dd/mm', ou '' sem data. */
function fiscoDdMm(iso){return dPT(iso).slice(0,5)}
/* A taxa de uma linha com mais do que um período no ano (OC 20217/2020, ponto
   III: a AT reparte as rendas pelas datas da renovação) ou com rendas depois
   do termo sem renovação registada, que contam à taxa base (D41, D15): «15 %
   até 28/02, 10 % depois». Só contam os troços com rendas (l.segmentos, do
   resumo; um troço sem o campo rendas conta). Um troço do período em que o
   contrato acabou antes do prazo por motivo do senhorio (regulariza, com a
   taxaAntes) diz a taxa que tinha: «25 % (era 10 %, n.º 20)» (D10).
   Troços todos à mesma taxa não se dizem (um contrato curto sem redução que
   continua depois do termo paga o mesmo antes e depois).
   Recebe: l — a linha do resumo.
   Devolve: o texto, ou '' com uma taxa só e sem nada a dizer (a taxa da
   linha diz tudo). */
function fiscoTaxaPorPeriodos(l){
  if(!l||l.isencao)return '';
  const ss=(Array.isArray(l.segmentos)?l.segmentos:[]).filter(s=>s&&(s.rendas==null||Number(s.rendas)>0));
  if(!ss.length)return '';
  const tx=s=>dec(s.taxa)+' %'+(s.regulariza&&s.taxaAntes!=null?' (era '+dec(s.taxaAntes)+' %, n.º 20)':'');
  if(ss.every(s=>!s.regulariza&&Number(s.taxa)===Number(ss[0].taxa)))return '';
  const ult=ss[ss.length-1],fim=ult.semRenovacao?' depois do termo, sem renovação registada':' depois';
  if(ss.length===1)return tx(ult);
  return ss.map((s,i)=>tx(s)+(i<ss.length-1?' até '+fiscoDdMm(s.ate):fim)).join(', ');
}
/* O termo de um contrato que teve a redução pela duração no ano e tem rendas
   depois do termo sem renovação registada (D15): essas contam sem a redução,
   e a nota do cartão di-lo. Sem redução nenhuma no ano não muda nada, e não
   se diz (o aviso de «A tratar» pergunta pela renovação).
   Recebe: l — a linha do resumo.
   Devolve: 'AAAA-MM-DD' (o dia antes do primeiro troço sem período com
   rendas), ou '' quando não há nada a dizer. */
function fiscoTermoSemRenovacao(l){
  if(!l||l.isencao||!Array.isArray(l.segmentos))return '';
  const tem=x=>x&&(x.rendas==null||Number(x.rendas)>0);
  if(!l.segmentos.some(x=>tem(x)&&x.reducao&&!x.semRenovacao))return '';
  const s=l.segmentos.find(x=>tem(x)&&x.semRenovacao);
  return s&&s.de?irsVespera(s.de):'';
}
/* A taxa de uma linha como se diz no resumo do quadro e no cartão do
   contrato: «isento · 6D código 01»; sem regras do ano, «sem regras de AAAA»
   (D50); com mais do que um período, a taxa de cada um (fiscoTaxaPorPeriodos);
   senão a taxa da lei do ano e porquê.
   Recebe: r — o resumo; l — a linha; cartao — true no cartão do contrato
   («taxa 25 % · base»), false no resumo do quadro («25 % taxa base»).
   Devolve: o texto. */
function fiscoTaxaTexto(r,l,cartao){
  if(l.isencao)return 'isento · '+(l.isencao.quadro||'6D')+(l.isencao.codigo?' código '+l.isencao.codigo:'');
  if(fiscoSemRegras(r))return 'sem regras de '+r.ano;
  const MOTIVO={nh:'não habitacional',duracao:'pela duração',moderada:'renda moderada',base:cartao?'base':'taxa base'};
  const pp=fiscoTaxaPorPeriodos(l);
  if(pp)return (cartao?'taxa ':'')+pp;
  if(cartao)return 'taxa '+dec(l.taxa)+' %'+(l.taxaEscrita===true?'':' · '+(MOTIVO[l.motivoTaxa]||''));
  return (dec(l.taxa)+' % '+(l.taxaEscrita===true?'escrita no contrato':MOTIVO[l.motivoTaxa]||'')).trim();
}
/* A comunicação da duração no 4.2A (Portaria 110/2019): faz-se uma vez por
   período — o contrato e cada renovação —, até 15 de fevereiro do ano
   seguinte ao início dele, e o 4.2A pergunta se foi feita a tempo (D01, D35).
   Lê l.comunicacao ({periodoInicio, chave, prazo, data, foraDePrazo}, do
   resumo); um resumo sem ela dá só a data em l.comunicado.
   Recebe: l — a linha do resumo.
   Devolve: {estado ('feita'|'fora'|'porFazer'), valor, sub, aviso} — valor
   «comunicada a dd/mm/aaaa»; «comunicada fora do prazo (a dd/mm/aaaa) — no
   4.2A é NÃO»; «por comunicar · até dd/mm/aaaa», ou com o prazo passado «por
   comunicar · o prazo acabou a dd/mm/aaaa — no 4.2A é NÃO»; sub o período a
   que respeita; aviso true quando não é SIM. */
function fiscoComunicacaoDe(l){
  const x=l&&l.comunicacao&&typeof l.comunicacao==='object'?l.comunicacao:null;
  const data=String((x?x.data:l&&l.comunicado)||''),prazo=String(x&&x.prazo||'');
  const sub=x&&x.periodoInicio?'do período desde '+dPT(x.periodoInicio):'';
  const fora=!!data&&!!x&&(x.foraDePrazo===true||(!!prazo&&data>prazo));
  if(data&&!fora)return {estado:'feita',valor:'comunicada a '+dPT(data),sub:sub,aviso:false};
  if(data)return {estado:'fora',valor:'comunicada fora do prazo (a '+dPT(data)+') — no 4.2A é NÃO',sub:sub,aviso:true};
  const passou=!!prazo&&prazo<today();
  return {estado:'porFazer',valor:'por comunicar'+(!prazo?'':passou?' · o prazo acabou a '+dPT(prazo)+' — no 4.2A é NÃO':' · até '+dPT(prazo)),sub:sub,aviso:true};
}
/* Se uma linha tem o facto do n.º 24 do art. 72.º (contrato novo com a renda
   pelo menos 5 % abaixo da do anterior no mesmo imóvel): o 4.2B mostra-se
   por ele, e não por a taxa ter descido (D36). O resumo dá-o em
   l.elegivel24; um resumo sem ele, pelo l.bonus.
   Recebe: l — a linha do resumo.
   Devolve: true quando o 4.2B se aplica. */
function fiscoElegivel24(l){
  if(!l)return false;
  return typeof l.elegivel24==='boolean'?l.elegivel24:!!l.bonus;
}
/* Uma linha de renda moderada (EBF art. 45.º-C) num ano cujo Anexo F ainda
   não foi aprovado: o campo onde se assinala a taxa de 10 % não se conhece
   (D49).
   Recebe: r — o resumo; l — a linha.
   Devolve: true quando é preciso dizê-lo. */
function fiscoModeradaPorConhecer(r,l){
  const m=r&&r.versao&&r.versao.modelo;
  if(!m||m.oficial!==false||!l||l.isencao)return false;
  return l.motivoTaxa==='moderada'||(Array.isArray(l.segmentos)&&l.segmentos.some(s=>s&&s.motivo==='moderada'));
}
/* O limite que o 4.2C pergunta (CIRS art. 72.º n.º 23), com a portaria em
   vigor na data de celebração de cada contrato: a versão do ano tem-nas por
   intervalo de datas (taxas.limiteRendaAlta.portaria, [{desde, ate, texto}];
   ate '' sem fim), e a frase de cada uma (D78). Contratos de intervalos
   diferentes dizem cada um a sua. Uma versão sem a lista diz o limite sem
   portaria.
   Recebe: L23 — o limiteRendaAlta da versão; ls — as linhas do 4.2C.
   Devolve: o texto («150 % dos limites … da Portaria 176/2019 …»), sem HTML. */
function fiscoLimitesDoN23(L23,ls){
  const pct=(Number(L23&&L23.percentagem)||150)+' % ',ps=Array.isArray(L23&&L23.portaria)?L23.portaria:[];
  const de=t=>/^[oa]s? /.test(t)?'d'+t:'de '+t;
  const grupos=[];
  ls.forEach(l=>{
    const d=String(l.celebracao||''),p=ps.find(x=>x&&(!x.desde||x.desde<=d)&&(!x.ate||d<=x.ate));
    const t=p&&p.texto?String(p.texto):'';if(!t)return;
    const g=grupos.find(x=>x.texto===t);if(g)g.nomes.push(l.nome);else grupos.push({texto:t,nomes:[l.nome]});
  });
  if(!grupos.length)return pct+'dos limites de renda por tipologia e concelho';
  if(grupos.length===1)return pct+de(grupos[0].texto);
  return pct+'do limite da data em que cada um foi celebrado — '+grupos.map(g=>listaE(g.nomes)+': '+g.texto).join('; ');
}

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
   tem — pelo facto do n.º 24 (fiscoElegivel24), mesmo quando a taxa
   estimada já não desce (está no mínimo): aí a AT pode aplicar os pontos
   (D36). A app compara a renda de hoje com a do anterior, e di-lo (Q2, D37).
   O 4.2C é uma pergunta só — os contratos do 4.2 celebrados desde 2024
   cumprem o limite do n.º 23? —, e diz-se a resposta quando todos estão
   confirmados, ou quais faltam confirmar; os limites são os da portaria em
   vigor na celebração de cada um, lida da versão do ano
   (fiscoLimitesDoN23, D78).
   Recebe: r — o resumo (resumoFiscal); ls — as linhas do quadro 4.2.
   Devolve: o HTML (string), ou '' quando nenhum dos dois se aplica. */
function fiscoReducoesHtml(r,ls){
  const T=r.versao.taxas||{},L23=T.limiteRendaAlta||{desde:'2024-01-01'},B=T.bonusRendaMenor||{};
  const pontos=Number(B.pontos)||5,menos=Number(B.rendaMenorPct)||5;
  const bon=ls.filter(fiscoElegivel24),n23=ls.filter(l=>l.celebracao&&l.celebracao>=L23.desde);
  let h='';
  if(bon.length){
    const parado=bon.filter(l=>!l.bonus);
    h+=`<div class="flabel u-mt-12px">Quadro 4.2B · renda abaixo da do contrato anterior</div>
    <div class="hint">${esc(listaE(bon.map(l=>l.nome+(l.campo?' (campo '+l.campo+')':''))))}: o n.º 24 do art. 72.º do CIRS desce a taxa mais ${pontos} pontos num contrato novo com a renda pelo menos ${menos} % abaixo da do contrato anterior no mesmo imóvel. No 4.2B escreves o campo do 4.2 e a renda deste contrato, e o n.º e a renda do anterior — estão no cartão de cada um. A app compara a renda de hoje com a do anterior.`
      +(parado.length&&!fiscoSemRegras(r)?` Em ${esc(listaE([...new Set(parado.map(l=>l.nome+' ('+dec(l.taxa)+' %)'))]))} a taxa estimada não desce mais, mas a AT pode aplicar os ${pontos} pontos: confirma o imposto na liquidação.`:'')+`</div>`;
  }
  if(n23.length){
    const porConfirmar=n23.filter(l=>l.acimaDoLimite!==false);
    h+=`<div class="flabel u-mt-12px">Quadro 4.2C · limite das rendas (n.º 23)</div>
    <div class="hint">${fiscoN(n23.length,'contrato do 4.2 celebrado','contratos do 4.2 celebrados')} desde ${dPT(L23.desde)}: o 4.2C pergunta se nenhum passa ${esc(fiscoLimitesDoN23(L23,n23))}. Um que passe não tem redução e vai ao 4.1.
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
   falta num selo vermelho, e quantos mais). Com mais do que um período no
   ano, a taxa de cada um («15 % até 28/02, 10 % depois», D41, D15:
   fiscoTaxaTexto); sem as regras do ano, nem taxa nem imposto estimado
   (D50). No fim, o total do quadro (as
   rendas, o líquido e o imposto estimado, sem os isentos, que vão ao 6D, ao
   6F ou ao 6H) —
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
  const cap=s=>String(s).charAt(0).toUpperCase()+String(s).slice(1);
  /* sem as regras do ano não há taxa nem imposto estimado (D50); o prejuízo
     é só o líquido negativo, e diz-se */
  const semRegras=fiscoSemRegras(r);
  const linha=l=>{
    const escrita=semRegras?null:fiscoTaxaEscritaOutra(l),pj=fiscoPrejuizoDe(l);
    const taxa=fiscoTaxaTexto(r,l,false);
    const sub=[l.campo?'campo '+l.campo:'',l.imovel,l.artigo?'art. '+l.artigo:'',l.fracao?'fr. '+l.fracao:'',l.atNumero?'n.º '+l.atNumero:'',taxa,
      escrita!=null?'escreveste '+dec(escrita)+' % no contrato':'',r.variosTitulares?'titular '+l.titular:''].filter(Boolean).map(esc).join(' · ');
    const falta=l.faltas.length?`<span class="fis-qr-falta"><span class="badge red">${esc(cap(l.faltas[0]))}</span>${l.faltas.length>1?` <span class="small">+${l.faltas.length-1}</span>`:''}</span>`:'';
    const num=l.isencao?'isento':pj>0?'prejuízo '+euro2(pj):semRegras?'sem regras de '+r.ano:'imposto estimado '+euro2(Math.max(0,Number(l.imposto)||0));
    return `<div class="fis-qr-linha tap" data-toca="camada" data-click="ctView('${jsq(l.contratoId)}')" aria-label="${esc(l.nome)}: abrir o contrato"><div class="fis-qr-nome"><b>${esc(l.nome)}</b><span class="small">${sub}</span>${falta}</div>
      <div class="fis-qr-num"><b>${euro2(l.rendas)}</b><span class="small">${num}</span></div></div>`;
  };
  const conta=ls.filter(l=>!l.isencao),isentos=ls.length-conta.length;
  const qsIsentos=[...new Set(ls.filter(l=>l.isencao).map(l=>l.isencao.quadro||'6D'))].sort();
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
      <div class="fis-qr-num"><b>${euro2(rendas)}</b><span class="small">${semRegras?'sem regras de '+r.ano:'imposto estimado '+euro2(imposto)}</span></div></div></div>
    ${isentos?`<p class="hint">O líquido e o imposto não contam ${fiscoN(isentos,'o contrato isento','os contratos isentos')} (${qsIsentos.length>1?'quadros ':'quadro '}${esc(listaE(qsIsentos))}).</p>`:''}`;
}
/* O cartão de um quadro de rendas (o 4.1 ou o 4.2), um por quadro e tudo o
   que é desse quadro lá dentro: o título diz o quadro e o que lá vai; abre
   com onde se preenche e o resumo dos contratos dele (fiscoQuadroResumoHtml);
   depois, um cartão por contrato,
   com os campos do Anexo F pela ordem do impresso (fiscoContratoHtml), e no
   fim o total do quadro — as rendas, as retenções e cada coluna de gastos —,
   e o hint do que é estimativa. Sem tabela: a tabela larga rolava de lado no
   telemóvel, e lia-se e copiava-se para o Portal aos bocados. No 4.2, cada
   cartão traz também o 4.2A do contrato (a comunicação da duração do
   período, fiscoComunicacaoDe, e as datas, que a AT pede sempre com ele) e o
   4.2B quando se aplica; por baixo dos cartões, o que o 4.2A — comunica-se
   uma vez por período, e não todos os anos (D01), com quantos contratos
   estão por comunicar ou foram comunicados fora do prazo (D35) —, o 4.2B e
   o 4.2C dizem ao quadro inteiro (fiscoReducoesHtml). O que se diz uma vez por página vai no primeiro
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
  /* a comunicação da duração (Portaria 110/2019), contrato a contrato: faz-se
     uma vez por período (o contrato e cada renovação), até ao dia da versão
     (15 de fevereiro) do ano seguinte ao início dele, e não todos os anos
     (D01); o 4.2A pergunta SIM ou NÃO, e uma feita depois do prazo é NÃO (D35) */
  const A2=esc(r.versao.quadros.datas),dia=irsDiaMes(r.versao.prazos&&r.versao.prazos.comunicacaoDuracao)||'15 de fevereiro';
  /* contados por contrato: em conjunta, um contrato dos dois tem duas linhas */
  const estados={};ls.forEach(l=>{estados[l.contratoId]=fiscoComunicacaoDe(l).estado});
  const nEst=e=>Object.keys(estados).filter(k=>estados[k]===e).length,porComunicar=nEst('porFazer'),fora=nEst('fora');
  const datas=red?`<div class="flabel u-mt-12px">Quadro ${A2} · datas de cada contrato</div>
    <div class="hint">O campo «Comunicação» do ${A2} pergunta se a duração do contrato e de cada renovação foi comunicada no Portal até ${esc(dia)} do ano seguinte ao início do contrato ou de cada renovação (Portaria 110/2019). Comunica-se uma vez por período, e não todos os anos: «comunicada a …» é SIM; «por comunicar» e «comunicada fora do prazo» são NÃO — e sem ela arriscas a redução.${porComunicar?' '+fiscoN(porComunicar,'contrato ainda por comunicar','contratos ainda por comunicar')+': marca a data na ficha do contrato quando o fizeres.':''}${fora?' '+fiscoN(fora,'contrato comunicado fora do prazo','contratos comunicados fora do prazo')+': no '+A2+' a resposta é NÃO.':''}</div>`
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
   finalidade está por indicar, vai com a falta — D16), numa renda moderada
   de um ano sem Anexo F aprovado o campo da taxa de 10 % por conhecer, a
   âmbar (D49), as retenções na fonte
   e o NIF de cada inquilino (ou o país, a quem não tem NIF português);
   depois, pelo mesmo campo, as colunas de gastos da versão; as três colunas
   das obras dos 24 meses, quando as há (o início do contrato e o dos gastos
   em mês e ano, como o impresso os pede); e, no 4.2, o 4.2A (o campo do 4.2,
   a comunicação da duração do período — fiscoComunicacaoDe, D01, D35 —, o
   início, o termo e a última renovação) e o 4.2B quando o contrato tem o
   facto do n.º 24 (fiscoElegivel24, D36: o campo do 4.2, a renda deste
   contrato — a de hoje, a que a app comparou, D37 —, o n.º e a renda do
   anterior). Texto simples, para quem escreve
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
   aviso true no que convém tratar (a comunicação por fazer ou fora do
   prazo, o campo por conhecer); nif true no
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
  /* a taxa de 10 % das rendas moderadas num ano sem Anexo F aprovado: o
     campo onde se assinala ainda não se conhece (D49) */
  if(fiscoModeradaPorConhecer(r,l)){
    const RM=(r.versao.taxas||{}).rendaModerada||{};
    add('','Taxa de '+dec(Number(RM.taxa)||10)+' % (EBF 45.º-C)','campo do modelo novo por conhecer',{aviso:true});
  }
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
    const com=fiscoComunicacaoDe(l);
    add(g,'Comunicação',com.valor,{sub:com.sub,aviso:com.aviso});
    add(g,'Início',dPT(l.datas.inicio),{falta:!l.datas.inicio});
    add(g,'Termo',dPT(l.datas.fim));
    add(g,'Última renovação',l.datas.renovacaoInicio?dPT(l.datas.renovacaoInicio)+' a '+(dPT(l.datas.renovacaoFim)||'—'):'');
    /* o 4.2B pelo facto do n.º 24, e não por a taxa ter descido (D36); a
       renda que a app comparou é a de hoje (Q2, D37) */
    if(fiscoElegivel24(l)){
      const a=l.contratoAnterior,b='Quadro '+Q.comReducao+'B';
      if(l.campo)add(b,'Campo do quadro '+Q.comReducao,l.campo);
      add(b,'Renda deste contrato',euro2(l.renda),{sub:'por mês · a de hoje, a que a app comparou'});
      add(b,'N.º do contrato anterior',a&&a.numero?a.numero:'',{sub:a?a.nome:'',falta:!(a&&a.numero),nota:a?'sem n.º na AT':'por identificar'});
      add(b,'Renda do contrato anterior',eur(l.rendaAnterior),{sub:'por mês',falta:!l.rendaAnterior});
    }
  }
  return out;
}
/* O cartão de um contrato num quadro: à cabeça o nome, o imóvel (o titular,
   quando as linhas são de mais do que um, e a quota-parte, quando não é
   inteiro) e a taxa da lei do ano e porquê (ou «isento», com o quadro e o
   código do programa; com mais do que um período, a de cada um; sem as
   regras do ano, nenhuma — fiscoTaxaTexto); a taxa escrita no contrato,
   quando é outra, numa nota à parte — na Declaração conta a da lei (D17); as
   rendas depois do termo sem renovação registada, noutra nota (D15); e as
   faltas por extenso; por
   baixo os campos do fiscoCamposDe, campo à esquerda e valor à direita, em
   grupos (a linha do quadro, os gastos, as obras, o 4.2A, o 4.2B). O que
   falta leva o selo vermelho com a falta, o que convém tratar o âmbar, o que
   não se aplica um «—». O NIF não parte entre linhas (lê-se e copia-se para o
   Portal de uma vez). Tocar abre a ficha do contrato (a Declaração requer os
   Contratos: sem eles não há página).
   Recebe: r — o resumo (resumoFiscal); l — a linha do contrato.
   Devolve: o HTML do cartão (string). */
function fiscoContratoHtml(r,l){
  const semRegras=fiscoSemRegras(r),escrita=semRegras?null:fiscoTaxaEscritaOutra(l);
  const taxa=fiscoTaxaTexto(r,l,true);
  const sub=[l.imovel,r.variosTitulares?'titular '+l.titular:'',l.quota<1?'quota-parte '+pct(l.quota,0):'',taxa].filter(Boolean).join(' · ');
  /* rendas depois do termo sem renovação registada: sem a redução pela
     duração, até se registar a renovação (D15) */
  const termo=fiscoTermoSemRenovacao(l);
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
  const nota=(escrita==null?'':`<p class="fis-ctc-nota">Escreveste ${esc(dec(escrita))} % no contrato; a lei de ${esc(String(r.ano))} dá ${esc(dec(l.taxa))} %, e é essa que conta aqui.</p>`)
    +(termo?`<p class="fis-ctc-nota">Rendas depois do termo (${dPT(termo)}) sem renovação registada: contam sem a redução pela duração. Se o contrato se renovou, regista a renovação na ficha.</p>`:'');
  return `<div class="fis-ctc tap" data-toca="camada" data-click="ctView('${jsq(l.contratoId)}')">
    <div class="fis-ctc-cab"><div class="fis-ctc-nome"><b>${esc(l.nome)}</b><span class="small">${esc(sub)}</span></div>${ic('chevR',18)}</div>
    ${nota}${l.faltas.length?`<p class="fis-ctc-falta">Falta: ${esc(l.faltas.join(', '))}.</p>`:''}
    <dl class="fis-campos">${corpo}</dl></div>`;
}
/* Os cartões das isenções, um por quadro do Anexo F onde cada uma se diz: o
   6D (PAA, programas municipais, RSAA), o 6F (ex-alojamento local, EBF art.
   74.º-A) e o 6H (contratos anteriores ao RAU, EBF art. 46.º-A) — D18. Os
   contratos isentos com rendas no ano ficam também na linha do 4.1, que é o
   que cada um destes quadros pede — pelo n.º do campo dessa linha, que vai
   ao lado de cada um (D77); não pagam imposto. O 6D leva ainda o n.º do
   contrato e o código do programa (os da versão do ano); o 6F e o 6H não
   têm código (semCodigo na versão), só o campo. Sem isentos, não se escreve.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML dos cartões (string), ou '' sem isentos. */
function fiscoIsentosCard(r){
  const ls=r.linhas.filter(l=>l.isencao);if(!ls.length)return '';
  const qs=[];ls.forEach(l=>{const q=l.isencao.quadro||'6D';if(qs.indexOf(q)<0)qs.push(q)});
  return qs.sort().map(q=>fiscoIsentosDoQuadro(r,q,ls.filter(l=>(l.isencao.quadro||'6D')===q))).join('');
}
/* O cartão de um quadro das isenções (fiscoIsentosCard): cada contrato com
   o campo do 4.1 onde ficou, o imóvel, o n.º e a isenção — e o código, nos
   quadros que o têm —, e o rendimento líquido isento desse quadro. Os
   códigos e a lei vêm da versão do ano (isencoes), nunca daqui.
   Recebe: r — o resumo; q — o quadro ('6D', '6F', '6H'); ls — as linhas
   isentas desse quadro.
   Devolve: o HTML do cartão (string). */
function fiscoIsentosDoQuadro(r,q,ls){
  const v=r.versao||{},iss=Array.isArray(v.isencoes)?v.isencoes:[],Q41=(v.quadros&&v.quadros.semReducao)||'4.1';
  const daVersao=l=>iss.find(x=>x&&x.id===l.isencao.id)||{};
  const semCodigo=ls.every(l=>daVersao(l).semCodigo===true);
  const leis=[];ls.forEach(l=>{const lei=daVersao(l).lei;if(lei&&leis.indexOf(lei)<0)leis.push(lei)});
  const codigo=l=>semCodigo?'':' · '+(l.isencao.codigo?'código '+esc(l.isencao.codigo):'<span class="badge amber">código por conhecer</span>');
  const liquido=r2(sum(ls.map(l=>Number(l.liquido)||0)));
  const tit=semCodigo?'Quadro '+esc(q)+' — rendimentos isentos'+(leis.length?' ('+esc(leis.join(', '))+')':''):'Quadro '+esc(q)+' — rendimentos isentos';
  /* os códigos do quadro, da versão: «01 Programa de Apoio ao Arrendamento (PAA)» */
  const cods=iss.filter(x=>x&&x.quadro===q&&x.codigo).map(x=>x.codigo+' '+x.nome);
  const porConhecer=ls.filter(l=>!semCodigo&&!l.isencao.codigo).map(l=>l.isencao.curto||l.isencao.nome);
  const ondeCampo=`no ${esc(q)} indicas ${semCodigo?'só ':''}o campo do ${esc(Q41)} onde ficaram${ls.some(l=>l.campo)?' (o n.º ao lado de cada um)':''}`;
  const hint=semCodigo
    ?`Estas rendas vão na linha do quadro ${esc(Q41)} como as outras, e ${ondeCampo}: o ${esc(q)} não tem código. Não pagam imposto e ficam fora do imposto estimado.`
    :`Estas rendas vão na linha do quadro ${esc(Q41)} como as outras, e ${ondeCampo}, o n.º do contrato e o código do programa${cods.length?' ('+esc(cods.join(', '))+')':''}. Não pagam imposto e ficam fora do imposto estimado; se englobares, entram só para achar a taxa dos outros rendimentos.${porConhecer.length?' O código '+(porConhecer.length>1?'de ':'do ')+esc(listaE([...new Set(porConhecer)]))+' só se sabe quando sair o Anexo F de '+r.ano+'.':''}`;
  return fisCartao(tit,fiscoN(fiscoNContratos(ls),'contrato isento','contratos isentos')+' em '+r.ano,
    `<div>${ls.map(l=>`<div class="stat"><span class="u-minw-0">${esc(l.nome)}<div class="small">${l.campo?'campo '+esc(l.campo)+' do '+esc(l.quadro)+' · ':''}${esc(l.imovel)}${l.imovel?' · ':''}n.º ${l.atNumero?esc(l.atNumero):'—'} · ${esc(l.isencao.nome||l.isencao.curto)}${codigo(l)}${r.variosTitulares?' · titular '+esc(l.titular):''}</div></span><b>${euro2(l.rendas)}</b></div>`).join('')}
    <div class="stat"><span><b>Rendimento líquido isento</b></span><b>${euro2(liquido)}</b></div></div>
    <div class="hint">${hint}</div>`);
}
/* Os dois números da demonstração de liquidação do AIMI do ano (o 9101, o
   imposto total, e o 9102, o valor tributável de todos os prédios sobre que
   incidiu): os do resumo (r.aimi.demonstracao), senão os da situação desse
   ano (irs-papeis.js:irsSituacao).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: {total, valorTributavel} — cada um um número ≥ 0, ou null por
   escrever. */
function fiscoAimiDemonstracao(r){
  const a=r&&r.aimi,d0=a&&a.demonstracao&&typeof a.demonstracao==='object'?a.demonstracao:null;
  let d=d0;
  if(!d&&typeof irsSituacao==='function'){try{d=irsSituacao(r.ano,r.titularId||'').aimi}catch(e){d=null}}
  const n=x=>x!=null&&x!==''&&isFinite(Number(x))&&Number(x)>=0?Number(x):null;
  return {total:n(d&&d.total),valorTributavel:n(d&&d.valorTributavel)};
}
/* Um valor em euros como vai num campo de escrever: com vírgula e duas
   casas, sem separador dos milhares (o num() lê-o de volta igual).
   Recebe: v — o valor (número), ou null.
   Devolve: o texto ('' sem valor). */
function fiscoEurosNoCampo(v){return v==null||!isFinite(Number(v))?'':Number(v).toFixed(2).replace('.',',')}
/* O cartão do quadro 9: os dois números da demonstração de liquidação do AIMI
   do ano, que se escrevem aqui e vão tal e qual ao 9101 e ao 9102 — a app não
   os estima: o 9101 é o AIMI inteiro da pessoa, e o 9102 o valor tributável
   de todos os prédios, mesmo os que não estão na app (D71) —; os prédios que
   deram rendas, com o VPT e o campo do 4.1/4.2 onde cada um ficou (o «Campo
   do Q4» que o 9 pede — D77); os que ficam fora do quadro 9 e porquê
   (r.aimi.excluidos); o AIMI pago registado na app; e a parte que abate à
   coleta — ou, sem o VPT de algum prédio, qual falta. Os campos gravam ao
   mudar (fiscoAimiMudou). Sem AIMI registado no ano e sem a demonstração,
   não se escreve.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem AIMI. */
function fiscoAimiCard(r){
  const a=r.aimi||null,dem=fiscoAimiDemonstracao(r);
  if(!a&&dem.total==null&&dem.valorTributavel==null)return '';
  const Q=r.versao.quadros.aimi||'9',ano=Number(r.ano)||YEAR,semRegras=fiscoSemRegras(r);
  const predios=a&&Array.isArray(a.predios)?a.predios:[],semVpt=a&&Array.isArray(a.semVpt)?a.semVpt:[],fora=a&&Array.isArray(a.excluidos)?a.excluidos:[];
  const onde=p=>{const cs=fiscoCamposDoImovel(r,p.propertyId,p.quadro);
    return cs.length?(cs.length>1?'campos ':'campo ')+listaE(cs)+' do quadro '+p.quadro:'campo do quadro '+p.quadro};
  const campo=(id,rot,chave,v)=>`<label>${esc(rot)}<input id="${id}" type="text" inputmode="decimal" class="num" value="${fiscoEurosNoCampo(v)}" placeholder="Opcional" autocomplete="off" data-change="fiscoAimiMudou(this,${ano},'${chave}')"></label>`;
  const falta=dem.total==null||dem.valorTributavel==null;
  const sub=a?'Adicional ao IMI pago em '+r.ano+' · '+fiscoN(a.n,'pagamento','pagamentos'):'Adicional ao IMI de '+r.ano;
  return fisCartao('Quadro '+esc(Q)+' — AIMI',sub,
    `<div class="form"><div class="row">${campo('fiscoAimiTotal','9101 · AIMI liquidado (€)','total',dem.total)}${campo('fiscoAimiVt','9102 · Valor tributável (€)','valorTributavel',dem.valorTributavel)}</div></div>
    <p class="hint">${falta?`Escreve-os da demonstração do AIMI de ${esc(String(r.ano))} (a nota de liquidação, no Portal das Finanças): o 9101 e o 9102 copiam-se de lá, tal e qual. Sem eles ficam por preencher — a app não os estima.`
      :`Os números da demonstração do AIMI de ${esc(String(r.ano))}: o 9101 e o 9102 copiam-se como estão. Gravam ao mudar.`}</p>
    <div>${predios.map(p=>`<div class="stat"><span class="u-minw-0">${esc(p.imovel)}<div class="small">${esc(onde(p))} · valor patrimonial tributário</div></span><b>${p.vpt?euro2(p.vpt):'sem VPT'}</b></div>`).join('')}
    ${fora.map(x=>`<div class="stat"><span class="u-minw-0">${esc(x&&x.imovel||'')} · ${esc(x&&x.porque||'')}<div class="small">não entra no quadro ${esc(Q)}</div></span></div>`).join('')}
    ${a?`<div class="stat"><span>AIMI pago registado na app</span><b>${euro2(a.total)}</b></div>`:''}
    ${a&&!semRegras?`<div class="stat"><span><b>Parte que abate ao imposto (estimativa)</b></span><b>${a.abate==null?'—':euro2(a.abate)}</b></div>`:''}</div>
    <div class="hint">${semVpt.length?'Falta o VPT de '+esc(listaE(semVpt))+' na ficha do imóvel: sem ele não se calcula a parte que abate. ':''}O AIMI não é gasto das rendas (CIRS art. 41.º): abate ao imposto na proporção do VPT dos prédios que deram rendas sobre o valor tributável de todos (CIMI art. 135.º-I), e nunca mais do que o imposto das rendas.${a&&a.parte!=null&&a.abate<a.parte?' A parte dos prédios arrendados ('+euro2(a.parte)+') passa o imposto estimado das rendas: abate só até lá.':''}${fora.length?' Os prédios sobre que o AIMI não incide (os rústicos, os isentos, os de comércio, indústria ou serviços) não entram no quadro (CIMI art. 135.º-B).':''}</div>`);
}
/* Grava um dos dois números da demonstração do AIMI ao sair do campo do
   cartão do quadro 9: lê o que se escreveu (num: «1.234,50» é 1 234,5; o
   vazio, ou o que não é um número acima de zero, fica por escrever), junta-o
   ao outro número como está na situação do ano (irsSituacao) e grava os dois
   por fiscoSetSituacao(ano, 'aimi', {total, valorTributavel}) — a função da
   página (fisco.js) que guarda a situação de cada ano; sem ela, não grava. O
   campo passa a mostrar o valor que ficou.
   Recebe: campo — o campo (o this da ação); ano — o ano dos rendimentos;
   chave — 'total' (o 9101) ou 'valorTributavel' (o 9102).
   Devolve: nada — grava (e a página redesenha, se a fiscoSetSituacao o fizer). */
function fiscoAimiMudou(campo,ano,chave){
  if(!campo||(chave!=='total'&&chave!=='valorTributavel'))return;
  const s=String(campo.value==null?'':campo.value).trim(),n=s?num(s):0,v=n>0?r2(n):null;
  let atual={total:null,valorTributavel:null};
  if(typeof irsSituacao==='function'){try{const x=irsSituacao(ano,'').aimi;if(x)atual={total:x.total==null?null:x.total,valorTributavel:x.valorTributavel==null?null:x.valorTributavel}}catch(e){}}
  const novo={total:atual.total,valorTributavel:atual.valorTributavel};novo[chave]=v;
  campo.value=fiscoEurosNoCampo(v);
  if(typeof fiscoSetSituacao==='function')fiscoSetSituacao(Number(ano),'aimi',novo);
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
   do ano (entrega.ate), e diz-se (D84). O 8B pede, de cada ano, o valor, as
   retenções na fonte e os gastos desse ano que não entraram na declaração
   dele: cada linha diz as retenções e, quando o resumo os dá, os gastos
   (l.anosAnteriores [{ano, valor, retencoes, gastos}]); a app conta cada
   renda num mês só, e um pagamento de vários anos regista-se num movimento
   por ano (D55).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem rendas de anos anteriores. */
function fiscoAnosAnterioresCard(r){
  const ls=r.linhas.filter(l=>Array.isArray(l.anosAnteriores)&&l.anosAnteriores.length);if(!ls.length)return '';
  const Q8=r.versao.quadros.anosAnteriores,ate=r.versao.entrega&&r.versao.entrega.ate?irsSomaDias(r.versao.entrega.ate,30):'';
  const prazo=ate?' até '+dPT(ate)+', 30 dias depois do fim do prazo da entrega (CIRS art. 74.º n.º 8)':' até 30 dias depois do fim do prazo da entrega (CIRS art. 74.º n.º 8)';
  const nume=x=>typeof x==='number'&&isFinite(x);
  const comGastos=ls.some(l=>l.anosAnteriores.some(a=>nume(a.gastos)));
  const extra=a=>(nume(a.retencoes)?' · retenções '+euro2(a.retencoes):'')+(nume(a.gastos)?' · gastos '+euro2(a.gastos):'');
  return fisCartao('Rendas de anos anteriores','Recebidas em '+r.ano+' · quadro '+esc(Q8),
    '<div>'+ls.map(l=>l.anosAnteriores.map(a=>`<div class="stat"><span>${esc(l.nome)}<div class="small">quadro ${esc(l.quadro)}${l.campo?' · campo '+esc(l.campo):''}${r.variosTitulares?' · titular '+esc(l.titular):''} · respeitam a ${esc(String(a.ano))}${extra(a)}</div></span><b>${euro2(a.valor)}</b></div>`).join('')).join('')+'</div>'
    +`<div class="hint">Já estão nas rendas da linha, porque contam no ano em que se recebem. No quadro ${esc(Q8)} dizes de que ano é cada parte: no 8A se optares pelo englobamento (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares as declarações de substituição desses anos (até cinco anos para trás)${prazo}. No 8B, cada ano leva o valor, as retenções na fonte e os gastos desse ano que não entraram na declaração dele${comGastos?'':' — esses gastos soma-os tu, a app não os separa'}. A app conta cada renda no mês a que respeita: um pagamento de vários anos regista-se num movimento por ano.</div>`);
}
/* O cartão do quadro 10, «contratos que acabaram» (D09): os contratos de
   habitação permanente com a taxa reduzida pela duração, ou com uma isenção
   dos programas, que acabaram no ano, seja qual for o motivo (r.cessados, do
   resumo). Cada um num cartão como os dos quadros, campo → valor pela ordem
   do impresso: o regime fiscal, o n.º do contrato, o ano em que o benefício
   começou, a data da cessação e o motivo — os códigos com o texto da versão
   do ano (quadro10.regimes e quadro10.motivos), nunca daqui. O que falta leva
   o selo vermelho. Com um motivo que regulariza (o 01 da versão, a cessação
   imputável ao senhorio, CIRS art. 72.º n.º 20 — D10), a nota diz que a
   redução do período em que acabou se perde: a taxa passa à da duração que
   o contrato durou mesmo (irs.js:irsTaxaDecorrida), e a diferença
   regulariza-se nesta declaração com juros compensatórios — a estimativa
   sem juros, ano a ano (r.regularizacoes). Sem as regras do ano não se
   estima (D50). Tocar abre a ficha do contrato. Sem cessados, não se escreve.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem contratos que acabaram. */
function fiscoQuadro10Card(r){
  const cs=r&&Array.isArray(r.cessados)?r.cessados.filter(Boolean):[];if(!cs.length)return '';
  const v=r.versao||irsAno(r.ano),q10=v.quadro10||{},Q=(v.quadros&&v.quadros.cessados)||'10';
  const regimes=Array.isArray(q10.regimes)?q10.regimes:[],motivos=Array.isArray(q10.motivos)?q10.motivos:[];
  const regs=Array.isArray(r.regularizacoes)?r.regularizacoes:[],semRegras=fiscoSemRegras(r);
  const dia=irsDiaMes(v.prazos&&v.prazos.comunicacaoDuracao)||'15 de fevereiro';
  const valor=(txt,nota)=>txt?esc(txt):`<span class="badge red">${esc(nota)}</span>`;
  const cartao=x=>{
    const reg=regimes.find(g=>g&&String(g.codigo)===String(x.regime)),mot=motivos.find(m=>m&&String(m.codigo)===String(x.motivo));
    const campos=[
      ['Regime fiscal',x.regime?x.regime+(reg&&reg.texto?' · '+reg.texto:''):'','por conhecer'],
      ['N.º do contrato',x.numero?String(x.numero):'','falta'],
      ['Ano de início do benefício',x.anoInicioBeneficio?String(x.anoInicioBeneficio):'','falta'],
      ['Data da cessação',dPT(x.data),'falta'],
      ['Motivo',x.motivo?x.motivo+(mot?' · '+(mot.curto||mot.texto||''):''):'','falta']];
    const dl=campos.map(c=>`<div class="fis-campo"><dt>${esc(c[0])}</dt><dd>${valor(c[1],c[2])}</dd></div>`).join('');
    const faltas=[!x.motivo?'o motivo da cessação':'',!x.numero?'o n.º do contrato na AT':''].filter(Boolean);
    let nota='';
    if(mot&&mot.regulariza){
      const c=typeof contract==='function'?contract(x.contratoId):null;
      let td=null;if(c&&typeof irsTaxaDecorrida==='function'){try{td=irsTaxaDecorrida(c)}catch(e){td=null}}
      const g=regs.find(y=>y&&y.contratoId===x.contratoId),anos=g&&Array.isArray(g.anos)?g.anos.filter(y=>y&&Number(y.diferenca)>0):[];
      const est=semRegras?` Sem as regras de ${esc(String(r.ano))} a app não estima a diferença.`
        :g&&Number(g.total)>0?` A diferença regulariza-se nesta declaração, com juros compensatórios — estimativa sem juros: ${euro2(g.total)}${anos.length?' ('+anos.map(y=>esc(String(y.ano))+': '+euro2(y.diferenca)).join(', ')+')':''}.`
        :' A diferença regulariza-se nesta declaração, com juros compensatórios.';
      nota=`<p class="fis-ctc-nota">Acabou antes do prazo por motivo do senhorio: a redução do período em que acabou perde-se (CIRS art. 72.º n.º 20) — a taxa passa a ser a da duração que o contrato durou mesmo${td&&!semRegras?' ('+esc(dec(td.taxa))+' %)':''}.${est}</p>`;
    }
    return `<div class="fis-ctc tap" data-toca="camada" data-click="ctView('${jsq(x.contratoId)}')">
    <div class="fis-ctc-cab"><div class="fis-ctc-nome"><b>${esc(x.nome||'')}</b><span class="small">${esc(x.imovel||'')}</span></div>${ic('chevR',18)}</div>
    ${nota}${faltas.length?`<p class="fis-ctc-falta">Falta: ${esc(listaE(faltas))} — ${faltas.length>1?'indica-os':'indica-o'} na ficha do contrato.</p>`:''}
    <dl class="fis-campos">${dl}</dl></div>`;
  };
  return fisCartao('Quadro '+esc(Q)+' · contratos que acabaram',fiscoN(cs.length,'contrato','contratos')+' em '+r.ano,
    `<div class="fis-cts">${cs.map(cartao).join('')}</div>
    <div class="hint">No quadro ${esc(Q)} vão os contratos de habitação permanente que tiveram a taxa reduzida pela duração, ou a isenção de um programa de arrendamento, e acabaram em ${esc(String(r.ano))}, seja qual for o motivo: um por linha, com o regime, o n.º do contrato, o ano em que o benefício começou, a data e o motivo. A cessação também se comunica no Portal das Finanças, até ${esc(dia)} do ano seguinte (Portaria 110/2019).</div>`,'fis-quadro');
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
