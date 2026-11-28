/* ================= CONTRATO ================= */
let cForm={};
/* As perguntas do formulário do contrato que abrem uma caixa (os ids dos
   interruptores — c_fpart, c_encQ, c_fextrasQ — e 'taxa', o «Escrever outra
   taxa»), abertas por quem preenche e ainda sem nada escrito lá dentro: o
   collectCt lembra-as aqui para um repaint não as fechar. E c_fcel: a data de
   celebração já esteve no ecrã e foi lida (ctCelebracaoNoCampo — um contrato
   novo só abre com hoje até lá). Não se grava; o ctModal esvazia-as. */
let _ctAbertas={};
/* O corpo da ficha de um contrato: o que se sabe sobre ele, para ler, como a
   prancheta M-Contrato.

   Pela ordem das perguntas que trazem alguém aqui: ainda está em vigor e
   quando acaba (o selo, o imóvel e a barra do tempo), o que tem prazo (os
   cartões dos prazos que já avisam), quanto paga e se já pagou (os valores),
   como está perante a AT, quem lá mora, a caução e o resto do que ficou
   combinado, as tarefas, o inventário e os anexos, e o PDF. O «Editar» é o do
   rodapé, só para quem pode (ctView); quem não pode lê porquê logo à cabeça.

   As datas ficam como a app as escreve em todo o lado. Um formato português
   só aqui dava duas maneiras de escrever a mesma data no mesmo ecrã.
   Recebe: id — o id do contrato.
   Devolve: o HTML do corpo, ou vazio se o contrato já não existir. */
function ctFicha(id){
  const c=contract(id);if(!c)return '';
  const pid=c.propertyId,p=prop(pid);
  /* O contacto do inquilino está escrito no CONTRATO, e o servidor manda o
     contrato inteiro a quem tem contract.view. O cargo «Contabilista», que a
     app traz de fábrica, tem contract.view e não tem tenant.view — sem esta
     guarda lia o contacto de quem não pode sequer abrir a ficha da pessoa. */
  const verPessoas=pode(pid,'tenant.view');
  /* Sem botão «Editar» no rodapé, a ficha tem de dizer porquê — e não há
     uma só razão: há «não tens permissão» e há «só quem o adicionou pode
     alterar». Quem tem contract.add mas não criou este contrato lia uma
     frase que não era a sua. A app já sabe dizer a certa. */
  const recusa=motivoRecusa(pid,'contract.add',c);
  const pzs=ctPrazosDoContrato(c);
  /* a lista de tarefas abre-se numa janela própria (tarefas.js:tfAbrir) */
  const tf=tfLinhaDaFicha('contrato',c.id);
  const cartoes=[ctValoresDaFicha(c),ctAtDaFicha(c),ctInquilinosDaFicha(c,verPessoas),ctCaucaoDaFicha(c,verPessoas),
    tf?ctSecao(tf.rotulo,`<div class="ct-tarefas">${tf.valor}</div>`):'',
    String(c.notes||'').trim()?ctSecao('Notas',`<div class="ct-notas">${rich(c.notes)}</div>`):'',
    ctAnexosDaFicha(c,p)].filter(Boolean).join('');
  return `<div class="ct-ficha">
    ${recusa?`<p class="ct-recusa">${esc(recusa)}</p>`:''}
    ${ctTopoDaFicha(c,p,pzs)}
    ${pzs.map(x=>ctPrazoDaFicha(c,x)).join('')}
    <div class="ct-grelha">${cartoes}</div>
    <button type="button" class="btn ct-gerar-pdf" data-toca="camada" data-click="ctPdfJanela('${jsq(c.id)}')">${ic('down',18)} Gerar contrato em PDF</button>
  </div>`;
}
/* Um cartão da ficha, com o título e, à direita dele, o que se passar (um
   selo); sem título é só o corpo.
   Recebe: titulo — o texto (por escapar; '' sem cabeçalho); corpo — o HTML;
   extra (opcional) — o HTML à direita do título; cls (opcional) — uma classe
   a mais, para o cartão se encontrar (o da AT, ctIrParaAt).
   Devolve: o HTML do cartão. */
function ctSecao(titulo,corpo,extra,cls){
  return `<div class="card ct-sec${cls?' '+cls:''}">${titulo?`<div class="ct-sec-cab"><h3>${esc(titulo)}</h3>${extra||''}</div>`:''}<div class="ct-sec-corpo">${corpo}</div></div>`;
}
/* Uma linha rótulo / valor de um cartão da ficha.
   Recebe: rot — o rótulo (por escapar); valor — o HTML do valor, já escapado.
   Devolve: o HTML da linha, ou '' sem valor (uma ficha mostra o que se sabe). */
function ctKv(rot,valor){
  const v=valor==null?'':String(valor).trim();
  return v?`<div class="ct-kv"><span>${esc(rot)}</span><b>${v}</b></div>`:'';
}
/* O que falta (ou passou) até uma data, por extenso: «faltam 134 dias», «falta
   1 dia», «acaba hoje»; com o verbo «começa», para um contrato por começar.
   Recebe: d — os dias até à data (pzDias); verbo (opcional) — 'começa' muda as frases.
   Devolve: o texto. */
function ctFaltaTexto(d,verbo){
  if(verbo==='começa')return d<=0?'começa hoje':d===1?'começa amanhã':'começa daqui a '+d+' dias';
  return d<=0?'acaba hoje':d===1?'falta 1 dia':'faltam '+d+' dias';
}
/* O topo da ficha: o selo do estado, o imóvel com a parte arrendada e o
   período — o início, o que falta e o fim por cima da barra do tempo
   decorrido (a largura vem do data-largura, estilos-calculados.js; nada em
   linha para a CSP). Sem as duas datas não há barra, e diz-se o que há. O
   prazo que custa um ano de contrato se passar diz-se aqui quando o cartão
   dele não está (silenciado, ou a nuvem ainda sem estado).
   Cada coisa diz-se uma vez, como a prancheta: com a barra, o selo diz só
   «Em vigor» e os dias que faltam ficam por cima da barra (a tabela da lista
   continua a juntá-los ao selo, que lá é o único sítio); o início de um
   contrato por começar está no período, e não também ao lado do selo. Num
   imóvel fora de Portugal, no lugar da oposição, a frase da lei do país do
   imóvel (prazos.js:PZ_LEI_DO_PAIS).
   Recebe: c — o contrato; p — o imóvel (pode faltar); pzs — os prazos do contrato que avisam.
   Devolve: o HTML do topo. */
function ctTopoDaFicha(c,p,pzs){
  const e=ctEstado(c),comBarra=!!(c.start&&c.end&&c.end>=c.start);
  const st=e==='ativo'&&comBarra?{txt:'Em vigor',cor:'in'}:ctSeloDoEstado(c);
  /* só quando o imóvel existe mesmo: sem ele o ctLabel escreve «?», e um
     ponto de interrogação numa ficha é pior do que a linha não estar lá */
  const onde=p?esc(p.name)+(c.roomId?' · '+esc(roomName(p,c.roomId)||'Quarto'):(p.rentalMode==='quartos'?' · Imóvel inteiro':'')):'';
  let periodo;
  if(comBarra){
    const tot=Math.max(1,pzDias(c.end,c.start)),feito=Math.min(tot,Math.max(0,pzDias(today(),c.start)));
    const pct=e==='terminado'?100:e==='futuro'?0:Math.round(feito/tot*100);
    const meio=e==='futuro'?ctFaltaTexto(pzDias(c.start),'começa'):e==='terminado'?'terminou':ctFaltaTexto(pzDias(c.end));
    periodo=`<div class="ct-periodo"><span>${dPT(c.start)}</span><span class="small">${meio}</span><span>${dPT(c.end)}</span></div>
      <div class="ct-barra" role="progressbar" aria-label="Prazo do contrato" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${pct}% do prazo já passou"><span class="ct-barra-feita" data-largura="${pct}"></span></div>`;
  }else periodo=`<p class="small ct-periodo-so">${c.start?(e==='futuro'?'Começa a ':'Desde ')+dPT(c.start):'Sem data de início'}${c.end?' · até '+dPT(c.end):' · sem data de fim'}</p>`;
  const dias=c.end?pzDias(c.end):null,o=ctOposicao(c),fora=pzForaDePortugal(c.propertyId);
  /* fora de Portugal os prazos são os da lei do país do imóvel (Roma I): a
     frase diz porquê, no lugar da oposição daqui */
  const op=fora?`<p class="small ct-op">${esc(PZ_LEI_DO_PAIS)}</p>`:isActive(c)&&c.end&&o&&dias>=0&&dias<=o.dias+30&&!pzs.some(x=>x.tipo==='oposicao')
    ?`<p class="small ct-op">Para o contrato não renovar a ${dPT(c.end)}, o aviso ao inquilino tem de seguir até <b>${dPT(o.alvo)}</b> (${esc(ctOposicaoDias(o))}).${o.efeitos?' É a primeira renovação: a oposição só produz efeitos a '+dPT(o.efeitos)+'.':''}</p>`:'';
  /* o termo fica na barra; o dia em que acabou mesmo (o «Terminar contrato»)
     diz-se por baixo */
  const ces=c.active===false?irsCessacao(c).data:'',termo=irsFimEfetivo(c);
  const cessou=ces?`<p class="small">Acabou a ${dPT(ces)}${termo&&ces<termo?', antes do termo':''}.</p>`:'';
  return `<div class="ct-topo">
    <div class="ct-topo-selos"><span class="badge${st.cor?' '+st.cor:''}">${esc(st.txt)}</span></div>
    ${onde?`<p class="ct-onde">${onde}</p>`:''}
    ${periodo}${op}${cessou}
  </div>`;
}
/* Os prazos deste contrato que já avisam e não foram silenciados (os mesmos
   do sino e da Visão geral — prazos.js:prazosAtivos), mais os recibos por
   emitir das rendas dele. Nada antes de se saber o estado do servidor
   (espera.js:sabemosOEstado).
   Recebe: c — o contrato.
   Devolve: os prazos (array), do mais urgente para o menos. */
function ctPrazosDoContrato(c){
  if(!sabemosOEstado())return [];
  const doCt={};(db.transactions||[]).forEach(t=>{if(t.contractId===c.id)doCt[t.id]=1});
  return prazosAtivos().filter(p=>{
    const a=String(p.chave).split(':');
    return CT_PRAZOS_DO_CONTRATO.indexOf(a[0])>-1?a[1]===c.id:(a[0]==='recibos'&&!!doCt[a[1]]);
  });
}
/* O título de um prazo na ficha, com a data: «Oposição à renovação até
   31/10/2026». O recibo diz o dia em que a renda foi recebida (passa-se
   quando se recebe, sem «até» — D82); o registo dos elementos mínimos não
   tem data (D85); a comunicação de fevereiro diz qual é pelo evento do
   prazo — a duração do contrato, a renovação, ou a cessação (D01, D09).
   Recebe: x — o prazo (prazos.js:prazosDe).
   Devolve: o texto (por escapar). */
function ctTituloDoPrazo(x){
  const d=dPT(x.alvo);
  switch(x.tipo){
    case 'oposicao':return 'Oposição à renovação até '+d;
    case 'fim':return (x.dias<0?'O prazo acabou a ':'O contrato termina a ')+d;
    case 'aumento':return 'Aviso do aumento até '+d;
    case 'modelo2':return 'Comunicar o contrato à AT até '+d;
    case 'cessacao':return 'Comunicar a cessação à AT até '+d;
    case 'fev15':return (x.evento==='cessacao'?'Comunicar a cessação à AT até ':x.evento==='renovacao'?'Comunicar a renovação à AT até ':'Comunicar a duração à AT até ')+d;
    case 'rsaa':return 'Enviar o contrato ao IHRU até '+d;
    case 'recibos':return 'Emitir o recibo da renda recebida a '+d.slice(0,5);
    case 'elementos':return 'Registar o contrato no Portal das Finanças';
  }
  return x.semData?pzPartes(x).titulo:pzPartes(x).titulo+' · '+d;
}
/* O cartão de um prazo na ficha (a prancheta: «Oposição à renovação até…»):
   o título com a data, o selo do que falta na cor do contrato visual
   (prazos.js:pzSelo), a frase do porquê e do como (a do sino) e as ações — na
   oposição e no fim, Renovar e Terminar para quem pode; num recibo, abrir o
   movimento; o «feito» do próprio prazo quando o tem (a ação de prazos.js —
   «Marcar como comunicada», «Marcar como enviado» —, a mesma do cartão dos
   prazos, prazos.js:prazosCard, e só quando a função existe) —, e o ✕ que
   silencia esta ocorrência, com «Anular» (prazos.js:pzSilencia). O fundo é o
   suave da cor do selo.
   Recebe: c — o contrato; x — o prazo.
   Devolve: o HTML do cartão. */
function ctPrazoDaFicha(c,x){
  const ok=podeEditar(c.propertyId,'contract.add',c),cor=pzSelo(x),id=jsq(c.id),acoes=[];
  if((x.tipo==='oposicao'||x.tipo==='fim')&&ok&&c.end&&c.active!==false)
    acoes.push(`<button type="button" class="btn sm" data-toca="camada" data-click="ctRenovar('${id}')">Renovar</button>`,
      `<button type="button" class="btn sm" data-toca="camada" data-click="endContract('${id}')">Terminar</button>`);
  /* o «feito» do prazo: o prazos.js só o dá a quem pode alterar o contrato
     (pzPodeMarcar); aqui confere-se ainda que a função da ação existe */
  const fnAcao=/^([A-Za-z_]\w*)\(/.exec(String(x.acao||''));
  if(x.acao&&x.acaoTexto&&fnAcao&&typeof window[fnAcao[1]]==='function')
    acoes.push(`<button type="button" class="btn sm" data-toca="camada" data-click="${esc(x.acao)}">${esc(x.acaoTexto)}</button>`);
  /* o Modelo 2 e a comunicação de fevereiro resolvem-se no cartão «Perante a
     AT», mais abaixo na ficha: o aviso leva lá (KAN-133) */
  if(x.tipo==='modelo2'||x.tipo==='fev15')acoes.push(`<button type="button" class="btn sm" data-toca="nada" data-click="ctIrParaAt()">Ver na ficha</button>`);
  if(x.tipo==='recibos'&&x.abrir)acoes.push(`<button type="button" class="btn sm" data-toca="camada" data-click="${x.abrir}">Abrir a renda</button>`);
  acoes.push(`<button type="button" class="btn sm ghost so-icone ct-silenciar" aria-label="Silenciar este aviso" title="Silenciar até a data mudar" data-toca="dados" data-click="pzSilencia('${jsq(x.chave)}')">${ic('x',16)}</button>`);
  return `<div class="ct-prazo ct-prazo-${cor}">
    <div class="ct-prazo-cab"><span class="ct-prazo-ic" aria-hidden="true">${ic('clock',20)}</span><p class="ct-prazo-tit">${esc(ctTituloDoPrazo(x))}</p><span class="badge ct-prazo-quando">${esc(pzQuando(x))}</span></div>
    <p class="ct-prazo-txt">${esc(x.sub)}</p>
    <div class="ct-prazo-acoes">${acoes.join('')}</div></div>`;
}
/* O cartão dos valores: a renda, o imposto (com o porquê da taxa estimada)
   e a líquida em três números grandes, e por baixo o dia do pagamento, a
   próxima renda planeada (dos Planeados), as rendas já registadas (dos
   Movimentos — a pergunta a seguir a «quanto paga» é «já pagou») e o aumento
   anual, e os encargos a cargo do inquilino; e os dois atalhos, Registar
   renda e Ver movimentos, para quem os pode usar. Com um serviço desligado
   nesta conta, o que é dele não se escreve. Sem estimativa do imposto (fora
   de Portugal, categoria B — ctSemEstimativa) e sem taxa escrita, o imposto
   e a líquida ficam em branco.
   Recebe: c — o contrato.
   Devolve: o HTML do cartão. */
function ctValoresDaFicha(c){
  const pid=c.propertyId,id=jsq(c.id);
  /* a renda planeada é dos Planeados: desligados nesta conta, não há próxima
     renda a mostrar — e a função nem sequer existe para lhe perguntar */
  const rec0=servicoLigado('recurring')?ctRecOf(c):null;
  /* num imóvel vendido, a renda depois do dia da venda já não se pede (planeados.js:recAcabouNaVenda) */
  const rec=rec0&&!recAcabouNaVenda(rec0)?rec0:null;
  const movs=servicoLigado('transactions')&&pode(pid,'tx.view')?(db.transactions||[]).filter(t=>t.contractId===c.id):[];
  const rendas=movs.filter(t=>t.kind==='income'),ultima=rendas.map(t=>t.date).sort().pop();
  /* o bruto engana, e a marca de «estimado» é a mesma que a lista já dá: o
     formulário guarda 0 para «em branco», e escrever «0%» era mentira */
  const escrita=Number(c.taxRate)>0,liq=netRent(c);
  /* fora de Portugal e na categoria B não há estimativa do imposto (D133,
     D134): sem taxa escrita, nem imposto nem líquida inventados */
  const semEst=!escrita&&ctSemEstimativa(c);
  const tres=c.rent>0&&semEst?`<div class="ct-tres">
      <div><span class="small">Renda</span><b class="disp">${euro2(c.rent)}</b></div>
      <div><span class="small">Imposto</span><b class="disp">—</b><span class="small">${semEst==='fora'?'Anexo J · sem estimativa':'categoria B · sem estimativa'}</span></div>
      <div><span class="small">Líquida</span><b class="disp">—</b><span class="small">escreve a taxa no contrato</span></div></div>`
    :c.rent>0?`<div class="ct-tres">
      <div><span class="small">Renda</span><b class="disp">${euro2(c.rent)}</b></div>
      <div><span class="small">Imposto</span><b class="disp">${dec(taxRateOf(c))}%</b><span class="small">${escrita?'escrita no contrato':esc(irsTaxaPorque(c))+' · estim.'}</span></div>
      <div><span class="small">Líquida</span><b class="disp">${euro2(liq)}</b><span class="small">${euro(liq*12)}/ano</span></div></div>`
    :`<p class="hint ct-sem-renda">Este contrato ainda não tem renda.</p>`;
  /* as rendas por receber, cada uma com o seu valor, e o resto de uma paga só
     em parte com «em dívida» (planeados.js:ctRendasEmDivida, KAN-129-4): com
     o resto em dívida, ou com duas ou mais em falta */
  const dividas=servicoLigado('recurring')&&servicoLigado('transactions')&&pode(pid,'tx.view')?ctRendasEmDivida(c):[];
  const kv=[
    ctKv('Pagamento',c.payDay?((c.payDayTo&&c.payDayTo>c.payDay)?'entre o dia '+c.payDay+' e o dia '+c.payDayTo:'no dia '+c.payDay):''),
    isActive(c)&&rec&&rec.next&&pode(pid,'rec.view')?ctRendaPlaneada(rec):'',
    dividas.length>1||dividas.some(x=>x.divida)?ctKv('Rendas por receber',ctDividasHtml(dividas)):'',
    rendas.length?ctKv('Rendas registadas',rendas.length+(ultima?' · última a '+dPT(ultima):'')):'',
    c.increase!=null&&c.increase!==''?ctKv('Aumento anual',dec(c.increase)+'%'+(c.start?' · próximo a '+dPT(pzAniversario(c.start)):'')):'',
    ctKv('Encargos do inquilino',esc(ctEncargosNomes(c)))].join('');
  /* registar a renda é dos Movimentos: com o serviço desligado nesta conta o
     atalho não aparece */
  /* as rendas que faltam desde o início do contrato — num terminado, que não
     tem planeado (KAN-132), e num em vigor, cujo planeado só começa no mês em
     que foi adicionado — registam-se de uma vez pela janela do preenchimento
     da nuvem (planeados.js:ctRendasPorRegistar, cloud/painel.js:CW.fillContrato) */
  const emFalta=servicoLigado('transactions')&&pode(pid,'tx.add')&&typeof window!=='undefined'&&window.CW&&typeof window.CW.fillContrato==='function'
    ?ctRendasPorRegistar(c).datas.length:0;
  /* num contrato que já acabou (ou cujo termo passou sem renovação
     registada), o que entra depois — a renda em atraso, a indemnização —
     regista-se ligado a ele: «Registar recebimento» (N025) */
  const botoes=[servicoLigado('transactions')&&isActive(c)&&pode(pid,'tx.add')?`<button type="button" class="btn sm primary" data-toca="camada" data-click="ctRegistarRenda('${jsq(pid)}','${id}')">Registar renda</button>`:'',
    ctRecebimentoPossivel(c)?`<button type="button" class="btn sm" data-toca="camada" data-click="ctRegistarRecebimento('${jsq(pid)}','${id}')">Registar recebimento</button>`:'',
    emFalta?`<button type="button" class="btn sm primary" data-toca="camada" data-click="CW.fillContrato('${id}')">Registar ${emFalta===1?'a renda em falta':'as '+emFalta+' rendas em falta'}</button>`:'',
    movs.length?`<button type="button" class="btn sm" data-toca="camada" data-click="ctVerMovimentos('${id}')">Ver movimentos</button>`:''].join('');
  return `<div class="card ct-sec ct-valores">${tres}${kv}${botoes?`<div class="ct-botoes">${botoes}</div>`:''}</div>`;
}
/* As rendas por receber de um contrato na linha do cartão dos valores, uma
   por linha: o mês e o valor dela, e o resto de uma renda paga só em parte
   com «em dívida» (KAN-129-4).
   Recebe: xs — o que planeados.js:ctRendasEmDivida devolve.
   Devolve: o HTML (escapado). */
function ctDividasHtml(xs){
  return `<span class="ct-dividas">${xs.map(x=>`<span>${esc(x.nome||x.mes)} · ${euro2(x.valor)}${x.divida?' em dívida':''}</span>`).join('')}</span>`;
}
/* A linha da renda planeada no cartão dos valores, nos três estados que os
   Planeados distinguem (planeados.js:recSelo): ainda não chegou — «Próxima
   renda … · planeada»; chegou e a janela do pagamento ainda está aberta —
   «· por confirmar»; a janela fechou sem confirmação — «Renda em atraso», a
   vermelho, desde quando (a mesma data da ficha do planeado). Chamar
   «próxima» a uma renda que já devia ter entrado escondia o atraso que a
   lista diz a vermelho.
   Recebe: rec — o planeado da renda do contrato (planeados.js:ctRecOf), com next.
   Devolve: o HTML da linha (contrato.js:ctKv). */
function ctRendaPlaneada(rec){
  if(rec.next>today())return ctKv('Próxima renda',dPT(rec.next)+' · planeada');
  if(recIsLate(rec))return ctKv('Renda em atraso',`<span class="perigo">desde ${dPT(rec.until||rec.next)}</span>${rec.muted?' · silenciada':''}`);
  return ctKv('Próxima renda',dPT(rec.next)+' · por confirmar');
}
/* Os movimentos de um contrato, do mais recente para o mais antigo, numa
   lista de escolha; tocar abre a ficha do movimento. É o «Ver movimentos» da
   ficha: os Movimentos não têm filtro por contrato.
   Recebe: id — o id do contrato.
   Devolve: nada — abre a lista de escolha. */
function ctVerMovimentos(id){
  const c=contract(id);if(!c)return;
  const movs=(db.transactions||[]).filter(t=>t.contractId===c.id).sort((a,b)=>-txPorDataECriacao(a,b));   /* o mais recente em cima, e no mesmo dia o adicionado depois */
  if(!movs.length)return;
  pickModal('Movimentos do contrato',movs.map(t=>({v:t.id,label:(t.label||'Movimento')+' · '+euro2(t.amount),sub:dPT(t.date),icon:'swap'})),
    o=>{closeModal();chamarServico('transactions','txView',o.v)});
}
/* O cartão «Perante a AT»: o estado num selo (declarado a verde, por indicar
   a cobalto, não declarado a cinzento — uma escolha do senhorio, sem cor de
   aviso), e o que se sabe do declarado — o número que a AT deu, a finalidade,
   a celebração, as renovações, a cessação (o dia e o motivo do quadro 10) e
   o quadro do Anexo F —, com as notas do IRS: a isenção, a taxa reduzida
   pela duração, o que a cessação leva ao quadro 10 (e, por motivo do senhorio, a
   regularização do art. 72.º n.º 20), e a taxa das rendas moderadas. Um
   direito real de habitação duradoura diz o quadro dele (o 4.3,
   ctQuadroDaFicha). Da ronda 2: um imóvel fora de Portugal não tem Anexo F
   nem nada do Modelo 2 — diz o país, o Anexo J e o imposto pago lá (D133);
   as rendas da categoria B dizem o Anexo B ou C, sem as notas da taxa
   especial (D134); e o arrendamento a uma entidade de gestão florestal diz
   o quadro do benefício, e porque não conta quando não conta (D119).
   A comunicação da duração de cada período, com o botão de a marcar, vai à
   cabeça do cartão, num bloco seu (ctComunicacaoBloco, KAN-127-18).
   Da ronda 2 das correções: a categoria B diz-se em qualquer estado em que a
   marca conta (também «Por indicar» e fora de Portugal, como o resumo:
   ctSemEstimativa), e nunca com recibos de renda — o documento é a fatura da
   atividade (Portaria 98-A/2015, art. 5.º n.º 1); um arrendamento rural
   também não os pede (art. 5.º n.º 3 a)); a dispensa dos recibos é a da
   situação fiscal do ano (irs-papeis.js:irsSituacao); o «Renovável» já não
   se pergunta nem se mostra.
   Recebe: c — o contrato.
   Devolve: o HTML do cartão. */
function ctAtDaFicha(c){
  const fisc=fiscoDe(c),fin=ctFinalidadeNome(fisc.finalidade);
  const semEst=ctSemEstimativa(c),fora=pzForaDePortugal(c.propertyId),catB=semEst==='catB';
  /* a redução pela duração é só dos contratos de habitação permanente (o
     irsReducao já o sabe), e é ela — não a taxa das rendas moderadas — que
     pede o quadro 4.2 e a comunicação de fevereiro */
  /* só é redução o que fica abaixo da taxa base (D11: os 26 % de um contrato
     curto do regime de 2019 não o são — o motor já o diz, e a nota não
     confia só nele) */
  const irsDoAno=irsTaxa(c,YEAR),escrita=Number(c.taxRate)>0;
  /* fora de Portugal e na categoria B não há taxa especial: nem redução, nem
     isenção, nem rendas moderadas, nem comunicação de fevereiro */
  const taxaReduzida=!semEst&&fisc.estado==='declarado'&&!!irsDoAno.reducao&&Number(irsDoAno.reducao.taxa)<Number(irsAno(YEAR).taxas.habitacional);
  const isento=!semEst&&irsDoAno.motivo==='isento'?irsDoAno.isencao:null,bonusRM=irsAno(YEAR).taxas.bonusRendaMenor;
  /* a comunicação da duração de cada período em causa, com o botão de a
     marcar, à cabeça do cartão (KAN-127-18: no meio das notas não se via) */
  const comunicacao=fisc.estado==='declarado'&&!semEst?ctComunicacaoBloco(c):'';
  /* o dia em que acabou e o motivo (o «Terminar contrato»), e o texto livre
     antigo do motivo, que já não se escreve, como nota */
  const ces=irsCessacao(c),cessacao=ces.data?ctCessacaoTexto(c):'';
  const notaAntiga=String(fisc.cessacaoMotivo||'').trim();
  const regulariza=ces.data&&fisc.estado==='declarado'&&!semEst?ctCessacaoAviso(c,ces.data,ces.motivo):'';
  /* a cessação de antes do ano anterior já não acende nos prazos
     (prazos.js:pzCessacaoRecente): a ficha diz, sem alarme, que se comunica */
  const diaCes=fisc.estado==='declarado'&&!fora?pzDiaDaCessacao(c,today()):'';
  const cesAntiga=diaCes&&!pzCessacaoRecente(diaCes,today())
    ?'O contrato acabou a '+dPT(diaCes)+': a cessação comunica-se à AT até ao fim do mês seguinte (o Modelo 2 também serve). Se nunca a comunicaste, ainda o deves fazer.':'';
  /* o inquilino empresa num contrato de habitação (D16): a resposta numa
     linha, e por responder a frase do aviso da Declaração com «Responder» */
  const empresa=fisc.estado==='declarado'&&!fora?ctEmpresaDaFicha(c):null;
  const selo=fisc.estado==='declarado'?'<span class="badge in">Declarado</span>':fisc.estado==='naoDeclarado'?'<span class="badge grey">Não declarado</span>':'<span class="badge">Por indicar</span>';
  let corpo='';
  if(fisc.estado==='declarado'&&fora){
    /* fora de Portugal: o país, o Anexo J e o imposto pago lá, por ano; o
       quadro vem da versão quando ela o tiver (anexoJ.quadro) */
    const p=prop(c.propertyId),J=irsAno(YEAR).anexoJ||{},ie=fisc.impostoEstrangeiro||{};
    const pago=Object.keys(ie).sort().map(a=>a+': '+euro2(ie[a])).join(' · ');
    corpo=ctKv('País do imóvel',esc(String((p&&p.pais)||'').trim()))
      +ctKv('Celebrado a',fisc.celebracao?dPT(fisc.celebracao):'')
      +ctKv('Cessação',cessacao?esc(cessacao):'')
      +ctKv('Imposto pago lá',esc(pago))
      +ctKv('Declara-se no',catB?'Anexo B ou C · categoria B':'Anexo J'+(J.quadro?' · quadro '+esc(J.quadro):''));
  }else if(fisc.estado==='declarado'){
    const renovs=(fisc.renovacoes||[]).filter(r=>r.fim).sort((a,b)=>String(a.fim).localeCompare(String(b.fim)));
    /* os recibos eletrónicos das rendas deste ano, pela marca de cada renda
       (os Movimentos, a quem os pode ver); com a dispensa da situação fiscal
       do ano das rendas (a mesma que os prazos leem) não há recibos, há o
       Modelo 44. As rendas da categoria B não têm recibo de renda (a fatura
       da atividade), nem as de um arrendamento rural */
    const rural=fisc.arrendamentoRural===true,pedeRecibo=!catB&&!rural;
    const dispensa=irsSituacao(YEAR).dispensaRecibos===true;
    const rendasAno=pedeRecibo&&servicoLigado('transactions')&&pode(c.propertyId,'tx.view')
      ?(db.transactions||[]).filter(t=>t.contractId===c.id&&ehRenda(t)&&String(t.date||'').slice(0,4)===String(YEAR)):[];
    const porEmitir=rendasAno.filter(t=>!t.recibo).length;
    const recibos=!pedeRecibo?'':dispensa?'dispensado · Modelo 44':rendasAno.length?(porEmitir?porEmitir+' de '+rendasAno.length+' por emitir em '+YEAR:'todos emitidos em '+YEAR):'';
    corpo=ctKv('N.º do contrato',String(fisc.numero||'').trim()?esc(fisc.numero):'<span class="badge red">Falta o n.º</span>')
      +ctKv('Finalidade',esc(fin))
      +ctKv('Celebrado a',fisc.celebracao?dPT(fisc.celebracao):'')
      +ctKv('Renovações',renovs.length?renovs.length+' · a última até '+dPT(renovs[renovs.length-1].fim):'')
      +ctKv('Cessação',cessacao?esc(cessacao):'')
      +ctKv('Nota da cessação',notaAntiga?esc(notaAntiga):'')
      +ctKv('Inquilino empresa',empresa?empresa.kv:'')
      +ctKv('Envio ao IHRU',ctIsencaoPede(c,'ihru')&&fisc.ihru?dPT(fisc.ihru):'')
      +ctKv('Consumos',fisc.consumosIncluidos===true?'incluídos na renda':'')
      +ctKv('Pago à parte',fisc.extrasMensais>0?euro2(fisc.extrasMensais)+' por mês · conta no limite das rendas moderadas':'')
      +ctKv('Obras antes do início',fisc.obrasSemOutroUso===true?'o imóvel esteve só à espera de inquilino':fisc.obrasSemOutroUso===false&&ctObrasAntes(c)?'o imóvel teve outro uso: não se deduzem':'')
      +ctKv('Renda de 2023',ctAtualizacao2023Visivel(c)&&fisc.atualizacao2023?(fisc.atualizacao2023==='sim'?'subiu mais de 2 %':'não subiu mais de 2 %'):'')
      +ctKv('Recibos eletrónicos',recibos)
      +ctKv('Arrendamento rural',rural?'sem recibo de renda eletrónico':'')
      +ctKv('Gestão florestal',fisc.egf===true?'arrendado a uma EGF ou UGF':'')
      +(catB?ctKv('Categoria B','fora do Anexo F · Anexo B ou C'):ctKv('Anexo F',esc(ctQuadroDaFicha(c,isento,taxaReduzida))));
  }else corpo=`<p class="hint">${fisc.estado==='naoDeclarado'?(fora?'Fica fora da Declaração.':'Fica fora do resumo do Anexo F e dos prazos da AT.')
    :fora?'Vais declarar as rendas deste imóvel no IRS? Fora de Portugal não há Modelo 2: as rendas vão ao Anexo J, com o imposto pago lá. Indica-o ao editar: a Declaração depende disso.'
    :ctAntesDoModelo2(c)?'Começou antes de abril de 2015: não tem Modelo 2. Registaste-o no Portal das Finanças (os elementos mínimos do contrato)? Indica-o ao editar: o resumo do Anexo F e os prazos da AT dependem disso.'
    :'Comunicaste este contrato às Finanças (Modelo 2)? Indica-o ao editar: o resumo do Anexo F e os prazos da AT dependem disso.'}</p>`
    +(catB?ctKv('Categoria B','fora do Anexo F · Anexo B ou C'):'');
  /* a isenção escolhida que não conta no ano: porquê, e o caminho para a
     pergunta que a confirma, a quem pode alterar o contrato */
  const isNaoConta=fisc.estado==='declarado'&&!isento&&!semEst?ctIsencaoNaoContaDaFicha(c):'';
  /* o arrendamento a uma entidade de gestão florestal marcado que não conta
     no ano corrente: porquê (D119) — também num imóvel que deixou de ser
     rústico, onde o formulário continua a mostrar a marca para a desligar */
  const egfAv=fisc.estado==='declarado'&&fisc.egf===true&&!semEst
    ?irsBeneficiosAvaliados(c,YEAR).find(x=>x.beneficio&&x.beneficio.marca==='contrato.egf'):null;
  const egfNota=egfAv?(egfAv.aplica?'Arrendado a uma entidade de gestão florestal: as rendas contam '+dec((Number(egfAv.beneficio.fator)||0)*100)+' %, e o quadro '+esc(egfAv.beneficio.quadro)+' do Anexo F aponta para a linha do contrato.'
    :'Arrendado a uma entidade de gestão florestal, mas o quadro '+esc(egfAv.beneficio.quadro)+' não conta em '+YEAR+': '+esc(egfAv.motivo)+'.'):'';
  /* a categoria B (D134) e o imóvel fora de Portugal (D133): para onde vão
     as rendas. A categoria B em qualquer estado em que conta (o resumo lê a
     marca sem olhar para o estado), e sem recibos de renda (N029) */
  const destino=catB?(fora?'As rendas deste contrato tributam-se na categoria B: declaram-se com a tua atividade, no Anexo B ou C.'
      :'As rendas deste contrato tributam-se na categoria B: declaram-se no Anexo B ou C, com a tua atividade, e não no Anexo F. '+ctCategoriaBDocumento())
    :fisc.estado==='declarado'&&fora?'Imóvel fora de Portugal: as rendas não vão ao Anexo F. Declaram-se no Anexo J, com as despesas do período arrendado e o imposto pago lá, que abate ao IRS daqui (CIRS art. 81.º).':'';
  const notas=[
    isento?'Isento de IRS: '+esc(isento.nome)+'. As rendas declaram-se na linha do quadro 4.1 do Anexo F, sem imposto, e o quadro '+esc(isento.quadro)+' aponta para ela'
      +(isento.semCodigo?'.':isento.codigo?' (código '+esc(isento.codigo)+').':' (o código ainda não se conhece: o Anexo F destes rendimentos não foi aprovado).'):'',
    destino,
    isNaoConta,
    egfNota,
    taxaReduzida?'Pela duração, este contrato tem direito à taxa reduzida de '+dec(irsDoAno.reducao.taxa)+' %'
      +(irsDoAno.reducao.bonus&&bonusRM?', já com os '+dec(bonusRM.pontos)+' pontos a menos de uma renda mais baixa do que a do contrato anterior (quadro 4.2B)':'')
      +'. Isso pede duas coisas: o quadro 4.2 do Anexo F preenchido, e a duração comunicada no Portal das Finanças — uma vez, até 15 de fevereiro do ano seguinte ao início do contrato e de cada renovação.'
      +(!escrita&&irsDoAno.motivo==='moderada'?' Em '+YEAR+' a renda dá-lhe ainda os '+dec(irsDoAno.taxa)+' % das rendas moderadas, que ficam por serem mais baixos.':''):'',
    empresa?empresa.nota:'',
    regulariza?esc(regulariza):'',
    cesAntiga?esc(cesAntiga):'',
    !semEst&&!taxaReduzida&&c.rent>0&&!escrita&&irsDoAno.motivo==='moderada'?'Com a renda até '+euro(irsAno(YEAR).taxas.rendaModerada.limiteMensal)+' por mês, as rendas de '+YEAR+' pagam a taxa de '+dec(irsDoAno.taxa)+' % das rendas moderadas (EBF art. 45.º-C), em vez de '+dec(irsAno(YEAR).taxas.habitacional)+' %.':''
  ].filter(Boolean).map(t=>`<div class="ct-nota">${t}</div>`).join('');
  return ctSecao('Perante a AT',comunicacao+corpo+notas,selo,'ct-sec-at');
}
/* «Ver na ficha» dos avisos do Modelo 2 e da comunicação de fevereiro
   (ctPrazoDaFicha): rola o corpo da janela até ao cartão «Perante a AT», que
   é onde se diz o estado perante a AT e se marca a comunicação. Suave, ou de
   uma vez com o movimento reduzido; o foco passa para o cartão sem rolar
   outra vez, para o leitor de ecrã chegar ao mesmo sítio.
   Devolve: nada — mexe no scroll e no foco. */
function ctIrParaAt(){
  const at=[].slice.call(document.querySelectorAll('.ct-sec-at')).pop();if(!at)return;
  const corpo=at.closest('.body'),suave=!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const comportamento=suave?'smooth':'auto';
  if(corpo){
    const topo=at.getBoundingClientRect().top-corpo.getBoundingClientRect().top+corpo.scrollTop-12;
    try{corpo.scrollTo({top:Math.max(0,topo),behavior:comportamento})}catch(e){corpo.scrollTop=Math.max(0,topo)}
  }else try{at.scrollIntoView({block:'start',behavior:comportamento})}catch(e){}
  at.setAttribute('tabindex','-1');
  try{at.focus({preventScroll:true})}catch(e){}
}
/* O selo do cartão de cidadão de uma pessoa, quando já pede atenção: caducado
   a vermelho; a caducar dentro da antecedência dos prazos (prazos.js:
   PZ_ANTECEDENCIA.cc) a âmbar, ou a vermelho na última semana.
   Recebe: iso — a validade do CC ('AAAA-MM-DD').
   Devolve: o HTML do selo, ou ''. */
function ctSeloDoCc(iso){
  const d=pzDias(iso);
  if(d<0)return `<span class="badge red">CC caducou a ${dPT(iso)}</span>`;
  return d<=PZ_ANTECEDENCIA.cc?`<span class="badge ${d<=7?'red':'amber'}">CC caduca a ${dPT(iso)}</span>`:'';
}
/* O cartão dos inquilinos: as iniciais, o nome, o telefone e o email (a quem
   pode ver inquilinos; tocar liga ou escreve), o selo do cartão de cidadão
   quando caduca, e a porta para a ficha da pessoa — com os Inquilinos ligados.
   O telefone e o email são as portas para ligar e escrever: cada um na sua
   linha, para no dedo terem a altura de um toque (estilos.css, secção
   «redesign: 1.3.3», .ct-pessoa-txt a).
   Recebe: c — o contrato; verPessoas — se o cargo deixa ver os inquilinos.
   Devolve: o HTML do cartão, ou '' sem inquilinos. */
function ctInquilinosDaFicha(c,verPessoas){
  const ts=ctTenants(c);if(!ts.length)return '';
  const abre=verPessoas&&servicoLigado('tenants');
  const linhas=ts.map(t=>{
    const tel=verPessoas&&t.phone?fmtPhone(t.phone):'',mail=verPessoas&&t.email?String(t.email):'';
    const cont=(tel?`<a class="small" href="tel:${esc(tel.replace(/\s+/g,''))}">${esc(tel)}</a>`:'')+(mail?`<a class="small" href="mailto:${esc(mail)}">${esc(mail)}</a>`:'');
    const cc=verPessoas&&t.ccValid?ctSeloDoCc(t.ccValid):'';
    return `<div class="ct-pessoa"><span class="avatar ct-av" aria-hidden="true">${esc(initials(t.name))}</span>
      <div class="ct-pessoa-txt"><b>${esc(t.name)}</b>${cont}${cc?`<span class="ct-pessoa-selos">${cc}</span>`:''}</div>
      ${abre?`<button type="button" class="btn sm ghost so-icone ct-pessoa-abrir" aria-label="Abrir a ficha de ${esc(t.name)}" data-toca="camada" data-click="personView('tenant','${jsq(t.id)}')">${ic('chevR',18)}</button>`:''}</div>`;
  }).join('');
  return ctSecao(ts.length>1?'Inquilinos':'Inquilino',linhas);
}
/* O cartão do que ficou combinado à parte da renda: a caução, as rendas
   antecipadas, o IBAN e os contactos escritos no contrato (o do inquilino só
   a quem pode ver inquilinos — ver ctFicha). Num contrato terminado com a
   caução por devolver nos movimentos (ctDevolucaoPossivel, D15), e que
   acabou no ano de hoje ou no anterior (prazos.js:pzCessacaoRecente), a
   pergunta «Devolveste a caução?» com «Registar a devolução» (ctDevolucaoCaucao).
   Recebe: c — o contrato; verPessoas — se o cargo deixa ver os inquilinos.
   Devolve: o HTML do cartão, ou '' sem nada para mostrar. */
function ctCaucaoDaFicha(c,verPessoas){
  const contacto=(tel,email)=>[tel?fmtPhone(tel):'',email||''].filter(Boolean).join(' · ');
  const corpo=[c.deposit>0?ctKv('Caução',euro2(c.deposit)):'',
    c.advance>0?ctKv('Rendas antecipadas',c.advance+(Number(c.advance)===1?' mês':' meses')):'',
    c.iban?ctKv('IBAN',`<span class="ct-iban">${esc(fmtIBAN(c.iban))}</span>`):'',
    (c.ownerPhone||c.ownerEmail)?ctKv('Contacto do senhorio',esc(contacto(c.ownerPhone,c.ownerEmail))):'',
    verPessoas&&(c.tenantPhone||c.tenantEmail)?ctKv('Contacto do inquilino',esc(contacto(c.tenantPhone,c.tenantEmail))):''].join('');
  /* só de um contrato que acabou no ano de hoje ou no anterior: a devolução
     de um que acabou há anos foi num ano já entregue */
  const terminado=(c.active===false||!!irsCessacao(c).data)&&pzCessacaoRecente(irsFimReal(c),today());
  const devolver=terminado&&ctDevolucaoPossivel(c)
    ?`<div class="ct-nota">Devolveste a caução? A devolução é um gasto do ano em que a devolves: regista-a, com o dia e o valor (só o que devolveste).<div class="toolbar u-m-9px-0-0"><button type="button" class="btn sm" data-toca="camada" data-click="ctDevolucaoCaucao('${jsq(c.id)}')">Registar a devolução</button></div></div>`:'';
  return corpo?`<div class="card ct-sec ct-sec-kv">${corpo}${devolver}</div>`:'';
}
/* Os mosaicos do que vai junto ao contrato (a prancheta): o inventário, as
   chaves entregues, o registo fotográfico e os anexos, cada um com quantos
   são, e tocar abre a lista (ctVerAnexos). As fotos e os ficheiros pedem
   file.view; o que não há não aparece.
   Recebe: c — o contrato; p — o imóvel (pode faltar).
   Devolve: o HTML dos mosaicos, ou ''. */
function ctAnexosDaFicha(c,p){
  const vf=pode(c.propertyId,'file.view'),inv=c.inventory||[],ch=c.keys||[];
  const fotos=vf?((p&&p.photos)||[]).filter(f=>(c.photoIds||[]).indexOf(f.id)>-1):[],files=vf?(c.files||[]):[];
  const t=[];
  if(inv.length)t.push(['inv','Inventário',inv.length===1?'1 artigo':inv.length+' artigos']);
  if(ch.length){const n=sum(ch.map(k=>Number(k.qty)||1));t.push(['chaves','Chaves entregues',(ch.length===1?'1 tipo':ch.length+' tipos')+' · '+(n===1?'1 chave':n+' chaves')])}
  if(fotos.length)t.push(['fotos','Registo fotográfico',fotos.length===1?'1 foto do imóvel':fotos.length+' fotos do imóvel']);
  if(files.length)t.push(['anexos','Anexos',files.length===1?'1 ficheiro':files.length+' ficheiros']);
  return t.length?`<div class="ct-minis">${t.map(([k,r,v])=>`<button type="button" class="ct-mini" data-toca="camada" data-click="ctVerAnexos('${jsq(c.id)}','${k}')"><span class="small">${r}</span><b>${esc(v)}</b></button>`).join('')}</div>`:'';
}
/* A lista de um dos mosaicos da ficha, numa janela por cima: os artigos do
   inventário com a quantidade e o estado, as chaves, as fotos escolhidas do
   imóvel (pintadas depois de abrir) ou os anexos (tocar abre o ficheiro).
   Recebe: id — o id do contrato; qual — 'inv', 'chaves', 'fotos' ou 'anexos'.
   Devolve: nada — abre a janela. */
function ctVerAnexos(id,qual){
  const c=contract(id);if(!c)return;
  const p=prop(c.propertyId),vf=pode(c.propertyId,'file.view');
  const fotos=vf?((p&&p.photos)||[]).filter(f=>(c.photoIds||[]).indexOf(f.id)>-1):[];
  let titulo='',corpo='';
  if(qual==='inv'){titulo='Inventário';corpo=(c.inventory||[]).map(i=>ctKv((i.qty||1)+'× '+(i.name||'artigo'),i.state==='novo'?'Novo':'Usado')).join('')}
  else if(qual==='chaves'){titulo='Chaves entregues';corpo=(c.keys||[]).map(k=>ctKv(k.name||'chave',String(k.qty||1))).join('')}
  else if(qual==='fotos'){titulo='Registo fotográfico';corpo=`<div class="ct-fotos">${fotos.map(f=>`<figure class="ct-foto"><div class="pcover ct-foto-img" id="th_${esc(f.id)}"></div><figcaption class="small">${esc(f.name||'Fotografia')}</figcaption></figure>`).join('')}</div>`}
  else if(qual==='anexos'&&vf){titulo='Anexos';corpo=(c.files||[]).map(f=>`<button type="button" class="ct-anexo" data-toca="camada" data-click="openMeta('${jsq(f.id)}')">${ic('clip',18)}<span>${esc(f.name||'ficheiro')}</span>${ic('chevR',16)}</button>`).join('')}
  if(!corpo)return;
  openModal(titulo,`<div class="ct-lista-anexos">${corpo}</div>`,`<button type="button" class="btn primary" data-toca="camada" data-click="closeModal()">Fechar</button>`);
  if(qual==='fotos')paintThumbs(fotos);
}
/* A ficha de um contrato: o que tocar num contrato passa a abrir.

   Era um formulário de quarenta campos, com o «Apagar contrato» encostado ao
   título. Agora tocar lê, e editar é um passo — o «Editar» do rodapé, só para
   quem pode (acessos.js:podeEditar) — e as ações que não são ler nem editar
   (registar a renda, o PDF, renovar, terminar, apagar) ficam no menu do
   cabeçalho, que é onde vivem as opções de um registo. No computador a janela
   alarga e os cartões vão em duas colunas (estilos.css, «redesign: 1.3.3»).
   Recebe: id — o id do contrato.
   Devolve: nada — abre a janela. */
function ctView(id){
  const c=contract(id);if(!c)return;
  const pid=c.propertyId,ok=podeEditar(pid,'contract.add',c);
  abrirFicha({
    titulo:()=>{const x=contract(id);return x?ctName(x):'Contrato'},
    corpo:()=>ctFicha(id),
    menu:()=>{
      const it=[];
      /* registar a renda é dos Movimentos: com o serviço desligado nesta conta o
         atalho não aparece — o menu fica com o que é do contrato */
      if(servicoLigado('transactions')&&isActive(c)&&pode(pid,'tx.add'))it.push({label:'Registar renda',icon:'up',toca:'camada',act:`ctRegistarRenda('${jsq(pid)}','${jsq(id)}')`});
      if(ctRecebimentoPossivel(c))it.push({label:'Registar recebimento',icon:'up',toca:'camada',act:`ctRegistarRecebimento('${jsq(pid)}','${jsq(id)}')`});
      it.push({label:'Gerar contrato em PDF',icon:'down',toca:'camada',act:`ctPdfJanela('${jsq(id)}')`});
      /* renovar regista a renovação (fisco.renovacoes) e leva o fim para a
         frente — mudar só a data de fim perdia o histórico que o 4.2A pede */
      if(ok&&c.end&&c.active!==false)it.push({label:'Renovar…',icon:'cal',toca:'camada',act:`ctRenovar('${jsq(id)}')`});
      if(ok)it.push(...ctTerminarOuReativar(c),
        {label:'Apagar contrato',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delContract('${jsq(id)}')`});
      return it.length?menu('fichaCt',it):'';
    },
    editar:ok?{rotulo:'Editar',act:`ctModal('${jsq(id)}')`}:null,
  });
}
/* O item do menu de um contrato entre Terminar e Reativar. Terminado
   (active false): «Reativar contrato». Em vigor — também com o termo
   passado, que a ficha diz terminado mas que continua (renovou-se sem
   registo: «Renovar…», ou «Terminar» com o dia em que acabou): «Terminar
   contrato». Por começar, nenhum: não há dia em que tenha acabado, e
   apaga-se. Nenhum dos dois mexe no termo (c.end).
   Serve o menu ⋯ (act, a ação em texto) e o toque longo da lista (fn, a
   mesma ação como função — lista-contratos.js:lpContrato).
   Recebe: c — o contrato.
   Devolve: [] ou [o item do menu: {label, icon, toca, act, fn}]. */
function ctTerminarOuReativar(c){
  if(!c)return [];
  const id=jsq(c.id),cid=c.id;
  if(c.active===false)return [{label:'Reativar contrato',icon:'check',toca:'camada',act:`reactivateContract('${id}')`,fn:()=>reactivateContract(cid)}];
  if(c.start&&c.start>today())return [];
  return [{label:'Terminar contrato',icon:'x',toca:'camada',act:`endContract('${id}')`,fn:()=>endContract(cid)}];
}
/* O «Registar renda» do menu da ficha: abre o formulário do movimento já como
   renda deste contrato. Era um onclick com txModal({…}), e um objeto literal
   fica fora da gramática das ações — a ação passa a chamar isto, com os dois
   ids em texto. Não devolve nada, como o onclick não devolvia.
   Recebe: pid — o id do imóvel; ctId — o id do contrato.
   Devolve: nada — abre o formulário do movimento. */
function ctRegistarRenda(pid,ctId){
  txModal({kind:'income',propId:pid,ctId:ctId});
}
/* Há onde registar, ligado a este contrato, o que entra depois de ele
   acabar — a renda em atraso, a indemnização pela ocupação, o que o seguro de
   renda paga (CIRS art. 8.º n.º 1 e n.º 2 g))? Num contrato terminado
   (registos.js:ctEstado: desligado, ou com o termo passado sem renovação
   registada), com os Movimentos ligados nesta conta e a quem pode adicionar
   movimentos no imóvel.
   Recebe: c — o contrato.
   Devolve: true ou false. */
function ctRecebimentoPossivel(c){
  return !!c&&ctEstado(c)==='terminado'&&servicoLigado('transactions')&&pode(c.propertyId,'tx.add');
}
/* O «Registar recebimento» da ficha (e do ⋯) de um contrato terminado: abre
   o formulário de uma receita nova já ligada a este contrato e ao imóvel
   dele, como o «Registar renda» de um em vigor — o formulário mantém o
   contrato terminado no seletor e sugere a categoria (movimento.js:txModal).
   Recebe: pid — o id do imóvel; ctId — o id do contrato.
   Devolve: nada — abre o formulário do movimento. */
function ctRegistarRecebimento(pid,ctId){
  txModal({kind:'income',propId:pid,ctId:ctId});
}

/* Abre o modal de criar/editar contrato. Sem id é um contrato novo; pid
   pré-escolhe o imóvel (só se for de investimento, senão cai no primeiro
   arrendável). Trabalha sobre uma cópia em cForm — nada toca na base até
   o guardar. Recusa abrir se não houver imóveis de arrendamento.
   Recebe: id (opcional) — id do contrato a editar; sem ele cria um novo;
   pid (opcional) — id do imóvel a pré-escolher no contrato novo; tid
   (opcional) — id do inquilino que entra logo no contrato novo (o «Novo
   contrato» do menu de uma pessoa).
   Devolve: nada — abre o modal do contrato. */
function ctModal(id,pid,tid){
  foldState={};_ctAbertas={};
  /* Quem não pode alterar recebe a FICHA, e não este formulário com os campos
     apagados. E antes do openModal: não se decora uma janela já aberta,
     escolhe-se qual é a janela a abrir. */
  const _c=id?contract(id):null;
  if(_c&&!podeEditar(_c.propertyId,'contract.add',_c))return ctView(id);
  if(!db.properties.length)return toast('Cria primeiro um imóvel.');
  /* só onde posso adicionar contratos: os meus imóveis e os de colaboração
     com o cargo certo — e nunca um vendido (D33: sai das listas do dia a dia) */
  const rentables=casasComo('contract.add').filter(p=>p.use==='investimento'&&!imovelVendido(p));
  if(!id&&!rentables.length){
    const inv=db.properties.filter(p=>p.use==='investimento');
    return toast(!inv.length?'Nenhum imóvel de arrendamento. Muda o uso na ficha do imóvel para criar contratos.'
      :inv.every(p=>imovelVendido(p))?'Os imóveis de arrendamento foram todos vendidos: não há onde adicionar um contrato.':fraseSemPerm('contract.add'));
  }
  cForm=normContract(id?JSON.parse(JSON.stringify(contract(id))):{propertyId:(pid&&(prop(pid)||{}).use==='investimento'&&!imovelVendido(prop(pid))&&pode(pid,'contract.add')?pid:rentables[0].id),start:today(),
    tenantIds:tid&&tenant(tid)?[tid]:[]});
  /* num imóvel por quartos com quartos arrendados, o contrato novo abre no
     primeiro quarto livre — o «Imóvel inteiro» só a partir do último fim
     (ctEscolhaPorOmissao); quem veio de um quarto escolhe-o a seguir
     (imovel.js:contratoNoQuarto) */
  if(!id)ctEscolhaPorOmissao(cForm);
  if(!id)fillOwnerContact();
  if(!id&&tid&&tenant(tid))fillTenantContact(tid);
  if(id)ctReconheceContactos();
  const ok=!!id&&podeEditar(cForm.propertyId,'contract.add',contract(id));
  const m=id?menu('ct',[{label:'Gerar contrato em PDF',icon:'down',toca:'camada',act:`ctPdfJanela('${jsq(id)}')`}].concat(ok?
    ctTerminarOuReativar(contract(id)).concat([
    {label:'Apagar contrato',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delContract('${jsq(id)}')`}]):[])):'';
  openModal(id?'Editar contrato':'Novo contrato',ctBody(),null,m);
  const p=prop(cForm.propertyId);if(p)paintThumbs(p.photos);
  onSave=ctSaver();
}
/* Os movimentos confirmados que caem FORA das datas do contrato.

   De um lado e do outro: antes do início e depois do fim. São factos — o
   dinheiro entrou naquele dia — e por isso não se mexem nem se movem com o
   contrato; o que a app faz é dizer que deixaram de bater certo, para alguém
   olhar para eles um a um.
   Recebe: c — o contrato.
   Devolve: os movimentos fora da janela, por ordem de data. */
function movimentosForaDoContrato(c){
  if(!c||!c.id)return [];
  return (db.transactions||[]).filter(t=>t.contractId===c.id&&
    ((c.start&&t.date<c.start)||(c.end&&t.date>c.end)))
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
/* Mostra-os, um a um, para se poder abrir cada um e decidir.
   Recebe: id — o id do contrato.
   Devolve: nada — abre a lista de escolha. */
function verMovimentosFora(id){
  const c=contract(id);if(!c)return;
  const fora=movimentosForaDoContrato(c);
  if(!fora.length)return;
  pickModal('Fora das datas do contrato',fora.map(t=>({v:t.id,
    label:(t.label||'Movimento')+' · '+euro2(t.amount),
    sub:dPT(t.date)+' · '+(c.start&&t.date<c.start?'antes do início ('+dPT(c.start)+')':'depois do fim ('+dPT(c.end)+')'),
    icon:'swap'})),o=>{closeModal();chamarServico('transactions','txView',o.v)},
    `<div class="hint u-mt-12px">As datas destes movimentos não se mexem: dizem quando o dinheiro entrou. Abre cada um para corrigir o que for preciso.</div>`);
}
/* Devolve o handler que o modal usa ao guardar: valida imóvel, quarto (a
   casa inteira e um quarto arrendado só com o início no dia do fim dos
   contratos deles, ou depois — ctEscolhaInvalida), renda,
   inquilinos e datas (o início é obrigatório, e nunca antes da compra da
   casa: ctInicioAntesDaCompra; o dia em que acabou, num terminado, pelas
   regras da folha do «Terminar»: ctCessacaoErro) e grava (ctGravarOuCessar).
   O erro diz-se junto do campo (componentes.js:falhaCampo), que também o
   anuncia. Num contrato que já tinha fim e o vê ir para a frente, pergunta
   primeiro se é uma renovação ou uma correção da data (ctFimPergunta) — a
   renovação fica no histórico; e quando o fim recua até hoje num contrato
   que teve redução, se é uma correção ou se acabou antes do prazo
   (ctFimCurtoPergunta) — o termo não se escreve por cima.
   Recebe: nada.
   Devolve: a função de guardar (sem argumentos), pronta a pôr em onSave. */
function ctSaver(){
  return ()=>{
    collectCt();
    if(!cForm.propertyId)return falhaCampo('c_prop','Escolhe o imóvel.');
    const recusa=motivoRecusa(cForm.propertyId,'contract.add',contract(cForm.id));if(recusa)return toast(recusa);
    /* a casa toda e um quarto arrendado só a partir do fim dos contratos
       deles (ctEscolhaInvalida); sem escolha possível, o formulário já disse
       porquê e o erro repete-o */
    const erroQuarto=ctEscolhaInvalida(cForm);
    if(erroQuarto){
      falhaCampo('c_roomEsc',erroQuarto);_ctErroQuarto=erroQuarto;
      /* o grupo não toma o foco: quem vai pelo teclado fica no primeiro quarto livre */
      const livre=document.querySelector('.ct-quartos [role="radio"]:not(:disabled):not([aria-disabled="true"])');if(livre)try{livre.focus({preventScroll:true})}catch(x){}
      return;
    }
    if(!(cForm.rent>0))return falhaCampo('c_rent','Indica a renda mensal.');
    if(!cForm.tenantIds.length)return falhaCampo('c_tenants','Escolhe pelo menos um inquilino.');
    /* o início é obrigatório (D43): o Anexo F pede-o em cada linha, e sem ele
       os gastos do ano ficam todos fora do período arrendado */
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(cForm.start||'')))return falhaCampo('c_start','Indica o início do contrato.');
    /* um fim antes do início guardava sem aviso e o contrato sumia das
       rendas e projeções, sem sinal nenhum do porquê */
    const antes=contract(cForm.id),fimAntes=antes&&antes.end;
    /* nem antes da compra da casa (a do quarto, num contrato de um quarto):
       só quando o início é novo ou mudou, ou a casa mudou — um contrato
       antigo que já estava antes continua a gravar-se. Pela ordem do
       formulário: o início vem antes do fim */
    const compra=ctInicioAntesDaCompra(cForm,antes);
    if(compra)return falhaCampo('c_start','O imóvel foi comprado a '+compra+': o contrato não pode começar antes.');
    if(cForm.start&&cForm.end&&cForm.end<cForm.start)return falhaCampo('c_end','O fim do contrato é antes do início — verifica as datas.');
    /* o dia em que acabou, escrito no formulário de um contrato terminado,
       segue as regras da folha do «Terminar» (o motivo aqui não se exige:
       um contrato terminado antes dele continua a gravar-se) */
    const ces=irsCessacao(cForm);
    if(cForm.active===false&&ces.data){const e=ctCessacaoErro(cForm,ces.data,ces.motivo,false);if(e)return falhaCampo(e.id,e.msg)}
    /* o bloco fiscal: o dia do envio ao IHRU com as regras do «Marcar como
       enviado» (prazos.js:pzMarcarIhru), só com a pergunta à vista; e o que
       se paga à parte nunca negativo */
    const ef=ctFiscoErro(cForm);if(ef)return falhaCampo(ef.id,ef.msg);
    /* só quando o fim vai para a frente (uma renovação nunca o encurta) e a
       renovação ainda não foi escrita à mão nas renovações */
    if(fimAntes&&cForm.end&&cForm.end>fimAntes&&!(fiscoDe(cForm).renovacoes||[]).some(r=>r.inicio===pzAddDias(fimAntes,1)))
      return ctFimPergunta(fimAntes);
    /* o fim que recua até hoje, num contrato que teve redução pela duração
       e ainda não tem a cessação: correção da data, ou acabou antes do prazo?
       (D10, D39 — o termo decide o escalão, e encurtá-lo tirava a redução
       também aos anos já entregues) */
    if(fimAntes&&cForm.end&&cForm.end<fimAntes&&cForm.end<=today()&&!ces.data&&ctTeveReducao(antes))
      return ctFimCurtoPergunta(fimAntes);
    ctGravarOuCessar();
  };
}
/* Os erros do bloco fiscal do formulário, pela ordem dos campos: o dia do
   envio ao IHRU (só quando a isenção escolhida o pede — ctIsencaoPede), nunca
   depois de hoje nem antes da celebração (ou do início, sem ela), como o
   «Marcar como enviado» do aviso; o que se paga à parte e o imposto pago no
   estrangeiro (os anos à vista, ctAnosImpostoEstrangeiro), nunca negativos.
   Recebe: c — o contrato do formulário (cForm, já recolhido).
   Devolve: null, ou {id, msg} — o campo e a frase do erro. */
