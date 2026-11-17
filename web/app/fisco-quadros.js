/* ================= FISCO · QUADROS =================
   Os cartões e os quadros da página do IRS · Anexo F, em HTML: o cartão
   genérico, o quadro 4.1 e o 4.2 com os campos de cada contrato, as
   reduções, os isentos do 6D, o AIMI do quadro 9, as obras dos 24 meses,
   as rendas de anos anteriores e o que ficou fora. Só desenham o que o
   resumo (fisco-resumo.js) já calculou; a vista que os junta é o fisco.js.
   Partiu-se do fisco.js (KAN-125). */

/* Um cartão da Análise no IRS: o título na letra dos títulos, o subtítulo ao
   lado e, à direita, o que o cartão traz no cabeçalho (o selo da contagem).
   Recebe: titulo — o título (texto já seguro); sub — o subtítulo ('' sem
   ele); corpo — o HTML do cartão; cls (opcional) — classes a mais; extra
   (opcional) — o HTML do canto direito do cabeçalho.
   Devolve: o HTML do cartão (string). */
function fisCartao(titulo,sub,corpo,cls,extra){
  return `<section class="card ana-cartao${cls?' '+cls:''}"><div class="ana-cab"><h2 class="ana-tit">${titulo}</h2>${sub?`<span class="small">${sub}</span>`:''}${extra?`<span class="ana-extra">${extra}</span>`:''}</div>${corpo}</section>`;
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
    <div class="hint">${esc(listaE(bon.map(l=>l.nome)))}: o n.º 24 do art. 72.º do CIRS desce a taxa mais 5 pontos num contrato novo com a renda pelo menos 5 % abaixo da do contrato anterior no mesmo imóvel. No 4.2B escreves o campo do 4.2 e a renda deste contrato, e o n.º e a renda do anterior — estão no cartão de cada um.</div>`;
  if(n23.length){
    const porConfirmar=n23.filter(l=>l.acimaDoLimite!==false);
    h+=`<div class="flabel u-mt-12px">Quadro 4.2C · limite das rendas (n.º 23)</div>
    <div class="hint">${fiscoN(n23.length,'contrato do 4.2 celebrado','contratos do 4.2 celebrados')} desde ${dPT(L23.desde)}: o 4.2C pergunta se nenhum passa 150 % dos limites de renda por tipologia e concelho (Portaria 176/2019). Um que passe não tem redução e vai ao 4.1.
    ${porConfirmar.length?' Por confirmar na ficha do contrato: '+esc(listaE(porConfirmar.map(l=>l.nome)))+'. Confirmados todos, a resposta é «Sim» (01).':' Todos confirmados dentro do limite: responde «Sim» (01).'}</div>`;
  }
  return h;
}
/* O começo do cartão de um quadro (fiscoQuadroCard): onde se preenche — o
   quadro do Anexo F e, no 4.2, o 4.2A das datas — e o resumo dos contratos
   desse quadro só, um por linha: o contrato e o imóvel (com o artigo, a
   fração, o n.º na AT e a taxa e porquê, e o titular quando as linhas são de
   mais do que um — a conjunta), as rendas que vão ao quadro e o
   imposto estimado, e o que falta (o primeiro em falta num selo vermelho, e
   quantos mais); no fim, o total do quadro (as rendas, o líquido e o imposto
   estimado, sem os isentos, que vão ao 6D). Era uma tabela só para o 4.1 e o
   4.2, com o quadro numa coluna: lia-se como um cartão que falava dos dois, e
   não se percebia onde preencher cada contrato (o ticket de QA 5cbde185, e a
   escolha do Martinho de um cartão por quadro). Linhas e não uma tabela: sem
   rolar de lado no telemóvel. Tocar numa linha abre a ficha do contrato — só
   com os Contratos ligados nesta conta.
   Recebe: r — o resumo (resumoFiscal); ls — as linhas do quadro; q — o
   quadro ('4.1', '4.2'); red — true no quadro com redução pela duração.
   Devolve: o HTML (string). */
function fiscoQuadroResumoHtml(r,ls,q,red){
  const comContratos=servicoLigado('contracts');
  const MOTIVO={nh:'não habitacional',duracao:'pela duração',moderada:'renda moderada',base:'taxa base'};
  const cap=s=>String(s).charAt(0).toUpperCase()+String(s).slice(1);
  const linha=l=>{
    const taxa=l.isencao?'isento · '+(l.isencao.quadro||'6D')+(l.isencao.codigo?' código '+l.isencao.codigo:'')
      :dec(l.taxa)+' % '+(l.taxaEscrita?'escrita no contrato':MOTIVO[l.motivoTaxa]||'');
    const sub=[l.imovel,l.artigo?'art. '+l.artigo:'',l.fracao?'fr. '+l.fracao:'',l.atNumero?'n.º '+l.atNumero:'',taxa.trim(),
      r.variosTitulares?'titular '+l.titular:''].filter(Boolean).map(esc).join(' · ');
    const falta=l.faltas.length?`<span class="fis-qr-falta"><span class="badge red">${esc(cap(l.faltas[0]))}</span>${l.faltas.length>1?` <span class="small">+${l.faltas.length-1}</span>`:''}</span>`:'';
    const toque=comContratos?` data-toca="camada" data-click="ctView('${jsq(l.contratoId)}')" aria-label="${esc(l.nome)}: abrir o contrato"`:'';
    return `<div class="fis-qr-linha${comContratos?' tap':''}"${toque}><div class="fis-qr-nome"><b>${esc(l.nome)}</b><span class="small">${sub}</span>${falta}</div>
      <div class="fis-qr-num"><b>${euro2(l.rendas)}</b><span class="small">${l.isencao?'isento':'imposto '+euro2(l.imposto)}</span></div></div>`;
  };
  const conta=ls.filter(l=>!l.isencao),isentos=ls.length-conta.length;
  const rendas=r2(sum(ls.map(l=>l.rendas))),liquido=r2(sum(conta.map(l=>l.liquido))),imposto=Math.max(0,r2(sum(conta.map(l=>l.imposto))));
  /* em conjunta, um contrato dos dois cônjuges vai numa linha por titular */
  const nCt=fiscoNContratos(ls),porLinha=ls.length>nCt?'uma linha por contrato e por titular':'uma linha por contrato';
  const onde=red?`Preenche no <b>quadro ${esc(q)}</b> do Anexo F: ${porLinha}, e no ${esc(r.versao.quadros.datas)} as datas de cada um.`
    :`Preenche no <b>quadro ${esc(q)}</b> do Anexo F: ${porLinha}.`;
  return `<p class="fis-onde">${onde}</p><div class="fis-qr">${ls.map(linha).join('')}
    <div class="fis-qr-linha fis-qr-total"><div class="fis-qr-nome"><b>Total do quadro ${esc(q)}</b><span class="small">${fiscoN(nCt,'contrato','contratos')} · líquido ${euro2(liquido)}</span></div>
      <div class="fis-qr-num"><b>${euro2(rendas)}</b><span class="small">imposto ${euro2(imposto)}</span></div></div></div>
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
   (fiscoReducoesHtml). Sem linhas nesse quadro, não se escreve.
   Recebe: r — o resumo (resumoFiscal); q — o quadro ('4.1', '4.2').
   Devolve: o HTML do cartão (string), ou '' sem linhas. */
function fiscoQuadroCard(r,q){
  const ls=r.linhas.filter(l=>l.quadro===q);if(!ls.length)return '';
  const cols=r.colunas,red=q===r.versao.quadros.comReducao,s=k=>r2(sum(ls.map(l=>k(l))));
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
  return fisCartao('Quadro '+esc(q)+' · '+(red?'com':'sem')+' redução pela duração',sub,
    fiscoQuadroResumoHtml(r,ls,q,red)+`<p class="lbl fis-q-campos">Os campos, contrato a contrato</p>
    <div class="fis-cts">${ls.map(l=>fiscoContratoHtml(r,l)).join('')}${tot}</div>
    <div class="hint">Rendas ilíquidas: o que entrou mais o que o inquilino reteve na fonte. Os gastos de um imóvel com mais do que um contrato no ano repartem-se pelas linhas na proporção das rendas de cada uma — é uma estimativa; o rateio por VPT ou por área, quando o imóvel se arrenda por partes, fica para quem preenche.${r.semRegra&&!red?' '+fiscoN(r.semRegra,'despesa sem regra de dedução conta','despesas sem regra de dedução contam')+' em Outros.':''}</div>${datas}`,'fis-quadro');
}
/* Os campos de um contrato no Anexo F, pela ordem do impresso e das
   instruções (a versão do ano, nos passos): o n.º do contrato na AT, a data
   de início, a freguesia (código), o tipo, o artigo, a fração ou secção, o
   titular, as rendas ilíquidas, a natureza, as retenções na fonte e o NIF de
   cada inquilino (ou o país, a quem não tem NIF português); depois, pelo
   mesmo campo, as colunas de gastos da versão; as três colunas das obras dos
   24 meses, quando as há; e, no 4.2, o 4.2A (a comunicação de fevereiro, o
   início, o termo e a última renovação) e o 4.2B quando há a descida do n.º
   24 (a renda deste contrato, o n.º e a renda do anterior). Texto simples,
   para quem escreve HTML e para quem escreve um PDF: nada inventado — o que a
   AT pede e falta vem com falta e o porquê na nota, o que não se aplica
   (uma fração, uma retenção a zero) vem vazio.
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
  const eur=x=>x?euro2(x):'',Q=r.versao.quadros,nat=r.versao.naturezas||{};
  const porIndicar=!l.estado&&!l.atNumero;
  add('','N.º do contrato',l.atNumero,{falta:!l.atNumero&&(porIndicar||l.estado==='declarado'),nota:porIndicar?'por indicar se foi declarado':'falta'});
  add('','Data de início',dPT(l.inicio),{falta:!l.inicio});
  add('','Freguesia (código)',l.freguesiaCodigo,{falta:!l.freguesiaCodigo});
  add('','Tipo',l.tipoPredio,{falta:!l.tipoPredio});
  add('','Artigo',l.artigo,{falta:!l.artigo});
  add('','Fração ou secção',l.fracao);
  add('','Titular',l.titular||'A');
  add('','Rendas (rendimento ilíquido)',euro2(l.rendas));
  add('','Natureza',l.natureza,{sub:l.natureza===nat.naoHabitacional?'não habitacional':l.natureza===nat.habitacional?'habitacional':''});
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
    const g='Obras dos 24 meses antes do contrato',m=/^(\d{4})-(\d{2})/.exec(l.obras24.inicioGastos||'');
    add(g,'Início do contrato',dPT(l.inicio));
    add(g,'Mês do primeiro pagamento',m?m[2]+'/'+m[1]:'');
    add(g,'Valor',euro2(l.obras24.valor));
  }
  if(l.quadro===Q.comReducao){
    const g='Quadro '+Q.datas;
    add(g,'Comunicação',l.comunicado?'comunicada a '+dPT(l.comunicado):'por comunicar',{aviso:!l.comunicado});
    add(g,'Início',dPT(l.datas.inicio),{falta:!l.datas.inicio});
    add(g,'Termo',dPT(l.datas.fim));
    add(g,'Última renovação',l.datas.renovacaoInicio?dPT(l.datas.renovacaoInicio)+' a '+(dPT(l.datas.renovacaoFim)||'—'):'');
    if(l.bonus){
      const a=l.contratoAnterior,b='Quadro '+Q.comReducao+'B';
      add(b,'Renda deste contrato',euro2(l.renda),{sub:'por mês'});
      add(b,'N.º do contrato anterior',a&&a.numero?a.numero:'',{sub:a?a.nome:'',falta:!(a&&a.numero),nota:a?'sem n.º na AT':'por identificar'});
      add(b,'Renda do contrato anterior',eur(l.rendaAnterior),{sub:'por mês',falta:!l.rendaAnterior});
    }
  }
  return out;
}
/* O cartão de um contrato num quadro: à cabeça o nome, o imóvel (o titular,
   quando as linhas são de mais do que um, e a quota-parte, quando não é
   inteiro) e a taxa do ano e porquê (ou «isento»,
   com o quadro e o código do programa), e as faltas por extenso; por baixo os
   campos do fiscoCamposDe, campo à esquerda e valor à direita, em grupos (a
   linha do quadro, os gastos, as obras, o 4.2A, o 4.2B). O que falta leva o
   selo vermelho com a falta, o que convém tratar o âmbar, o que não se aplica
   um «—». O NIF não parte entre linhas (lê-se e copia-se para o Portal de uma
   vez). Tocar abre a ficha do contrato — só com o serviço dos Contratos
   ligado nesta conta; sem ele o cartão é só de leitura.
   Recebe: r — o resumo (resumoFiscal); l — a linha do contrato.
   Devolve: o HTML do cartão (string). */
function fiscoContratoHtml(r,l){
  const taxa=l.isencao?'isento · '+(l.isencao.quadro||'6D')+(l.isencao.codigo?' código '+l.isencao.codigo:'')
    :'taxa '+dec(l.taxa)+' %'+(l.taxaEscrita?'':' · '+({nh:'não habitacional',duracao:'pela duração',moderada:'renda moderada',base:'base'}[l.motivoTaxa]||''));
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
  const abre=servicoLigado('contracts');
  return `<div class="fis-ctc${abre?' tap':''}"${abre?` data-toca="camada" data-click="ctView('${jsq(l.contratoId)}')"`:''}>
    <div class="fis-ctc-cab"><div class="fis-ctc-nome"><b>${esc(l.nome)}</b><span class="small">${esc(sub)}</span></div>${abre?ic('chevR',18):''}</div>
    ${l.faltas.length?`<p class="fis-ctc-falta">Falta: ${esc(l.faltas.join(', '))}.</p>`:''}
    <dl class="fis-campos">${corpo}</dl></div>`;
}
/* O cartão do quadro 6D: os contratos isentos (PAA, programas municipais,
   RSAA) com rendas no ano, cada um com o n.º, o programa e o código, e o
   rendimento líquido isento. Ficam também na linha do 4.1, que é o que o 6D
   pede; não pagam imposto, e no englobamento contam só para a taxa. Sem
   isentos, não se escreve.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem isentos. */
function fiscoIsentosCard(r){
  const ls=r.linhas.filter(l=>l.isencao);if(!ls.length)return '';
  return fisCartao('Quadro 6D — rendimentos isentos',fiscoN(fiscoNContratos(ls),'contrato isento','contratos isentos')+' em '+r.ano,
    `<div>${ls.map(l=>`<div class="stat"><span class="u-minw-0">${esc(l.nome)}<div class="small">${esc(l.imovel)}${l.imovel?' · ':''}n.º ${l.atNumero?esc(l.atNumero):'—'} · ${esc(l.isencao.nome||l.isencao.curto)} · ${l.isencao.codigo?'código '+esc(l.isencao.codigo):'código por conhecer'}${r.variosTitulares?' · titular '+l.titular:''}</div></span><b>${euro2(l.rendas)}</b></div>`).join('')}
    <div class="stat"><span><b>Rendimento líquido isento</b></span><b>${euro2(r.totais.isentos.liquido)}</b></div></div>
    <div class="hint">Estas rendas vão na linha do quadro 4.1 como as outras, e no 6D indicas o campo do 4.1 onde ficaram, o n.º do contrato e o código do programa (01 PAA, 02 programa municipal, 03 alojamento estudantil municipal). Não pagam imposto e ficam fora do imposto estimado; se englobares, entram só para achar a taxa dos outros rendimentos.${ls.some(l=>!l.isencao.codigo)?' O código do RSAA só se sabe quando sair o Anexo F de '+r.ano+'.':''}</div>`);
}
/* O cartão do quadro 9: o AIMI pago no ano (fiscoAimi), os prédios que deram
   rendas com o VPT, o 9101 e o 9102, e a parte que abate à coleta — ou, sem o
   VPT de algum prédio, qual falta. Sem AIMI no ano, não se escreve.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem AIMI. */
function fiscoAimiCard(r){
  const a=r.aimi;if(!a)return '';
  const Q=r.versao.quadros.aimi||'9';
  return fisCartao('Quadro '+esc(Q)+' — AIMI','Adicional ao IMI pago em '+r.ano+' · '+fiscoN(a.n,'pagamento','pagamentos'),
    `<div>${a.predios.map(p=>`<div class="stat"><span class="u-minw-0">${esc(p.imovel)}<div class="small">campo do quadro ${esc(p.quadro)} · valor patrimonial tributário</div></span><b>${p.vpt?euro2(p.vpt):'sem VPT'}</b></div>`).join('')}
    <div class="stat"><span>9101 · AIMI liquidado</span><b>${euro2(a.total)}</b></div>
    <div class="stat"><span>9102 · VPT dos prédios urbanos sujeitos ao AIMI</span><b>${a.semVpt.length?'—':euro2(a.vptTotal)}</b></div>
    <div class="stat"><span><b>Parte que abate ao imposto (estimativa)</b></span><b>${a.abate==null?'—':euro2(a.abate)}</b></div></div>
    <div class="hint">${a.semVpt.length?'Falta o VPT de '+esc(listaE(a.semVpt))+' na ficha do imóvel: sem ele não se calcula a parte que abate. ':''}O AIMI não é gasto das rendas (CIRS art. 41.º): abate ao imposto na proporção do VPT dos prédios que deram rendas sobre o de todos os prédios urbanos sujeitos ao AIMI (CIMI art. 135.º-I), e nunca mais do que o imposto das rendas.${a.parte!=null&&a.abate<a.parte?' A parte dos prédios arrendados ('+euro2(a.parte)+') passa o imposto estimado das rendas: abate só até lá.':''} Os valores certos estão na demonstração de liquidação do AIMI — o 9101 é o imposto total e o 9102 o valor tributável de todos os prédios, mesmo os que não estão na app.</div>`);
}
/* O cartão das obras dos 24 meses anteriores ao arrendamento — só quando as há.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem obras. */
function fiscoObrasCard(r){
  const ls=r.linhas.filter(l=>l.obras24.valor>0);if(!ls.length)return '';
  return fisCartao('Obras antes do arrendamento','Gastos dos 24 meses anteriores ao início, nos contratos que começaram em '+r.ano,
    '<div>'+ls.map(l=>`<div class="stat"><span>${esc(l.nome)}<div class="small">${esc(l.imovel)} · quadro ${esc(l.quadro)}${r.variosTitulares?' · titular '+l.titular:''} · desde ${dPT(l.obras24.inicioGastos)}</div></span><b>${euro2(l.obras24.valor)}</b></div>`).join('')
    +`<div class="stat"><span><b>Total</b></span><b>${euro2(r.totais.obras24)}</b></div></div>
    <div class="hint">Conservação e manutenção pagas antes de o contrato começar, nos 24 meses anteriores, quando o imóvel não tinha contrato em vigor — e o que marcaste à mão como obras dos 24 meses. Vão nas três colunas próprias da linha do contrato (início do contrato, mês do primeiro pagamento, valor) e não se repetem noutro ano.</div>`);
}
/* O cartão das rendas recebidas no ano que respeitam a anos anteriores (pelo
   mês a que a renda respeita, no movimento) — só quando as há. Já estão no
   valor das linhas; o quadro 8 diz que parte é de que ano.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem rendas de anos anteriores. */
function fiscoAnosAnterioresCard(r){
  const ls=r.linhas.filter(l=>l.anosAnteriores.length);if(!ls.length)return '';
  return fisCartao('Rendas de anos anteriores','Recebidas em '+r.ano+' · quadro '+esc(r.versao.quadros.anosAnteriores),
    '<div>'+ls.map(l=>l.anosAnteriores.map(a=>`<div class="stat"><span>${esc(l.nome)}<div class="small">quadro ${esc(l.quadro)}${r.variosTitulares?' · titular '+l.titular:''} · respeitam a ${a.ano}</div></span><b>${euro2(a.valor)}</b></div>`).join('')).join('')+'</div>'
    +`<div class="hint">Já estão nas rendas da linha, porque contam no ano em que se recebem. No quadro ${esc(r.versao.quadros.anosAnteriores)} dizes de que ano é cada parte: no 8A se optares pelo englobamento (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares declarações de substituição desses anos, até cinco para trás.</div>`);
}
/* O cartão «Fora da declaração»: os contratos marcados como não declarados com
   rendas no ano, com o valor, sem juízo. Tocar abre o contrato — com o serviço
   dos Contratos ligado nesta conta; sem ele a lista é só de leitura e a frase
   diz quem o liga.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem contratos fora. */
function fiscoForaCard(r){
  if(!r.fora.length)return '';
  const comContratos=servicoLigado('contracts');
  const linha=f=>`<div class="card${comContratos?' tap':''} u-p-11px-13px"${comContratos?` data-toca="camada" data-click="ctView('${jsq(f.contratoId)}')"`:''}>
      <div class="row-between u-ai-center u-g-10px"><div class="u-minw-0"><b>${esc(f.nome)}</b><div class="small">${esc(f.imovel)}${f.imovel?' · ':''}${fiscoN(f.n,'renda','rendas')} em ${r.ano}</div></div><b>${euro2(f.rendas)}</b></div></div>`;
  return fisCartao('Fora da declaração',fiscoN(r.fora.length,'contrato marcado como não declarado','contratos marcados como não declarados'),
    `<div class="list u-g-8px">${r.fora.map(linha).join('')}</div>
    <div class="hint">As rendas destes contratos não entram no quadro nem nos totais, e a parte deles nos gastos do imóvel também não. ${comContratos?'O estado muda-se na ficha do contrato.':fraseServicoDesligado('contracts')}</div>`);
}
/* O cartão «Rendas sem contrato»: as rendas do ano que não dizem de que
   contrato são, por imóvel, com a saída para as ligar — que é dos Movimentos:
   com esse serviço desligado nesta conta a saída não se escreve, e a frase diz
   quem o liga.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem rendas soltas. */
function fiscoSemContratoCard(r){
  if(!r.semContrato.length)return '';
  const n=sum(r.semContrato.map(s=>s.n)),comMovimentos=servicoLigado('transactions');
  return fisCartao('Rendas sem contrato',fiscoN(n,'renda','rendas')+' de '+r.ano+' sem contrato ligado',
    '<div>'+r.semContrato.map(s=>`<div class="stat"><span>${esc(s.imovel)}<div class="small">${fiscoN(s.n,'movimento','movimentos')}</div></span><b>${euro2(s.rendas)}</b></div>`).join('')+'</div>'
    +`<div class="hint">Uma renda só entra numa linha do quadro quando o movimento diz de que contrato é. ${comMovimentos?'Abre o movimento e liga-o ao contrato.':fraseServicoDesligado('transactions')}</div>`
    +(!comMovimentos?'':n===1?saida('Abrir o movimento',`txView('${jsq(r.semContrato[0].ids[0])}')`,'camada'):saida('Ver movimentos',"go('transactions')",'ecra')));
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