function ctFiscoErro(c){
  const f=fiscoDe(c);
  if(f.estado!=='declarado')return null;
  if(ctIsencaoPede(c,'ihru')&&f.ihru){
    if(f.ihru>today())return {id:'c_fihru',msg:'O dia do envio não pode ser depois de hoje.'};
    const cel=f.celebracao||c.start||'';
    if(cel&&f.ihru<cel)return {id:'c_fihru',msg:'O dia do envio não pode ser antes da celebração ('+dPT(cel)+').'};
  }
  if(document.getElementById('c_fextras')&&ctAberto('c_fextrasQ')&&num(val('c_fextras'))<0)return {id:'c_fextras',msg:'O que se paga à parte não pode ser negativo.'};
  for(const a of ctAnosImpostoEstrangeiro(c)){
    if(document.getElementById('c_fie_'+a)&&num(val('c_fie_'+a))<0)return {id:'c_fie_'+a,msg:'O imposto pago não pode ser negativo.'};
  }
  return null;
}
/* O contrato teve redução da taxa pela duração em algum período (o inicial
   ou uma renovação — irs.js:irsPrazosDeComunicacao)?
   Recebe: c — o contrato (pode faltar).
   Devolve: true ou false. */
function ctTeveReducao(c){
  return !!c&&irsPrazosDeComunicacao(c).length>0;
}
/* O último passo do guardar, depois das perguntas do fim: um contrato que se
   desliga em «Contrato em vigor» sem o dia em que acabou pede-o, com o
   motivo, na folha do «Terminar» (ctTerminarFolha, que grava a seguir) — um
   por começar não, que não acabou dia nenhum; um terminado que se volta a
   ligar perde a cessação (como no «Reativar»); e grava.
   Devolve: nada — abre a folha ou grava (ctGravar). */
function ctGravarOuCessar(){
  const antes=contract(cForm.id),ces=irsCessacao(cForm);
  if(cForm.active===false&&!ces.data&&(!antes||antes.active!==false)&&!(cForm.start&&cForm.start>today()))
    return ctTerminarFolha(cForm,true);
  if(cForm.active!==false&&(ces.data||ces.motivo))cForm.fisco=normFisco(Object.assign({},fiscoDe(cForm),{cessacao:{data:'',motivo:''}}));
  ctGravar();
}
/* Pergunta, por cima do formulário, se o fim que recuou é uma correção da
   data ou o dia em que o contrato acabou antes do prazo. Na correção grava;
   no fim antes do prazo o termo volta ao que estava e o dia escrito passa à
   folha do «Terminar», com o motivo (ctFimCurtoResposta).
   Recebe: fimAntes — o fim que estava gravado ('AAAA-MM-DD').
   Devolve: nada — abre a pergunta. */
function ctFimCurtoPergunta(fimAntes){
  _ctFimAntes=fimAntes;
  openModal('Correção ou fim antes do prazo?',`<div class="hint u-fs-14px">O fim do contrato passa de ${dPT(fimAntes)} para ${dPT(cForm.end)}. Se só estás a corrigir uma data mal escrita, é uma correção. Se o contrato acabou antes do prazo, o fim fica ${dPT(fimAntes)} — é o prazo do contrato que decide a taxa reduzida, também nos anos já declarados — e ${dPT(cForm.end)} fica como o dia em que acabou, com o motivo.</div>`,
    `<button class="btn" data-toca="dados" data-click="ctFimCurtoResposta(0)">É uma correção</button><button class="btn primary" data-toca="camada" data-click="ctFimCurtoResposta(1)">Acabou antes do prazo</button>`);
}
/* A resposta à pergunta do fim que recuou: fecha-a; numa correção grava
   (ctGravarOuCessar); se acabou antes do prazo, devolve o termo e abre a
   folha do «Terminar» com o dia escrito.
   Recebe: cessou — 1 se acabou antes do prazo, 0 se é uma correção.
   Devolve: nada. */
function ctFimCurtoResposta(cessou){
  closeModal();
  const fim=_ctFimAntes;_ctFimAntes='';
  if(!Number(cessou)||!fim)return ctGravarOuCessar();
  const dia=cForm.end;cForm.end=fim;
  ctTerminarFolha(cForm,true,dia);
}
/* O início do contrato do formulário é antes da compra da casa? Só conta um
   início novo ou mudado (ou uma casa trocada): o contrato antigo que já
   estava antes da compra grava-se quando se mexe noutro campo.
   Recebe: c — o contrato do formulário (cForm); antes — o mesmo contrato
   como está na base (undefined num contrato novo).
   Devolve: a data de compra em DD/MM/AAAA quando o início é antes dela (a
   frase do erro leva-a), ou ''. */
function ctInicioAntesDaCompra(c,antes){
  if(!c||!c.start)return '';
  if(antes&&antes.start===c.start&&antes.propertyId===c.propertyId)return '';
  return antesDaCompra(c.propertyId,c.start);
}
/* o fim que estava gravado, enquanto a pergunta «renovação ou correção?»
   está aberta (ctFimPergunta → ctFimResposta) */
let _ctFimAntes='';
/* Pergunta, por cima do formulário, se a data de fim nova é uma renovação
   ou uma correção da data. As duas respostas gravam (ctFimResposta).
   Recebe: fimAntes — o fim que estava gravado ('AAAA-MM-DD').
   Devolve: nada — abre a pergunta. */
function ctFimPergunta(fimAntes){
  _ctFimAntes=fimAntes;
  openModal('Renovação ou correção?',`<div class="hint u-fs-14px">O fim do contrato passa de ${dPT(fimAntes)} para ${dPT(cForm.end)}. É uma renovação? Fica registada nas renovações (de ${dPT(pzAddDias(fimAntes,1))} a ${dPT(cForm.end)}), e o quadro 4.2A do Anexo F pede-a. Se só estás a corrigir uma data mal escrita, é uma correção.</div>`,
    `<button class="btn" data-toca="dados" data-click="ctFimResposta(0)">É uma correção</button><button class="btn primary" data-toca="dados" data-click="ctFimResposta(1)">É uma renovação</button>`);
}
/* A resposta à pergunta do fim: fecha-a, regista a renovação quando o é, e
   grava o contrato (pelo último passo do guardar, que ainda pede a cessação
   a um contrato que se desligou).
   Recebe: renov — 1 se é uma renovação, 0 se é uma correção da data.
   Devolve: nada — grava (ctGravarOuCessar). */
function ctFimResposta(renov){
  closeModal();
  if(Number(renov)&&_ctFimAntes)ctJuntaRenovacao(cForm,pzAddDias(_ctFimAntes,1),cForm.end);
  _ctFimAntes='';
  ctGravarOuCessar();
}
/* Uma renovação escrita à mão nas renovações, inteira (início e fim que
   existem, por ordem) e com o fim depois do termo, leva o termo (c.end) com
   ela — o que o «Renovar…» faz, e o que o dados.js:normContract faz aos
   contratos já gravados (D42). Sem termo, nada: um contrato sem fim não
   ganha um.
   Recebe: c — o contrato (o do formulário).
   Devolve: nada — muda c.end. */
function ctFimPelasRenovacoes(c){
  if(!c||!dataExiste(c.end))return;
  (fiscoDe(c).renovacoes||[]).forEach(r=>{
    if(r&&dataExiste(r.inicio)&&dataExiste(r.fim)&&r.inicio<=r.fim&&r.fim>c.end)c.end=r.fim});
}
/* Acrescenta uma renovação às do bloco fiscal, sem mexer no fim do contrato.
   Recebe: c — o contrato (o do formulário ou o da base); inicio, fim — 'AAAA-MM-DD'.
   Devolve: nada — muda c.fisco. */
function ctJuntaRenovacao(c,inicio,fim){
  const f=fiscoDe(c);
  if((f.renovacoes||[]).some(r=>r.inicio===inicio))return;
  c.fisco=normFisco(Object.assign({},f,{renovacoes:(f.renovacoes||[]).concat([{id:uid(),inicio:inicio,fim:fim}])}));
}
/* Grava o contrato do formulário (cForm, já validado): insere-o ou substitui-o
   em db.contracts, sincroniza o movimento recorrente da renda, persiste,
   fecha o formulário e aponta os movimentos que ficaram fora das datas. Um
   contrato novo diz «Contrato adicionado.» com o «Ver» para a ficha dele
   (componentes.js:avisoComVer); o dos movimentos fora vem primeiro. Uma
   renovação escrita à mão que passa o fim leva o fim com ela
   (ctFimPelasRenovacoes, D42). Com rendas antecipadas ou caução novas (ou
   mudadas), propõe logo o registo do que se pagou na assinatura
   (ctAntecipadasProposta, D56).
   Devolve: nada. */
function ctGravar(){
  ctFimPelasRenovacoes(cForm);
  const i=db.contracts.findIndex(x=>x.id===cForm.id),cid=cForm.id,antes=i<0?null:db.contracts[i];
  /* o que se pagou na assinatura propõe-se num contrato novo, ou quando as
     antecipadas ou a caução mudaram — não em cada gravação */
  const propor=!antes||Number(antes.advance)!==Number(cForm.advance)||Number(antes.deposit)!==Number(cForm.deposit);
  if(i<0)db.contracts.push(cForm);else db.contracts[i]=cForm;
  /* a renda planeada é dos Planeados: desligados nesta conta, o servidor nem
     aceitava o registo — o contrato guarda-se na mesma, sem ela */
  if(servicoLigado('recurring'))syncContractRec(cForm);
  save();closeModal();buildNav();render();
  /* O que é previsão acompanha o contrato; o que é FACTO fica onde está. A
     data de um movimento diz que o dinheiro entrou naquele dia, e mudá-la
     era dizer que entrou noutro — muda a receita do ano, o IRS, o cashflow
     e as contas entre proprietários. A app aponta, e a pessoa decide. */
  const fora=movimentosForaDoContrato(cForm);
  if(fora.length)toast(fora.length===1?'1 movimento deste contrato está fora das datas dele.'
    :fora.length+' movimentos deste contrato estão fora das datas dele.',
    {rotulo:'Ver',ms:9000,fn:()=>verMovimentosFora(cForm.id)});
  else if(i>-1)toast('Contrato guardado.');
  else avisoComVer('Contrato adicionado.','contracts',()=>ctView(cid));
  if(propor)ctAntecipadasProposta(cid);
}
/* O que o inquilino pagou na assinatura e ainda não está registado (D56): as
   rendas antecipadas — uma por cada um dos primeiros meses do contrato
   (c.advance), com o mês a que respeita — e a caução, com o dia em que se
   pagaram: a celebração (fisco.celebracao); sem ela, o início, ou hoje se o
   contrato ainda não começou. Declaram-se no ano em que se recebem, com
   recibo (Ofício-Circulado 20256). Um mês que já tem renda deste contrato, ou
   uma caução já registada, não se propõe. Só com os Movimentos ligados e a
   quem pode adicionar movimentos no imóvel; um pagamento que seria depois de
   hoje não se propõe (ainda não se recebeu).
   Recebe: c — o contrato (o da base).
   Devolve: null, ou {data, itens:[{tipo:'renda'|'caucao', periodo, valor, rotulo}]}. */
function ctAntecipadasPorRegistar(c){
  if(!c||!servicoLigado('transactions')||!pode(c.propertyId,'tx.add'))return null;
  const ini=String(c.start||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(ini))return null;
  const f=fiscoDe(c),h=today(),data=f.celebracao||(ini>h?h:ini);
  if(!data||data>h)return null;
  const doCt=(db.transactions||[]).filter(t=>t&&t.contractId===c.id&&t.kind==='income');
  const papel=t=>irsReceitaDe(t).papel,itens=[];
  const n=Math.max(0,Math.min(36,Math.round(Number(c.advance)||0)));
  if(Number(c.rent)>0)for(let k=0;k<n;k++){
    const y=Number(ini.slice(0,4)),m0=Number(ini.slice(5,7))-1+k,mes=(y+Math.floor(m0/12))+'-'+String(m0%12+1).padStart(2,'0');
    if(doCt.some(t=>papel(t)==='renda'&&irsMesDaRenda(t)===mes))continue;
    itens.push({tipo:'renda',periodo:mes,valor:Number(c.rent),rotulo:'Renda de '+(MESES[m0%12]||'')+' de '+mes.slice(0,4)});
  }
  /* a caução só com a subcategoria dela (o id rendas/caucao): sem ela, ia às
     rendas sem se saber que é a caução */
  if(Number(c.deposit)>0&&ctCatDoId('rendas/caucao')&&!doCt.some(t=>papel(t)==='caucao'))
    itens.push({tipo:'caucao',periodo:'',valor:Number(c.deposit),rotulo:'Caução'});
  return itens.length?{data:data,itens:itens}:null;
}
/* A categoria e a subcategoria que a conta dá a um id do IRS (o nome pode ter
   mudado; o id não), só se ainda existem na árvore: dados.js:catDoIdIrs, nas
   receitas por omissão.
   Recebe: id — o id ('rendas', 'rendas/renda-mensal', 'rendas/caucao',
   'devolucoes/caucao'…); arvore (opcional) — 'catsIn' (omissão) ou 'cats'.
   Devolve: {category, sub}, ou null quando a conta não tem esse id. */
function ctCatDoId(id,arvore){return catDoIdIrs(arvore==='cats'?'cats':'catsIn',id)}
/* Propõe, por cima da lista, o registo do que se pagou na assinatura
   (ctAntecipadasPorRegistar): cada renda antecipada e a caução num
   interruptor (todos ligados; a linha inteira toca-se, com 44 px), e o dia
   em que se pagaram (a celebração, por omissão).
   Sem nada a registar não abre.
   Recebe: id — o id do contrato.
   Devolve: nada — abre a janela, ou nada. */
function ctAntecipadasProposta(id){
  const c=contract(id),p=ctAntecipadasPorRegistar(c);if(!p)return;
  const linhas=p.itens.map((x,k)=>ctInterruptor('c_antItem_'+k,true,x.rotulo,euro2(x.valor)+(x.tipo==='caucao'?', a caução do contrato':', paga à cabeça'))).join('');
  const temRendas=p.itens.some(x=>x.tipo==='renda');
  openModal('O que se pagou na assinatura',`<div class="form">
    <div class="hint">O que o inquilino pagou ao assinar declara-se no ano em que o recebeste, com recibo${temRendas?', e cada renda antecipada fica com o mês a que respeita':''}. Desmarca o que não recebeste.</div>
    ${linhas}
    <label>Pago a <span class="req">*</span><input id="c_antData" type="date" value="${esc(p.data)}" max="${esc(today())}"></label></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Agora não</button><button class="btn primary" data-toca="dados" data-click="ctAntecipadasOk('${jsq(id)}')">Registar</button>`);
}
/* Regista o que se marcou na janela do que se pagou na assinatura: cada
   renda com o dia escrito e o mês a que respeita (periodo), na categoria das
   Rendas (e Renda mensal) da conta; a caução na subcategoria dela. Com
   «Anular» (remove o que se registou).
   Recebe: id — o id do contrato.
   Devolve: nada. */
function ctAntecipadasOk(id){
  const c=contract(id),p=ctAntecipadasPorRegistar(c);if(!p)return closeModal();
  const dia=val('c_antData'),h=today();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))return falhaCampo('c_antData','Indica o dia em que se pagou.');
  if(dia>h)return falhaCampo('c_antData','O dia não pode ser depois de hoje.');
  const marcados=p.itens.filter((x,k)=>{const e=document.getElementById('c_antItem_'+k);return !e||e.checked});
  if(!marcados.length)return closeModal();
  const rendas=ctCatDoId('rendas'),mensal=ctCatDoId('rendas/renda-mensal'),caucao=ctCatDoId('rendas/caucao');
  const novos=marcados.map(x=>{
    const cat=x.tipo==='caucao'?caucao:(mensal||rendas||{category:'',sub:''});
    return normTx({kind:'income',label:(x.tipo==='caucao'?'Caução ':'Renda ')+ctName(c),amount:x.valor,date:dia,
      propertyId:c.propertyId,contractId:c.id,category:cat.category,sub:cat.sub,periodo:x.periodo,split:null});
  });
  novos.forEach(t=>db.transactions.push(t));
  const ids=novos.map(t=>t.id);
  closeModal();save();buildNav();render();
  comDesfazer(novos.length===1?'1 movimento registado.':novos.length+' movimentos registados.',()=>{
    db.transactions=db.transactions.filter(t=>ids.indexOf(t.id)<0);save();buildNav();render();
  });
}
/* HTML do formulário do contrato, montado a partir de cForm, como a prancheta
   M-NovoContrato: os campos em grupos (.sect) — o que se arrenda (o imóvel, o
   quarto em chips, os inquilinos e o nome), a renda (a líquida e, por baixo
   dela, o «Escrever outra taxa», que abre o imposto no mesmo sítio — a caixa
   da líquida não salta —; o dia do pagamento e o aumento), o prazo (as datas com a frase da duração e
   da oposição, a caução, as rendas antecipadas e o IBAN), a renda recorrente
   e o estado do contrato em interruptores (num terminado, com o dia em que
   acabou e o motivo — ctCessacaoCampos) com a situação perante a AT num
   segmentado, e os contactos —; recolhidos, o inventário, as fotos, as chaves
   e os anexos; e as notas. O obrigatório leva o asterisco vermelho e o erro
   diz-se junto do campo (ctSaver). Os ids são os de sempre, lidos pelo
   collectCt. Só devolve a string — é o ctModal/repaintCt que a põe no modal e
   pinta as miniaturas.
   Recebe: nada — lê o cForm.
   Devolve: string com o HTML do formulário do contrato. */
function ctBody(){
  const c=cForm,p=prop(c.propertyId),qs=ctQuartosEstado(c),rooms=qs.rooms;
  const tags=ctTenants(c).map(t=>({id:t.id,label:t.name}));
  const inv=c.inventory||[];
  const nSum=(c.keys||[]).length?sum(c.keys.map(k=>k.qty))+' chaves':'';
  const rec=servicoLigado('recurring');
  /* o nome, o imposto e o aumento em branco valem alguma coisa: o exemplo é
     esse valor, e a dica por baixo di-lo («Em branco: …») */
  const nomeVazio=(c.tenantIds||[]).length?ctPick(c):'';
  return `<div class="form ct-form">
    <div class="sect ct-gf" id="ct_arrenda">
      <label>Imóvel <span class="req">*</span>${sel('c_prop',c.propertyId,propOptsPara('contract.add',c.propertyId).filter(o=>{const x=prop(o.v);return x&&(x.id===c.propertyId||(x.use==='investimento'&&!imovelVendido(x)))}),'onCtProp','rascunho')}</label>
      ${rooms.length?ctQuartosHtml(c,qs)
       :(p&&p.use==='investimento'?`<div class="hint ct-colado">Este imóvel está definido como arrendado por inteiro. Para arrendar por quartos, muda isso na ficha do imóvel.</div>`:'')}
      <div class="ct-campo"><div class="flabel">Inquilinos <span class="req">*</span></div><div id="c_tenants">${tagField(tags,'Adicionar','addCtTenant()','delCtTenant','','camada')}</div></div>
      <label>Nome do contrato (opcional)<input id="c_name" value="${esc(c.name||'')}" placeholder="Ex: ${esc(nomeVazio||'Ana · T2 Lisboa')}" autocomplete="off"></label>
      <div class="hint ct-colado">É por este nome que o contrato aparece nos movimentos e nas listas. ${nomeVazio?`Em branco: «${esc(nomeVazio)}», o dos inquilinos.`:'Em branco, usa-se o nome dos inquilinos.'}</div>
    </div>
    <div class="sect ct-gf" id="ct_renda"><h3 class="ct-gf-tit">Renda</h3>
      <label>Renda mensal (€) <span class="req">*</span><input id="c_rent" type="text" inputmode="decimal" class="num" value="${c.rent||''}" placeholder="Ex: 450" data-input="liveNet()" autocomplete="off"></label>
      <div class="ct-net" id="netBox">${netBox()}</div>
      <div id="c_taxOutraBox"${ctTaxaVisivel(c)?' hidden':''}><button type="button" class="btn sm ct-abre" data-toca="rascunho" data-click="ctTaxaOutra()">Escrever outra taxa</button></div>
      <div id="c_taxBox"${ctTaxaVisivel(c)?'':' hidden'}><div class="form">
      <label>Imposto sobre a renda (%, opcional)<input id="c_tax" type="text" inputmode="decimal" class="num" value="${c.taxRate?dec(c.taxRate):''}" placeholder="Ex: ${dec(irsRate(c))}" data-input="liveNet()" autocomplete="off"></label>
      <div class="hint ct-colado" id="c_taxDica">${ctTaxaDica(c)}</div>
      <p class="hint ct-colado" id="c_taxAviso"${ctTaxaEscritaAviso(c)?'':' hidden'}><b>${esc(ctTaxaEscritaAviso(c))}</b></p></div></div>
      <div class="ct-campo"><span class="flabel" id="c_diasRot">A renda paga-se</span>
        <div class="ct-par ct-dias" role="group" aria-labelledby="c_diasRot">
          <label>entre o dia<input id="c_day" type="text" inputmode="numeric" class="num" value="${c.payDay||''}" placeholder="Opcional" autocomplete="off"></label>
          <label>e o dia<input id="c_dayTo" type="text" inputmode="numeric" class="num" value="${c.payDayTo||''}" placeholder="Opcional" autocomplete="off"></label></div>
        <div class="hint">Num mês que não tenha esse dia (o 31 em abril), conta o último dia do mês.</div></div>
      <label>Aumento anual (%, opcional)<input id="c_inc" type="text" inputmode="decimal" class="num" value="${c.increase==null?'':dec(c.increase)}" placeholder="Ex: ${dec(db.settings.growth)}" autocomplete="off"></label>
      <div class="hint ct-colado">Aumento em branco: ${dec(db.settings.growth)} % ao ano nas projeções (o das Definições), sem o aviso do aumento nos prazos.</div>
      ${ctEncargosCampos(c)}
    </div>
    <div class="sect ct-gf" id="ct_prazo"><h3 class="ct-gf-tit">Prazo</h3>
      <div class="ct-par">
        <label>Início <span class="req">*</span><input id="c_start" type="date" value="${c.start||''}" data-change="ctInicioMudou()"${minDaCompra(c.propertyId,c.start)}></label>
        <label>Fim<input id="c_end" type="date" value="${c.end||''}" data-change="liveNet()"></label></div>
      <p class="hint ct-colado" id="c_prazoFrase">${esc(ctFraseDoPrazo(c))}</p>
      <div class="ct-par">
        <label>Caução (€)<input id="c_dep" type="text" inputmode="decimal" class="num" value="${c.deposit||''}" placeholder="Opcional" autocomplete="off"></label>
        <label>Rendas antecipadas (meses)<input id="c_adv" type="text" inputmode="numeric" class="num" value="${c.advance||''}" placeholder="Opcional" autocomplete="off"></label></div>
      ${rec?`<div class="hint ct-colado">Com rendas antecipadas, a renda recorrente arranca depois dos meses pagos à cabeça.</div>`:''}
      <label>IBAN para pagamento das rendas (opcional)<input id="c_iban" value="${esc(c.iban)}" placeholder="Ex: PT50 0002 0123 1234 5678 9015 4" autocomplete="off"></label>
    </div>
    <div class="sect ct-gf" id="ct_fisco">
      ${rec?ctInterruptor('c_autorec',c.autoRec!==false,'Criar movimento recorrente da renda','Todos os meses a renda fica por confirmar em Planeados.'):''}
      ${ctInterruptor('c_active',c.active!==false,'Contrato em vigor','Desligado, o contrato deixa de contar para as rendas e as projeções.')}
      ${c.active===false?ctCessacaoCampos(c):''}
      ${fiscoSect()}
    </div>
    <div class="sect ct-gf" id="ct_contactos"><h3 class="ct-gf-tit">Contactos</h3>
      ${contactSect('owner',c,p)}${contactSect('tenant',c,p)}
    </div>
    ${fold('inv','Inventário',`
      ${inv.length?`<div class="form u-g-7px">
        <label class="check u-mb-2px"><input type="checkbox" id="inv_all" data-change="invToggleAll()"> Selecionar todos</label>
        ${inv.map(it=>`<div class="invrow">
          <input type="checkbox" class="i-c" id="invc_${it.id}" aria-label="Selecionar ${esc(it.name||'artigo')}">
          <input class="i-n" id="invn_${it.id}" value="${esc(it.name)}" placeholder="Ex: Sofá" aria-label="Artigo">
          <input class="i-q" id="invq_${it.id}" type="text" inputmode="numeric" value="${it.qty}" placeholder="Ex: 1" aria-label="Quantidade" autocomplete="off">
          <span class="i-s">${sel('invs_'+it.id,it.state,[{v:'novo',label:'Novo'},{v:'usado',label:'Usado'}],'','rascunho')}</span>
          <button type="button" class="btn sm danger so-icone" aria-label="Remover ${esc(it.name||'artigo')}" data-toca="rascunho" data-click="delInv('${it.id}')">${ic('trash',14)}</button></div>`).join('')}
        <div class="toolbar u-m-4px-0-0"><button type="button" class="btn sm danger" data-toca="rascunho" data-click="delInvSelected()">Remover selecionados</button></div>
      </div>`:`<div class="hint">Ainda sem artigos: o anexo I do contrato em PDF diz «sem elementos registados».</div>`}
      <div class="toolbar u-m-0">
        <button type="button" class="btn sm" data-toca="rascunho" data-click="addInv()">${ic('plus',14)} Adicionar artigo</button>
        <button type="button" class="btn sm" data-toca="camada" data-click="addInvBulk()">Adicionar vários</button></div>`,
      {icon:'box',summary:inv.length?inv.length+(inv.length===1?' artigo':' artigos'):''})}
    ${fold('photos','Registo fotográfico',`
      ${(p&&(p.photos||[]).length)?`
        <div class="hint u-m-n4px-0-0">Escolhe quais das fotos do imóvel entram neste contrato.</div>
        <div class="thumbs">${p.photos.map(f=>{const on=(c.photoIds||[]).indexOf(f.id)>-1;
          return `<div class="thumb ${on?'u-bc-v-accent u-bw-2px':'u-op-055'}" role="checkbox" aria-checked="${on?'true':'false'}" data-toca="rascunho" data-click="togCtPhoto('${f.id}')">
            <div id="th_${f.id}" class="u-h-76px u-bg-v-chip"></div>
            <div class="nm">${on?ic('check',13)+' ':''}${esc(f.name||'sem nome')}</div></div>`}).join('')}</div>
        <div class="toolbar u-m-11px-0-0">
          <button type="button" class="btn sm" data-toca="rascunho" data-click="allCtPhotos(1)">Selecionar todas</button>
          <button type="button" class="btn sm" data-toca="rascunho" data-click="allCtPhotos(0)">Nenhuma</button></div>`
        :`<div class="hint">Este imóvel ainda não tem fotos. Adiciona-as na ficha do imóvel.</div>`}`,
      {icon:'photo',summary:`${(c.photoIds||[]).length} de ${(p&&p.photos||[]).length}`})}
    ${fold('keys','Chaves entregues',`
      ${(c.keys||[]).length?`<div class="form u-g-7px">
        <label class="check u-mb-2px"><input type="checkbox" id="key_all" data-change="keyToggleAll()"> Selecionar todos</label>
        ${c.keys.map(k=>`<div class="invrow u-gtc-auto-1fr-62px-auto">
          <input type="checkbox" id="keyc_${k.id}" aria-label="Selecionar ${esc(k.name||'chave')}">
          <input class="i-n" id="keyn_${k.id}" value="${esc(k.name)}" placeholder="Ex: Chave de casa" aria-label="Tipo de chave">
          <input class="i-q" id="keyq_${k.id}" type="text" inputmode="numeric" value="${k.qty}" placeholder="Ex: 1" aria-label="Quantidade" autocomplete="off">
          <button type="button" class="btn sm danger so-icone" aria-label="Remover ${esc(k.name||'chave')}" data-toca="rascunho" data-click="delKey('${k.id}')">${ic('trash',14)}</button></div>`).join('')}
        <div class="toolbar u-m-4px-0-0"><button type="button" class="btn sm danger" data-toca="rascunho" data-click="delKeySelected()">Remover selecionadas</button></div>
      </div>`:`<div class="hint">Ainda sem chaves: o auto de entrega do contrato em PDF diz «sem elementos registados».</div>`}
      <div class="toolbar u-m-0">
        <button type="button" class="btn sm" data-toca="rascunho" data-click="addKey()">${ic('plus',14)} Adicionar tipo de chave</button>
        <button type="button" class="btn sm" data-toca="camada" data-click="addKeyBulk()">Adicionar várias</button></div>`,
      {icon:'key',summary:nSum})}
    ${fold('files','Anexos',fileBlock('',c.files||[],'c_filein','ctAddFiles','ctDelFile',{hint:'PDF do contrato assinado, recibos, comunicações. Ficam no dispositivo e não entram na cópia em JSON.'}),
      {icon:'clip',summary:(c.files||[]).length?c.files.length+' anexo'+(c.files.length===1?'':'s'):''})}
    <div class="sect ct-gf" id="ct_notas">${richEditor('Notas','c_notes',c.notes,'Opcional')}</div>
  </div>`;
}
/* Os quartos do imóvel do contrato, vistos deste contrato: todos, os que já
   têm OUTRO contrato vivo (ctVivo — um quarto prometido para 2028 já está
   prometido; o próprio contrato não conta), os livres, e quando é que cada
   arrendado fica livre: o fim do contrato dele (ctFimEfetivo, com as
   renovações escritas à mão); com dois contratos vivos no mesmo quarto, o
   que acaba mais tarde; um contrato sem data de fim deixa-o sem data. Um
   imóvel inteiro ou sem quartos devolve listas vazias.
   Recebe: c — o contrato (o do formulário, com propertyId e id).
   Devolve: {rooms, ocupados, livres, fins, semFim, ultimoFim} — os quartos
   (objetos); os ids dos arrendados e dos livres, pela ordem da ficha do
   imóvel; o fim de cada arrendado por id ('AAAA-MM-DD', '' sem fim); os
   arrendados sem fim; e o fim mais tarde de todos ('' se algum não tem fim,
   ou sem arrendados). */
function ctQuartosEstado(c){
  const p=prop(c.propertyId),rooms=(p&&p.rentalMode==='quartos')?(p.rooms||[]):[];
  const fins={},tem=id=>Object.prototype.hasOwnProperty.call(fins,id);
  db.contracts.filter(x=>x.id!==c.id&&x.propertyId===c.propertyId&&x.roomId&&ctVivo(x)).forEach(x=>{
    const f=ctFimEfetivo(x),antes=tem(x.roomId)?fins[x.roomId]:null;
    fins[x.roomId]=antes===''||!f?'':(antes&&antes>f?antes:f);
  });
  const ocupados=rooms.filter(r=>tem(r.id)).map(r=>r.id);
  const semFim=ocupados.filter(id=>!fins[id]);
  return {rooms,ocupados,livres:rooms.filter(r=>!tem(r.id)).map(r=>r.id),fins,semFim,
    ultimoFim:semFim.length?'':ocupados.reduce((m,id)=>fins[id]>m?fins[id]:m,'')};
}
/* A data de início que as escolhas do quarto olham: a do contrato, ou hoje
   enquanto o campo está vazio (um contrato sem início começa, para isto,
   no dia em que se escreve).
   Recebe: c — o contrato do formulário.
   Devolve: 'AAAA-MM-DD'. */
function ctInicioDe(c){
  const s=String((c&&c.start)||'');
  return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:today();
}
/* Um contrato que já estava gravado como do imóvel inteiro: abre e grava
   como estava, mesmo que entretanto haja quartos arrendados — não se tranca
   a edição de um contrato antigo por causa dos que vieram depois.
   Recebe: c — o contrato do formulário.
   Devolve: true se está na base e sem quarto. */
function ctInteiroGravado(c){
  const g=c&&c.id?contract(c.id):null;
  return !!g&&!g.roomId;
}
/* O «Imóvel inteiro» escolhe-se? Num imóvel por quartos com quartos
   arrendados, só se o contrato começar no dia do último fim dos contratos
   deles, ou depois (o fim mais tarde — ctQuartosEstado:ultimoFim); um
   arrendado sem data de fim bloqueia-o. Sem arrendados, sempre; e o
   contrato gravado assim continua como estava (ctInteiroGravado).
   Recebe: c — o contrato do formulário; qs (opcional) — o ctQuartosEstado(c), já feito.
   Devolve: true se o contrato pode ser do imóvel inteiro. */
function ctInteiroPossivel(c,qs){
  const q=qs||ctQuartosEstado(c);
  return !q.ocupados.length||ctInteiroGravado(c)||(!!q.ultimoFim&&ctInicioDe(c)>=q.ultimoFim);
}
/* Um quarto escolhe-se? Livre, sempre. Arrendado, só se o contrato começar
   no dia do fim do contrato desse quarto, ou depois; sem data de fim, não.
   O quarto que o próprio contrato já tinha gravado escolhe-se sempre (não se
   tranca a edição de um contrato antigo).
   Recebe: c — o contrato do formulário; qs — o ctQuartosEstado(c) (ou nada); rid — o id do quarto.
   Devolve: true se o quarto pode ser deste contrato. */
function ctQuartoPossivel(c,qs,rid){
  const q=qs||ctQuartosEstado(c);
  if(q.ocupados.indexOf(rid)<0)return true;
  const g=c&&c.id?contract(c.id):null;
  if(g&&g.roomId===rid)return true;
  return !!q.fins[rid]&&ctInicioDe(c)>=q.fins[rid];
}
/* O quarto com que um contrato abre, para o início que ele tem: sem
   quartos arrendados — ou com o início depois de todos acabarem — nenhum (o
   imóvel inteiro, como sempre); senão o primeiro livre, pela ordem da
   ficha; sem livres, o primeiro arrendado que já acabou nesse início.
   Nenhum também quando nada se escolhe nesse início (ctEscolhaPorOmissao
   decide o que fazer).
   Recebe: c — o contrato do formulário.
   Devolve: o id do quarto, ou null. */
function ctQuartoPorOmissao(c){
  const q=ctQuartosEstado(c);
  if(ctInteiroPossivel(c,q))return null;
  if(q.livres.length)return q.livres[0];
  return q.ocupados.find(id=>ctQuartoPossivel(c,q,id))||null;
}
/* Sem nada que se escolha no início que o contrato novo tem (todos os
   quartos arrendados): o primeiro quarto da lista (a ordem da ficha), com
   o início no dia em que o contrato dele acaba; se o primeiro não tiver
   data de fim, o seguinte que tenha. Sem nenhum com data, nada (o
   formulário diz que não há contrato possível). Decisão do Martinho
   (2026-10-20).
   Recebe: c — o contrato do formulário; q — o ctQuartosEstado(c).
   Devolve: {roomId, start}, ou null. */
function ctOmissaoSemLivres(c,q){
  const rid=q.ocupados.find(id=>q.fins[id]);
  return rid?{roomId:rid,start:q.fins[rid]}:null;
}
/* A escolha com que um contrato NOVO abre (ctModal) ou com que fica ao
   trocar de imóvel (onCtProp): o quarto por omissão no início que tem
   (ctQuartoPorOmissao); se nesse início nada se escolhe, o quarto e o
   início do ctOmissaoSemLivres — só num contrato que ainda não está na
   base: o início de um gravado não se mexe ao trocar de imóvel.
   Recebe: c — o contrato do formulário (muda-lhe o roomId e, se for
   preciso, o start).
   Devolve: nada. */
function ctEscolhaPorOmissao(c){
  c.roomId=ctQuartoPorOmissao(c);
  if(c.roomId||ctInteiroPossivel(c)||(c.id&&contract(c.id)))return;
  const o=ctOmissaoSemLivres(c,ctQuartosEstado(c));
  if(o){c.roomId=o.roomId;c.start=o.start}
}
/* O porquê de a escolha do quarto não valer para o início do contrato, na
   voz do erro (o ctSaver e o aviso junto dos chips, ctQuartosMiolo). Fora
   de um imóvel por quartos, nunca.
   Recebe: c — o contrato do formulário (roomId e start); qs (opcional) — o ctQuartosEstado(c).
   Devolve: o texto do erro, ou '' se a escolha vale. */
function ctEscolhaInvalida(c,qs){
  const q=qs||ctQuartosEstado(c),cur=c.roomId||'';
  if(!q.rooms.length)return '';
  if(cur){
    if(ctQuartoPossivel(c,q,cur))return '';
    return q.fins[cur]?'Com este início, o quarto escolhido ainda está arrendado: só a partir de '+dPT(q.fins[cur])+'.'
      :'O quarto escolhido está arrendado sem data de fim: escolhe outro quarto.';
  }
  if(ctInteiroPossivel(c,q))return '';
  if(ctNadaSeEscolhe(c,q))return q.semFim.length===q.ocupados.length&&!q.livres.length
    ?'Todos os quartos deste imóvel estão arrendados: não há contrato novo possível aqui.'
    :'Com este início, todos os quartos ainda estão arrendados: muda o início para o dia em que um contrato acaba.';
  return q.ultimoFim?'Com este início, a casa inteira ainda não está livre: só a partir de '+dPT(q.ultimoFim)+'.'
    :'A casa inteira não se escolhe enquanto houver um quarto arrendado sem data de fim: escolhe um quarto.';
}
/* Nada se escolhe para este início: nem a casa inteira, nem quarto nenhum.
   Recebe: c — o contrato do formulário; q — o ctQuartosEstado(c).
   Devolve: true se não há escolha possível. */
function ctNadaSeEscolhe(c,q){
  return !ctInteiroPossivel(c,q)&&!q.rooms.some(r=>ctQuartoPossivel(c,q,r.id));
}
/* A frase por baixo dos chips, num imóvel por quartos com quartos
   arrendados: a partir de quando a casa inteira fica livre (o último fim,
   ou nunca enquanto houver um arrendado sem data de fim), a regra dos
   quartos arrendados (a data de cada um vai no chip) e, sem escolha
   possível, porquê. Sem arrendados, ou num contrato gravado da casa
   inteira, nada.
   Recebe: c — o contrato do formulário; q — o ctQuartosEstado(c).
   Devolve: o texto (por escapar), ou ''. */
function ctQuartosFrase(c,q){
  if(!q.ocupados.length||ctInteiroGravado(c))return '';
  const nada=ctNadaSeEscolhe(c,q)&&!c.roomId;
  if(nada&&!q.livres.length&&q.semFim.length===q.ocupados.length)
    return 'Todos os quartos deste imóvel estão arrendados sem data de fim, por isso não há contrato novo possível aqui. Quando um contrato acabar, o quarto fica livre; ou adiciona um quarto na ficha do imóvel.';
  const partes=[];
  if(nada)partes.push('Com este início, todos os quartos ainda estão arrendados.');
  if(!ctInteiroPossivel(c,q))partes.push(q.ultimoFim
    ?'A casa inteira só a partir de '+dPT(q.ultimoFim)+(q.ocupados.length>1?', o fim do contrato mais longo.':', o fim do contrato do quarto arrendado.')
    :'A casa inteira não se escolhe enquanto houver um quarto arrendado sem data de fim.');
  const quartoEspera=q.ocupados.some(id=>q.fins[id]&&!ctQuartoPossivel(c,q,id));
  if(quartoEspera)partes.push('Um quarto arrendado escolhe-se com o início no dia em que o contrato dele acaba, ou depois.');
  if(quartoEspera||(!ctInteiroPossivel(c,q)&&q.ultimoFim))partes.push('Tocar numa escolha com data muda o início do contrato para esse dia.');
  return partes.join(' ');
}
/* O quarto do contrato, num imóvel arrendado por quartos: o campo inteiro,
   numa caixa que o ctInicioMudou reescreve por dentro (ctQuartosMiolo).
   Recebe: c — o contrato do formulário; qs — o ctQuartosEstado(c).
   Devolve: o HTML do campo. */
function ctQuartosHtml(c,qs){
  return `<div class="ct-campo" id="c_roomCampo">${ctQuartosMiolo(c,qs)}</div>`;
}
/* O miolo do campo do quarto: um chip por quarto (role radio) e «Imóvel
   inteiro» à cabeça. Com quartos arrendados, as escolhas dependem do
   INÍCIO do contrato: o «Imóvel inteiro» só a partir do último fim
   (ctInteiroPossivel) — à espera antes disso, e fora de vista enquanto um
   arrendado não tiver data de fim —, e um arrendado a partir do fim do dele
   (ctQuartoPossivel), com a data no chip («· livre a dd/mm/aaaa»; sem data
   de fim, «· já arrendado», desligado). Um chip à espera de uma data não é
   disabled: leva aria-disabled e o .ct-espera, e o toque muda o início para
   essa data e escolhe-o (ctComecaNoFim); o rótulo para o leitor de ecrã diz
   «livre a …, toca para começar nessa data». A escolha feita nunca se desliga: se o início
   a deixar de fora, fica escolhida e o erro diz-se por baixo, como o do
   ctSaver (ctEscolhaInvalida). A frase (ctQuartosFrase) diz as datas e, sem
   escolha possível, porquê; o grupo aponta-lhe.
   O valor vive num campo escondido (c_room), que o collectCt lê; o erro do
   ctSaver cai no grupo (c_roomEsc).
   Recebe: c — o contrato do formulário; qs — o ctQuartosEstado(c).
   Devolve: o HTML de dentro do campo. */
function ctQuartosMiolo(c,qs){
  const cur=c.roomId||'',inteiro=ctInteiroPossivel(c,qs),gravado=ctInteiroGravado(c);
  /* a casa inteira à vista quando se escolhe, ou quando só espera por uma
     data (nenhum arrendado sem fim); com um arrendado sem fim nunca se
     escolheria, e sai */
  const verInteiro=inteiro||!qs.semFim.length;
  const opcoes=(verInteiro?[{v:'',label:'Imóvel inteiro',pode:inteiro,
    fim:!gravado&&qs.ocupados.length?qs.ultimoFim:''}]:[])
    .concat(qs.rooms.map(r=>({v:r.id,label:r.name||'Quarto',pode:ctQuartoPossivel(c,qs,r.id),
      ja:qs.ocupados.indexOf(r.id)>-1,fim:qs.fins[r.id]||''})));
  const frase=ctQuartosFrase(c,qs),erro=ctEscolhaInvalida(c,qs);
  /* o erro por baixo só quando a escolha está à vista, num chip aceso */
  const erroVisto=erro&&opcoes.some(o=>o.v===cur);
  _ctErroQuarto=erroVisto?erro:'';
  const descr=erroVisto?'c_roomEsc-erro':frase?'c_roomFrase':'';
  return `<span class="flabel" id="c_roomRot">Quarto${inteiro?'':' <span class="req">*</span>'}</span><input type="hidden" id="c_room" value="${esc(cur)}">
    <div class="chips-fila ct-quartos${erroVisto?' err':''}" id="c_roomEsc" role="radiogroup" aria-labelledby="c_roomRot"${descr?` aria-describedby="${descr}"`:''}${erroVisto?' aria-invalid="true"':''}>${opcoes.map(o=>{
      /* à espera de uma data: não vale neste início, mas toca-se — muda o
         início para o fim e escolhe-o (ctComecaNoFim); sem data de fim,
         desligado de vez. O escolhido nunca se desliga. */
      const on=cur===o.v,espera=!o.pode&&!!o.fim,fora=!o.pode&&!on&&!espera;
      /* a marca diz quando fica livre (ou que está arrendado sem fim); o
         .ct-ja dá-lhe o fundo dos arrendados, também à casa inteira à espera */
      const marca=o.fim?' · livre a '+dPT(o.fim):o.ja?' · já arrendado':'';
      const acao=fora?' disabled':` data-toca="rascunho" data-click="${espera?'ctComecaNoFim':'ctEscolheQuarto'}('${jsq(o.v)}')"`;
      const rotulo=espera?` aria-label="${esc(o.label+', livre a '+dPT(o.fim)+', toca para começar nessa data')}"${on?'':' aria-disabled="true"'}`:'';
      return `<button type="button" class="chip${on?' on':''}${o.ja||o.fim?' ct-ja':''}${espera?' ct-espera':''}" role="radio" aria-checked="${on?'true':'false'}" data-v="${esc(o.v)}"${rotulo}${acao}>${esc(o.label)}${marca?`<span class="ct-ja-txt">${esc(marca)}</span>`:''}</button>`}).join('')}</div>
    ${erroVisto?`<p class="erro-campo" id="c_roomEsc-erro">${esc(erro)}</p>`:''}
    ${frase?`<div class="hint" id="c_roomFrase">${esc(frase)}</div>`:''}`;
}
/* o erro do quarto que está à vista junto dos chips (ctQuartosMiolo, o
   ctSaver), para o ctInicioMudou o dizer só quando aparece ou muda; o
   ctEscolheQuarto larga-o */
let _ctErroQuarto='';
/* O início do contrato mudou: o resumo da renda e a frase do prazo
   (liveNet) e, num imóvel por quartos, as escolhas do quarto, que dependem
   dele (ctQuartosMiolo) — sem largar a escolha feita. Se ela deixar de
   valer, o erro aparece junto dos chips e diz-se também em voz
   (o toast, como o falhaCampo), uma vez, quando aparece ou muda. A data de
   celebração que mostra o início (data-segue) acompanha-o.
   Recebe: nada — lê o c_start e o c_room.
   Devolve: nada — reescreve o miolo do campo do quarto e, se segue o início,
   a data de celebração. */
function ctInicioMudou(){
  /* a data de celebração que veio do início (em branco vale o início) segue-o:
     sem isto, um contrato antigo com o início corrigido gravava o início de
     antes como dia da assinatura (ctCelebracaoNoCampo) */
  const cel=document.getElementById('c_fcel');
  if(cel&&cel.getAttribute('data-segue')==='inicio'){cel.value=val('c_start');marcarDatasVazias(cel)}
  liveNet();
  const campo=document.getElementById('c_roomCampo');if(!campo||!cForm)return;
  const quarto=document.getElementById('c_room');
  const est=Object.assign({},cForm,{start:val('c_start'),roomId:(quarto&&quarto.value)||null});
  const antes=_ctErroQuarto;
  campo.innerHTML=ctQuartosMiolo(est,ctQuartosEstado(est));
  if(_ctErroQuarto&&_ctErroQuarto!==antes)toast(_ctErroQuarto);
}
/* Tocou-se num chip à espera de uma data («Quarto 1 · livre a 31/03/2027»,
   «Imóvel inteiro · livre a …»): escolhe-o e põe o início do contrato
   nesse dia — o fim do contrato desse quarto, ou o último fim para a casa
   inteira —, pelo mesmo caminho de quem muda a data (ctInicioMudou: o
   liveNet e os chips refazem-se). O aviso diz o início novo, e o foco
   volta ao chip, que foi redesenhado.
   Recebe: rid — o id do quarto ('' para o imóvel inteiro).
   Devolve: nada — mexe no início, no quarto e nos chips. */
function ctComecaNoFim(rid){
  const v=String(rid||''),ini=document.getElementById('c_start'),quarto=document.getElementById('c_room');
  if(!ini||!cForm)return;
  const q=ctQuartosEstado(Object.assign({},cForm,{start:val('c_start'),roomId:v||null}));
  const fim=v?q.fins[v]:q.ultimoFim;if(!fim)return;
  ini.value=fim;if(quarto)quarto.value=v;
  marcarDatasVazias(ini);
  ctInicioMudou();
  toast('O início do contrato passou para '+dPT(fim)+'.');
  const b=document.querySelector('.ct-quartos [data-v="'+v.replace(/["\\]/g,'')+'"]');
  if(b)try{b.focus({preventScroll:true})}catch(x){}
}
/* Um chip do quarto foi tocado: guarda a escolha no campo escondido e acende
   o chip, sem repintar o formulário (o foco e o que se escreveu ficam). Larga
   o erro do quarto (ctSaver, ctQuartosMiolo), se lá estiver, e o grupo
   volta a apontar para a frase.
   Recebe: rid — o id do quarto ('' para o imóvel inteiro).
   Devolve: nada — mexe no campo e nos chips. */
function ctEscolheQuarto(rid){
  const v=String(rid||''),i=document.getElementById('c_room');if(i)i.value=v;
  const g=document.querySelector('.ct-quartos');if(!g)return;
  g.classList.remove('err');g.removeAttribute('aria-invalid');
  if(g.getAttribute('aria-describedby')==='c_roomEsc-erro'){
    g.removeAttribute('aria-describedby');
    if(document.getElementById('c_roomFrase')&&typeof g.setAttribute==='function')g.setAttribute('aria-describedby','c_roomFrase');
  }
  const erro=document.getElementById('c_roomEsc-erro');if(erro)erro.remove();
  _ctErroQuarto='';
  [].slice.call(g.querySelectorAll('[role="radio"]')).forEach(b=>{
    const on=b.getAttribute('data-v')===v;
    b.classList.toggle('on',on);b.setAttribute('aria-checked',on?'true':'false');
  });
}
/* Um interruptor do formulário (a prancheta: «Criar movimento recorrente da
   renda»): a caixa de marcar da casa, com o papel de interruptor e o aspeto
   do .interruptor, dentro de um rótulo que se toca inteiro. É uma caixa, e
   não um botão, para o collectCt a ler como sempre leu (chk).
   Recebe: id — o id da caixa; on — se está ligada; titulo — o que liga; sub
   — a frase por baixo ('' para nenhuma); muda (opcional) — o código do
   data-change (o liveNet, quando a estimativa depende dele); ajuda
   (opcional) — a chave do «?» da pergunta (CT_AJUDAS), que fica fora do
   rótulo, entre o texto e o interruptor (ctQ).
   Devolve: o HTML do interruptor. */
function ctInterruptor(id,on,titulo,sub,muda,ajuda){
  const h=`<label class="ct-sw-linha"><span class="ct-sw-txt"><b>${esc(titulo)}</b>${sub?`<span class="small">${esc(sub)}</span>`:''}</span><input type="checkbox" role="switch" class="ct-sw" id="${esc(id)}"${on?' checked':''}${muda?` data-change="${esc(muda)}"`:''}></label>`;
  return ajuda?ctQ(h,ajuda,false,'ct-q-sw'):h;
}
/* A frase por baixo das datas: quanto dura o contrato e, com fim, até quando
   se avisa o inquilino para ele não renovar (a antecedência que os prazos
   contam pela duração do período — ctOposicao, prazos.js:pzOposicao —, e o
   dia em que a oposição produz efeitos na primeira renovação). Sem fim, diz
   que não há prazo a avisar. Num imóvel fora de Portugal, que os prazos são
   os da lei do país dele (prazos.js:PZ_LEI_DO_PAIS).
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (por escapar); '' com as datas trocadas. */
function ctFraseDoPrazo(c){
  if(c&&pzForaDePortugal(c.propertyId))return PZ_LEI_DO_PAIS;
  const iso=/^\d{4}-\d{2}-\d{2}$/;
  if(!iso.test(String(c.end||'')))return 'Sem data de fim: não há oposição à renovação a avisar.';
  if(iso.test(String(c.start||''))&&c.end<c.start)return '';
  let dur='';
  if(iso.test(String(c.start||''))){
    const m=Math.round(pzDias(c.end,c.start)/30.44);
    dur=m>=12&&m%12===0?(m/12===1?'1 ano':m/12+' anos'):(m===1?'1 mês':m+' meses');
  }
  const o=ctOposicao(c);
  return (dur?dur.charAt(0).toUpperCase()+dur.slice(1)+'. ':'')+'Para não renovar, avisa o inquilino até '+dPT(o.alvo)+' ('+ctOposicaoDias(o)+') — a app lembra-te antes, nos prazos.'
    +(o.efeitos?' Na primeira renovação, a oposição só produz efeitos a '+dPT(o.efeitos)+'.':'');
}
/* A antecedência da oposição à renovação de um contrato com fim: a dos
   prazos (prazos.js:pzOposicao — 240, 120 ou 60 dias, ou um terço, pela
   duração do período que acaba no termo; e, na primeira renovação, o dia em
   que a oposição produz efeitos). Quando os prazos não a dão, os 120 dias de
   sempre. O prazos.js é da base: chama-se sem guarda.
   Recebe: c — o contrato (com c.end; o do formulário serve).
   Devolve: {alvo, dias, terco, efeitos}, ou null sem fim. */
function ctOposicao(c){
  if(!c||!/^\d{4}-\d{2}-\d{2}$/.test(String(c.end||'')))return null;
  const o=pzOposicao(c);
  return o||{alvo:pzAddDias(c.end,-120),dias:120,terco:false,efeitos:''};
}
/* A antecedência da oposição por extenso, para o parêntesis: «120 dias»,
   «41 dias, um terço do prazo».
   Recebe: o — o ctOposicao.
   Devolve: o texto (por escapar). */
function ctOposicaoDias(o){
  return (o.dias===1?'1 dia':o.dias+' dias')+(o.terco?', um terço do prazo':'');
}
/* O contrato como está escrito no formulário agora, para a estimativa da
   taxa: a renda, as datas, a finalidade, a celebração, a isenção e as duas
   perguntas do art. 72.º n.os 23 e 24 dos campos que estão no ecrã — e a
   taxa escrita, as perguntas das isenções, o dia do envio ao IHRU e o que se
   paga à parte —, o resto do cForm. Não grava nada. O que está numa caixa
   fechada pela pergunta dela (ctAberto: o que se paga à parte, a
   particularidade fiscal) conta como em branco, como o collectCt o grava; a
   celebração igual ao início conta como em branco (ctCelebracaoDoCampo).
   Devolve: um objeto novo com a forma de um contrato. */
function ctEmEdicao(){
  const eR=document.getElementById('c_rent'),eT=document.getElementById('c_tax');
  const f=Object.assign({},fiscoDe(cForm));
  const simNao=id=>{const r=val(id);return r==='1'?true:r==='0'?false:null};
  const part=ctAberto('c_fpart');
  if(document.getElementById('c_ffin'))f.finalidade=val('c_ffin');
  if(document.getElementById('c_fcel'))f.celebracao=ctCelebracaoDoCampo(val('c_start')||cForm.start);
  if(document.getElementById('c_fisen'))f.isencao=part?val('c_fisen'):'';
  if(document.getElementById('c_facima'))f.rendaAcimaDoLimite=simNao('c_facima');
  if(document.getElementById('c_fant'))f.rendaAnterior=num(val('c_fant'))||0;
  if(document.getElementById('c_fnrau'))f.nrau3536=simNao('c_fnrau');
  if(document.getElementById('c_fal'))f.alRegistado2022=simNao('c_fal');
  if(document.getElementById('c_fihru'))f.ihru=val('c_fihru');
  if(document.getElementById('c_fextras'))f.extrasMensais=ctAberto('c_fextrasQ')?Math.max(0,num(val('c_fextras'))||0):0;
  if(document.getElementById('c_fcatb'))f.categoriaB=ctCategoriaBNaDobra(cForm)&&!part?false:chk('c_fcatb');
  if(document.getElementById('c_fegf'))f.egf=chk('c_fegf');
  return Object.assign({},cForm,{rent:eR?num(eR.value):cForm.rent,taxRate:eT?numTaxa(eT.value):cForm.taxRate,
    start:val('c_start')||cForm.start,end:val('c_end')||cForm.end,fisco:f});
}
// HTML do resumo bruto → imposto → líquido. Lê os campos do formulário se
// já estiverem no DOM; antes disso usa os valores de cForm. Sem taxa escrita,
// a estimativa do ano corrente (irsRate), com o motivo à vista. Vive numa
// caixa da superfície 2 (.ct-net), com a líquida a verde e o imposto a laranja.
// Fora de Portugal e na categoria B (ctSemEstimativa), sem taxa escrita, só
// a bruta e porque não há estimativa.
// Recebe: nada — lê os campos ou o cForm.
// Devolve: string com o HTML do resumo (ou um aviso, se faltar a renda).
function netBox(){
  /* «campo presente e vazio» (apagado de propósito → estimativa) é diferente de «ainda sem DOM» (cForm) */
  const eT=document.getElementById('c_tax'),est=ctEmEdicao();
  const r=est.rent,escrita=eT?num(eT.value):(Number(cForm.taxRate)||0);
  if(!r)return `<div class="small">Escreve a renda para veres a líquida.</div>`;
  /* fora de Portugal e na categoria B não há estimativa (ctSemEstimativa):
     sem taxa escrita, a bruta e porquê */
  if(!(escrita>0)&&ctSemEstimativa(est))return `<div class="ct-net-linha"><span>Renda bruta</span><b>${euro2(r)}</b></div>
    <div class="small">${esc(ctSemEstimativaTexto(est))}</div>`;
  const tx=escrita>0?escrita:irsRate(est);
  /* num imóvel subarrendado, o imposto é sobre a diferença para a renda que
     se paga ao senhorio (CIRS art. 8.º n.º 2 c), irs.js:irsSublocacaoMensal) */
  const sub=irsTaxa(est,YEAR).sublocacao===true?irsSublocacaoMensal(est):null;
  const imposto=(sub?sub.diferenca:r)*tx/100;
  return `<div class="ct-net-linha"><span>Renda bruta</span><b>${euro2(r)}</b></div>
    <div class="ct-net-linha"><span>Imposto (${dec(tx)}%${escrita>0?'':', estimado: '+esc(irsTaxaPorque(est))})</span><b class="neg">−${euro2(imposto)}</b></div>
    <div class="ct-net-linha ct-net-total"><span>Renda líquida</span><b class="pos">${euro2(r-imposto)}</b></div>
    <div class="small">${euro((r-imposto)*12)} por ano, se a renda se mantiver.</div>`;
}
// Recalcula o resumo da renda líquida enquanto se escreve na renda ou no imposto,
// e — porque a taxa em branco depende da renda, das datas, da finalidade, da
// isenção e das perguntas do art. 72.º — o exemplo do imposto e o «Em branco:
// N %» por baixo dele; mostra ou esconde as perguntas dos n.os 23 e 24
// (ctN23Visivel) e troca a explicação da isenção escolhida; e a frase da
// duração e da oposição por baixo das datas (ctFraseDoPrazo).
// Recebe: nada — lê os campos do formulário.
// Devolve: nada — reescreve a caixa #netBox, o placeholder de c_tax, o
// #c_taxVazio, o #c_taxAviso (a taxa escrita que não é a da lei, D17), o
// #c_prazoFrase, o hidden do #c_fn23, o do #c_fempBox (a pergunta do
// inquilino empresa, ctEmpresaVisivel), os das perguntas das isenções
// (#c_fnrauBox, #c_falBox, #c_fihruBox), o das obras (#c_fobrasBox, com a
// pergunta) e o da atualização de 2023 (#c_fat23Box); a dica da taxa
// (#c_taxDica, sem estimativa fora de Portugal e na categoria B); o «?» da
// finalidade (#c_aj_fin, só no DHD); as frases curtas do caso (KAN-161: o
// n.º, o prazo do Modelo 2, a celebração depois do início, a isenção e a
// gestão florestal que não contam); e, quando as datas mudam as isenções
// que servem ao contrato (ctIsencoesOferecidas), a escolha da isenção. Da
// ronda 2: o hidden do #c_fn24 (ctN24Visivel), do #c_fisenBox
// (ctIsencaoVisivel), do #c_fextrasW (ctExtrasVisivel), do #c_taxBox e do
// #c_taxOutraBox (ctTaxaVisivel).
function liveNet(){
  const b=document.getElementById('netBox');if(b)b.innerHTML=netBox();
  const est=ctEmEdicao(),r=dec(irsRate(est));
  /* a dica do imposto troca de frase quando deixa de haver estimativa (a
     categoria B ligada); o «Em branco: …» vem dentro dela */
  const td=document.getElementById('c_taxDica');if(td)td.innerHTML=ctTaxaDica(est);
  const v=document.getElementById('c_taxVazio'),t=document.getElementById('c_tax');
  if(v)v.textContent=ctTaxaVazia(est);
  if(t)t.placeholder='Ex: '+r;
  const av=document.getElementById('c_taxAviso');if(av){const x=ctTaxaEscritaAviso(est);av.hidden=!x;av.innerHTML=x?'<b>'+esc(x)+'</b>':''}
  const fr=document.getElementById('c_prazoFrase');if(fr)fr.textContent=ctFraseDoPrazo(est);
  const n=document.getElementById('c_fn23');if(n)n.hidden=!ctN23Visivel(est);
  const emp=document.getElementById('c_fempBox');if(emp)emp.hidden=!ctEmpresaVisivel(est);
  const caixa=(id,on)=>{const e=document.getElementById(id);if(e)e.hidden=!on};
  /* da ronda 2: a renda do contrato anterior (n.º 24) com a sua data, a
     escolha da isenção só na habitação, o que se paga à parte só na
     habitação, e o campo do imposto só sem estimativa ou com taxa escrita */
  caixa('c_fn24',ctN24Visivel(est));
  caixa('c_fisenBox',ctIsencaoVisivel(est));
  caixa('c_fextrasW',ctExtrasVisivel(est));
  const tv=ctTaxaVisivel(est);caixa('c_taxBox',tv);caixa('c_taxOutraBox',!tv);
  caixa('c_fnrauBox',ctIsencaoPede(est,'nrau3536'));
  caixa('c_falBox',ctIsencaoPede(est,'alRegistado2022'));
  caixa('c_fihruBox',ctIsencaoPede(est,'ihru'));
  caixa('c_fat23Box',ctAtualizacao2023Visivel(est));
  const ob=document.getElementById('c_fobrasBox');
  if(ob){const o=ctObrasAntes(est);ob.hidden=!o;const p=document.getElementById('c_fobrasPerg');if(p)p.textContent=ctObrasPergunta(est,o)}
  /* KAN-161: as explicações vivem no «?» e leem-se no toque (ctExplicar); aqui
     só as frases curtas do caso deste contrato (ctCasoHtml) e o «?» da
     finalidade, que só existe no DHD */
  caixa('c_aj_fin',!!ctFinalidadeDica(est));
  const caso=(id,t)=>{const e=document.getElementById(id);if(e){e.textContent=t;e.hidden=!t}};
  caso('c_fnumCaso',ctNumeroCaso(est));
  caso('c_fporIndicar',ctPorIndicarCaso(est));
  caso('c_fcelCaso',ctCelebracaoCaso(est));
  caso('c_fegfCaso',ctEgfCaso(est));
  caso('c_fpartCaso',ctParticularidadeCaso(est));
  ctIsencoesRefaz(est);
  caso('c_fisenCaso',ctIsencaoCaso(fiscoDe(est).isencao,est));
}
/* Refaz a escolha da isenção quando as isenções que servem ao contrato
   mudam (uma data de celebração ou de início nova — ctIsencoesOferecidas),
   com a escolhida ainda escolhida. Sem a escolha no ecrã, ou com as mesmas
   opções, não toca em nada (o foco fica onde está).
   Recebe: est — o contrato como está escrito (ctEmEdicao).
   Devolve: nada — troca o #sel_c_fisen. */
function ctIsencoesRefaz(est){
  const caixa=document.getElementById('sel_c_fisen'),antes=window.__sel&&window.__sel.c_fisen;
  if(!caixa||!antes)return;
  const opts=ctIsencoesOferecidas(est),chave=o=>o.map(x=>x.v).join('|');
  if(chave(opts)===chave(antes.options||[]))return;
  const tmp=document.createElement('div');tmp.innerHTML=sel('c_fisen',fiscoDe(est).isencao,opts,'liveNet','rascunho');
  const novo=tmp.firstElementChild;if(novo&&caixa.parentNode)caixa.parentNode.replaceChild(novo,caixa);
}
/* Copia o que está nos campos do modal para cForm. Chamar SEMPRE antes de
   repintar ou de mexer nas listas (inventário, chaves, fotos), senão o que
   o utilizador escreveu perde-se. Também normaliza os dias de pagamento
   (1–31, o "até" nunca antes do "de") e as rendas antecipadas (0–36). Os
   encargos a cargo do inquilino (o Q13) e os campos do bloco fiscal só
   quando estão no ecrã.
   Devolve: nada — só atualiza o objeto cForm. */
function collectCt(){
  const c=cForm;
  if(document.getElementById('c_prop'))c.propertyId=val('c_prop')||null;
  if(document.getElementById('c_autorec'))c.autoRec=chk('c_autorec');
  c.roomId=document.getElementById('c_room')?(val('c_room')||null):null;
  c.name=val('c_name');c.rent=num(val('c_rent'));c.taxRate=numTaxa(val('c_tax'));c.iban=val('c_iban');
  if(document.getElementById('c_omail'))c.ownerEmail=val('c_omail');
  if(document.getElementById('c_ophone'))c.ownerPhone=val('c_ophone');
  if(document.getElementById('c_tmail'))c.tenantEmail=val('c_tmail');
  if(document.getElementById('c_tphone'))c.tenantPhone=val('c_tphone');
  c.deposit=num(val('c_dep'));c.start=val('c_start');c.end=val('c_end');
  c.payDay=Math.max(0,Math.min(31,Math.round(num(val('c_day')))))||null;
  c.payDayTo=Math.max(0,Math.min(31,Math.round(num(val('c_dayTo')))))||null;
  c.advance=Math.max(0,Math.min(36,Math.round(num(val('c_adv')))))||0;
  if(c.payDay&&c.payDayTo&&c.payDayTo<c.payDay)c.payDayTo=c.payDay;
  const i=val('c_inc');c.increase=String(i).trim()===''?null:num(i);
  if(document.getElementById('c_notes'))c.notes=richVal('c_notes');c.active=chk('c_active');
  (c.inventory||[]).forEach(it=>{
    const n=document.getElementById('invn_'+it.id);if(n)it.name=n.value;
    const q=document.getElementById('invq_'+it.id);if(q)it.qty=Math.max(1,Math.round(num(q.value))||1);
    const s=document.getElementById('invs_'+it.id);if(s)it.state=s.value;
  });
  (c.files||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
  (c.keys||[]).forEach(k=>{
    const nEl=document.getElementById('keyn_'+k.id);if(nEl)k.name=nEl.value;
    const q=document.getElementById('keyq_'+k.id);if(q)k.qty=Math.max(1,Math.round(num(q.value))||1);
  });
  if(document.getElementById('c_ocid'))c.ownerContactId=val('c_ocid')||'';
  if(document.getElementById('c_tcid'))c.tenantContactId=val('c_tcid')||'';
  /* o dia em que acabou e o motivo, num contrato terminado (ctCessacaoCampos):
     só com os campos no ecrã; ligado outra vez, quem limpa é o ctGravarOuCessar */
  const cesData=c.active===false&&document.getElementById('c_cesData')?val('c_cesData'):null;
  const ces=cesData==null?null:{data:cesData,motivo:cesData?val('c_cesMot'):''};
  /* o bloco fiscal: cada campo só quando está no ecrã (só o contrato declarado
     os tem), e o estado nunca daqui — muda-se pelos botões (setFiscoEstado).
     No fim passa pelo normFisco, que guarda os ids das renovações que já lá
     estavam: é por eles que os campos c_rini_/c_rfim_ se voltam a encontrar. */
  const f=c.fisco=fiscoDe(c);
  /* as perguntas que abrem caixas (ctAberto): fechadas, o que está lá dentro
     grava-se em branco — nada conta escondido; e ficam lembradas para o
     repaint (_ctAbertas) */
  ['c_fpart','c_encQ','c_fextrasQ'].forEach(id=>{const e=document.getElementById(id);if(e)_ctAbertas[id]=!!e.checked});
  const part=ctAberto('c_fpart'),catBNaDobra=ctCategoriaBNaDobra(c);
  if(document.getElementById('c_fnum'))f.numero=val('c_fnum');
  if(document.getElementById('c_ffin'))f.finalidade=val('c_ffin');
  /* a celebração do campo, sempre à vista no declarado (KAN-160): o dia do
     início grava-se em branco, que quer dizer o mesmo (ctCelebracaoDoCampo) —
     um contrato antigo sem ela, gravado sem mexer, fica igual. O «Renovável»
     já não se pergunta — o valor antigo fica como estava */
  if(document.getElementById('c_fcel')){f.celebracao=ctCelebracaoDoCampo(c.start);_ctAbertas.c_fcel=true}
  /* a pergunta do inquilino empresa vive sempre no ecrã do declarado (escondida
     quando não se aplica), com o valor gravado: lê-la não o apaga. A resposta
     vai a fisco.empresaMorador (D16); a pergunta antiga, junta com a
     sublocação (empresaHabitacao), fica coerente para os clientes antigos:
     «Não» é também «Não» lá, e «Não sei» apaga um «Sim» antigo */
  if(document.getElementById('c_femp')){
    const r=val('c_femp'),v=r==='1'?true:r==='0'?false:null;
    f.empresaMorador=v;
    if(v===false)f.empresaHabitacao=false;else if(v===null&&f.empresaHabitacao===true)f.empresaHabitacao=null;
  }
  (f.renovacoes||[]).forEach(r=>{
    const a=document.getElementById('c_rini_'+r.id);if(a)r.inicio=a.value;
    const b=document.getElementById('c_rfim_'+r.id);if(b)r.fim=b.value;
  });
  if(ces)f.cessacao=ces;
  /* a isenção vive na particularidade fiscal: com «Não», nenhuma */
  if(document.getElementById('c_fisen'))f.isencao=part?val('c_fisen'):'';
  if(document.getElementById('c_facima')){const r=val('c_facima');f.rendaAcimaDoLimite=r==='1'?true:r==='0'?false:null}
  if(document.getElementById('c_fant'))f.rendaAnterior=num(val('c_fant'))||0;
  /* o que a Declaração não sabe sozinha (auditoria ao IRS, vaga 3): as
     perguntas que confirmam as isenções, o envio ao IHRU, os consumos, o que
     se paga à parte, as obras antes do início e a atualização de 2023 —
     escondidas ou não, com o valor guardado: lê-las não o apaga */
  const simNao=id=>{const r=val(id);return r==='1'?true:r==='0'?false:null};
  if(document.getElementById('c_fnrau'))f.nrau3536=simNao('c_fnrau');
  if(document.getElementById('c_fal'))f.alRegistado2022=simNao('c_fal');
  if(document.getElementById('c_fihru'))f.ihru=val('c_fihru');
  /* o que se paga à parte só com a resposta «Sim» à pergunta dele */
  if(document.getElementById('c_fextras'))f.extrasMensais=ctAberto('c_fextrasQ')?(num(val('c_fextras'))||0):0;
  if(document.getElementById('c_fobras'))f.obrasSemOutroUso=simNao('c_fobras');
  if(document.getElementById('c_fat23'))f.atualizacao2023=val('c_fat23');
  /* da ronda 2: a categoria B (D134) — num declarado em Portugal dentro da
     particularidade fiscal; nos outros estados e fora de Portugal só está no
     ecrã quando já está ligada, para se poder desligar —, a entidade de
     gestão florestal (D119), o arrendamento rural (sem recibos de renda,
     Portaria 98-A/2015, art. 5.º n.º 3 a)) e o imposto pago no estrangeiro
     de cada ano à vista (D133: em branco apaga o ano; os anos que não estão
     no ecrã ficam) */
  if(document.getElementById('c_fcatb'))f.categoriaB=catBNaDobra&&!part?false:chk('c_fcatb');
  if(document.getElementById('c_fegf'))f.egf=chk('c_fegf');
  if(document.getElementById('c_frural'))f.arrendamentoRural=val('c_frural')==='1';
  const ie=Object.assign({},f.impostoEstrangeiro||{});
  for(let a=YEAR-40;a<=YEAR+1;a++){
    if(!document.getElementById('c_fie_'+a))continue;
    const t=String(val('c_fie_'+a)).trim();
    if(t==='')delete ie[a];else ie[a]=num(t);
  }
  f.impostoEstrangeiro=ie;
  /* os encargos a cargo do inquilino (o Q13) e os consumos (N126): só com
     «Sim» a «O inquilino paga algum encargo do imóvel?»; os consumos numa
     escolha só — à parte (o encargo 'consumos'), incluídos na renda (o campo
     30 do Modelo 2, fisco.consumosIncluidos) ou nada —, que nunca grava os
     dois ao mesmo tempo. Gravam-se pela ordem da constante */
  const encQ=document.getElementById('c_encQ');
  if(encQ||document.getElementById('c_enc_'+ENCARGOS_DO_INQUILINO[0].id)){
    const aberto=!encQ||encQ.checked,eCons=document.getElementById('c_fconsumos');
    const cons=eCons?val('c_fconsumos'):null,antes=Array.isArray(c.encargosInquilino)?c.encargosInquilino:[];
    c.encargosInquilino=!aberto?[]:ENCARGOS_DO_INQUILINO.filter(e=>e.id==='consumos'
      ?(cons===null?antes.indexOf('consumos')>-1:cons==='inquilino'):chk('c_enc_'+e.id)).map(e=>e.id);
    if(!aberto)f.consumosIncluidos=false;else if(cons!==null)f.consumosIncluidos=cons==='incluidos';
  }
  c.fisco=normFisco(f);
}
// Repinta o corpo do modal a partir de cForm e recarrega as miniaturas das
// fotos. Não recolhe os campos — chama collectCt() antes, se for preciso.
// Devolve: nada — redesenha o corpo do modal.
function repaintCt(){const b=modalBodyEl();if(!b)return;b.innerHTML=ctBody();marcarDatasVazias(b);
  const p=prop(cForm.propertyId);if(p)paintThumbs(p.photos)}

/* A secção «Declaração» do formulário: o estado do contrato perante a AT, e o
   que o Anexo F e o Modelo 2 pedem quando está declarado — um caminho linear
   (D8, maqueta 1), em que cada pergunta só aparece quando conta.
   O segmentado tem três escolhas com a mesma cor e a mesma letra («não vou
   declarar» é uma decisão, não um erro) que respondem à pergunta do grupo:
   «Já o comunicaste às Finanças?» — Ainda não, Sim, tem n.º, Não vou
   declarar (ctSegmentoAt); a frase por baixo diz só o que muda.
   Num declarado ficam à vista o n.º (vai a cada linha do 4.1), a finalidade
   (o DHD com o 4.3, D120) e a data de celebração (KAN-160, sempre à vista:
   perto de 2019, 2024 e setembro de 2026 a data muda o regime); e, nos
   contratos de habitação dos anos das rendas moderadas, «O inquilino paga à
   parte móveis, equipamentos ou serviços?» (DL 97/2026, art. 3.º). A isenção
   (6D, 6F, 6H, com as perguntas que a confirmam e o envio ao IHRU) e a
   categoria B (D134, D7) vivem atrás de «Este contrato tem alguma
   particularidade fiscal?», aberta quando já têm valor
   (ctParticularidadeTem). Só quando contam: o inquilino empresa; a gestão
   florestal (6C, D119) e o arrendamento rural num rústico ou já marcados; as
   perguntas dos n.os 23 e 24 do art. 72.º (ctN23Visivel, ctN24Visivel); as
   obras antes do início (CIRS art. 41.º n.º 7) e a renda de 2023; as
   renovações (4.2A) quando podem existir (ctRenovacoesVisivel). O dia em que
   acabou e o motivo do quadro 10 pedem-se ao terminar e corrigem-se ao lado
   do «Contrato em vigor» (ctCessacaoCampos); os consumos vivem nos encargos
   do inquilino (ctEncargosCampos).
   KAN-161: a explicação de cada pergunta (a lei, o que é, onde vai no Anexo
   F) abre no «?» dela (ctAjudaBtn, ctExplicar); por baixo fica só a frase
   curta do caso deste contrato, quando a há (ctCasoHtml).
   As caixas escondidas pelas datas ficam no ecrã com o valor guardado (o
   liveNet mostra-as ou esconde-as); uma caixa fechada pela sua pergunta
   grava-se em branco (collectCt): nada conta escondido. A categoria B ligada
   vê-se em qualquer estado e país, para se poder desligar (N056). Num imóvel
   fora de Portugal, só o que o Anexo J pede — o imposto pago lá de cada ano
   — e as obras antes do início (D133).
   Devolve: string com o HTML da secção. */
function fiscoSect(){
  const c=cForm,f=fiscoDe(c),renovs=f.renovacoes||[];
  const vA=irsAno(YEAR),L=vA.taxas.limiteRendaAlta,B=vA.taxas.bonusRendaMenor,M=vA.taxas.rendaModerada;
  const sn=(v,sim,nao)=>v===true?sim:v===false?nao:'';
  const fora=pzForaDePortugal(c.propertyId);
  /* o segmentado da casa (a prancheta): três escolhas curtas, com a mesma
     letra e a mesma cor — «não vou declarar» é uma decisão, não um erro — e
     que respondem à pergunta do grupo (ctSegmentoAt); o «?» explica a
     escolhida, menos o «Sim, tem n.º» de cá, que se explica pergunta a pergunta */
  const seg=ctSegmentoAt(f.estado,fora,f.estado!=='declarado'||fora);
  /* a categoria B ligada fora da particularidade fiscal (noutro estado, ou
     fora de Portugal): à vista para se poder desligar — o resumo conta-a em
     qualquer estado (N056) */
  const catBSo=f.categoriaB===true?ctCategoriaBCampo(true):'';
  if(f.estado==='naoDeclarado')return seg+ctCasoHtml('c_fnaoDecl',ctNaoDeclaradoCaso(c))+catBSo;
  /* com «Ainda não», as rendas contam: uma isenção já guardada continua a
     contar, e por isso vê-se e troca-se (ctIsencaoCampos) */
  if(f.estado!=='declarado')return seg+ctCasoHtml('c_fporIndicar',ctPorIndicarCaso(c))+catBSo+(f.isencao?ctIsencaoCampos(c):'');
  const obras=ctObrasAntes(c);
  const obrasBox=`<div id="c_fobrasBox"${obras?'':' hidden'}><div class="form">
      ${ctQ(`<label><span id="c_fobrasPerg">${esc(ctObrasPergunta(c,obras))}</span>${sel('c_fobras',sn(f.obrasSemOutroUso,'1','0'),[{v:'',label:'Não sei'},{v:'1',label:'Sim'},{v:'0',label:'Não'}],'','rascunho')}</label>`,'obras')}
    </div></div>`;
  /* um imóvel fora de Portugal (D133): nada do Modelo 2 nem da taxa
     especial — o Anexo J, o imposto pago lá de cada ano, e as obras antes do
     início (as despesas contam como no art. 41.º); o que é o Anexo J
     explica-o o «?» do segmentado */
  if(fora)return seg+`
    ${ctImpostoEstrangeiroCampos(c)}
    ${obrasBox}${catBSo}${f.egf===true?ctEgfCampo(c):''}`;
  /* a redução pela duração é só dos contratos de habitação permanente (irsReducao) */
  const reduzida=irsTaxa(c,YEAR).reducao;
  /* a maqueta 1 do D8: à vista o n.º, a finalidade e a data de celebração;
     o que se paga à parte com a sua pergunta (à vista sempre: a lei precisa
     dela); a isenção e a categoria B atrás de «Este contrato tem alguma
     particularidade fiscal?», aberta quando já têm valor; o resto só quando
     conta. Cada frase curta do caso logo a seguir ao campo de que fala */
  const part=ctParticularidadeTem(c)||_ctAbertas.c_fpart===true;
  const ext=f.extrasMensais>0||_ctAbertas.c_fextrasQ===true;
  const cel=ctCelebracaoNoCampo(c);
  const celEst=Object.assign({},c,{fisco:Object.assign({},f,{celebracao:cel.valor})});
  return seg+`
    ${ctQ(`<label>N.º do contrato na AT (opcional)<input id="c_fnum" type="text" inputmode="numeric" class="num" value="${esc(f.numero)}" placeholder="Ex: 1234567" autocomplete="off"></label>`,'num')}
    ${ctCasoHtml('c_fnumCaso',ctNumeroCaso(c))}
    ${ctQ(`<label>Finalidade${sel('c_ffin',f.finalidade,[{v:'',label:'—'}].concat(FISCO_FINALIDADES_TODAS.map(x=>({v:x[0],label:x[1]}))),'liveNet','rascunho')}</label>`,'fin',!ctFinalidadeDica(c))}
    <div id="c_fempBox"${ctEmpresaVisivel(c)?'':' hidden'}><div class="form">
      ${ctQ(`<label>O contrato identifica pelo nome quem lá mora?${sel('c_femp',ctEmpresaMoradorValor(c),[{v:'',label:'Não sei'},{v:'1',label:'Sim'},{v:'0',label:'Não'}],'','rascunho')}</label>`,'emp')}
    </div></div>
    ${ctQ(`<label>Data de celebração<input id="c_fcel" type="date" value="${esc(cel.valor)}"${cel.segue?' data-segue="inicio"':''} data-change="ctCelebracaoMudou()"></label>`,'cel')}
    ${ctCasoHtml('c_fcelCaso',ctCelebracaoCaso(celEst),true)}
    ${M?`<div id="c_fextrasW"${ctExtrasVisivel(c)?'':' hidden'}>
    ${ctInterruptor('c_fextrasQ',ext,'O inquilino paga à parte móveis, equipamentos ou serviços?','Mesmo num contrato separado.','ctExtrasMudou()','extras')}
    <div id="c_fextrasBox"${ext?'':' hidden'}><div class="form">
      <label>Valor pago à parte por mês (€)<input id="c_fextras" type="text" inputmode="decimal" class="num" value="${f.extrasMensais?dec(f.extrasMensais):''}" placeholder="Opcional" data-input="liveNet()" autocomplete="off"></label>
    </div></div></div>`:''}
    ${ctInterruptor('c_fpart',part,'Este contrato tem alguma particularidade fiscal?','Uma isenção de IRS, ou rendas tributadas na categoria B.','ctParticularidadeMudou()')}
    ${ctCasoHtml('c_fpartCaso',ctParticularidadeCaso(c))}
    <div id="c_fpartBox"${part?'':' hidden'}><div class="form">
    ${ctIsencaoCampos(c)}
    ${ctCategoriaBCampo(f.categoriaB===true)}
    </div></div>
    ${ctEgfVisivel(c)||f.egf===true?ctEgfCampo(c):''}
    ${ctRuralVisivel(c)?`<div id="c_fruralBox"><div class="form">
      ${ctQ(`<label>É um arrendamento rural (agrícola, florestal ou de campanha)?${sel('c_frural',f.arrendamentoRural===true?'1':'',[{v:'',label:'Não'},{v:'1',label:'Sim'}],'','rascunho')}</label>`,'rural')}
    </div></div>`:''}
    ${L?`<div id="c_fn23"${ctN23Visivel(c)?'':' hidden'}><div class="form">
      ${ctQ(`<label>Renda acima de ${dec(L.percentagem)} % do limite do concelho?${sel('c_facima',f.rendaAcimaDoLimite===true?'1':f.rendaAcimaDoLimite===false?'0':'',[{v:'',label:'Não sei'},{v:'0',label:'Não'},{v:'1',label:'Sim'}],'liveNet','rascunho')}</label>`,'n23')}
    </div></div>`:''}
    ${B?`<div id="c_fn24"${ctN24Visivel(c)?'':' hidden'}><div class="form">
      ${ctQ(`<label>Renda do contrato anterior neste imóvel (€)<input id="c_fant" type="text" inputmode="decimal" value="${f.rendaAnterior?dec(f.rendaAnterior):''}" placeholder="Opcional" data-input="liveNet()" autocomplete="off"></label>`,'n24')}
      <div class="hint ct-colado">Em branco: não se aplica.</div>
    </div></div>`:''}
    ${obrasBox}
    <div id="c_fat23Box"${ctAtualizacao2023Visivel(c)?'':' hidden'}><div class="form">
      ${ctQ(`<label>A renda de 2023 subiu mais de 2 %?${sel('c_fat23',f.atualizacao2023,[{v:'',label:'Não sei'},{v:'sim',label:'Sim'},{v:'nao',label:'Não'}],'','rascunho')}</label>`,'at23')}
    </div></div>
    ${ctRenovacoesVisivel(c)?`<div>${ctQ('<div class="flabel">Renovações</div>','renov','','ct-q-fl')}
      ${renovs.length?`<div class="form u-g-9px">${renovs.map(r=>`<div class="invrow u-gtc-1fr-1fr-auto u-ai-end">
        <label>Início<input id="c_rini_${esc(r.id)}" type="date" value="${esc(r.inicio)}"></label>
        <label>Fim<input id="c_rfim_${esc(r.id)}" type="date" value="${esc(r.fim)}"></label>
        <button type="button" class="btn sm danger" data-toca="rascunho" data-click="delRenov('${jsq(r.id)}')" aria-label="Remover renovação">${ic('trash',14)}</button></div>`).join('')}</div>`:''}
      <div class="toolbar ${renovs.length?'u-m-4px-0-0':'u-m-0-0-0'}"><button type="button" class="btn sm" data-toca="rascunho" data-click="addRenov()">${ic('plus',14)} Adicionar renovação</button></div></div>`:''}
    ${reduzida?ctQ(`<div class="hint">${esc(ctReduzidaCaso(reduzida))}</div>`,'reduzida','','ct-q-fl'):''}`;
}
/* As explicações do bloco fiscal (KAN-161, decisão do Martinho: explicações
   no «?»): por chave, o título da janela (o nome curto da pergunta, também o
   do aria-label do «?») e o texto, lido do contrato como está escrito no
   momento do toque (ctEmEdicao) — a lei, o que é e onde vai no Anexo F. A
   frase curta do caso fica por baixo da pergunta (ctCasoHtml). */
const CT_AJUDAS={
  at:{titulo:c=>pzForaDePortugal(c.propertyId)?'Vais declarar estas rendas no IRS?':'Já o comunicaste às Finanças?',
    texto:c=>{const e=fiscoDe(c).estado;return e==='naoDeclarado'?ctNaoDeclaradoDica(c):e!=='declarado'?ctPorIndicarDica(c):pzForaDePortugal(c.propertyId)?ctForaDica():''}},
  num:{titulo:()=>'N.º do contrato na AT',texto:c=>ctNumeroDica(c)},
  fin:{titulo:()=>'Finalidade',texto:c=>ctFinalidadeDica(c)},
  emp:{titulo:()=>'Inquilino com NIF de empresa',texto:()=>ctEmpresaDica()},
  cel:{titulo:()=>'Data de celebração',texto:()=>ctCelebracaoDica()},
  extras:{titulo:()=>'Móveis, equipamentos ou serviços pagos à parte',texto:()=>ctExtrasDica()},
  isen:{titulo:()=>'Isenção de IRS',texto:c=>ctIsencaoTexto(fiscoDe(c).isencao,c)},
  nrau:{titulo:()=>'Renda antiga anterior ao RAU',texto:()=>ctPedeDica('nrau3536')},
  al:{titulo:()=>'Ex-alojamento local',texto:()=>ctPedeDica('alRegistado2022')},
  ihru:{titulo:()=>'Envio ao IHRU',texto:c=>ctIhruDica(c)},
  catb:{titulo:()=>'Rendas na categoria B',texto:c=>ctCategoriaBDica(fiscoDe(c).categoriaB===true)},
  egf:{titulo:()=>'Entidade de gestão florestal',texto:c=>ctEgfDica(c)},
  rural:{titulo:()=>'Arrendamento rural',texto:()=>ctRuralDica()},
  n23:{titulo:()=>'Renda acima do limite do concelho',texto:()=>ctN23Dica()},
  n24:{titulo:()=>'Renda do contrato anterior',texto:()=>ctN24Dica()},
  obras:{titulo:()=>'Obras antes do início',texto:()=>ctObrasDica()},
  at23:{titulo:()=>'A renda de 2023',texto:()=>ctAtualizacao2023Dica()},
  renov:{titulo:()=>'Renovações',texto:()=>ctRenovacoesDica()},
  reduzida:{titulo:()=>'Taxa reduzida pela duração',texto:c=>ctReduzidaDica(c)},
  ie:{titulo:()=>'Imposto pago no estrangeiro',texto:()=>ctImpostoEstrangeiroDica()},
};
/* Uma pergunta do bloco fiscal com o «?» dela (KAN-161): o rótulo (ou o
   interruptor, ou o título do grupo) como estava, e o «?» a seguir, FORA do
   <label> — dentro, o rótulo passava-lhe o toque e o nome dele entrava no do
   campo. A folha pousa-o ao lado do texto (estilos.css:.ct-q).
   Recebe: html — o rótulo; chave — a de CT_AJUDAS; escondido (opcional) —
   true para o «?» começar escondido (a finalidade fora do DHD); classe
   (opcional) — 'ct-q-sw' num interruptor, 'ct-q-fl' num título ou numa nota.
   Devolve: o HTML. */
function ctQ(html,chave,escondido,classe){
  return `<div class="ct-q${classe?' '+classe:''}">${html}${ctAjudaBtn(chave,escondido)}</div>`;
}
/* O «?» de uma pergunta: um botão só de ícone (ic ajuda) que abre a
   explicação numa janela por cima do formulário (ctExplicar), com o nome
   «Explicar: <pergunta>».
   Recebe: chave — a de CT_AJUDAS; escondido (opcional) — true para nascer
   escondido.
   Devolve: o HTML do botão ('' sem a chave). */
function ctAjudaBtn(chave,escondido){
  const a=CT_AJUDAS[chave];if(!a)return '';
  const t=a.titulo(cForm||{});
  return `<button type="button" class="ct-ajuda" id="c_aj_${esc(chave)}" data-toca="camada" data-click="ctExplicar('${jsq(chave)}')" aria-label="${esc('Explicar: '+t)}" aria-haspopup="dialog"${escondido?' hidden':''}>${ic('ajuda',18)}</button>`;
}
/* A frase curta do caso deste contrato por baixo de uma pergunta (KAN-161):
   escondida quando não há caso; o liveNet reescreve-a pelo id. Um aviso (a
   celebração depois do início) diz-se pela cor da frente.
   Recebe: id — o id da frase; texto — a frase (por escapar, '' para
   nenhuma); aviso (opcional) — true para a cor de aviso.
   Devolve: o HTML. */
function ctCasoHtml(id,texto,aviso){
  return `<div class="hint ct-colado ct-caso${aviso?' ct-caso-aviso':''}" id="${esc(id)}"${texto?'':' hidden'}>${esc(texto||'')}</div>`;
}
/* Abre a explicação de uma pergunta do bloco fiscal numa janela por cima do
   «Editar contrato» (o empilhar do componentes.js:openModal: o formulário fica
   por baixo, inerte, com o que está escrito e a posição onde estava). O
   texto lê-se AGORA, do contrato como está escrito (ctEmEdicao), antes de a
   janela abrir — o openModal tira os ids à de baixo. Só de leitura: fecha-se
   no «Fechar», no X, no fundo ou no Escape; o foco volta ao «?» quando lá
   estava (o teclado).
   Recebe: chave — a de CT_AJUDAS.
   Devolve: nada — abre a janela (ou nada, sem explicação). */
function ctExplicar(chave){
  const a=CT_AJUDAS[chave];if(!a||!cForm)return;
  const est=ctEmEdicao(),t=ctAjudaTexto(chave,est);if(!t)return;
  const L=openModal(a.titulo(est),`<p class="ct-explica">${esc(t)}</p>`,
    `<button type="button" class="btn primary" data-toca="camada" data-click="closeModal()">Fechar</button>`);
  const g=L&&L.gatilho;
  if(L&&g&&g.classList&&g.classList.contains('ct-ajuda'))
    L.aoFechar=()=>setTimeout(()=>{try{g.focus({preventScroll:true})}catch(e){}},0);
}
/* O texto da explicação de uma pergunta, o que a janela do «?» mostra.
   Recebe: chave — a de CT_AJUDAS; c — o contrato (o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML), ou '' sem explicação. */
function ctAjudaTexto(chave,c){
  const a=CT_AJUDAS[chave];
  return a?String(a.texto(c||{})||''):'';
}
/* A explicação da pergunta do n.º 24 do art. 72.º (quadro 4.2B), com a data
   e os números da versão do ano (taxas.bonusRendaMenor).
   Devolve: o texto (sem HTML); '' sem o n.º 24 na versão. */
function ctN24Dica(){
  const B=irsAno(YEAR).taxas.bonusRendaMenor;if(!B)return '';
  return 'Num contrato celebrado desde '+dPT(B.desde)+': se a renda for pelo menos '+dec(B.rendaMenorPct)+' % mais baixa do que a do contrato anterior neste imóvel, a taxa desce mais '+dec(B.pontos)+' pontos (CIRS art. 72.º n.º 24, quadro 4.2B do Anexo F). Em branco: não se aplica.';
}
/* A explicação da pergunta das obras antes do início (CIRS art. 41.º n.º 7).
   Devolve: o texto (sem HTML). */
function ctObrasDica(){
  return 'Há obras de conservação deste imóvel pagas nos 24 meses antes do início do contrato. Só se deduzem se, nesse tempo, o imóvel não teve outro uso (CIRS art. 41.º n.º 7). Em «Não sei», ficam fora do Anexo F até confirmares.';
}
/* A explicação da pergunta da atualização da renda de 2023 (Lei 19/2022).
   Devolve: o texto (sem HTML). */
function ctAtualizacao2023Dica(){
  return 'O Anexo F pergunta-o nas linhas dos contratos em vigor antes de 2022: se a atualização da renda de 2023 passou o coeficiente de 1,02 (Lei 19/2022).';
}
/* A explicação das renovações escritas à mão (o quadro 4.2A).
   Devolve: o texto (sem HTML). */
function ctRenovacoesDica(){
  return 'Início e fim de cada renovação. O quadro 4.2A do Anexo F pede os da última. Uma renovação que vai para lá do fim leva o fim com ela.';
}
/* A redução pela duração deste contrato no ano corrente (irs.js:irsTaxa),
   do contrato como está escrito e, sem ela, do formulário como abriu.
   Recebe: c — o contrato (o que ctEmEdicao devolve).
   Devolve: o objeto da redução ({taxa…}), ou null. */
function ctReduzidaDe(c){return irsTaxa(c,YEAR).reducao||irsTaxa(cForm,YEAR).reducao||null}
/* A explicação da taxa reduzida pela duração, para o «?» da nota: o quadro
   4.2 e a comunicação da duração no Portal das Finanças.
   Recebe: c — o contrato (o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML); '' sem redução. */
function ctReduzidaDica(c){
  const r=ctReduzidaDe(c);if(!r)return '';
  return ctReduzidaCaso(r).replace(/\.$/,'')+', e a duração comunica-se no Portal das Finanças uma vez, até 15 de fevereiro do ano seguinte ao início do contrato e de cada renovação.';
}
/* A nota curta de um contrato com redução pela duração (KAN-161): a taxa e o
   quadro (o resto é o «?», ctReduzidaDica).
   Recebe: r — a redução (irsTaxa(…).reducao).
   Devolve: o texto (sem HTML). */
function ctReduzidaCaso(r){return 'Taxa reduzida pela duração ('+dec(r.taxa)+' %): vai ao quadro 4.2 do Anexo F.'}
/* Muda o estado do contrato perante a AT e repinta, para os campos do
   declarado aparecerem ou sumirem. Colhe antes: o que estava escrito nos
   outros campos não se perde.
   Recebe: v — o estado ('', 'declarado' ou 'naoDeclarado').
   Devolve: nada — atualiza cForm.fisco.estado e repinta o formulário. */
function setFiscoEstado(v){collectCt();cForm.fisco.estado=FISCO_ESTADOS.indexOf(v)>-1?v:'';repaintCt()}
/* Acrescenta uma renovação vazia (início e fim por escrever) e repinta.
   Devolve: nada — repinta o formulário. */
function addRenov(){collectCt();cForm.fisco.renovacoes.push({id:uid(),inicio:'',fim:''});repaintCt()}
/* Remove uma renovação pelo id e repinta.
   Recebe: rid — o id da renovação a remover.
   Devolve: nada — repinta o formulário. */
function delRenov(rid){collectCt();cForm.fisco.renovacoes=cForm.fisco.renovacoes.filter(r=>r.id!==rid);repaintCt()}
/* A pergunta de um interruptor do formulário deixa ler o que está na caixa
   dele? Sem o interruptor no ecrã (um formulário antigo, um teste com só
   alguns campos), sim; com ele, só ligado. É a regra de nunca gravar o que
   não se vê: a caixa fechada grava-se em branco.
   Recebe: id — o id do interruptor (c_fpart, c_encQ, c_fextrasQ).
   Devolve: true ou false. */
function ctAberto(id){const e=document.getElementById(id);return !e||!!e.checked}
/* Abre ou fecha a caixa de um interruptor sem repintar (o foco fica onde
   está), lembra a escolha para um repaint (_ctAbertas) e refaz a estimativa
   (o que se paga à parte e a categoria B mexem na taxa).
   Recebe: sw — o id do interruptor; caixa — o id da caixa.
   Devolve: nada. */
function ctCaixaSegue(sw,caixa){
  const s=document.getElementById(sw),b=document.getElementById(caixa);
  if(s){_ctAbertas[sw]=!!s.checked;if(b)b.hidden=!s.checked}
  liveNet();
}
/* O data-change da data de celebração (KAN-160): escrita à mão, deixa de
   seguir o início (ctInicioMudou), e a estimativa e a frase do caso refazem-se
   (liveNet: a celebração depois do início avisa).
   Devolve: nada. */
function ctCelebracaoMudou(){
  const e=document.getElementById('c_fcel');if(e)e.removeAttribute('data-segue');
  liveNet();
}
/* O data-change de «O inquilino paga à parte móveis, equipamentos ou
   serviços?»: abre ou fecha o valor (ctCaixaSegue).
   Devolve: nada. */
function ctExtrasMudou(){ctCaixaSegue('c_fextrasQ','c_fextrasBox')}
/* O data-change de «Este contrato tem alguma particularidade fiscal?»: abre
   ou fecha a isenção e a categoria B (ctCaixaSegue).
   Devolve: nada. */
function ctParticularidadeMudou(){ctCaixaSegue('c_fpart','c_fpartBox')}
/* O data-change de «O inquilino paga algum encargo do imóvel?»: abre ou
   fecha os encargos e os consumos (ctCaixaSegue).
   Devolve: nada. */
function ctEncargosMudou(){ctCaixaSegue('c_encQ','c_encBox')}
/* O segmentado do estado perante a AT (D8 e): a pergunta no rótulo do grupo
   e três respostas que lhe respondem — «Ainda não» (por indicar: as rendas
   contam e o Modelo 2 avisa), «Sim, tem n.º» (declarado; também o registo
   dos elementos mínimos dos contratos de antes de abril de 2015) e «Não vou
   declarar» (não declarado). Num imóvel fora de Portugal não há Modelo 2: a
   pergunta é se as rendas vão ao IRS. Os valores gravados não mudam ('',
   'declarado', 'naoDeclarado'). Com ajuda, o «?» ao lado da pergunta
   explica a resposta escolhida (CT_AJUDAS.at).
   Recebe: estado — o fisco.estado; fora — true num imóvel fora de Portugal;
   ajuda (opcional) — true para o «?».
   Devolve: o HTML do grupo. */
function ctSegmentoAt(estado,fora,ajuda){
  const ops=fora?[['','Ainda não sei'],['declarado','Sim'],['naoDeclarado','Não vou declarar']]
    :[['','Ainda não'],['declarado','Sim, tem n.º'],['naoDeclarado','Não vou declarar']];
  const rot=`<span class="flabel" id="c_fiscoRot">${fora?'Vais declarar estas rendas no IRS?':'Já o comunicaste às Finanças?'}</span>`;
  return `<div class="ct-campo">${ajuda?ctQ(rot,'at',false,'ct-q-fl'):rot}
    <div class="segm ct-at-segm" role="radiogroup" aria-labelledby="c_fiscoRot">${ops
      .map(([k,lb])=>`<button type="button" role="radio" aria-checked="${estado===k?'true':'false'}" class="${estado===k?'on':''}" data-toca="rascunho" data-click="setFiscoEstado('${k}')">${lb}</button>`).join('')}</div></div>`;
}
/* A categoria B deste contrato vive dentro da particularidade fiscal? Num
   contrato declarado de um imóvel em Portugal; nos outros estados e fora de
   Portugal o interruptor só aparece ligado, à parte (N056).
   Recebe: c — o contrato do formulário.
   Devolve: true ou false. */
function ctCategoriaBNaDobra(c){return !!c&&fiscoDe(c).estado==='declarado'&&!pzForaDePortugal(c.propertyId)}
/* O interruptor da categoria B (D7): a pergunta «Tens atividade aberta com
   estas rendas na categoria B?», com o «?» que explica — antes, quem a liga;
   ligada, o que muda (ctCategoriaBDica, lida no toque).
   Recebe: ligado — se a marca está ligada.
   Devolve: o HTML. */
function ctCategoriaBCampo(ligado){
  return ctInterruptor('c_fcatb',ligado,'Tens atividade aberta com estas rendas na categoria B?','','liveNet()','catb');
}
/* O documento das rendas da categoria B (N029): o contrato continua com o
   Modelo 2 (Imposto do Selo, para todos os contratos), mas não há recibo de
   renda eletrónico — é a fatura da atividade (Portaria 98-A/2015, art. 5.º
   n.º 1; CIRS art. 115.º n.º 1 a)).
   Devolve: o texto (sem HTML). */
function ctCategoriaBDocumento(){
  return 'O contrato continua com o Modelo 2; os recibos de renda eletrónicos não se emitem (Portaria 98-A/2015, art. 5.º n.º 1): o documento é a fatura ou a fatura-recibo da tua atividade.';
}
/* A particularidade fiscal do contrato já tem alguma resposta (a isenção ou
   a categoria B)? Então abre-se: um campo com valor nunca fica escondido.
   Recebe: c — o contrato.
   Devolve: true ou false. */
function ctParticularidadeTem(c){const f=fiscoDe(c);return !!f.isencao||f.categoriaB===true}
/* A frase curta por baixo de «Este contrato tem alguma particularidade
   fiscal?» quando as datas do contrato lhe abrem uma isenção que só certos
   contratos têm — as que pedem uma confirmação (o `pede` da versão: a renda
   antiga do 6H, o ex-alojamento local do 6F) — e ainda nenhuma está
   escolhida (KAN-126-10: com o interruptor desligado, nada dizia que o
   contrato de 1985 podia ter a do 6H). As dos programas (6D) servem a
   quase todos os contratos e não se anunciam.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML), ou ''. */
function ctParticularidadeCaso(c){
  const f=fiscoDe(c);if(f.isencao)return '';
  const isens=irsAno(YEAR).isencoes||[];
  const xs=ctIsencoesOferecidas(c).map(o=>o.v&&isens.find(x=>x&&x.id===o.v)).filter(x=>x&&[].concat(x.pede||[]).length);
  if(!xs.length)return '';
  if(xs.length>1)return 'Pelas datas, este contrato pode ter uma isenção dos quadros '+listaE(xs.map(x=>x.quadro))+'. Escolhe em «Isenção de IRS» a que se aplicar.';
  return 'Pelas datas, este contrato pode ter a isenção do quadro '+xs[0].quadro+', '+(xs[0].curto||xs[0].nome)+'. Escolhe-a em «Isenção de IRS», se se aplicar.';
}
/* A celebração está escrita e não é o dia do início? Em branco, a app conta
   o início; por isso o dia do início grava-se em branco (ctCelebracaoDoCampo).
   Recebe: c — o contrato.
   Devolve: true ou false. */
function ctCelebracaoOutra(c){const f=fiscoDe(c);return !!f.celebracao&&f.celebracao!==(c&&c.start)}
/* A pergunta do que se paga à parte (N153, a nota da lei): em todos os
   contratos de habitação (permanente, não permanente ou por indicar) dos anos
   das rendas moderadas, seja qual for a renda — o DL 97/2026, art. 3.º,
   soma-os mesmo num contrato separado; num não habitacional ou num DHD, só
   com um valor já guardado.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: true se a pergunta se mostra. */
function ctExtrasVisivel(c){
  const M=irsAno(YEAR).taxas.rendaModerada,f=fiscoDe(c);
  if(f.extrasMensais>0)return true;
  return !!M&&YEAR<=M.ate&&['hp','hnp',''].indexOf(f.finalidade)>-1;
}
/* A escolha da isenção mostra-se quando há alguma que sirva ao contrato
   (ctIsencoesOferecidas: as datas e a finalidade), ou uma já escolhida.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: true ou false. */
function ctIsencaoVisivel(c){return !!fiscoDe(c).isencao||ctIsencoesOferecidas(c).length>1}
/* O campo do imposto (N130, D8 f): só quando não há estimativa (fora de
   Portugal, categoria B — ctSemEstimativa), quando já há uma taxa escrita,
   ou depois de «Escrever outra taxa». Nos outros, a caixa da renda líquida
   já diz a taxa estimada.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: true ou false. */
function ctTaxaVisivel(c){return Number(c&&c.taxRate)>0||!!ctSemEstimativa(c)||_ctAbertas.taxa===true}
/* O «Escrever outra taxa» (KAN-169): um botão com contorno e a letra de ação
   (estilos.css:.ct-abre — o fantasma de antes lia-se como texto solto), por
   baixo da renda líquida. Abre o campo do imposto no lugar dele, com a dica
   dentro de um .form como as outras caixas que abrem (a margem negativa do
   .ct-colado conta com o espaço da grelha; sem ela, a dica subia para cima do
   campo), e põe lá o foco.
   Devolve: nada. */
function ctTaxaOutra(){
  _ctAbertas.taxa=true;
  const b=document.getElementById('c_taxBox'),o=document.getElementById('c_taxOutraBox'),t=document.getElementById('c_tax');
  if(b)b.hidden=false;if(o)o.hidden=true;
  if(t&&typeof t.focus==='function')try{t.focus()}catch(e){}
}
/* A pergunta da renda do contrato anterior (o n.º 24 do art. 72.º, quadro
   4.2B) faz-se quando conta, com a sua data (N089): num contrato celebrado
   (ou começado, sem celebração escrita) desde a do n.º 24 na versão
   (taxas.bonusRendaMenor.desde) que, sem ela, teria redução pela duração no
   ano corrente.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: true se a pergunta se mostra. */
function ctN24Visivel(c){
  const B=irsAno(YEAR).taxas.bonusRendaMenor;if(!B||!c)return false;
  const f=fiscoDe(c),cel=f.celebracao||c.start||'';
  if(!cel||cel<B.desde)return false;
  return !!irsReducao(Object.assign({},c,{fisco:Object.assign({},f,{rendaAcimaDoLimite:null,rendaAnterior:0,isencao:''})}),YEAR);
}
/* A dica da pergunta do n.º 23 (N092, D3): a regra, e os limites que contam
   nas rendas do ano corrente como a versão os escreve — cada portaria com as
   datas em que vale (taxas.limiteRendaAlta.portaria, como o PDF:
   fisco-exportar.js:fiscoExpLimites23) —, com a nota da versão quando a tem
   (taxas.limiteRendaAlta.nota: desde 1/9/2026 os limites da Portaria
   176/2019 leem-se como os do arrendamento acessível em todos os contratos em
   vigor, DL 97/2026, art. 14.º b)).
   Devolve: o texto (sem HTML); '' sem o n.º 23 na versão. */
function ctN23Dica(){
  const L=irsAno(YEAR).taxas.limiteRendaAlta;if(!L)return '';
  const i=YEAR+'-01-01',fim=YEAR+'-12-31';
  const ps=(Array.isArray(L.portaria)?L.portaria:[]).filter(p=>p&&(!p.ate||p.ate>=i)&&(!p.desde||p.desde<=fim));
  const txt=p=>String(p.texto||p.portaria||'');
  const lim=ps.length<2?(ps.length?txt(ps[0]):'os do arrendamento acessível')
    :ps.map(p=>{const de=p.desde&&p.desde>i,ate=p.ate&&p.ate<fim;
      return (de&&ate?'de '+dPT(p.desde)+' a '+dPT(p.ate):ate?'até '+dPT(p.ate):de?'desde '+dPT(p.desde):'em '+YEAR)+', '+txt(p)}).join('; ');
  const nota=String(L.nota||'').trim();
  return 'Num contrato de habitação celebrado desde '+dPT(L.desde)+', uma renda mensal acima de '+dec(L.percentagem)+' % dos limites gerais da tipologia no concelho faz perder a redução pela duração, e o contrato vai ao quadro 4.1 (CIRS art. 72.º n.º 23). Os limites, nas rendas de '+YEAR+': '+lim+'.'
    +(nota?' '+nota:'')+' A app não tem essas tabelas: indica-o aqui. Em «Não sei» conta-se a redução.';
}
/* As renovações escrevem-se à mão só quando podem existir (N060): o
   contrato já as tem, o fim já passou, ou começou antes do ano anterior (um
   contrato antigo registado agora com o termo de hoje tem renovações que
   mudam a taxa do 4.2 — a nota do verificador da lei). Num contrato novo,
   nascem do «Renovar…» e da pergunta ao mudar o fim.
   Recebe: c — o contrato do formulário.
   Devolve: true se a lista se mostra. */
function ctRenovacoesVisivel(c){
  if((fiscoDe(c).renovacoes||[]).length)return true;
  const h=today();
  return (dataExiste(c&&c.end)&&c.end<h)||(dataExiste(c&&c.start)&&c.start<(Number(h.slice(0,4))-1)+'-01-01');
}
/* O interruptor da entidade de gestão florestal (D119), com o «?» da
   explicação (ctEgfDica): num prédio rústico em Portugal, ou sempre que já
   está ligado (N127); por baixo, só porque não conta quando não conta
   (ctEgfCaso).
   Recebe: c — o contrato do formulário.
   Devolve: o HTML. */
function ctEgfCampo(c){
  return `${ctInterruptor('c_fegf',fiscoDe(c).egf===true,'Arrendado a entidade de gestão florestal reconhecida (EGF/UGF)','','liveNet()','egf')}
    ${ctCasoHtml('c_fegfCaso',ctEgfCaso(c))}`;
}
/* A pergunta do arrendamento rural (N093) faz-se num prédio rústico em
   Portugal, ou sempre que já está marcada: as rendas de um contrato do
   Regime do Arrendamento Rural não pedem recibo de renda eletrónico
   (Portaria 98-A/2015, art. 5.º n.º 3 a)). Grava fisco.arrendamentoRural, que
   os prazos leem (prazos.js:pzArrendamentoRural).
   Recebe: c — o contrato do formulário.
   Devolve: true se a pergunta se mostra. */
function ctRuralVisivel(c){
  const p=c&&c.propertyId?prop(c.propertyId):null;
  return fiscoDe(c).arrendamentoRural===true||(!!p&&p.tipoPredio==='R'&&!pzForaDePortugal(c.propertyId));
}
/* A dica da pergunta do arrendamento rural.
   Devolve: o texto (sem HTML). */
function ctRuralDica(){
  return 'As rendas de um arrendamento rural não pedem recibo de renda eletrónico (Portaria 98-A/2015, art. 5.º n.º 3 a)); podes declará-las no Modelo 44, se quiseres. Um terreno arrendado para outro fim (um estacionamento, uma antena) não é arrendamento rural.';
}
/* A escolha da isenção (6D, 6F, 6H) e as perguntas que a confirmam (a
   renda antiga, o ex-alojamento local, o envio ao IHRU), cada uma só com a
   sua isenção escolhida. Num contrato declarado vive na particularidade
   fiscal; noutro estado só aparece com uma isenção guardada — o motor
   conta-a em qualquer estado, e uma isenção escondida punha as rendas a 0 %
   sem se poder trocar.
   Recebe: c — o contrato do formulário.
   Devolve: o HTML. */
function ctIsencaoCampos(c){
  const f=fiscoDe(c),isOpts=ctIsencoesOferecidas(c),sn=(v,sim,nao)=>v===true?sim:v===false?nao:'';
  return `<div id="c_fisenBox"${ctIsencaoVisivel(c)?'':' hidden'}><div class="form">
    ${ctQ(`<label>Isenção de IRS${sel('c_fisen',f.isencao,isOpts,'liveNet','rascunho')}</label>`,'isen')}
    ${ctCasoHtml('c_fisenCaso',ctIsencaoCaso(f.isencao,c))}
    <div id="c_fnrauBox"${ctIsencaoPede(c,'nrau3536')?'':' hidden'}><div class="form">
      ${ctQ(`<label>O contrato é anterior ao RAU (1990) e ficou sujeito aos arts. 35.º ou 36.º do NRAU?${sel('c_fnrau',sn(f.nrau3536,'1','0'),[{v:'',label:'Não sei'},{v:'1',label:'Sim'},{v:'0',label:'Não'}],'liveNet','rascunho')}</label>`,'nrau')}
    </div></div>
    <div id="c_falBox"${ctIsencaoPede(c,'alRegistado2022')?'':' hidden'}><div class="form">
      ${ctQ(`<label>${esc(ctAlPergunta())}${sel('c_fal',sn(f.alRegistado2022,'1','0'),[{v:'',label:'Não sei'},{v:'1',label:'Sim'},{v:'0',label:'Não'}],'liveNet','rascunho')}</label>`,'al')}
    </div></div>
    <div id="c_fihruBox"${ctIsencaoPede(c,'ihru')?'':' hidden'}><div class="form">
      ${ctQ(`<label>Enviado ao IHRU a<input id="c_fihru" type="date" value="${esc(f.ihru)}" max="${esc(today())}" data-change="liveNet()"></label>`,'ihru')}
    </div></div>
    </div></div>`;
}
/* A explicação da isenção escolhida, para o «?» da escolha (KAN-161):
   o texto da versão do ano e onde se declara (o 6H e o 6F sem código: só
   apontam para a linha do 4.1); sem isenção, para que servem, sem fechar a
   lista (D18), e que um imóvel reabilitado se marca na ficha do imóvel (o
   benefício da versão com a marca do imóvel: o 6A, D118). Com o contrato, e quando uma condição de datas, de finalidade
   ou do IHRU já a deixa de fora no ano corrente, diz qual (ctIsencaoCaso,
   que é também a frase curta por baixo) — as perguntas que a confirmam têm o
   seu lugar logo a seguir, e não se repetem aqui.
   Recebe: id — o valor de fisco.isencao ('' ou o id de uma isenção); c
   (opcional) — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML). */
function ctIsencaoTexto(id,c){
  const x=id?(irsAno(YEAR).isencoes||[]).find(i=>i.id===id):null;
  if(!id){
    /* a taxa dos imóveis reabilitados não é isenção: marca-se no imóvel (D118) */
    const reab=(irsAno(YEAR).beneficios||[]).find(b=>b&&b.marca==='imovel.reabilitacao');
    return 'Há isenções de IRS para alguns contratos: os dos programas de arrendamento acessível, as rendas antigas de contratos anteriores ao RAU (1990) sujeitos ao NRAU, e o ex-alojamento local passado a arrendamento, entre outros. Escolhe a do contrato, se a tiver: com isenção, a taxa estimada passa a 0 %.'
      +(reab?' Um imóvel reabilitado não é isenção: marca-se na ficha do imóvel (quadro '+reab.quadro+').':'');
  }
  if(!x)return 'Esta isenção não existe nas regras de '+YEAR+'.';
  const onde=x.semCodigo?' Declara-se no quadro '+x.quadro+' do Anexo F, que aponta para a linha do contrato no quadro 4.1.'
    :' Declara-se no quadro '+x.quadro+' do Anexo F'+(x.codigo?' (código '+x.codigo+')':' (o código ainda não se conhece)')+'.';
  const caso=c?ctIsencaoCaso(id,c):'';
  return x.texto+onde+(caso?' '+caso:'');
}
/* O que a isenção escolhida diz deste contrato agora, para a frase curta por
   baixo da escolha (KAN-161; a explicação inteira é a do «?»,
   ctIsencaoTexto): uma isenção que a versão do ano não tem, ou porque não
   conta no ano corrente — uma condição de datas, de finalidade ou do IHRU
   (irs.js:irsIsencaoMotivo); as perguntas que a confirmam contam-se como
   respondidas: quem diz que faltam é a própria pergunta, logo abaixo.
   Recebe: id — o valor de fisco.isencao; c — o contrato (o do formulário, ou
   o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML), ou '' sem isenção ou quando ela conta. */
function ctIsencaoCaso(id,c){
  if(!id||!c)return '';
  const x=(irsAno(YEAR).isencoes||[]).find(i=>i.id===id);
  if(!x)return 'Esta isenção não existe nas regras de '+YEAR+'.';
  const f=fiscoDe(c),conf={};[].concat(x.pede||[]).forEach(k=>{conf[k]=true});
  const porque=irsIsencaoMotivo(Object.assign({},c,{fisco:Object.assign({},f,conf)}),YEAR);
  return porque?'Atenção: '+porque+'.':'';
}
/* A isenção escolhida no contrato, como a versão do ano corrente a escreve.
   Recebe: c — o contrato (o do formulário, ou o da base).
   Devolve: a isenção da versão ({id, quadro, pede, pedeIhru…}), ou null. */
function ctIsencaoDe(c){
  const id=fiscoDe(c).isencao;
  return id?(irsAno(YEAR).isencoes||[]).find(x=>x&&x.id===id)||null:null;
}
/* As isenções que o formulário oferece: as da versão do ano corrente cujas
   datas servem a este contrato — celebrado (fisco.celebracao, senão o
   início) desde o `desde` e até ao `celebradoAte` da versão: o PAA só aos
   celebrados até 31/08/2026, o RSAA desde 01/09/2026, o ex-alojamento local
   até 31/12/2024 (D46). Sem data ainda, todas. Uma isenção com
   `datasPelaCelebracao` (a renda antiga: o início pode ser de quem herdou ou
   comprou com o inquilino lá dentro) mede-se só pela celebração escrita; sem
   ela, oferece-se. E só as da finalidade do contrato (o `finalidade` de cada
   isenção — todas são de habitação; com a finalidade em branco, todas). A já
   escolhida fica sempre, para se ver e se poder trocar (a dica diz porque
   não conta); uma que a versão já não tem fica com o id.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: [{v, label}] — a primeira é «Nenhuma» (v ''). */
function ctIsencoesOferecidas(c){
  const f=fiscoDe(c),isens=irsAno(YEAR).isencoes||[],iso=/^\d{4}-\d{2}-\d{2}$/,fin=String(f.finalidade||'');
  const serve=x=>{
    const cel=String(x.datasPelaCelebracao?f.celebracao||'':f.celebracao||(c&&c.start)||'');
    const datas=!iso.test(cel)||((!x.desde||cel>=x.desde)&&(!x.celebradoAte||cel<=x.celebradoAte));
    return datas&&(!fin||!Array.isArray(x.finalidade)||x.finalidade.indexOf(fin)>-1);
  };
  const out=[{v:'',label:'Nenhuma'}].concat(isens.filter(x=>x&&(x.id===f.isencao||serve(x))).map(x=>({v:x.id,label:x.nome})));
  if(f.isencao&&!isens.some(x=>x&&x.id===f.isencao))out.push({v:f.isencao,label:f.isencao.toUpperCase()});
  return out;
}
/* A isenção escolhida pede esta confirmação? Os campos do `pede` da versão
   (a renda antiga: nrau3536; o ex-alojamento local: alRegistado2022), e
   'ihru' para a que pede o dia do envio ao IHRU (o RSAA: pedeIhru).
   Recebe: c — o contrato; campo — 'nrau3536', 'alRegistado2022' ou 'ihru'.
   Devolve: true se a pergunta desse campo se mostra. */
function ctIsencaoPede(c,campo){
  const x=ctIsencaoDe(c);if(!x)return false;
  if(campo==='ihru')return !!(x.pedeIhru||x.prazoIhru);
  return [].concat(x.pede||[]).indexOf(campo)>-1;
}
/* A dica por baixo de uma pergunta que confirma uma isenção: a lei que a
   pede e o que acontece em «Não sei» — e, no ex-alojamento local, até que
   ano vale (o ateAno da versão).
   Recebe: campo — 'nrau3536' ou 'alRegistado2022'.
   Devolve: o texto (sem HTML). */
function ctPedeDica(campo){
  const x=(irsAno(YEAR).isencoes||[]).find(i=>i&&[].concat(i.pede||[]).indexOf(campo)>-1)||{};
  const lei=x.lei?' ('+x.lei+')':'';
  if(campo==='nrau3536')return 'É o que a isenção pede'+lei+': as rendas antigas de um inquilino com rendimentos baixos, ou com 65 ou mais anos, ou com deficiência de 60 % ou mais. Em «Não sei», a isenção não conta.';
  return 'É o que a isenção pede'+lei+(x.ateAno?', e vale para as rendas até às de '+x.ateAno:'')+'. Em «Não sei», a isenção não conta.';
}
/* A pergunta do ex-alojamento local (o 6F, N156): o EBF art. 74.º-A n.º 1
   pede o alojamento local registado E afeto a esse fim a 31/12/2022 (OC
   20268/2024, ponto 13; PIV 25740: um AL fechado antes não conta), e o
   contrato celebrado e registado no Portal das Finanças nas datas da versão
   (o desde e o celebradoAte da isenção).
   Devolve: o texto (sem HTML). */
function ctAlPergunta(){
  const x=(irsAno(YEAR).isencoes||[]).find(i=>i&&[].concat(i.pede||[]).indexOf('alRegistado2022')>-1)||{};
  const quando=x.desde&&x.celebradoAte?' entre '+dPT(x.desde)+' e '+dPT(x.celebradoAte):x.celebradoAte?' até '+dPT(x.celebradoAte):'';
  return 'O imóvel ainda estava em alojamento local, registado e afeto a esse fim, a 31/12/2022, e este contrato foi celebrado e registado no Portal das Finanças'+quando+'?';
}
/* A dica do dia do envio ao IHRU (RSAA, D46): até quando se envia — o
   `prazoIhru` da versão no ano seguinte ao da celebração (ou ao do início,
   sem ela) — e o que acontece sem o envio. É o mesmo campo que o «Marcar
   como enviado» do aviso grava (prazos.js:pzMarcarIhru).
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML). */
function ctIhruDica(c){
  /* sem a isenção escolhida (a caixa escondida), a da versão que pede o envio */
  const x=ctIsencaoDe(c)||(irsAno(YEAR).isencoes||[]).find(i=>i&&i.prazoIhru)||{};
  const md=String(x.prazoIhru||''),f=fiscoDe(c),cel=String(f.celebracao||(c&&c.start)||'');
  const ok=/^\d{2}-\d{2}$/.test(md),prazo=ok&&/^\d{4}-\d{2}-\d{2}$/.test(cel)?dPT((Number(cel.slice(0,4))+1)+'-'+md)
    :ok?md.slice(3)+'/'+md.slice(0,2)+' do ano seguinte ao da celebração':'ao prazo da lei';
  return 'A cópia do contrato e o comprovativo da comunicação às Finanças vão à plataforma do IHRU até '+prazo+': sem isso, as rendas não ficam isentas de IRS. Escreve o dia em que os enviaste.';
}
/* A dica da data de celebração (D108): para que serve na app — o regime da
   redução e o quadro 4.2C (o ano do `limiteRendaAlta` da versão) —, e que o
   Anexo F pede a data de início, não esta.
   Devolve: o texto (sem HTML). */
function ctCelebracaoDica(){
  const L=irsAno(YEAR).taxas.limiteRendaAlta,desde=L&&/^\d{4}/.test(String(L.desde||''))?String(L.desde).slice(0,4):'';
  return 'O dia em que assinaram: decide o regime da redução pela duração'+(desde?' e se o quadro 4.2C se aplica (contratos celebrados desde '+desde+')':'')+'. No Anexo F vai a data de início, não esta.';
}
/* O contrato do formulário é novo (ainda não está na base)? O ctModal sem id
   cria um com um id novo (dados.js:normContract), que só entra na base ao
   guardar.
   Recebe: c — o contrato do formulário.
   Devolve: true ou false. */
function ctNovo(c){return !c||!c.id||!contract(c.id)}
/* O que a data de celebração mostra (KAN-160, decisão do Martinho: hoje só
   nos novos): a escrita; senão, num contrato novo que ainda não a mostrou,
   hoje; senão o início — em branco a app conta o início, e por isso gravar
   sem mexer não muda o IRS de um contrato antigo. A que vem do início segue-o
   (ctInicioMudou) até ser escrita à mão (ctCelebracaoMudou).
   Recebe: c — o contrato do formulário.
   Devolve: {valor, segue} — 'AAAA-MM-DD' (ou '' sem início), e true quando é
   o início. */
function ctCelebracaoNoCampo(c){
  const f=fiscoDe(c);
  if(dataExiste(f.celebracao))return {valor:f.celebracao,segue:false};
  if(ctNovo(c)&&_ctAbertas.c_fcel!==true)return {valor:today(),segue:false};
  return {valor:dataExiste(c&&c.start)?c.start:'',segue:true};
}
/* A data de celebração como se grava, lida do campo (KAN-160): a do campo,
   ou '' quando é o dia do início (ctCelebracaoOutra), que quer dizer o mesmo —
   assim um contrato antigo sem ela, aberto e gravado sem mexer, fica igual.
   Recebe: inicio — o início do contrato como está escrito.
   Devolve: 'AAAA-MM-DD' ou ''. */
function ctCelebracaoDoCampo(inicio){
  const v=String(val('c_fcel')||'');
  return dataExiste(v)&&ctCelebracaoOutra({start:inicio,fisco:{celebracao:v}})?v:'';
}
/* A frase curta por baixo da data de celebração (KAN-160): uma assinatura
   depois do início avisa — num contrato antigo registado agora, o hoje que o
   campo traz não é o dia em que assinaram.
   Recebe: c — o contrato (o do formulário com a data do campo, ou o que
   ctEmEdicao devolve).
   Devolve: o texto (sem HTML), ou ''. */
function ctCelebracaoCaso(c){
  const cel=String(fiscoDe(c).celebracao||''),ini=String((c&&c.start)||'');
  if(!dataExiste(cel)||!dataExiste(ini)||cel<=ini)return '';
  return 'Esta data é depois do início ('+dPT(ini)+'). Se assinaram antes ou no próprio dia, corrige-a.';
}
/* A dica do n.º do contrato (D85): nos começados antes de 1 de abril de 2015
   (prazos.js:PZ_MODELO2_DESDE) não há Modelo 2 — o n.º vem do registo dos
   elementos mínimos no Portal das Finanças.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML). */
function ctNumeroDica(c){
  if(ctAntesDoModelo2(c))return 'Começou antes de abril de 2015: não tem Modelo 2. O n.º vem do registo dos elementos mínimos do contrato no Portal das Finanças; o Anexo F pede-o em cada linha.';
  return 'Vem no comprovativo do Modelo 2; o Anexo F pede-o em cada linha.';
}
/* A frase curta por baixo do n.º (KAN-161): só num contrato começado antes
   de 1 de abril de 2015, que não tem Modelo 2 (o resto é o «?»,
   ctNumeroDica).
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML), ou ''. */
function ctNumeroCaso(c){
  return ctAntesDoModelo2(c)?'Começou antes de abril de 2015: não tem Modelo 2.':'';
}
/* A dica de um contrato por indicar perante a AT (D85): o Modelo 2 e o
   prazo dele; nos começados antes de 1 de abril de 2015, o registo dos
   elementos mínimos, sem Modelo 2 nem prazo; num imóvel fora de Portugal
   (prazos.js:pzForaDePortugal), sem Modelo 2: as rendas vão ao Anexo J. A
   pergunta está no rótulo do grupo (ctSegmentoAt): a dica diz o que quer
   dizer «Ainda não» — as rendas contam e a app lembra o prazo —, e um prazo
   que já passou diz-se no passado.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML). */
function ctPorIndicarDica(c){
  if(c&&pzForaDePortugal(c.propertyId))return 'Fora de Portugal não há Modelo 2: as rendas vão ao Anexo J, com o imposto pago lá. Com «Sim» ou «Ainda não sei», a Declaração conta-as; com «Não vou declarar», ficam de fora.';
  if(ctAntesDoModelo2(c))return 'Começou antes de abril de 2015: não tem Modelo 2. Regista-se no Portal das Finanças com os elementos mínimos do contrato, e é desse registo que vem o n.º que o Anexo F pede. Com «Ainda não», as rendas contam no resumo do Anexo F.';
  const caso=ctPorIndicarCaso(c);
  return 'Com «Ainda não», as rendas contam no resumo do Anexo F e a app lembra-te o prazo do Modelo 2.'+(caso?' '+caso:'');
}
/* A frase curta por baixo de «Ainda não» (KAN-161; a explicação inteira é a
   do «?», ctPorIndicarDica): o prazo do Modelo 2 deste contrato — o fim do
   mês seguinte ao início, no passado quando já passou; num começado antes de
   abril de 2015, que não tem Modelo 2. Fora de Portugal, nada.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML), ou ''. */
function ctPorIndicarCaso(c){
  if(c&&pzForaDePortugal(c.propertyId))return '';
  if(ctAntesDoModelo2(c))return 'Começou antes de abril de 2015: não tem Modelo 2.';
  const ini=String((c&&c.start)||''),prazo=/^\d{4}-\d{2}-\d{2}$/.test(ini)?fimDoMesSeguinte(ini):'';
  return !prazo?'':prazo<today()?'O prazo era '+dPT(prazo)+', o fim do mês seguinte ao início: comunica-o quanto antes.':'O prazo é '+dPT(prazo)+', o fim do mês seguinte ao início.';
}
/* O que «Não vou declarar» quer dizer (D85), para o «?» do segmentado:
   fica fora do resumo e dos prazos (num imóvel fora de Portugal, fora da
   Declaração), muda-se quando se quiser, e o Modelo 2 é do Imposto do Selo.
   Recebe: c — o contrato.
   Devolve: o texto (sem HTML). */
function ctNaoDeclaradoDica(c){
  const fora=!!c&&pzForaDePortugal(c.propertyId);
  return ctNaoDeclaradoCaso(c)+' Podes mudar isto quando quiseres.'+(!fora&&!ctAntesDoModelo2(c)?' A comunicação do contrato às Finanças (o Modelo 2) é do Imposto do Selo: esta escolha só diz respeito ao IRS.':'');
}
/* A frase curta por baixo de «Não vou declarar» (KAN-161): o que fica de
   fora com esta escolha.
   Recebe: c — o contrato.
   Devolve: o texto (sem HTML). */
function ctNaoDeclaradoCaso(c){
  return c&&pzForaDePortugal(c.propertyId)?'As rendas deste contrato ficam fora da Declaração.':'Este contrato fica fora do resumo do Anexo F e dos prazos da AT.';
}
/* O que «Sim» quer dizer num imóvel fora de Portugal (D133), para o «?» do
   segmentado: o Anexo J, e nada do Modelo 2 nem dos recibos.
   Devolve: o texto (sem HTML). */
function ctForaDica(){
  return 'Imóvel fora de Portugal: as rendas não vão ao Anexo F, nem há Modelo 2, recibos eletrónicos ou comunicações à AT. Declaram-se no Anexo J, com as despesas do período arrendado e o imposto pago lá.';
}
/* O contrato começou antes de haver Modelo 2 (1 de abril de 2015,
   prazos.js:PZ_MODELO2_DESDE)?
   Recebe: c — o contrato.
   Devolve: true ou false (sem início, false). */
function ctAntesDoModelo2(c){
  const s=String((c&&c.start)||'');
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&s<PZ_MODELO2_DESDE;
}
/* A dica do que se paga à parte (D48, N096): o limite das rendas moderadas
   do ano (irs-AAAA.js:taxas.rendaModerada) testa a renda com o que o
   inquilino paga à parte pelos móveis e equipamentos ligados ao imóvel com
   carácter de permanência e pelos serviços que o valorizam, mesmo em
   contrato separado, com o valor anual dividido pelos meses (DL 97/2026,
   art. 3.º n.os 1 e 3) — o irs.js:irsRendaMensalDoTeste soma-lhe este valor.
   A AT ainda não disse como lê o artigo: na dúvida, confirma. E o que se paga
   pelos móveis também é renda a declarar (CIRS art. 8.º n.º 2 b), a natureza
   da versão, naturezas.mobiliario).
   Devolve: o texto (sem HTML); '' sem rendas moderadas no ano. */
function ctExtrasDica(){
  const v=irsAno(YEAR),m=v.taxas.rendaModerada;if(!m)return '';
  const nat=(v.naturezas||{}).mobiliario;
  return 'Para o limite das rendas moderadas ('+dec(m.taxa)+' % até '+euro(m.limiteMensal)+' por mês) soma-se à renda o que o inquilino paga à parte pelos móveis e equipamentos ligados ao imóvel com carácter de permanência e pelos serviços que o valorizam, mesmo num contrato separado; um valor anual divide-se pelos meses (DL 97/2026, art. 3.º). Na dúvida, confirma.'
    +' O que o inquilino paga pelos móveis também é renda a declarar no Anexo F (CIRS art. 8.º n.º 2'+(nat?', natureza '+nat:'')+').';
}
/* As obras de conservação pagas nos 24 meses antes do início do contrato
   que a Declaração conta como «obras antes do arrendamento» (CIRS art. 41.º
   n.º 7) — a regra do fisco-resumo.js:fiscoObra24De, vista deste contrato
   (também do que ainda não está gravado): despesas do imóvel na coluna das
   obras dos 24 meses, ou de conservação sem contrato em vigor nesse dia,
   pagas desde 24 meses antes do início e antes dele, quando nenhum outro
   contrato do imóvel começa entre o pagamento e este início. Não exclui o
   primeiro contrato do imóvel: é o caso típico do n.º 7 (D28). Só com a
   Declaração ligada (é ela que as usa).
   Recebe: c — o contrato (o do formulário, ou o da base).
   Devolve: null sem obras; senão {desde} — o dia do primeiro pagamento ('AAAA-MM-DD'). */
function ctObrasAntes(c){
  if(!c||!c.propertyId||!servicoLigado('fisco')||!/^\d{4}-\d{2}-\d{2}$/.test(String(c.start||'')))return null;
  const de=fiscoMenos24(c.start),pid=c.propertyId;let desde='';
  (db.transactions||[]).forEach(t=>{
    if(!t||t.kind!=='expense')return;
    const d=String(t.date||'');if(!d||d<de||d>=c.start)return;
    const col=irsColunaDe(t).col;if(col!=='obras24'&&col!=='conservacao')return;
    if(!txProps(t).some(p=>p&&p.id===pid))return;
    const outros=(db.contracts||[]).filter(x=>x&&x.id!==c.id&&x.propertyId===pid&&x.start);
    /* a conservação paga com outro contrato em vigor é desse (fiscoHaviaContrato,
       sem este: a versão gravada dele não conta contra a que se escreve) */
    if(col==='conservacao'&&outros.some(x=>{if(x.start>d)return false;const f=fiscoFimDaVida(x);return f!==null&&(!f||f>=d)}))return;
    if(outros.some(x=>x.start>d&&x.start<c.start))return;
    if(!desde||d<desde)desde=d;
  });
  return desde?{desde:desde}:null;
}
/* A pergunta das obras antes do início (D28): «Entre setembro de 2025 e
   01/06/2026, o imóvel esteve só à espera de inquilino…» — do mês do primeiro
   pagamento ao início do contrato.
   Recebe: c — o contrato; o — o ctObrasAntes dele (ou null).
   Devolve: o texto (sem HTML). */
function ctObrasPergunta(c,o){
  const d=o&&o.desde?String(o.desde):'',mes=d?(MESES[Number(d.slice(5,7))-1]||'')+' de '+d.slice(0,4):'';
  return (mes?'Entre '+mes+' e '+dPT(c.start)+', o':'Antes do início, o')+' imóvel esteve só à espera de inquilino, sem uso teu, da família nem alojamento local?';
}
/* A pergunta da atualização de 2023 (D76) faz-se nos contratos começados
   antes de 2022 — a mesma regra do fisco-resumo.js (l.atualizacao2023).
   Recebe: c — o contrato.
   Devolve: true se a pergunta se mostra. */
function ctAtualizacao2023Visivel(c){
  const s=String((c&&c.start)||'');
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&s<'2022-01-01';
}
/* A taxa escrita no contrato que não é a da lei do ano (D17): a Declaração
   usa sempre a da lei de cada ano (irs.js:irsTaxa), e a escrita serve só à
   renda líquida do formulário e da ficha.
   Recebe: c — o contrato (com taxRate; o do formulário ou o que ctEmEdicao devolve).
   Devolve: o texto do aviso (sem HTML), ou '' sem taxa escrita, quando é a
   da lei ou sem taxa da lei a comparar (ctSemEstimativa). */
function ctTaxaEscritaAviso(c){
  const escrita=Number(c&&c.taxRate)||0;if(!(escrita>0))return '';
  /* sem taxa da lei a comparar (fora de Portugal, categoria B) não há aviso */
  if(ctSemEstimativa(c))return '';
  const lei=irsRate(c,YEAR);
  if(Math.round(escrita*100)===Math.round(lei*100))return '';
  return 'Escreveste '+dec(escrita)+' %, e pelas regras de '+YEAR+' a taxa deste contrato é '+dec(lei)+' % ('+irsTaxaPorque(c,YEAR)+'). Na Declaração conta sempre a da lei de cada ano: a escrita serve só para a renda líquida.';
}
/* O contrato cujas rendas não têm a taxa especial do Anexo F, e por isso
   nenhuma estimativa do imposto: as de um imóvel fora de Portugal vão ao
   Anexo J, com o imposto pago lá (D133, decisão do Martinho: sem estimativa),
   e as tributadas na categoria B vão ao Anexo B ou C com a atividade (D134).
   A ordem e a regra são as do resumo (fisco-resumo.js:fiscoForaDoAnexoF): a
   categoria B em qualquer estado menos o «Não declarado» (que fica fora de
   tudo) e antes do país — um imóvel lá fora afeto à atividade é da
   atividade (N056). A regra é uma só, a do motor (irs.js:irsSemEstimativa),
   que a lista dos contratos e a Avaliação também leem.
   Recebe: c — o contrato (o do formulário, o que ctEmEdicao devolve, ou o da base).
   Devolve: 'fora', 'catB' ou ''. */
function ctSemEstimativa(c){return irsSemEstimativa(c)}
/* A frase de quando não há estimativa do imposto (ctSemEstimativa), para a
   caixa da renda líquida do formulário.
   Recebe: c — o contrato.
   Devolve: o texto (sem HTML); '' quando há estimativa. */
function ctSemEstimativaTexto(c){
  const s=ctSemEstimativa(c);
  if(s==='fora')return 'Num imóvel fora de Portugal a app não estima o imposto: as rendas vão ao Anexo J, com o imposto pago lá. Escreve a taxa, se a souberes, para veres a renda líquida.';
  if(s==='catB')return 'Nas rendas da categoria B a app não estima o imposto: depende da tua atividade (Anexo B ou C). Escreve a taxa, se a souberes, para veres a renda líquida.';
  return '';
}
/* O nome da finalidade do bloco fiscal, também a do direito real de
   habitação duradoura (dados.js:FISCO_FINALIDADES_TODAS).
   Recebe: fin — o id ('hp', 'hnp', 'nh', 'dhd' ou '').
   Devolve: o nome, ou ''. */
function ctFinalidadeNome(fin){return (FISCO_FINALIDADES_TODAS.find(x=>x[0]===fin)||[])[1]||''}
/* A dica da finalidade: num direito real de habitação duradoura (D120), o
   quadro e a taxa da versão do ano, e de onde vêm a escritura e a caução que
   esse quadro pede. Nas outras finalidades, nada.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML), ou ''. */
function ctFinalidadeDica(c){
  if(fiscoDe(c).finalidade!=='dhd')return '';
  const v=irsAno(YEAR),q=v.quadros.dhd,t=v.taxas.dhd;
  return 'O direito real de habitação duradoura (DL 1/2020) vai ao quadro '+q+' do Anexo F, e não ao '+v.quadros.semReducao+(t!=null?': a prestação mensal paga '+dec(t)+' %':'')
    +'. A data da escritura é o início do contrato, e o valor da caução é a caução do contrato.';
}
/* O quadro do Anexo F a que vai a linha do contrato no ano corrente, para a
   ficha: o 4.3 num direito real de habitação duradoura (o da versão,
   quadros.dhd), o 4.1 com a isenção, o 4.2 com a redução pela duração, senão
   o 4.1 com o porquê da taxa.
   Recebe: c — o contrato; isento — a isenção que conta (ou null); reduzida —
   true com a redução pela duração.
   Devolve: o texto (por escapar). */
function ctQuadroDaFicha(c,isento,reduzida){
  const v=irsAno(YEAR),t=irsTaxa(c,YEAR);
  if(t.motivo==='dhd')return 'quadro '+v.quadros.dhd+' · '+irsTaxaPorque(c);
  /* num imóvel subarrendado, as rendas vão ao quadro 5 (irs.js:irsTaxaDoSubarrendamento) */
  if(t.sublocacao===true&&v.quadros.sublocacao)return 'quadro '+v.quadros.sublocacao+' · '+irsTaxaPorque(c);
  return isento?'quadro '+v.quadros.semReducao+' · isento':reduzida?'quadro '+v.quadros.comReducao+' · pela duração':'quadro '+v.quadros.semReducao+' · '+irsTaxaPorque(c);
}
/* A pergunta da entidade de gestão florestal (D119) faz-se num imóvel
   rústico em Portugal: o benefício do quadro 6C (EBF art. 59.º-G) é dos
   prédios rústicos florestais arrendados a uma EGF ou UGF reconhecida.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: true se a pergunta se mostra. */
function ctEgfVisivel(c){
  const p=c&&c.propertyId?prop(c.propertyId):null;
  return !!p&&p.tipoPredio==='R'&&!pzForaDePortugal(c.propertyId);
}
/* A dica da entidade de gestão florestal: o texto e o quadro do benefício da
   versão do ano (o que tem a marca do contrato, egf), e — marcado e sem
   valer no ano corrente — porquê (irs.js:irsBeneficiosAvaliados: celebrado
   depois de 2020, os 12 anos acabados, a lei sem prorrogação…).
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML); '' sem o benefício na versão. */
function ctEgfDica(c){
  const b=(irsAno(YEAR).beneficios||[]).find(x=>x&&x.marca==='contrato.egf');if(!b)return '';
  const caso=ctEgfCaso(c);
  return b.texto+' Declara-se no quadro '+b.quadro+' do Anexo F, que aponta para a linha do contrato no quadro '+irsAno(YEAR).quadros.semReducao+'.'
    +(caso?' '+caso:'');
}
/* Porque a gestão florestal marcada não conta no ano corrente
   (irs.js:irsBeneficiosAvaliados), para a frase curta por baixo do
   interruptor (KAN-161); a explicação inteira é a do «?» (ctEgfDica).
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (sem HTML), ou '' desligada, a contar, ou sem o benefício. */
function ctEgfCaso(c){
  const b=(irsAno(YEAR).beneficios||[]).find(x=>x&&x.marca==='contrato.egf');
  if(!b||fiscoDe(c).egf!==true)return '';
  const av=irsBeneficiosAvaliados(c,YEAR).find(x=>x.beneficio&&x.beneficio.id===b.id);
  return av&&!av.aplica&&av.motivo?'Atenção: em '+YEAR+' não conta — '+av.motivo+'.':'';
}
/* A dica da categoria B (D134, D7, N029): desligada, quem responde «Sim» —
   as duas maneiras de as rendas lá irem, sempre com atividade aberta — e o
   que acontece; ligada, o que muda: saem do Anexo F, o contrato continua com
   o Modelo 2 e não há recibos de renda (a fatura da atividade,
   ctCategoriaBDocumento). Não é o «Não vou declarar».
   Recebe: ligado (opcional) — true com a marca ligada.
   Devolve: o texto (sem HTML). */
function ctCategoriaBDica(ligado){
  if(ligado===true)return 'As rendas deste contrato saem do Anexo F e declaram-se no Anexo B ou C, com a tua atividade. '+ctCategoriaBDocumento();
  return 'Só com atividade aberta: se optaste por tributar estas rendas na categoria B (CIRS art. 4.º n.º 1 n), na declaração de início ou de alterações de atividade), ou se o imóvel está afeto à tua atividade empresarial ou profissional (art. 3.º n.º 2 a)). Ligado, as rendas saem do Anexo F e vão ao Anexo B ou C. Sem atividade aberta, fica desligado.';
}
/* Os anos do imposto pago no estrangeiro que o formulário pergunta (D133):
   os três últimos até ao ano corrente, desde o do início do contrato, e os
   que já têm valor guardado.
   Recebe: c — o contrato do formulário.
   Devolve: ['AAAA', …] por ordem. */
function ctAnosImpostoEstrangeiro(c){
  const ini=/^\d{4}/.test(String((c&&c.start)||''))?Number(String(c.start).slice(0,4)):YEAR-1;
  const anos={};
  for(let a=Math.min(YEAR,Math.max(ini,YEAR-2));a<=YEAR;a++)anos[a]=1;
  Object.keys(fiscoDe(c).impostoEstrangeiro||{}).forEach(k=>{if(/^\d{4}$/.test(k))anos[k]=1});
  return Object.keys(anos).sort();
}
/* Os campos do imposto pago no estrangeiro, um por ano de rendas
   (ctAnosImpostoEstrangeiro), dois por linha, com a dica do Anexo J.
   Recebe: c — o contrato do formulário.
   Devolve: o HTML. */
function ctImpostoEstrangeiroCampos(c){
  const ie=fiscoDe(c).impostoEstrangeiro||{},anos=ctAnosImpostoEstrangeiro(c),linhas=[];
  for(let i=0;i<anos.length;i+=2)linhas.push(anos.slice(i,i+2));
  const campo=a=>`<label>Pelas rendas de ${a} (€)<input id="c_fie_${a}" type="text" inputmode="decimal" class="num" value="${ie[a]!=null?dec(ie[a]):''}" placeholder="Opcional" autocomplete="off"></label>`;
  return `<div class="ct-campo">${ctQ('<div class="flabel">Imposto pago no estrangeiro</div>','ie',false,'ct-q-fl')}
    ${linhas.map(l=>`<div class="ct-par">${l.map(campo).join('')}</div>`).join('')}
    <div class="hint">Em branco: nada pago lá.</div></div>`;
}
/* A explicação do imposto pago no estrangeiro (D133), para o «?» do grupo.
   Devolve: o texto (sem HTML). */
function ctImpostoEstrangeiroDica(){
  return 'O imposto sobre estas rendas pago no país do imóvel, com o comprovativo. O Anexo J pede-o ao lado das rendas, e abate ao IRS daqui pelo crédito de imposto (CIRS art. 81.º). Em branco: nada pago lá.';
}
/* O que vale a taxa em branco, para o «Em branco: …» por baixo do campo do
   imposto: a estimativa do ano corrente (irsRate), ou «sem estimativa» fora
   de Portugal e na categoria B (ctSemEstimativa).
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto («25 %», «sem estimativa»). */
function ctTaxaVazia(c){return ctSemEstimativa(c)?'sem estimativa':dec(irsRate(c))+' %'}
/* A dica por baixo do campo do imposto: o que vale em branco (#c_taxVazio)
   e que a Declaração usa sempre a da lei (D17); sem estimativa, porquê
   (ctSemEstimativaTexto). A lista das taxas do ano já não vive aqui (N130):
   a caixa da renda líquida diz a estimada e porquê.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o HTML da dica. */
function ctTaxaDica(c){
  if(ctSemEstimativa(c))return `Em branco: <b id="c_taxVazio">sem estimativa</b>. ${esc(ctSemEstimativaTexto(c))}`;
  return `Em branco: <b id="c_taxVazio">${esc(ctTaxaVazia(c))}</b>, a estimativa para ${YEAR}. Na Declaração conta sempre a taxa da lei de cada ano: a que escreves aqui serve só para a renda líquida.`;
}
/* Os encargos do imóvel que o contrato põe a cargo do inquilino (o Q13,
   c.encargosInquilino), pelos nomes de dados.js:ENCARGOS_DO_INQUILINO e pela
   ordem dela.
   Recebe: c — o contrato.
   Devolve: o texto («Condomínio, IMI»), ou '' sem nenhum. */
function ctEncargosNomes(c){
  const ids=Array.isArray(c&&c.encargosInquilino)?c.encargosInquilino:[];
  return ENCARGOS_DO_INQUILINO.filter(e=>ids.indexOf(e.id)>-1).map(e=>e.nome).join(', ');
}
/* O bloco «Encargos a cargo do inquilino» do formulário (o Q13): um
   interruptor por encargo de dados.js:ENCARGOS_DO_INQUILINO, e a dica do que
   muda de verdade (planeados.js:recEncargoDoInquilino) — enquanto o contrato
   estiver em vigor, os planeados do IMI e do condomínio deste imóvel e o do
   seguro da ficha dele ficam suspensos, para não se pagarem nem confirmarem
   duas vezes; a água, a luz e o gás e um seguro adicionado à mão não se
   reconhecem, e a dica não os promete.
   Da ronda 2 (N126): tudo atrás de «O inquilino paga algum encargo do
   imóvel?» (desligado por omissão; ligado quando já há algum, ou os consumos
   incluídos); só os encargos que a ficha do imóvel tem com valor (o IMI, o
   condomínio, o seguro) e os já marcados — sem nenhum na ficha, os três — com
   «Outro encargo» para os restantes; e os consumos numa escolha só (o
   inquilino paga-os à parte, incluídos na renda, ou não se aplica), que
   escreve o encargo 'consumos' ou o campo 30 do Modelo 2
   (fisco.consumosIncluidos), nunca os dois (collectCt).
   Recebe: c — o contrato do formulário.
   Devolve: o HTML. */
function ctEncargosCampos(c){
  const ids=Array.isArray(c&&c.encargosInquilino)?c.encargosInquilino:[];
  const p=c&&c.propertyId?prop(c.propertyId):null,aberto=ctEncargosTem(c)||_ctAbertas.c_encQ===true;
  const doImovel=ENCARGOS_DO_INQUILINO.filter(e=>e.id!=='consumos');
  const naFicha=e=>!!p&&Number(p[e.id])>0,algum=doImovel.some(naFicha);
  const mostra=e=>!algum||naFicha(e)||ids.indexOf(e.id)>-1,outros=doImovel.some(e=>!mostra(e));
  const cons=ctConsumosValor(c);
  return `<div class="ct-campo">${ctInterruptor('c_encQ',aberto,'O inquilino paga algum encargo do imóvel?','O condomínio, o IMI, o seguro, ou a água, a luz e o gás (também quando a renda os inclui).','ctEncargosMudou()')}
    <div id="c_encBox"${aberto?'':' hidden'}><div class="form">
    <div class="ct-campo" role="group" aria-labelledby="c_encRot"><div class="flabel" id="c_encRot">Encargos a cargo do inquilino</div>
    ${doImovel.map(e=>`<div id="c_encW_${e.id}"${mostra(e)?'':' hidden'}>${ctInterruptor('c_enc_'+e.id,ids.indexOf(e.id)>-1,e.nome,'')}</div>`).join('')}
    ${outros?`<div id="c_encOutros"><button type="button" class="btn sm ct-abre" data-toca="rascunho" data-click="ctEncargosOutros()">Outro encargo</button></div>`:''}
    <div class="hint ct-colado">Os que o contrato põe a pagar ao inquilino. Enquanto o contrato estiver em vigor, os planeados do IMI e do condomínio deste imóvel, e o do seguro da ficha do imóvel, ficam suspensos: não se pedem nem se confirmam. Os da água, da luz e do gás, e um seguro adicionado à mão, continuam a pedir-se: não os confirmes nos meses em que o inquilino os paga.</div></div>
    <label>Água, luz e gás${sel('c_fconsumos',cons,[{v:'',label:'Não se aplica'},{v:'inquilino',label:'O inquilino paga-os à parte'},{v:'incluidos',label:'Incluídos na renda'}],'ctConsumosMudou','rascunho')}</label>
    <div class="hint ct-colado" id="c_fconsumosHint">${esc(ctConsumosDica(cons))}</div>
    </div></div></div>`;
}
/* O contrato já diz algum encargo a cargo do inquilino, ou que a renda
   inclui os consumos? Então a pergunta dos encargos vem com «Sim».
   Recebe: c — o contrato.
   Devolve: true ou false. */
function ctEncargosTem(c){
  return (Array.isArray(c&&c.encargosInquilino)&&c.encargosInquilino.length>0)||fiscoDe(c).consumosIncluidos===true;
}
/* A resposta dos consumos para a escolha do formulário: 'incluidos' com o
   campo 30 do Modelo 2 (fisco.consumosIncluidos — num dado antigo com os
   dois, este ganha: é o que conta na Declaração), 'inquilino' com o encargo
   'consumos', senão ''.
   Recebe: c — o contrato.
   Devolve: 'incluidos', 'inquilino' ou ''. */
function ctConsumosValor(c){
  if(fiscoDe(c).consumosIncluidos===true)return 'incluidos';
  return Array.isArray(c&&c.encargosInquilino)&&c.encargosInquilino.indexOf('consumos')>-1?'inquilino':'';
}
/* A dica da escolha dos consumos: o que cada resposta faz na Declaração
   (D26 — os consumos que o senhorio paga só contam como gasto quando a renda
   os inclui e o Modelo 2 o declarou, campo 30).
   Recebe: v — 'incluidos', 'inquilino' ou ''.
   Devolve: o texto (sem HTML). */
function ctConsumosDica(v){
  if(v==='incluidos')return 'Só quando o contrato o diz e o Modelo 2 o declarou (campo 30): os consumos que pagas deste imóvel contam como gasto no Anexo F.';
  if(v==='inquilino')return 'São do inquilino: os que pagares deste imóvel não se deduzem.';
  return 'Os consumos que pagares deste imóvel só se deduzem quando a renda os inclui e o Modelo 2 o declarou (campo 30).';
}
/* O sel() dos consumos mudou: a dica acompanha.
   Devolve: nada. */
function ctConsumosMudou(){
  const h=document.getElementById('c_fconsumosHint');if(h)h.textContent=ctConsumosDica(val('c_fconsumos'));
}
/* O «Outro encargo»: mostra os encargos que a ficha do imóvel não tem (o
   condomínio pago pelo inquilino pode não ter valor na ficha).
   Devolve: nada. */
function ctEncargosOutros(){
  ENCARGOS_DO_INQUILINO.forEach(e=>{const w=document.getElementById('c_encW_'+e.id);if(w)w.hidden=false});
  const b=document.getElementById('c_encOutros');if(b)b.hidden=true;
}
/* A pergunta do inquilino empresa (D16) faz-se quando conta: um contrato de
   habitação (permanente ou não) com algum inquilino de NIF de pessoa
   coletiva (irs-papeis.js:nifColetivo — só o sinal que a acende). Para a AT
   a renda é de habitação quando o contrato identifica pelo nome quem lá
   mora (PIV 28246, 26024, 30248); a proibição de sublocar não é condição
   (PIV 30723).
   Recebe: c — o contrato (o do formulário, o que ctEmEdicao devolve, ou o da base).
   Devolve: true se a pergunta se mostra. */
function ctEmpresaVisivel(c){
  if(!c||['hp','hnp'].indexOf(fiscoDe(c).finalidade)<0)return false;
  return ctTenants(c).some(t=>nifColetivo(t.nif));
}
/* A resposta à pergunta do inquilino empresa para o sel() do formulário,
   pelo leitor do motor (irs.js:irsEmpresaMorador — fisco.empresaMorador, ou
   um empresaHabitacao antigo «Sim»).
   Recebe: c — o contrato.
   Devolve: '1' (identifica), '0' (não identifica) ou '' (por responder). */
function ctEmpresaMoradorValor(c){
  const r=irsEmpresaMorador(c);
  return r===true?'1':r===false?'0':'';
}
/* A dica da pergunta do inquilino empresa: só a identificação de quem lá
   mora decide (D16), e o que a AT faz sem ela — a natureza e a taxa do não
   habitacional, lidas da versão do ano.
   Devolve: o texto (sem HTML). */
function ctEmpresaDica(){
  const v=irsAno(YEAR);
  return 'Um inquilino com NIF de empresa ou de outra entidade: a AT só trata a renda como de habitação se o contrato identifica pelo nome a pessoa que lá mora. Sem isso, o arrendamento é não habitacional (natureza '
    +v.naturezas.naoHabitacional+', '+dec(v.taxas.naoHabitacional)+' %, sem a redução pela duração), e a Declaração conta-o assim.';
}
/* O inquilino empresa na ficha (o cartão «Perante a AT»), quando a pergunta
   se aplica (ctEmpresaVisivel): a resposta numa linha (com «Não», a
   Declaração conta o contrato como não habitacional); por responder, a
   linha diz-o a âmbar e a nota diz o que confirmar, com «Responder» para
   quem pode alterar o contrato (ctResponderEmpresa).
   Recebe: c — o contrato.
   Devolve: null quando não se aplica; senão {kv, nota} — o HTML do valor da
   linha e o da nota. */
function ctEmpresaDaFicha(c){
  if(!ctEmpresaVisivel(c))return null;
  const r=irsEmpresaMorador(c),emp=ctTenants(c).find(t=>nifColetivo(t.nif));
  if(r===true)return {kv:'identifica quem lá mora',nota:''};
  if(r===false){
    const v=irsAno(YEAR);
    return {kv:'não identifica quem lá mora: para a AT é não habitacional',
      nota:esc('A Declaração conta este contrato como não habitacional: natureza '+v.naturezas.naoHabitacional+', '+dec(v.taxas.naoHabitacional)+' %, sem a redução pela duração.')};
  }
  const pode=podeEditar(c.propertyId,'contract.add',c);
  return {kv:'<span class="badge amber">Por confirmar</span>',
    nota:esc('Arrendamento de habitação a '+(emp&&emp.name||'uma empresa')+', com NIF de empresa ou de outra entidade. Confirma se o contrato identifica pelo nome quem lá mora: sem isso, a AT trata o arrendamento como não habitacional.')
      +(pode?`<div class="toolbar u-m-9px-0-0"><button type="button" class="btn sm" data-toca="camada" data-click="ctResponderEmpresa('${jsq(c.id)}')">Responder</button></div>`:'')};
}
/* O «Responder» da pergunta do inquilino empresa (a ficha, e o aviso da
   Declaração): abre o formulário do contrato e leva-o à pergunta, com o foco
   no botão da escolha. Quem não pode alterar recebe a ficha (ctModal).
   Recebe: id — o id do contrato.
   Devolve: nada — abre o formulário. */
function ctResponderEmpresa(id){ctIrParaPergunta(id,'c_femp')}
/* Abre o formulário do contrato e leva-o a uma pergunta do bloco fiscal, com
   o foco nela — o «Responder» da ficha e dos avisos da Declaração: o
   inquilino empresa (c_femp), as perguntas das isenções (c_fnrau, c_fal), o
   envio ao IHRU (c_fihru), as obras antes do início (c_fobras), a
   atualização de 2023 (c_fat23), os consumos (c_fconsumos; o c_fcons antigo
   leva lá), a gestão florestal (c_fegf). Um campo dentro de uma caixa fechada
   pela pergunta dela (a particularidade fiscal, os encargos, o que se paga
   à parte, o imposto) abre-a primeiro (ctAbreCaixaDe). Quem não
   pode alterar recebe a ficha (ctModal).
   Recebe: id — o id do contrato; campo — o id do campo.
   Devolve: nada — abre o formulário. */
function ctIrParaPergunta(id,campo){
  ctModal(id);
  if(!cForm||cForm.id!==id)return;
  const k=String(campo||'')==='c_fcons'?'c_fconsumos':String(campo||'');
  ctAbreCaixaDe(k);
  const s=document.getElementById('sel_'+k)||document.getElementById(k),b=document.getElementById('selb_'+k)||document.getElementById(k);
  if(s&&typeof s.scrollIntoView==='function')try{s.scrollIntoView({block:'center'})}catch(e){}
  if(b&&typeof b.focus==='function')try{b.focus({preventScroll:true})}catch(e){}
}
/* Abre a caixa onde vive um campo do formulário do contrato, quando a
   pergunta dela a fechou: liga o interruptor e mostra a caixa (o mesmo que o
   toque nele faz, ctCaixaSegue), ou abre o campo do imposto (ctTaxaOutra).
   Recebe: campo — o id do campo.
   Devolve: nada. */
function ctAbreCaixaDe(campo){
  const k=String(campo||''),pares=[[/^c_(fisen|fnrau|fal|fihru|fcatb)$/,'c_fpart','c_fpartBox'],[/^c_(fconsumos|enc_.+)$/,'c_encQ','c_encBox'],
    [/^c_fextras$/,'c_fextrasQ','c_fextrasBox']];
  if(k==='c_tax')return ctTaxaOutra();
  const par=pares.find(x=>x[0].test(k));if(!par)return;
  const s=document.getElementById(par[1]);
  if(s&&!s.checked){s.checked=true;ctCaixaSegue(par[1],par[2])}
}
/* A nota da ficha quando a isenção escolhida não conta no ano corrente
   (irs.js:irsIsencaoMotivo): porquê e, quando o que falta é uma pergunta do
   contrato (a do 6H, a do 6F, o envio ao IHRU), o «Responder» que leva a ela,
   a quem pode alterar o contrato.
   Recebe: c — o contrato.
   Devolve: o HTML da nota, ou '' (sem isenção, ou ela conta). */
function ctIsencaoNaoContaDaFicha(c){
  const x=ctIsencaoDe(c),m=x?irsIsencaoMotivo(c,YEAR):'';if(!m)return '';
  const f=fiscoDe(c);
  const campo=ctIsencaoPede(c,'nrau3536')&&f.nrau3536!==true?'c_fnrau':ctIsencaoPede(c,'alRegistado2022')&&f.alRegistado2022!==true?'c_fal'
    :ctIsencaoPede(c,'ihru')&&!f.ihru?'c_fihru':'';
  const ok=campo&&podeEditar(c.propertyId,'contract.add',c);
  return esc('Isenção escolhida: '+(x.curto||x.nome)+'. Nas rendas de '+YEAR+', '+m+'.')
    +(ok?`<div class="toolbar u-m-9px-0-0"><button type="button" class="btn sm" data-toca="camada" data-click="ctIrParaPergunta('${jsq(c.id)}','${campo}')">Responder</button></div>`:'');
}
/* As perguntas dos n.os 23 e 24 do art. 72.º só se fazem quando contam: num
   contrato celebrado (ou começado, sem celebração escrita) desde a data do
   n.º 23 que, sem elas, teria redução pela duração no ano corrente.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: true se as perguntas se mostram. */
function ctN23Visivel(c){
  const L=irsAno(YEAR).taxas.limiteRendaAlta;if(!L||!c)return false;
  const f=fiscoDe(c),cel=f.celebracao||c.start||'';
  if(!cel||cel<L.desde)return false;
  return !!irsReducao(Object.assign({},c,{fisco:Object.assign({},f,{rendaAcimaDoLimite:null,rendaAnterior:0,isencao:''})}),YEAR);
}
/* As comunicações da duração (Portaria 110/2019, art. 2.º b); FAQ 5936 da AT)
   que a ficha mostra: a do período de que dependem as rendas do ano anterior
   e a do ano corrente (irs.js:irsComunicacaoDoAno — o contrato inicial ou a
   renovação, o último com redução vivo no ano), cada período uma vez. Faz-se
   uma vez por período, até 15 de fevereiro do ano seguinte ao início dele, e
   vale para todos os anos dele. Com dois períodos à vista (uma renovação
   começada este ano), o de antes só fica se está por fazer.
   Recebe: c — o contrato; hoje (opcional) — 'AAAA-MM-DD' (por omissão, hoje).
   Devolve: [{periodoInicio, chave, prazo, data, foraDePrazo}], pela ordem dos
   períodos; [] sem nada a comunicar. */
function ctComunicacoesDaFicha(c,hoje){
  const a=Number(String(hoje||today()).slice(0,4)),vistas={},out=[];
  [a-1,a].forEach(y=>{const x=irsComunicacaoDoAno(c,y);if(x&&!vistas[x.chave]){vistas[x.chave]=1;out.push(x)}});
  return out.filter((x,i)=>i===out.length-1||!x.data);
}
/* A chave da comunicação da duração que a ficha propõe primeiro: a primeira
   por fazer das que mostra (ctComunicacoesDaFicha), senão a última. A chave é
   o ano do INÍCIO do período (o contrato ou a renovação), e não o ano dos
   rendimentos — é por ela que a marca se grava (fisco.comunicacoes).
   Recebe: c — o contrato; hoje — 'AAAA-MM-DD'.
   Devolve: o ano do início do período (número), ou null quando não há o que comunicar. */
function ctAnoComunicacao(c,hoje){
  const xs=ctComunicacoesDaFicha(c,hoje),x=xs.find(p=>!p.data)||xs[xs.length-1];
  return x?Number(x.chave):null;
}
/* O contrato esteve em vigor algum dia do ano? Do início ao último dia em
   vigor (irs.js:irsFimReal: o dia em que acabou, se acabou; senão o termo
   com as renovações); sem fim, até sempre. Um ano antes de o contrato
   começar, ou depois de acabar, não tem duração nenhuma a comunicar.
   Recebe: c — o contrato; ano — o ano (número).
   Devolve: true ou false. */
function ctViveNoAno(c,ano){
  const fim=irsFimReal(c);
  return !!c.start&&c.start<=ano+'-12-31'&&(!fim||fim>=ano+'-01-01');
}
/* O termo de um contrato contando as renovações registadas: o c.end, ou o fim
   de uma renovação escrita à mão que vai para lá dele (irs.js:irsFimEfetivo).
   É o termo estipulado, nunca o dia em que o contrato acabou mesmo.
   Recebe: c — o contrato.
   Devolve: 'AAAA-MM-DD', ou '' sem fim. */
function ctFimEfetivo(c){
  return irsFimEfetivo(c);
}
/* As linhas da ficha sobre a comunicação da duração, uma por período
   (ctComunicacoesDaFicha): feita (e quando — depois do prazo, o 4.2A é NÃO)
   ou por fazer (e até quando), com o botão de a marcar ou desmarcar para
   quem pode alterar o contrato. Um período com a data antiga da app de
   antes por confirmar (N003: fisco.comunicacoesPorConfirmar, que a
   migração deixou por cair depois do prazo) pergunta se se comunicou até ao
   prazo, com o dia antigo como sugestão: «Comuniquei a dd/mm/aaaa» e «Não
   comuniquei» (ctResolverComunicacao), ou «Noutro dia» (a janela de sempre,
   ctComunicadaPergunta).
   Recebe: c — o contrato.
   Devolve: o HTML (texto escapado e os botões), ou '' sem nada a comunicar. */
function ctComunicacaoNota(c){
  const h=today(),pode=podeEditar(c.propertyId,'contract.add',c);
  return ctComunicacoesDaFicha(c,h).map(x=>{
    const renov=x.periodoInicio!==c.start,quem=renov?'A renovação de '+dPT(x.periodoInicio):'A duração do contrato';
    const id=jsq(c.id),k=Number(x.chave);
    if(!x.data&&x.porConfirmar===true&&dataExiste(x.dataAntiga)){
      const oque=renov?'a renovação de '+dPT(x.periodoInicio):'a duração do contrato';
      const per='Comunicaste '+oque+' no Portal das Finanças até '+dPT(x.prazo)+'? A app antiga marcou-a a '+dPT(x.dataAntiga)
        +', mas essa marca não diz quando a comunicaste. O quadro 4.2A do Anexo F pergunta se foi a tempo: se não foi, a resposta é NÃO.';
      const bts=pode?`<div class="toolbar u-m-9px-0-0"><button type="button" class="btn sm" data-toca="dados" data-click="ctResolverComunicacao('${id}',${k},1)">Comuniquei a ${dPT(x.dataAntiga)}</button><button type="button" class="btn sm" data-toca="camada" data-click="ctComunicadaPergunta('${id}',${k})">Noutro dia</button><button type="button" class="btn sm" data-toca="dados" data-click="ctResolverComunicacao('${id}',${k},0)">Não comuniquei</button></div>`:'';
      return `<div>${esc(per)}${bts}</div>`;
    }
    const txt=x.data?quem+' foi comunicada no Portal das Finanças a '+dPT(x.data)
        +(x.foraDePrazo?', depois do prazo ('+dPT(x.prazo)+'): no quadro 4.2A do Anexo F a resposta é NÃO.':'.')
      :quem+' está por comunicar no Portal das Finanças: '+(h>x.prazo?'o prazo era ':'até ')+dPT(x.prazo)+'.'
        +(h>x.prazo?'':' Comunica-se uma vez, e vale para todos os anos '+(renov?'da renovação.':'do contrato.'));
    const btn=pode?`<div class="toolbar u-m-9px-0-0"><button type="button" class="btn sm" data-toca="${x.data?'dados':'camada'}" data-click="${x.data?`ctMarcarComunicada('${id}',${k},0)`:`ctComunicadaPergunta('${id}',${k})`}">${x.data?'Desmarcar':'Marcar como comunicada'}</button></div>`:'';
    return `<div>${esc(txt)}${btn}</div>`;
  }).join('');
}
/* O bloco da comunicação da duração à cabeça do cartão «Perante a AT»
   (KAN-127-18: «Não vejo nada para comunicar a duração» — a frase e o botão
   viviam no fim das notas, depois do parágrafo da taxa reduzida). Uma linha
   à vista, «Comunicação da duração às Finanças · por marcar» (ou «· feita»),
   com a borda de aviso enquanto há algum período por marcar, e por baixo as
   linhas de cada período com o botão (ctComunicacaoNota).
   Recebe: c — o contrato.
   Devolve: o HTML, ou '' sem nada a comunicar. */
function ctComunicacaoBloco(c){
  const xs=ctComunicacoesDaFicha(c,today());if(!xs.length)return '';
  const falta=xs.some(x=>!x.data);
  return `<div class="ct-com${falta?'':' ct-com-feita'}" id="ct_com"><p class="ct-com-tit">Comunicação da duração às Finanças · <span>${falta?'por marcar':'feita'}</span></p>
    <div class="ct-com-txt">${ctComunicacaoNota(c)}</div></div>`;
}
/* A janela pequena de «Marcar como comunicada» de um período: o dia em que a
   comunicação foi feita no Portal, em branco e obrigatório — um dia proposto
   (o do prazo, ou hoje) passava por um que a pessoa soubesse, e o 4.2A
   pergunta se foi feita a tempo. Escolhido um dia depois do prazo, a frase
   por baixo diz que no 4.2A a resposta é NÃO (ctComDiaMudou).
   Recebe: id — o id do contrato; chave — o ano do início do período (fisco.comunicacoes).
   Devolve: nada — abre a janela. */
function ctComunicadaPergunta(id,chave){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const k=String(chave),x=irsPrazosDeComunicacao(c).find(p=>p.chave===k);if(!x)return;
  const h=today(),quem=x.periodoInicio!==c.start?'A renovação de '+dPT(x.periodoInicio):'A duração do contrato';
  openModal('Comunicação da duração',`<div class="form">
    <div class="hint">${esc(quem)} comunica-se uma vez no Portal das Finanças, até ${dPT(x.prazo)}. Indica o dia em que a comunicaste.</div>
    <label>Comunicada a <span class="req">*</span><input id="c_comdia" type="date" max="${esc(h)}" data-prazo="${esc(x.prazo)}" data-change="ctComDiaMudou()"></label>
    <div class="hint" id="c_comdiaFora" hidden>Depois de ${dPT(x.prazo)}: no quadro 4.2A do Anexo F a resposta é NÃO, porque a comunicação não foi feita no prazo.</div></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="ctMarcarComunicada('${jsq(id)}',${Number(k)},1)">Marcar</button>`);
}
/* O dia da janela da comunicação mudou: acende a frase de que, depois do
   prazo (o data-prazo do campo), no 4.2A a resposta é NÃO; apaga-a antes.
   Devolve: nada — mexe no hidden da frase. */
function ctComDiaMudou(){
  const e=document.getElementById('c_comdia'),a=document.getElementById('c_comdiaFora');if(!e||!a)return;
  const p=typeof e.getAttribute==='function'?String(e.getAttribute('data-prazo')||''):'',v=String(e.value||'');
  a.hidden=!(v&&p&&v>p);
}
/* Marca (com o dia da janela, ctComunicadaPergunta) ou desmarca a
   comunicação da duração de um período, pela chave do período — o ano do
   início dele, com a marca comunicacoesV=2 no mesmo gesto —, e grava pelo
   caminho de sempre (save + render, que repinta a ficha aberta). Marcada, o
   aviso do 15 de fevereiro cala-se em todos os anos do período. Um dia
   depois do prazo grava-se (foi o dia), e o aviso diz que o 4.2A é NÃO.
   Recebe: id — o id do contrato; chave — o ano do início do período; on — 1 marca, 0 desmarca.
   Devolve: nada. */
function ctMarcarComunicada(id,chave,on){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const k=String(chave);if(!/^\d{4}$/.test(k))return;
  const f=fiscoDe(c),com=Object.assign({},f.comunicacoes);
  let fora=false;
  if(Number(on)){
    const x=irsPrazosDeComunicacao(c).find(p=>p.chave===k);if(!x)return;
    const dia=val('c_comdia');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))return falhaCampo('c_comdia','Indica o dia da comunicação.');
    if(dia>today())return falhaCampo('c_comdia','O dia da comunicação não pode ser depois de hoje.');
    com[k]=dia;fora=!!x.prazo&&dia>x.prazo;
    closeModal();
  }else delete com[k];
  c.fisco=normFisco(Object.assign({},f,{comunicacoes:com,comunicacoesV:2}));
  save();render();
  toast(!Number(on)?'Comunicação desmarcada.':fora?'Comunicação marcada, depois do prazo: no quadro 4.2A a resposta é NÃO.':'Comunicação marcada como feita.');
}
/* A resposta da ficha à pergunta de uma comunicação por confirmar (N003):
   «Comuniquei a …» grava o dia antigo (fisco.comunicacoesPorConfirmar[chave],
   lido do contrato e não da ação) como o dia da comunicação — depois do
   prazo, no 4.2A a resposta é NÃO —; «Não comuniquei» tira só a pergunta, e
   o período fica por comunicar (dados.js:resolverComunicacao). Grava e
   repinta pelo caminho de sempre.
   Recebe: id — o id do contrato; chave — o ano do início do período;
   comuniquei — 1 no dia antigo, 0 não comuniquei.
   Devolve: nada. */
function ctResolverComunicacao(id,chave,comuniquei){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const k=String(chave),antiga=String((fiscoDe(c).comunicacoesPorConfirmar||{})[k]||'');
  if(!/^\d{4}$/.test(k)||!dataExiste(antiga))return;
  const sim=Number(comuniquei)===1;
  if(!resolverComunicacao(c,k,sim?antiga:''))return;
  save();render();
  const x=irsPrazosDeComunicacao(c).find(p=>p.chave===k),fora=!!(x&&x.prazo&&antiga>x.prazo);
  toast(!sim?'Fica por comunicar: no quadro 4.2A a resposta é NÃO. Se a comunicares, marca o dia na ficha.'
    :fora?'Comunicação marcada a '+dPT(antiga)+', depois do prazo: no quadro 4.2A a resposta é NÃO.':'Comunicação marcada a '+dPT(antiga)+'.');
}
/* Soma meses a uma data, em hora local; um dia que não existe no mês de
   chegada (31 de abril) cai no último dia desse mês.
   Recebe: iso — 'AAAA-MM-DD'; n — os meses a somar.
   Devolve: 'AAAA-MM-DD'. */
function ctSomaMeses(iso,n){
  const d0=new Date(iso+'T00:00:00'),dia=d0.getDate();
  const d=new Date(d0.getFullYear(),d0.getMonth()+n,1),ult=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(dia,ult));
  return pzIso(d);
}
/* O fim que a janela «Renovar…» propõe: o fim de agora mais a duração do
   período que acaba nele (a última renovação, ou o contrato inicial) — em
   meses inteiros quando os há, senão em dias.
   Recebe: c — o contrato (com fim).
   Devolve: 'AAAA-MM-DD', ou '' sem fim. */
function ctRenovacaoSugerida(c){
  if(!c||!c.end)return '';
  const fe=ctFimEfetivo(c);if(fe!==c.end)c=Object.assign({},c,{end:fe});
  const ps=irsPeriodos(c),ult=ps[ps.length-1];
  const ini=ult.inicio&&ult.inicio<=c.end?ult.inicio:(c.start||'');
  const novoIni=pzAddDias(c.end,1),meses=ini?irsMeses(ini,c.end):0;
  if(meses>0)return pzAddDias(ctSomaMeses(novoIni,meses),-1);
  const dias=ini?pzDias(c.end,ini)+1:0;
  return dias>0?pzAddDias(c.end,dias):pzAddAnos(c.end,1);
}
/* A janela pequena do «Renovar…» da ficha: a nova data de fim, já com a
   sugestão (ctRenovacaoSugerida). Vinda do «Reativar» de um contrato com o
   termo passado (reactivateContract), é a mesma janela com o título e o
   botão de reativar: o contrato que continuou depois do termo renovou-se, e
   a renovação regista-se (o 4.2A pede-a) — reativar sem ela apagava o termo
   ou deixava-o terminado.
   Recebe: id — o id do contrato; reativar (opcional) — 1 para renovar e reativar.
   Devolve: nada — abre a janela. */
function ctRenovar(id,reativar){
  const c=contract(id);if(!c||!c.end)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const re=Number(reativar)?1:0,fe=ctFimEfetivo(c);
  const frase=re?`O prazo deste contrato acabou a ${dPT(fe)}. Se continuou depois disso, renovou-se: a renovação começa a ${dPT(pzAddDias(fe,1))}, fica registada nas renovações (o quadro 4.2A do Anexo F pede-a) e o contrato volta a contar para as rendas e as projeções.`
    :`O contrato termina a ${dPT(fe)}. A renovação começa a ${dPT(pzAddDias(fe,1))} e fica registada nas renovações, e o fim do contrato passa a ser o novo. As rendas planeadas seguem-no.`;
  openModal(re?'Reativar contrato':'Renovar contrato',`<div class="form">
    <div class="hint">${frase}</div>
    <label>Novo fim <span class="req">*</span><input id="c_renfim" type="date" value="${esc(ctRenovacaoSugerida(c))}"></label>
    <div class="hint u-mt-n6px">A data proposta repete a duração do período que agora acaba.</div></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="ctRenovarOk('${jsq(id)}',${re?1:0})">${re?'Renovar e reativar':'Renovar'}</button>`);
}
/* Grava a renovação da janela «Renovar…»: uma entrada nas renovações (do dia
   a seguir ao fim antigo até ao fim novo), o fim novo no contrato, e as
   rendas planeadas acertadas pelo syncContractRec. Vinda do «Reativar», o
   contrato volta a estar em vigor e perde a cessação.
   Recebe: id — o id do contrato; reativar (opcional) — 1 para reativar também.
   Devolve: nada — grava, fecha a janela e redesenha. */
function ctRenovarOk(id,reativar){
  const c=contract(id);if(!c||!c.end)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const fim=val('c_renfim'),fe=ctFimEfetivo(c);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fim))return falhaCampo('c_renfim','Indica a nova data de fim.');
  if(fim<=fe)return falhaCampo('c_renfim','O novo fim tem de ser depois de '+dPT(fe)+'.');
  /* uma renovação já registada à mão para lá do fim conta: a nova começa
     depois dela, e não se escreve a mesma outra vez */
  ctJuntaRenovacao(c,pzAddDias(fe,1),fim);
  c.end=fim;
  const re=Number(reativar)===1;
  if(re){c.active=true;c.fisco=normFisco(Object.assign({},fiscoDe(c),{cessacao:{data:'',motivo:''}}))}
  if(servicoLigado('recurring'))syncContractRec(c);
  save();closeModal();buildNav();render();
  toast((re?'Contrato reativado, com a renovação registada':'Renovação registada')+': o contrato vai até '+dPT(fim)+'.');
}

/* contacto: escolher de uma pessoa conhecida, ou escrever outro
   Recebe: kind — 'owner' ou 'tenant', diz de que lado é a secção; c — o
   contrato (objeto, normalmente cForm); p — o imóvel do contrato (objeto;
   pode vir vazio, só é usado no lado do senhorio).
   Devolve: string com o HTML da secção de contacto. */
function contactSect(kind,c,p){
  const owners=kind==='owner';
  const gente=owners?ownersOfProp(p||{}).map(owner).filter(Boolean):ctTenants(c);
  const cur=owners?c.ownerContactId:c.tenantContactId;
  const opts=gente.map(g=>({v:g.id,label:g.name+(g.phone?' · '+fmtPhone(g.phone):'')})).concat([{v:'',label:'Outro contacto (escrever)'}]);
  const chosen=cur?gente.find(g=>g.id===cur):null;
  /* uma escolha que já não está na lista (a pessoa saiu do contrato ou do
     imóvel) não se mostra: o sel caía na primeira pessoa, e o ecrã dizia um
     nome por cima dos campos de outro contacto */
  return `<div class="ct-contacto">
    <div class="ct-contacto-cab"><b>Contacto do ${owners?'senhorio':'inquilino'}</b><span class="small">${owners?'O que o inquilino usa para vos contactar.':'Ponto de contacto deste contrato.'}</span></div>
    ${gente.length?`<label>Usar o contacto de${sel(owners?'c_ocid':'c_tcid',chosen?cur:'',opts,owners?'onOwnerContact':'onTenantContact','rascunho')}</label>`:''}
    ${chosen?`<div class="ct-net-linha ct-contacto-escolhido"><span>${esc(chosen.name)}</span>
        <b>${ctMeiosDeContacto(chosen)}</b></div>`
      :`<div class="row">
        <label>Email (opcional)<input id="${owners?'c_omail':'c_tmail'}" type="email" inputmode="email" value="${esc(owners?c.ownerEmail:c.tenantEmail)}" placeholder="Ex: ${owners?'rui@exemplo.pt':'ana@exemplo.pt'}" autocomplete="off"></label>
        <label>Telemóvel (opcional)<input id="${owners?'c_ophone':'c_tphone'}" type="tel" inputmode="tel" value="${esc(owners?c.ownerPhone:c.tenantPhone)}" placeholder="Ex: ${owners?'912 345 678':'913 456 789'}" autocomplete="off"></label></div>`}
  </div>`;
}
/* O telefone e o email da pessoa escolhida no contacto (contactSect), cada um
   no seu bocado: o telefone não parte a meio (.ct-contacto-tel), o email
   parte onde for preciso (.ct-contacto-mail) — um email ou um nome comprido
   desce de linha em vez de sair da caixa a 375px.
   Recebe: g — a pessoa (owner/tenant) com phone e email.
   Devolve: o HTML (escapado) do que vai dentro do <b>. */
function ctMeiosDeContacto(g){
  const partes=[g.phone?`<span class="ct-contacto-tel">${esc(fmtPhone(g.phone))}</span>`:'',g.email?`<span class="ct-contacto-mail">${esc(g.email)}</span>`:''].filter(Boolean);
  return partes.length?partes.join(' · '):'sem contacto na ficha';
}
// Ao escolher o contacto do senhorio: copia o email/telefone da pessoa
// escolhida para o contrato e repinta o formulário.
// Devolve: nada — repinta o formulário do contrato.
function onOwnerContact(){
  collectCt();cForm.ownerContactId=val('c_ocid')||'';
  const g=cForm.ownerContactId?owner(cForm.ownerContactId):null;
  if(g){cForm.ownerEmail=g.email||'';cForm.ownerPhone=g.phone||''}
  repaintCt();
}
// Ao escolher o contacto do inquilino: copia o email/telefone da pessoa
// escolhida para o contrato e repinta o formulário.
// Devolve: nada — repinta o formulário do contrato.
function onTenantContact(){
  collectCt();cForm.tenantContactId=val('c_tcid')||'';
  const g=cForm.tenantContactId?tenant(cForm.tenantContactId):null;
  if(g){cForm.tenantEmail=g.email||'';cForm.tenantPhone=g.phone||''}
  repaintCt();
}
// Liga/desliga uma foto do imóvel no registo fotográfico do contrato.
// Recebe: fid — id da foto (uma das fotos do imóvel).
// Devolve: nada — repinta o formulário.
function togCtPhoto(fid){
  collectCt();
  const l=cForm.photoIds||(cForm.photoIds=[]),i=l.indexOf(fid);
  if(i>-1)l.splice(i,1);else l.push(fid);
  repaintCt();
}
// Seleciona todas as fotos do imóvel para o contrato (on=1) ou nenhuma (on=0).
// Recebe: on — 1 seleciona todas, 0 limpa a seleção.
// Devolve: nada — repinta o formulário.
function allCtPhotos(on){
  collectCt();
  const p=prop(cForm.propertyId);
  cForm.photoIds=on?(p&&p.photos||[]).map(f=>f.id):[];
  repaintCt();
}
// Acrescenta uma linha de chave vazia (quantidade 1) e repinta.
// Devolve: nada — repinta o formulário.
function addKey(){collectCt();cForm.keys.push({id:uid(),name:'',qty:1});repaintCt()}
// Remove um tipo de chave pelo id e repinta.
// Recebe: kid — id da chave a remover.
// Devolve: nada — repinta o formulário.
function delKey(kid){collectCt();cForm.keys=cForm.keys.filter(k=>k.id!==kid);repaintCt()}
// Marca/desmarca as checkboxes de todas as chaves conforme o "Selecionar todos".
// Devolve: nada — só mexe nas checkboxes do DOM.
function keyToggleAll(){const on=chk('key_all');(cForm.keys||[]).forEach(k=>{const e=document.getElementById('keyc_'+k.id);if(e)e.checked=on})}
// Remove as chaves com a checkbox marcada; avisa se nenhuma estiver selecionada.
// Devolve: nada — repinta o formulário (ou só avisa, se nada estiver marcado).
function delKeySelected(){
  collectCt();
  const s2=(cForm.keys||[]).filter(k=>chk('keyc_'+k.id));
  if(!s2.length)return toast('Não há chaves selecionadas.');
  const ids={};s2.forEach(k=>ids[k.id]=1);
  cForm.keys=cForm.keys.filter(k=>!ids[k.id]);repaintCt();toast(s2.length+' removidas.');
}
// Abre um modal com textarea para colar várias chaves de uma vez, uma por
// linha ("Nome; quantidade"). Quem as processa é o doKeyBulk().
// Devolve: nada — abre o modal do texto em bloco.
function addKeyBulk(){
  collectCt();
  openModal('Adicionar várias chaves',`<div class="form">
    <div class="hint">Uma por linha, com a quantidade: <b>Chave de casa; 2</b></div>
    <textarea id="keybulk" class="u-minh-130px u-font-13px-1p6-ui-monospace-menlo-monospace" placeholder="Ex: Chave de casa; 2&#10;Chave do correio; 1&#10;Comando do portão" aria-label="Chaves, uma por linha"></textarea></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="rascunho" data-click="doKeyBulk()">Adicionar</button>`);
}
// Lê o textarea do addKeyBulk: uma chave por linha, nome e quantidade
// separados por ;, | ou tab. Sem quantidade, fica 1.
// Devolve: nada — junta as chaves a cForm, fecha o modal e repinta.
function doKeyBulk(){
  let added=0;
  String(val('keybulk')||'').split('\n').map(x=>x.trim()).filter(Boolean).forEach(line=>{
    const p2=line.split(/[;|\t]/).map(x=>x.trim());
    if(p2[0]){cForm.keys.push({id:uid(),name:p2[0],qty:Math.max(1,Math.round(num(p2[1]))||1)});added++}
  });
  closeModal();repaintCt();toast(added?'Chaves adicionadas.':'Nada para adicionar.');
}
/* O contacto escrito no contrato é exatamente o de uma pessoa? O email sem
   olhar a maiúsculas e o telefone só pelos algarismos; e nunca vazio com
   vazio — um contrato sem contacto não é «o contacto» de quem também não
   tem nenhum.
   Recebe: email, tel — o contacto do contrato; g — a pessoa (owner ou tenant).
   Devolve: true/false. */
function ctMesmoContacto(email,tel,g){
  const m=x=>String(x||'').trim().toLowerCase(),d=x=>String(x||'').replace(/\D/g,'');
  return !!g&&!!(m(email)||d(tel))&&m(email)===m(g.email)&&d(tel)===d(g.phone);
}
/* Puxa o contacto do primeiro proprietário para os campos ainda vazios. Se
   estavam os dois vazios e a pessoa tem contacto, fica ela escolhida em «Usar
   o contacto de»: os campos traziam o contacto da proprietária e a escolha
   dizia «Outro contacto (escrever)». Ao trocar de imóvel (onCtProp), uma
   escolha que não é proprietária do imóvel novo larga-se — e o contacto que
   veio dela também, para entrar o do proprietário certo; o que alguém
   escreveu à mão fica.
   Devolve: nada — só mexe no email/telefone e na escolha em cForm. */
function fillOwnerContact(){
  const p=prop(cForm.propertyId);if(!p)return;
  const os=ownersOfProp(p).map(owner).filter(Boolean);
  if(cForm.ownerContactId&&!os.some(o=>o.id===cForm.ownerContactId)){
    if(ctMesmoContacto(cForm.ownerEmail,cForm.ownerPhone,owner(cForm.ownerContactId))){cForm.ownerEmail='';cForm.ownerPhone=''}
    cForm.ownerContactId='';
  }
  const o=os[0];if(!o)return;
  const vazios=!cForm.ownerEmail&&!cForm.ownerPhone;
  if(!cForm.ownerEmail)cForm.ownerEmail=o.email||'';
  if(!cForm.ownerPhone)cForm.ownerPhone=o.phone||'';
  if(!cForm.ownerContactId&&vazios&&(o.email||o.phone))cForm.ownerContactId=o.id;
}
// Preenche o contacto do inquilino do contrato com o da pessoa, mas só os
// campos ainda vazios — não pisa o que já lá estava. Se estavam os dois
// vazios e a pessoa tem contacto, fica ela escolhida em «Usar o contacto de»
// (como o do senhorio, fillOwnerContact).
// Recebe: tid — id do inquilino.
// Devolve: nada — só preenche o email/telefone e a escolha em cForm.
function fillTenantContact(tid){
  const t=tenant(tid);if(!t)return;
  const vazios=!cForm.tenantEmail&&!cForm.tenantPhone;
  if(!cForm.tenantEmail)cForm.tenantEmail=t.email||'';
  if(!cForm.tenantPhone)cForm.tenantPhone=t.phone||'';
  if(!cForm.tenantContactId&&vazios&&(t.email||t.phone))cForm.tenantContactId=t.id;
}
/* Ao abrir um contrato que já existe: se o contacto escrito nele é
   exatamente o de um proprietário do imóvel (ou de um dos inquilinos) e
   nenhuma pessoa está escolhida, escolhe-a — os contratos gravados antes
   desta regra diziam «Outro contacto (escrever)» por cima do contacto da
   proprietária. Só com contacto igual e não vazio (ctMesmoContacto).
   Recebe: nada — lê e mexe no cForm.
   Devolve: nada. */
function ctReconheceContactos(){
  if(!cForm.ownerContactId){
    const o=ownersOfProp(prop(cForm.propertyId)||{}).map(owner).filter(Boolean).find(g=>ctMesmoContacto(cForm.ownerEmail,cForm.ownerPhone,g));
    if(o)cForm.ownerContactId=o.id;
  }
  if(!cForm.tenantContactId){
    const t=ctTenants(cForm).find(g=>ctMesmoContacto(cForm.tenantEmail,cForm.tenantPhone,g));
    if(t)cForm.tenantContactId=t.id;
  }
}
// Ao trocar o imóvel do contrato: larga o quarto (pertencia ao anterior) e
// escolhe o do imóvel novo como um contrato novo o escolheria (o primeiro
// livre, com quartos arrendados — ctEscolhaPorOmissao), puxa o contacto do
// proprietário novo e repinta.
// Devolve: nada — repinta o formulário.
function onCtProp(){collectCt();cForm.propertyId=val('c_prop');ctEscolhaPorOmissao(cForm);fillOwnerContact();repaintCt()}
// Abre o seletor de inquilinos (só os que ainda não estão no contrato); ao
// escolher, junta-o e preenche o contacto do contrato se estiver vazio.
// Devolve: nada — abre o seletor de inquilinos.
function addCtTenant(){
  collectCt();
  const free=db.tenants.filter(t=>(cForm.tenantIds||[]).indexOf(t.id)<0);
  pickModal('Escolher inquilino',free.map(t=>({v:t.id,label:t.name,sub:[t.phone,t.email].filter(Boolean).join(' · '),avatar:true})),
    t=>{cForm.tenantIds.push(t.v);fillTenantContact(t.v);closeModal();repaintCt()},
    `<button type="button" class="btn u-w-100pc u-jc-center" data-toca="camada" data-click="newTenantFromCt()">${ic('plus',15)} Criar inquilino novo</button>`);
}
// Tira um inquilino do contrato — a ficha da pessoa fica intacta.
// Recebe: tid — id do inquilino a tirar do contrato.
// Devolve: nada — repinta o formulário.
function delCtTenant(tid){collectCt();cForm.tenantIds=(cForm.tenantIds||[]).filter(x=>x!==tid);repaintCt()}
/* Cria um inquilino novo sem sair do fluxo do contrato: fecha o seletor,
   abre a ficha de pessoa e, quando esta é guardada, volta ao modal do
   contrato já com o inquilino adicionado e o contacto preenchido.
   Devolve: nada — abre a ficha de pessoa nova. */
function newTenantFromCt(){
  /* a ficha nova vai subir como registo deste imóvel: sem «Adicionar inquilinos» o servidor recusava-a */
  if(!pode(cForm.propertyId,'tenant.add'))return toast(fraseSemPerm('tenant.add'));
  closeModal();
  /* num imóvel onde só colaboro a ficha fica presa ao imóvel (houseId): se o
     contrato ficar por guardar, sobe na mesma como registo dele, não privada */
  personModal('tenant',null,nid=>{
    if(cForm.tenantIds.indexOf(nid)<0)cForm.tenantIds.push(nid);
    fillTenantContact(nid);
    closeModal();render();repaintCt();
    toast('Inquilino criado e adicionado ao contrato.');
  },souDono(cForm.propertyId)?'':cForm.propertyId);
}
// Acrescenta um artigo vazio ao inventário (quantidade 1, usado) e repinta.
// Devolve: nada — repinta o formulário.
function addInv(){collectCt();cForm.inventory.push({id:uid(),name:'',qty:1,state:'usado'});repaintCt()}
// Remove um artigo do inventário pelo id e repinta.
// Recebe: iid — id do artigo a remover.
// Devolve: nada — repinta o formulário.
function delInv(iid){collectCt();cForm.inventory=cForm.inventory.filter(i=>i.id!==iid);repaintCt()}
// Marca/desmarca as checkboxes de todos os artigos conforme o "Selecionar todos".
// Devolve: nada — só mexe nas checkboxes do DOM.
function invToggleAll(){
  const on=chk('inv_all');
  (cForm.inventory||[]).forEach(i=>{const e=document.getElementById('invc_'+i.id);if(e)e.checked=on});
}
// Remove os artigos com a checkbox marcada; avisa se nenhum estiver selecionado.
// Devolve: nada — repinta o formulário (ou só avisa, se nada estiver marcado).
function delInvSelected(){
  collectCt();
  const sel2=(cForm.inventory||[]).filter(i=>chk('invc_'+i.id));
  if(!sel2.length)return toast('Não há artigos selecionados.');
  const ids={};sel2.forEach(i=>ids[i.id]=1);
  cForm.inventory=cForm.inventory.filter(i=>!ids[i.id]);
  repaintCt();toast(sel2.length+' artigos removidos.');
}
// Abre um modal com textarea para colar vários artigos de uma vez, um por
// linha ("Nome; quantidade; estado"). Quem os processa é o doInvBulk().
// Devolve: nada — abre o modal do texto em bloco.
function addInvBulk(){
  collectCt();
  openModal('Adicionar vários artigos',`<div class="form">
    <div class="hint">Um artigo por linha. Podes indicar quantidade e estado: <b>Cadeira; 4; usado</b></div>
    <textarea id="invbulk" class="u-minh-150px u-font-13px-1p6-ui-monospace-menlo-monospace" placeholder="Ex: Sofá; 1; novo&#10;Cadeira; 4; usado&#10;Frigorífico" aria-label="Artigos, um por linha"></textarea></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="rascunho" data-click="doInvBulk()">Adicionar</button>`);
}
// Lê o textarea do addInvBulk: um artigo por linha, campos separados por ;,
// | ou tab. Sem quantidade fica 1; o estado só é "novo" se a linha o disser.
// Devolve: nada — junta os artigos a cForm, fecha o modal e repinta.
function doInvBulk(){
  const lines=String(val('invbulk')||'').split('\n').map(x=>x.trim()).filter(Boolean);
  let added=0;
  lines.forEach(line=>{
    const parts=line.split(/[;|\t]/).map(x=>x.trim());
    if(!parts[0])return;
    cForm.inventory.push({id:uid(),name:parts[0],qty:Math.max(1,Math.round(num(parts[1]))||1),
      state:/nov/i.test(parts[2]||'')?'novo':'usado'});
    added++;
  });
  closeModal();repaintCt();
  toast(added?added+' artigos adicionados.':'Nada para adicionar.');
}
// Recebe os ficheiros do input de anexos: o conteúdo vai para o IndexedDB
// (takeFiles) e os metadados juntam-se a cForm.files. Assíncrono — repinta no fim.
// Recebe: input — o elemento <input type="file"> com os ficheiros escolhidos.
// Devolve: nada — repinta quando os ficheiros acabarem de entrar.
function ctAddFiles(input){
  collectCt();
  takeFiles(input).then(ms=>{cForm.files=(cForm.files||[]).concat(ms);repaintCt();
    if(ms.length)toast(ms.length===1?'Anexo adicionado.':ms.length+' anexos adicionados.')});
}
// Tira um anexo do contrato e apaga logo o conteúdo do IndexedDB — para o
// ficheiro em si não há desfazer.
// Recebe: fid — id do anexo a remover.
// Devolve: nada — repinta o formulário.
function ctDelFile(fid){collectCt();cForm.files=(cForm.files||[]).filter(f=>f.id!==fid);idbDel(fid).catch(()=>{});repaintCt()}
/* O «Terminar contrato» (o menu, a lista, o cartão do prazo): abre a folha
   com o dia em que acabou e o motivo (ctTerminarFolha). Um contrato que
   ainda não começou não acabou dia nenhum: apaga-se, e o aviso di-lo.
   Recebe: id — id do contrato.
   Devolve: nada — abre a folha (ou avisa). */
function endContract(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  if(c.start&&c.start>today())return toast('Este contrato só começa a '+dPT(c.start)+': se já não vai começar, apaga-o.');
  ctTerminarFolha(c,false);
}
/* o contrato da folha do «Terminar» aberta: o id de um da base, ou '' para o
   do formulário (cForm) — o ctCessacaoNota lê-o para refazer a frase */
let _ctCessar=null;
/* Os motivos da cessação que a versão do ano dá a um contrato (o quadro 10 do
   Anexo F, `irsAno(ano).quadro10.motivos`): os do programa da isenção dele
   (PAA, programas municipais, alojamento estudantil), ou os da redução da
   taxa — que também servem a qualquer outro contrato. Um direito real de
   habitação duradoura tem os do quadro 4.3 (`quadro43.motivos`, 01 a 06: o
   01, por acordo das partes, regulariza desde o início — CIRS art. 72.º
   n.º 20; o 06, o fim do prazo). Nenhum código nem texto do impresso vive
   aqui.
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos da versão.
   Devolve: [{v, label, quem, regulariza}] pela ordem da versão; [] sem a tabela. */
function ctMotivosCessacao(c,ano){
  if(fiscoDe(c).finalidade==='dhd'){
    const q43=irsAno(anoIrs(ano)).quadro43,m43=q43&&Array.isArray(q43.motivos)?q43.motivos.filter(m=>m&&m.codigo):[];
    return m43.map(m=>({v:String(m.codigo),label:String(m.curto||m.texto||m.codigo),quem:String(m.quem||''),regulariza:m.regulariza===true}));
  }
  const q=irsAno(anoIrs(ano)).quadro10,ms=q&&Array.isArray(q.motivos)?q.motivos.filter(m=>m&&m.codigo):[];
  const is=fiscoDe(c).isencao,para=is&&ms.some(m=>m.para===is)?is:'reducao';
  return ms.filter(m=>m.para===para).map(m=>({v:String(m.codigo),label:String(m.curto||m.texto||m.codigo),quem:String(m.quem||''),regulariza:m.regulariza===true}));
}
/* O que está mal no dia e no motivo de uma cessação: o dia existe, nunca
   antes do início, nem depois de hoje, nem depois do termo (o que continuou
   depois do termo é uma renovação); o motivo é um dos da versão, e
   obrigatório quando se pede.
   Recebe: c — o contrato; data — 'AAAA-MM-DD'; motivo — o código ('' sem
   ele); exigeMotivo — se o motivo é obrigatório.
   Devolve: null, ou {id, msg} — o campo (c_cesData, c_cesMot) e a frase do erro. */
function ctCessacaoErro(c,data,motivo,exigeMotivo){
  const d=String(data||''),m=String(motivo||''),termo=irsFimEfetivo(c);
  if(!dataExiste(d))return {id:'c_cesData',msg:'Indica o dia em que o contrato acabou.'};
  if(c.start&&d<c.start)return {id:'c_cesData',msg:'O contrato começou a '+dPT(c.start)+': não pode ter acabado antes.'};
  if(d>today())return {id:'c_cesData',msg:'O dia em que acabou não pode ser depois de hoje.'};
  if(termo&&d>termo)return {id:'c_cesData',msg:'O prazo do contrato acabava a '+dPT(termo)+': se continuou depois, regista primeiro a renovação («Renovar…»).'};
  const ms=ctMotivosCessacao(c,Number(d.slice(0,4)));
  if(m&&!ms.some(x=>x.v===m))return {id:'c_cesMot',msg:'Escolhe um dos motivos da lista.'};
  if(!m&&exigeMotivo&&ms.length){
    const q=ctMotivoVaiAoAnexo(c,d);
    return {id:'c_cesMot',msg:q?'Escolhe o motivo: o '+q+' do Anexo F pede-o.':'Escolhe o motivo por que o contrato acabou.'};
  }
  return null;
}
/* O quadro do Anexo F que leva o motivo da cessação de um contrato nesse
   ano: o 4.3 num direito real de habitação duradoura; o quadro 10 num
   contrato declarado que lá vai (irs.js:irsRegimeQuadro10 — redução pela
   duração ou isenção de um programa, no período em que acabou). Fora de
   Portugal (Anexo J), na categoria B, ou sem redução nem isenção, nenhum: o
   motivo fica só registado no contrato (D14).
   Recebe: c — o contrato (com as renovações que a folha regista); data — o
   dia em que acabou ('AAAA-MM-DD').
   Devolve: 'quadro 4.3', 'quadro 10', ou ''. */
function ctMotivoVaiAoAnexo(c,data){
  const f=fiscoDe(c);
  if(f.finalidade==='dhd')return ctQuadroDaCessacao(c);
  if(f.estado!=='declarado'||ctSemEstimativa(c)||!dataExiste(data))return '';
  const cessado=Object.assign({},c,{active:false,fisco:Object.assign({},f,{cessacao:{data:data,motivo:''}})});
  return irsRegimeQuadro10(cessado,Number(data.slice(0,4)))?'quadro 10':'';
}
/* A frase por baixo do motivo, na folha do «Terminar» (D14, N100): o motivo
   é obrigatório em todos os contratos declarados, mas só se diz que o
   Anexo F o pede quando pede (ctMotivoVaiAoAnexo) — com a redução pela
   duração, também a comunicação da cessação no Portal (Portaria 110/2019,
   art. 2.º c)); num declarado que não vai ao quadro 10 nesse ano, que fica
   só registado. Num contrato por declarar, quando é que o pedem.
   Recebe: c — o contrato (com as renovações da folha); data — o dia em que acabou.
   Devolve: o texto (por escapar). */
function ctMotivoDica(c,data){
  const f=fiscoDe(c),d=dataExiste(data)?data:today(),q=ctMotivoVaiAoAnexo(c,d);
  if(f.estado!=='declarado')return 'Num contrato declarado às Finanças, o '+(f.finalidade==='dhd'?ctQuadroDaCessacao(c):'quadro 10')+' do Anexo F pede-o'+(f.finalidade==='dhd'?'.':' quando o contrato tem redução da taxa pela duração ou isenção.');
  if(q==='quadro 10'&&irsIsencao(Object.assign({},c,{active:false,fisco:Object.assign({},f,{cessacao:{data:d,motivo:''}})}),Number(d.slice(0,4))))return 'O quadro 10 do Anexo F pede-o.';
  if(q)return 'O '+q+' do Anexo F e a comunicação da cessação à AT pedem-no.';
  const sem=ctSemEstimativa(c);
  if(sem==='fora')return 'Fica registado no contrato: as rendas deste imóvel declaram-se no Anexo J, que não o pede.';
  if(sem==='catB')return 'Fica registado no contrato: as rendas dele declaram-se no Anexo B ou C, que não o pedem.';
  return 'Fica registado no contrato. Só vai ao quadro 10 do Anexo F quando o contrato tem redução da taxa pela duração ou isenção, e este não tem nenhuma das duas em '+d.slice(0,4)+'.';
}
/* O quadro do Anexo F que pede a data e o motivo da cessação: o 4.3 num
   direito real de habitação duradoura (o da versão, quadros.dhd), senão o
   quadro 10.
   Recebe: c — o contrato.
   Devolve: o texto («quadro 4.3», «quadro 10»). */
function ctQuadroDaCessacao(c){
  return fiscoDe(c).finalidade==='dhd'?'quadro '+irsAno(YEAR).quadros.dhd:'quadro 10';
}
/* O motivo é obrigatório na folha do «Terminar» num contrato declarado: é o
   que vai ao quadro 10 e à comunicação da cessação.
   Recebe: c — o contrato.
   Devolve: true ou false. */
const ctMotivoExigido=c=>fiscoDe(c).estado==='declarado';
/* A folha do «Terminar contrato» (D02, D09, D39): o dia em que acabou — hoje
   por omissão, nunca antes do início nem depois de hoje — e o motivo, com os
   da versão do ano (ctMotivosCessacao) e a frase de quando o Anexo F o pede
   (ctMotivoDica); por baixo, o que isso leva ao IRS (ctCessacaoAviso, refeito
   a cada mudança). O termo (c.end) não se toca: é ele que decide a taxa.
   Com o termo já passado, o contrato que se termina agora continuou depois
   dele e renovou-se (CC art. 1096.º): a folha não propõe o termo antigo nem
   o motivo do fim do prazo; pergunta se continuou (ctRenovacaoNaFolha) e,
   com «Sim», até quando ia a renovação — e regista as renovações até ao dia
   em que acabou no mesmo gesto (ctRenovacoesAte); com «Não», o dia fica até
   ao termo. Com a caução escrita no contrato e sem devolução registada, a
   devolução regista-se ali também (ctDevolucaoCampos, D15). Do formulário
   (desligar «Contrato em vigor», ou o fim que recua e acabou antes do
   prazo), a folha trabalha no cForm e grava-o a seguir.
   Recebe: c — o contrato (o da base, ou o cForm); doForm — true vindo do
   formulário; dia (opcional) — o dia em que acabou, já dito ('AAAA-MM-DD':
   sem a pergunta da renovação).
   Devolve: nada — abre a folha. */
function ctTerminarFolha(c,doForm,dia){
  const h=today(),termo=irsFimEfetivo(c),dado=dataExiste(dia);
  const passou=!dado&&!!termo&&termo<h,max=!passou&&termo&&termo<h?termo:h;
  const d=dado?dia:h;
  _ctCessar={id:doForm?'':c.id};
  const ms=ctMotivosCessacao(c,Number(d.slice(0,4))),exige=ctMotivoExigido(c)&&ms.length>0;
  const fimDoPrazo=!passou&&d===termo?(ms.find(x=>x.quem==='fim')||{}).v||'':'';
  const nota=passou?'':ctCessacaoAviso(c,d,fimDoPrazo);
  const req=exige?' <span class="req">*</span>':'';
  openModal('Terminar contrato',`<div class="form">
    <div class="hint">O contrato de ${esc(ctNames(c))} deixa de contar para as rendas e as projeções.${termo&&!passou?' O fim do contrato ('+dPT(termo)+') fica como está: é o prazo dele que decide a taxa do IRS.':''}</div>
    ${passou?ctRenovacaoNaFolha(c,termo):''}
    <label>Acabou a <span class="req">*</span><input id="c_cesData" type="date" value="${esc(d)}"${c.start?` min="${esc(c.start)}"`:''} max="${esc(max)}" data-change="ctCessacaoNota()"></label>
    ${ms.length?`<label>Motivo${req}${sel('c_cesMot',fimDoPrazo,[{v:'',label:'—'}].concat(ms.map(x=>({v:x.v,label:x.label}))),'ctCessacaoNota','rascunho')}</label>
    <div class="hint ct-colado" id="c_cesMotDica">${esc(ctMotivoDica(c,d))}</div>`:''}
    <div class="hint" id="c_cesNota"${nota?'':' hidden'}>${esc(nota)}</div>
    ${ctDevolucaoCampos(c,true)}</div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn danger" data-toca="dados" data-click="ctTerminarOk('${doForm?'':jsq(c.id)}')">Terminar</button>`);
}
/* A pergunta da renovação na folha do «Terminar», com o termo já passado: o
   contrato continuou depois dele? Nada vem escolhido. Com «Sim», até quando
   ia a renovação — num contrato que teve redução pela duração, em branco
   (é a duração que decide a taxa, e o CC art. 1096.º deixa as partes
   combinarem outra: não se supõe); nos outros, a proposta repete o período
   que acabou (ctRenovacaoSugerida). As seguintes, da mesma duração,
   registam-se até ao dia em que acabou (ctRenovacoesAte). Num imóvel fora
   de Portugal a frase não cita o Código Civil (a lei é a do país).
   Recebe: c — o contrato; termo — o termo passado ('AAAA-MM-DD').
   Devolve: o HTML. */
function ctRenovacaoNaFolha(c,termo){
  const red=ctTeveReducao(c),ini=pzAddDias(termo,1),proposta=red?'':ctRenovacaoSugerida(c);
  const lei=pzForaDePortugal(c.propertyId)?'':' (Código Civil, art. 1096.º)';
  return `<div class="hint">O prazo do contrato acabou a ${dPT(termo)}. Se continuou depois disso, renovou-se${lei}: a renovação regista-se no contrato, e ele acaba no dia em que acabou mesmo.</div>
    <label>Continuou depois de ${dPT(termo)}? <span class="req">*</span>${sel('c_cesRenov','',[{v:'',label:'—'},{v:'1',label:'Sim, renovou-se'},{v:'0',label:'Não, acabou nesse dia ou antes'}],'ctCessacaoRenovMudou','rascunho')}</label>
    <div id="c_cesRenBox" hidden><div class="form">
      <label>A renovação ia até <span class="req">*</span><input id="c_cesRenFim" type="date" value="${esc(proposta)}" min="${esc(ini)}" data-change="ctCessacaoNota()"></label>
      <div class="hint ct-colado">${red?'Vê no contrato quanto dura cada renovação: é a duração que decide a taxa do IRS.':'A data proposta repete a duração do período que acabou: confirma-a no contrato.'} Se acabou depois desse dia, as renovações seguintes, com a mesma duração, registam-se também.</div>
    </div></div>`;
}
/* A resposta à pergunta da renovação mudou: com «Sim» aparece até quando ia
   a renovação; com «Não», o dia em que acabou não passa do termo (vem para
   ele, se estava depois). Refaz as frases da folha (ctCessacaoNota).
   Devolve: nada — mexe nos campos da folha. */
function ctCessacaoRenovMudou(){
  const r=val('c_cesRenov'),box=document.getElementById('c_cesRenBox'),e=document.getElementById('c_cesData');
  if(box)box.hidden=r!=='1';
  const c=_ctCessar?(_ctCessar.id?contract(_ctCessar.id):cForm):null,termo=c?irsFimEfetivo(c):'';
  if(e&&termo){
    if(typeof e.setAttribute==='function')e.setAttribute('max',r==='0'?termo:today());
    if(r==='0'&&String(e.value||'')>termo)e.value=termo;
  }
  ctCessacaoNota();
}
/* As renovações de um contrato com o termo passado até ao dia em que acabou:
   a primeira do dia a seguir ao termo até ao fim escrito, e as seguintes com
   a mesma duração (CC art. 1096.º: períodos sucessivos de igual duração) até
   à que tem esse dia — em meses inteiros quando a primeira os tem, senão em
   dias. No máximo cem, que nenhum contrato tem.
   Recebe: c — o contrato; fim1 — o fim da primeira renovação; dia — o dia em
   que acabou ('AAAA-MM-DD').
   Devolve: [{inicio, fim}] pela ordem; [] sem termo, sem fim, ou com o fim antes do início. */
function ctRenovacoesAte(c,fim1,dia){
  const termo=irsFimEfetivo(c);if(!termo||!dataExiste(fim1))return [];
  const ini=pzAddDias(termo,1);if(fim1<ini)return [];
  const m=irsMeses(ini,fim1),meses=m>0&&pzAddDias(ctSomaMeses(ini,m),-1)===fim1?m:0,dias=pzDias(fim1,ini)+1;
  const out=[{inicio:ini,fim:fim1}];
  while(out.length<100&&dataExiste(dia)&&out[out.length-1].fim<dia){
    const i=pzAddDias(out[out.length-1].fim,1);
    out.push({inicio:i,fim:meses?pzAddDias(ctSomaMeses(i,meses),-1):pzAddDias(i,dias-1)});
  }
  return out;
}
/* Junta ao contrato as renovações dadas (uma com o mesmo início de outra que
   já lá está não se repete: ctJuntaRenovacao) e leva o termo (c.end) ao fim
   da última, como o «Renovar…».
   Recebe: c — o contrato (muda-o); rs — [{inicio, fim}] pela ordem.
   Devolve: o mesmo contrato. */
function ctJuntaRenovacoes(c,rs){
  const xs=Array.isArray(rs)?rs:[];
  xs.forEach(r=>ctJuntaRenovacao(c,r.inicio,r.fim));
  const ult=xs[xs.length-1];if(ult&&(!c.end||ult.fim>c.end))c.end=ult.fim;
  return c;
}
/* O contrato da folha do «Terminar» como fica com a resposta à pergunta da
   renovação: com «Sim» e o fim dela escrito, uma cópia com as renovações até
   ao dia em que acabou (ctRenovacoesAte, ctJuntaRenovacoes); sem a pergunta,
   ou com outra resposta, o próprio contrato.
   Recebe: c — o contrato da folha; dia — o dia em que acabou ('AAAA-MM-DD').
   Devolve: {c, renovacoes:[{inicio, fim}], resposta} — resposta '1', '0', ''
   (por responder), ou null sem a pergunta na folha. */
function ctCessarComRenovacoes(c,dia){
  if(!document.getElementById('c_cesRenov'))return {c:c,renovacoes:[],resposta:null};
  const r=String(val('c_cesRenov')||'');
  const rs=r==='1'&&dataExiste(dia)?ctRenovacoesAte(c,val('c_cesRenFim'),dia):[];
  return {c:rs.length?ctJuntaRenovacoes(Object.assign({},c),rs):c,renovacoes:rs,resposta:r};
}
/* O dia, o motivo ou a renovação da folha do «Terminar» mudaram: refaz a
   frase do que isso leva ao IRS (ctCessacaoAviso, com as renovações que se
   vão registar) e esconde-a quando não há nada a dizer — também enquanto a
   pergunta da renovação está por responder —, e a frase do motivo
   (ctMotivoDica).
   Devolve: nada — mexe no #c_cesNota e no #c_cesMotDica. */
function ctCessacaoNota(){
  const n=document.getElementById('c_cesNota');if(!n||!_ctCessar)return;
  const c0=_ctCessar.id?contract(_ctCessar.id):cForm;if(!c0)return;
  const dia=val('c_cesData'),r=ctCessarComRenovacoes(c0,dia);
  const espera=r.resposta===''||(r.resposta==='1'&&!r.renovacoes.length);
  const t=espera?'':ctCessacaoAviso(r.c,dia,val('c_cesMot'));
  n.textContent=t;n.hidden=!t;
  const m=document.getElementById('c_cesMotDica');if(m)m.textContent=ctMotivoDica(r.c,dia);
}
/* O «Terminar» da folha: lê a resposta da renovação (se a houver), o dia, o
   motivo e a devolução da caução, diz o erro junto do campo pela ordem da
   folha, e termina — o contrato da base (ctTerminar, com as renovações e a
   devolução) ou o do formulário, que se grava logo (ctGravar).
   Recebe: id — o id do contrato; '' para o do formulário.
   Devolve: nada. */
function ctTerminarOk(id){
  const doForm=!id,c=doForm?cForm:contract(id);if(!c)return;
  const data=val('c_cesData'),motivo=val('c_cesMot'),termo=irsFimEfetivo(c);
  const r=ctCessarComRenovacoes(c,data);
  if(r.resposta==='')return falhaCampo('c_cesRenov','Diz se o contrato continuou depois de '+dPT(termo)+'.');
  if(r.resposta==='1'){
    const fim1=val('c_cesRenFim'),ini=pzAddDias(termo,1);
    if(!dataExiste(fim1))return falhaCampo('c_cesRenFim','Indica até quando ia a renovação.');
    if(fim1<ini)return falhaCampo('c_cesRenFim','A renovação começou a '+dPT(ini)+': o fim é depois desse dia.');
    if(dataExiste(data)&&data<=termo)return falhaCampo('c_cesData','Se continuou depois de '+dPT(termo)+', acabou depois desse dia.');
  }
  if(r.resposta==='0'&&dataExiste(data)&&data>termo)return falhaCampo('c_cesData','Acabou até '+dPT(termo)+': se continuou depois, responde «Sim, renovou-se».');
  const e=ctCessacaoErro(r.c,data,motivo,ctMotivoExigido(r.c));if(e)return falhaCampo(e.id,e.msg);
  const dev=ctDevolucaoDaFolha(c);if(dev&&dev.erro)return falhaCampo(dev.erro.id,dev.erro.msg);
  closeModal();_ctCessar=null;
  const extra={renovacoes:r.renovacoes,devolucao:dev};
  if(!doForm)return ctTerminar(id,data,motivo,extra);
  ctJuntaRenovacoes(cForm,r.renovacoes);
  cForm.fisco=normFisco(Object.assign({},fiscoDe(cForm),{cessacao:{data:data,motivo:motivo}}));
  cForm.active=false;
  const tx=dev?ctTxDevolucao(cForm,dev.dia,dev.valor):null;if(tx)db.transactions.push(tx);
  ctGravar();
}
/* Termina um contrato da base: regista as renovações que a folha deu (o
   termo vai para o fim da última, como no «Renovar…»), guarda o dia em que
   acabou e o motivo em fisco.cessacao, desliga-o (active false), regista a
   devolução da caução se veio, e acerta a renda planeada. Fora disso o
   termo (c.end) nunca muda — a «alternativa» c.end=min(c.end,data) está
   proibida (é o termo que decide o escalão da redução, também nos anos já
   entregues). O aviso tem «Anular», que desfaz tudo.
   Recebe: id — o id do contrato; data — 'AAAA-MM-DD'; motivo — o código do
   quadro 10 ('' sem ele); extra (opcional) — {renovacoes:[{inicio, fim}],
   devolucao:{dia, valor}|null}.
   Devolve: '' quando terminou, ou a frase do erro (nada se grava). */
function ctTerminar(id,data,motivo,extra){
  const c=contract(id);if(!c)return 'O contrato já não existe.';
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa){toast(recusa);return recusa}
  const x=extra||{},rs=Array.isArray(x.renovacoes)?x.renovacoes:[];
  const alvo=rs.length?ctJuntaRenovacoes(Object.assign({},c),rs):c;
  const e=ctCessacaoErro(alvo,data,motivo,ctMotivoExigido(alvo));if(e)return e.msg;
  const dv=x.devolucao&&!ctDevolucaoErro(c,x.devolucao.dia,x.devolucao.valor)?ctTxDevolucao(c,x.devolucao.dia,x.devolucao.valor):null;
  const antes={active:c.active,end:c.end,cessacao:irsCessacao(c),renovacoes:JSON.parse(JSON.stringify(fiscoDe(c).renovacoes||[]))};
  if(rs.length){c.fisco=alvo.fisco;c.end=alvo.end}
  c.fisco=normFisco(Object.assign({},fiscoDe(c),{cessacao:{data:String(data),motivo:String(motivo||'')}}));
  c.active=false;
  if(dv)db.transactions.push(dv);
  if(servicoLigado('recurring'))syncContractRec(c);
  save();closeAllModals();buildNav();render();
  const msg=(rs.length?'Contrato terminado, com '+(rs.length===1?'a renovação registada':rs.length+' renovações registadas'):'Contrato terminado')
    +(dv?', e a devolução da caução registada.':'.');
  comDesfazer(msg,()=>{
    const y=contract(id);if(!y)return;
    y.active=antes.active;y.end=antes.end;
    y.fisco=normFisco(Object.assign({},fiscoDe(y),{cessacao:antes.cessacao,renovacoes:antes.renovacoes}));
    if(dv)db.transactions=db.transactions.filter(t=>t.id!==dv.id);
    if(servicoLigado('recurring'))syncContractRec(y);
  });
  return '';
}
/* A devolução da caução pode registar-se neste contrato (D15, ficha
   doutrinária 26360: é gasto de quem é senhorio no dia em que a devolve,
   mesmo que a caução não tenha sido registada como renda)? Com a caução
   escrita no contrato, a categoria Devoluções ao inquilino › Devolução da
   caução na conta (pelo id, ctCatDoId), os Movimentos ligados, quem pode
   adicionar movimentos no imóvel, e nenhuma devolução da caução ligada ao
   contrato ainda.
   Recebe: c — o contrato.
   Devolve: true ou false. */
function ctDevolucaoPossivel(c){
  if(!c||!(Number(c.deposit)>0)||!servicoLigado('transactions')||!pode(c.propertyId,'tx.add'))return false;
  if(!ctCatDoId('devolucoes/caucao','cats'))return false;
  return !(db.transactions||[]).some(t=>t&&t.kind==='expense'&&t.contractId===c.id&&txCatIrsId(t,true)==='devolucoes/caucao');
}
/* Os campos da devolução da caução: o dia (hoje por omissão) e o valor (a
   caução inteira por omissão; uma parte, se ficou alguma coisa para danos ou
   rendas em falta). Na folha do «Terminar», atrás do interruptor «Já devolvi
   a caução» (ctCessacaoDevMudou); na janela da ficha, à vista.
   Recebe: c — o contrato; naFolha — true na folha do «Terminar».
   Devolve: o HTML, ou '' quando não há devolução a registar (ctDevolucaoPossivel). */
function ctDevolucaoCampos(c,naFolha){
  if(!ctDevolucaoPossivel(c))return '';
  const h=today(),dep=Number(c.deposit);
  const campos=`<div class="ct-par">
      <label>Devolvida a <span class="req">*</span><input id="c_devDia" type="date" value="${esc(h)}"${c.start?` min="${esc(c.start)}"`:''} max="${esc(h)}"></label>
      <label>Valor devolvido (€) <span class="req">*</span><input id="c_devValor" type="text" inputmode="decimal" class="num" value="${esc(String(dep))}" autocomplete="off"></label></div>
    <div class="hint ct-colado">Se ficaste com uma parte (danos, rendas em falta), escreve só o que devolveste. Fica uma despesa em Devoluções ao inquilino, ligada ao contrato.</div>`;
  if(!naFolha)return campos;
  return `${ctInterruptor('c_cesDev',false,'Já devolvi a caução','Caução de '+euro2(dep)+': a devolução é um gasto do ano em que a devolves.','ctCessacaoDevMudou()')}
    <div id="c_devBox" hidden><div class="form">${campos}</div></div>`;
}
/* O interruptor «Já devolvi a caução» da folha do «Terminar» mudou: mostra
   ou esconde o dia e o valor.
   Devolve: nada — mexe no #c_devBox. */
function ctCessacaoDevMudou(){
  const b=document.getElementById('c_devBox');if(b)b.hidden=!chk('c_cesDev');
}
/* O que está mal no dia e no valor de uma devolução da caução: o dia existe,
   não é antes do início do contrato nem depois de hoje; o valor é mais de
   zero e não passa da caução.
   Recebe: c — o contrato; dia — 'AAAA-MM-DD'; valor — euros (número).
   Devolve: null, ou {id, msg} — o campo (c_devDia, c_devValor) e a frase do erro. */
function ctDevolucaoErro(c,dia,valor){
  const d=String(dia||''),v=Number(valor),dep=Number(c&&c.deposit)||0;
  if(!dataExiste(d))return {id:'c_devDia',msg:'Indica o dia em que devolveste a caução.'};
  if(c&&c.start&&d<c.start)return {id:'c_devDia',msg:'O contrato começou a '+dPT(c.start)+': a devolução não pode ser antes.'};
  if(d>today())return {id:'c_devDia',msg:'O dia da devolução não pode ser depois de hoje.'};
  if(!(v>0))return {id:'c_devValor',msg:'Indica quanto devolveste.'};
  if(dep>0&&v>dep+0.004)return {id:'c_devValor',msg:'A caução do contrato é de '+euro2(dep)+': a devolução não passa disso.'};
  return null;
}
/* A devolução da caução escrita na folha do «Terminar», com o interruptor
   ligado: o dia e o valor, ou o erro.
   Recebe: c — o contrato da folha.
   Devolve: null (sem o interruptor, ou desligado), {dia, valor}, ou {erro:{id, msg}}. */
function ctDevolucaoDaFolha(c){
  if(!document.getElementById('c_cesDev')||!chk('c_cesDev'))return null;
  const dia=val('c_devDia'),valor=num(val('c_devValor')),e=ctDevolucaoErro(c,dia,valor);
  return e?{erro:e}:{dia:dia,valor:Math.round(valor*100)/100};
}
/* O movimento da devolução da caução: uma despesa do imóvel, ligada ao
   contrato, na categoria Devoluções ao inquilino › Devolução da caução da
   conta (pelo id, ctCatDoId — o nome pode ter mudado), paga pelo dono quando
   o imóvel tem um só (como o formulário do movimento).
   Recebe: c — o contrato; dia — 'AAAA-MM-DD'; valor — euros.
   Devolve: o movimento (normTx), ou null sem a categoria na conta. */
function ctTxDevolucao(c,dia,valor){
  const cat=ctCatDoId('devolucoes/caucao','cats');if(!c||!cat)return null;
  const os=ownersOfProp(prop(c.propertyId)||{});
  return normTx({kind:'expense',label:'Devolução da caução '+ctName(c),amount:Math.round(Number(valor)*100)/100,date:String(dia),
    propertyId:c.propertyId,contractId:c.id,category:cat.category,sub:cat.sub,paidBy:os.length===1?os[0]:null,split:null});
}
/* «Registar a devolução» da ficha de um contrato terminado com caução e sem
   devolução registada (ctCaucaoDaFicha): a janela com o dia e o valor
   (ctDevolucaoCampos).
   Recebe: id — o id do contrato.
   Devolve: nada — abre a janela (ou nada, sem devolução a registar). */
function ctDevolucaoCaucao(id){
  const c=contract(id);if(!c||!ctDevolucaoPossivel(c))return;
  openModal('Devolução da caução',`<div class="form">
    <div class="hint">A caução deste contrato é de ${euro2(c.deposit)}. Devolvê-la é um gasto do ano em que a devolves, na Declaração do IRS: regista o dia e o que devolveste.</div>
    ${ctDevolucaoCampos(c,false)}</div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="ctDevolucaoCaucaoOk('${jsq(id)}')">Registar</button>`);
}
/* Grava a devolução da janela da ficha: valida (ctDevolucaoErro, junto do
   campo), cria a despesa (ctTxDevolucao), com «Anular».
   Recebe: id — o id do contrato.
   Devolve: nada. */
function ctDevolucaoCaucaoOk(id){
  const c=contract(id);if(!c||!ctDevolucaoPossivel(c))return closeModal();
  const dia=val('c_devDia'),valor=num(val('c_devValor')),e=ctDevolucaoErro(c,dia,valor);
  if(e)return falhaCampo(e.id,e.msg);
  const tx=ctTxDevolucao(c,dia,valor);if(!tx)return closeModal();
  db.transactions.push(tx);
  closeModal();save();buildNav();render();
  comDesfazer('Devolução da caução registada.',()=>{db.transactions=db.transactions.filter(t=>t.id!==tx.id)});
}
/* O que uma cessação leva ao IRS, numa frase para a folha e para a ficha:
   com um motivo que a versão marca para regularizar (o 01, por motivo do
   senhorio antes do prazo, num período com redução), a taxa da duração que
   o contrato chegou a ter no lugar da reduzida e a regularização dos anos
   anteriores com juros (CIRS art. 72.º n.º 20; irs.js:irsTaxaDecorrida); de
   resto, num contrato declarado que vai ao quadro 10 nesse ano
   (irs.js:irsRegimeQuadro10), que vai lá com a data e o motivo. Num direito
   real de habitação duradoura, o quadro 4.3; com o acordo das partes (o
   motivo que o quadro43 marca para regularizar), a taxa reduzida cai desde o
   início (art. 72.º n.º 20).
   Recebe: c — o contrato; data — 'AAAA-MM-DD'; motivo — o código ('' sem ele).
   Devolve: o texto (por escapar), ou ''. */
function ctCessacaoAviso(c,data,motivo){
  const d=String(data||'');if(!c||!dataExiste(d))return '';
  const ano=Number(d.slice(0,4)),m=ctMotivosCessacao(c,ano).find(x=>x.v===String(motivo||''));
  const f=fiscoDe(c),cessado=Object.assign({},c,{active:false,fisco:Object.assign({},f,{cessacao:{data:d,motivo:String(motivo||'')}})});
  /* um direito real de habitação duradoura: o quadro 4.3, e o acordo das
     partes (o motivo que a versão marca para regularizar) tira os 5 % desde
     o início (art. 72.º n.º 20) */
  if(f.finalidade==='dhd'){
    const q=irsAno(ano).quadros.dhd;
    if(m&&m.regulariza)return 'Por acordo das partes, a cessação do DHD tira a taxa reduzida desde o início (CIRS art. 72.º n.º 20): a diferença nos anos já declarados regulariza-se na declaração de '+ano+', com juros compensatórios. Vai ao quadro '+q+' do Anexo F com a data e o motivo.';
    return f.estado==='declarado'?'Vai ao quadro '+q+' do Anexo F dos rendimentos de '+ano+', com a data e o motivo.':'';
  }
  if(m&&m.regulariza){
    const vivo=Object.assign({},c,{active:true,fisco:Object.assign({},f,{cessacao:{data:'',motivo:''}})});
    const seg=irsTaxaNaData(vivo,d),r=seg&&seg.reducao;
    if(r){
      const dd=irsTaxaDecorrida(cessado),para=dd?Number(dd.taxa):Number(irsAno(ano).taxas.habitacional),de=Number(r.taxa);
      if(para>de)return 'Por motivo do senhorio, antes do prazo, a redução pela duração deste período cai (CIRS art. 72.º n.º 20): as rendas dele passam de '+dec(de)+' % para '+dec(para)+' %, a taxa da duração que o contrato chegou a ter. A diferença nos anos deste período já declarados regulariza-se na declaração de '+ano+', com juros compensatórios; a Declaração desse ano estima-a.';
      return 'Por motivo do senhorio, antes do prazo: a duração que o contrato chegou a ter dá a mesma taxa ('+dec(de)+' %), e não há diferença a regularizar (CIRS art. 72.º n.º 20).';
    }
  }
  if(f.estado==='declarado'&&irsRegimeQuadro10(cessado,ano))return 'Vai ao quadro 10 do Anexo F dos rendimentos de '+ano+', com a data e o motivo.';
  return '';
}
/* A cessação de um contrato numa linha, para a ficha: o dia e o motivo pelo
   texto curto da versão do ano ('motivo por indicar' sem ele).
   Recebe: c — o contrato.
   Devolve: o texto (por escapar), ou '' sem cessação. */
function ctCessacaoTexto(c){
  const x=irsCessacao(c);if(!x.data)return '';
  const m=ctMotivosCessacao(c,Number(x.data.slice(0,4))).find(y=>y.v===x.motivo);
  return dPT(x.data)+' · '+(m?m.label:x.motivo?'motivo '+x.motivo:'motivo por indicar');
}
/* O dia em que acabou e o motivo no formulário de um contrato terminado, a
   seguir ao «Contrato em vigor»: corrigem-se aqui (o collectCt lê-os, o
   ctSaver valida-os pelas regras da folha). A frase só diz que o Anexo F os
   pede quando pede (ctMotivoVaiAoAnexo, D14). O texto livre antigo do
   motivo, que já não se escreve, fica dito por baixo.
   Recebe: c — o contrato do formulário.
   Devolve: o HTML dos campos. */
function ctCessacaoCampos(c){
  const x=irsCessacao(c),h=today(),termo=irsFimEfetivo(c),max=termo&&termo<h?termo:h;
  const ms=ctMotivosCessacao(c,x.data?Number(x.data.slice(0,4)):YEAR),antiga=String(fiscoDe(c).cessacaoMotivo||'').trim();
  const q=ctMotivoVaiAoAnexo(c,x.data||h);
  return `<label>Acabou a<input id="c_cesData" type="date" value="${esc(x.data)}"${c.start?` min="${esc(c.start)}"`:''} max="${esc(max)}"></label>
    ${ms.length?`<label>Motivo${sel('c_cesMot',x.motivo,[{v:'',label:'—'}].concat(ms.map(y=>({v:y.v,label:y.label}))),'','rascunho')}</label>`:''}
    <div class="hint ct-colado">O dia em que o contrato acabou e porquê${q?': o '+esc(q)+' do Anexo F pede-os':''}. O fim do contrato fica o do prazo.${antiga?' Escrito antes: «'+esc(antiga)+'».':''}</div>`;
}
/* O «Reativar contrato»: volta a contar para as rendas e as projeções e perde
   a cessação, e o termo (c.end) nunca se apaga (D14 — sem ele o contrato
   perdia a redução em todos os anos). Com o termo passado, reativar é
   renovar: abre o «Renovar…» com o botão de reativar (ctRenovar).
   Recebe: id — id do contrato.
   Devolve: nada — pede confirmação e, se aceite, grava e redesenha a vista. */
function reactivateContract(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const termo=irsFimEfetivo(c);
  if(termo&&termo<today())return ctRenovar(id,1);
  const ces=irsCessacao(c).data;
  confirmModal('Reativar contrato',`Reativar o contrato de ${esc(ctNames(c))}? Volta a contar para as rendas e projeções${ces?', e o dia em que acabou ('+dPT(ces)+') sai':''}.`,()=>{
    c.active=true;c.fisco=normFisco(Object.assign({},fiscoDe(c),{cessacao:{data:'',motivo:''}}));
    if(servicoLigado('recurring'))syncContractRec(c);save();closeAllModals();buildNav();render();toast('Contrato reativado.');
  });
}
/* As rendas de um contrato nos anos cuja Declaração ainda está por entregar
   (imovel.js:imvAnosPorEntregar): as receitas ligadas a ele que vão à linha
   dele (irs-papeis.js:irsReceitaDe — a renda e a caução), pela renda bruta
   (com o que o inquilino reteve), como a Declaração as soma.
   Recebe: c — o contrato; hoje (opcional) — 'AAAA-MM-DD'.
   Devolve: [{ano, total}] só dos anos com rendas, do mais antigo para o mais recente. */
function ctRendasPorEntregar(c,hoje){
  if(!c)return [];
  const ts=(db.transactions||[]).filter(t=>t&&t.contractId===c.id&&t.kind==='income'&&['renda','caucao'].indexOf(irsReceitaDe(t).papel)>-1);
  return imvAnosPorEntregar(hoje).map(ano=>({ano,total:Math.round(sum(ts.filter(t=>String(t.date||'').startsWith(String(ano))).map(rendaBruta))*100)/100}))
    .filter(x=>x.total>0);
}
/* O valor das rendas por entregar de um contrato, para o meio de uma frase:
   «(7 200,00 €)», ou com os anos quando são dois; '' a quem não vê os
   movimentos do imóvel.
   Recebe: c — o contrato; rs — o que o ctRendasPorEntregar devolveu.
   Devolve: o texto (com o espaço à frente), ou ''. */
function ctValorPorEntregar(c,rs){
  if(!servicoLigado('transactions')||!pode(c.propertyId,'tx.view')||!rs.length)return '';
  return ' ('+(rs.length===1?euro2(rs[0].total):rs.map(r=>r.ano+': '+euro2(r.total)).join('; '))+')';
}
/* O que a confirmação de apagar um contrato acrescenta quando ele tem rendas
   de um ano por entregar (ctRendasPorEntregar), como a do imóvel
   (imovel.js:imvAvisoDeApagar): quanto fica sem contrato, que a Declaração
   desse ano perde a linha dele — a taxa, as datas e, num terminado, a
   cessação — e, num contrato em vigor, o «Terminar contrato» no lugar de
   apagar. Um contrato «não declarado» já está fora da Declaração: nada.
   Recebe: c — o contrato; antes (opcional) — o código de uma ação a correr
   antes de abrir o «Terminar» (a seleção sai do modo de seleção: 'CW.selLSair();').
   Devolve: o HTML (frase e botão), ou ''. */
function ctAvisoDeApagar(c,antes){
  if(!c||ctNaoDeclarado(c))return '';
  const rs=ctRendasPorEntregar(c);if(!rs.length)return '';
  const um=rs.length===1,term=c.active===false||!!irsCessacao(c).data;
  const frase='As rendas de '+listaE(rs.map(r=>String(r.ano)))+' deste contrato'+ctValorPorEntregar(c,rs)+' ficam sem contrato, e a Declaração do IRS '
    +(um?'desse ano, ainda por entregar, perde':'desses anos, ainda por entregar, perde')+' a linha dele: '+(term?'a taxa, as datas e a cessação.':'a taxa e as datas.');
  if(term)return esc(frase)+' Já está terminado: assim, fica na Declaração com o dia em que acabou.';
  if(!podeEditar(c.propertyId,'contract.add',c)||(c.start&&c.start>today()))return esc(frase);
  return esc(frase)+' Se o contrato acabou, termina-o em vez de o apagar: fica na Declaração com o dia em que acabou.'
    +`<div class="toolbar u-mt-12px"><button type="button" class="btn" data-toca="camada" data-click="closeModal();${antes||''}endContract('${jsq(c.id)}')">Terminar contrato</button></div>`;
}
/* O que a confirmação de apagar um inquilino acrescenta quando um contrato
   dele (não «não declarado») tem rendas de um ano por entregar: a linha
   desse contrato na Declaração fica sem ele — e o Anexo F pede o NIF do
   inquilino —, quanto vale (a quem vê os movimentos) e, nos contratos em
   vigor que a pessoa pode alterar, o «Terminar contrato» no lugar de apagar
   (o inquilino fica nos anos em que lá morou). Só com os Contratos ligados
   (quem chama, pessoas.js:delPerson, guarda-o).
   Recebe: tid — o id do inquilino; antes (opcional) — o código de uma ação a
   correr antes de abrir o «Terminar» (como no ctAvisoDeApagar).
   Devolve: o HTML (frase e botões), ou ''. */
function ctAvisoDeApagarInquilino(tid,antes){
  const cs=contractsOfTenant(tid).filter(c=>!ctNaoDeclarado(c)).map(c=>({c,rs:ctRendasPorEntregar(c)})).filter(x=>x.rs.length);
  if(!cs.length)return '';
  const anos=[...new Set(cs.flatMap(x=>x.rs.map(r=>r.ano)))].sort(),um=cs.length===1,umAno=anos.length===1;
  const cada=cs.map(x=>'«'+ctName(x.c)+'»'+ctValorPorEntregar(x.c,x.rs));
  const frase='A Declaração do IRS de '+listaE(anos.map(String))+', ainda por entregar, tem rendas '+(um?'do contrato ':'dos contratos ')+listaE(cada)
    +': sem esta ficha, a linha '+(um?'dele':'de cada um')+' fica sem este inquilino, e o Anexo F pede o NIF dele. Guarda-a até entregares '+(umAno?'essa declaração.':'essas declarações.');
  const vivos=cs.filter(x=>x.c.active!==false&&!irsCessacao(x.c).data&&!(x.c.start&&x.c.start>today())&&podeEditar(x.c.propertyId,'contract.add',x.c));
  if(!vivos.length)return esc(frase);
  return esc(frase)+' Se o inquilino saiu, termina o contrato: fica na Declaração com ele, nos anos em que lá morou.'
    +`<div class="toolbar u-mt-12px">${vivos.map(x=>`<button type="button" class="btn" data-toca="camada" data-click="closeModal();${antes||''}endContract('${jsq(x.c.id)}')">${vivos.length>1?'Terminar «'+esc(ctName(x.c))+'»':'Terminar contrato'}</button>`).join('')}</div>`;
}
/* Apaga o contrato, com confirmação: sai da lista, o recorrente automático
   da renda vai com ele e os movimentos ligados ficam órfãos (mantêm-se, mas
   sem contractId). Com rendas de um ano por entregar, a confirmação diz o
   que a Declaração perde e propõe terminá-lo (ctAvisoDeApagar). O toast dá
   para desfazer tudo; os anexos só se apagam do IndexedDB quando o desfazer
   expira sem ser usado.
   Recebe: id — id do contrato a apagar.
   Devolve: nada — pede confirmação e, se aceite, grava e redesenha a vista. */
function delContract(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c,true);if(recusa)return toast(recusa);
  const aviso=ctAvisoDeApagar(c);
  confirmModal('Apagar contrato',`Apagar o contrato de ${esc(ctNames(c))}? Os movimentos ficam, mas deixam de estar ligados a ele.${aviso?' '+aviso:''}`,()=>{
    const copia=JSON.parse(JSON.stringify(c));
    const recs=JSON.parse(JSON.stringify((db.recurring||[]).filter(r=>r.auto&&r.tx&&r.tx.contractId===id)));
    const ligados=db.transactions.filter(t=>t.contractId===id).map(t=>t.id);
    db.contracts=db.contracts.filter(x=>x.id!==id);
    db.recurring=(db.recurring||[]).filter(r=>!(r.auto&&r.tx&&r.tx.contractId===id));
    db.transactions.forEach(t=>{if(t.contractId===id)t.contractId=null});
    save();closeAllModals();buildNav();render();
    comDesfazer('Contrato apagado.',()=>{
      db.contracts.push(copia);
      db.recurring=(db.recurring||[]).concat(recs);
      db.transactions.forEach(t=>{if(ligados.indexOf(t.id)>-1)t.contractId=id});
    },()=>{
      (copia.files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    });
  });
}
