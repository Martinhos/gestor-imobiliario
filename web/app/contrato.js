/* ================= CONTRATO ================= */
let cForm={};
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
   extra (opcional) — o HTML à direita do título.
   Devolve: o HTML do cartão. */
function ctSecao(titulo,corpo,extra){
  return `<div class="card ct-sec">${titulo?`<div class="ct-sec-cab"><h3>${esc(titulo)}</h3>${extra||''}</div>`:''}<div class="ct-sec-corpo">${corpo}</div></div>`;
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
   contrato por começar está no período, e não também ao lado do selo.
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
  const dias=c.end?pzDias(c.end):null;
  const op=isActive(c)&&c.end&&dias>=0&&dias<=150&&!pzs.some(x=>x.tipo==='oposicao')
    ?`<p class="small ct-op">Para o contrato não renovar a ${dPT(c.end)}, o aviso ao inquilino tem de seguir até <b>${dPT(pzAddDias(c.end,-120))}</b> (120 dias).</p>`:'';
  return `<div class="ct-topo">
    <div class="ct-topo-selos"><span class="badge${st.cor?' '+st.cor:''}">${esc(st.txt)}</span></div>
    ${onde?`<p class="ct-onde">${onde}</p>`:''}
    ${periodo}${op}
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
   31/10/2026».
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
    case 'fev15':return 'Comunicar a duração à AT até '+d;
    case 'rsaa':return 'Enviar o contrato ao IHRU até '+d;
    case 'recibos':return 'Emitir o recibo da renda até '+d;
  }
  return pzPartes(x).titulo+' · '+d;
}
/* O cartão de um prazo na ficha (a prancheta: «Oposição à renovação até…»):
   o título com a data, o selo do que falta na cor do contrato visual
   (prazos.js:pzSelo), a frase do porquê e do como (a do sino) e as ações — na
   oposição e no fim, Renovar e Terminar para quem pode; num recibo, abrir o
   movimento —, e o ✕ que silencia esta ocorrência, com «Anular»
   (prazos.js:pzSilencia). O fundo é o suave da cor do selo.
   Recebe: c — o contrato; x — o prazo.
   Devolve: o HTML do cartão. */
function ctPrazoDaFicha(c,x){
  const ok=podeEditar(c.propertyId,'contract.add',c),cor=pzSelo(x),id=jsq(c.id),acoes=[];
  if((x.tipo==='oposicao'||x.tipo==='fim')&&ok&&c.end&&c.active!==false)
    acoes.push(`<button type="button" class="btn sm" data-toca="camada" data-click="ctRenovar('${id}')">Renovar</button>`,
      `<button type="button" class="btn sm" data-toca="camada" data-click="endContract('${id}')">Terminar</button>`);
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
   anual; e os dois atalhos, Registar renda e Ver movimentos, para quem os
   pode usar. Com um serviço desligado nesta conta, o que é dele não se
   escreve.
   Recebe: c — o contrato.
   Devolve: o HTML do cartão. */
function ctValoresDaFicha(c){
  const pid=c.propertyId,id=jsq(c.id);
  /* a renda planeada é dos Planeados: desligados nesta conta, não há próxima
     renda a mostrar — e a função nem sequer existe para lhe perguntar */
  const rec=servicoLigado('recurring')?ctRecOf(c):null;
  const movs=servicoLigado('transactions')&&pode(pid,'tx.view')?(db.transactions||[]).filter(t=>t.contractId===c.id):[];
  const rendas=movs.filter(t=>t.kind==='income'),ultima=rendas.map(t=>t.date).sort().pop();
  /* o bruto engana, e a marca de «estimado» é a mesma que a lista já dá: o
     formulário guarda 0 para «em branco», e escrever «0%» era mentira */
  const escrita=Number(c.taxRate)>0,liq=netRent(c);
  const tres=c.rent>0?`<div class="ct-tres">
      <div><span class="small">Renda</span><b class="disp">${euro2(c.rent)}</b></div>
      <div><span class="small">Imposto</span><b class="disp">${dec(taxRateOf(c))}%</b><span class="small">${escrita?'escrita no contrato':esc(irsTaxaPorque(c))+' · estim.'}</span></div>
      <div><span class="small">Líquida</span><b class="disp">${euro2(liq)}</b><span class="small">${euro(liq*12)}/ano</span></div></div>`
    :`<p class="hint ct-sem-renda">Este contrato ainda não tem renda.</p>`;
  const kv=[
    ctKv('Pagamento',c.payDay?((c.payDayTo&&c.payDayTo>c.payDay)?'entre o dia '+c.payDay+' e o dia '+c.payDayTo:'no dia '+c.payDay):''),
    isActive(c)&&rec&&rec.next&&pode(pid,'rec.view')?ctRendaPlaneada(rec):'',
    rendas.length?ctKv('Rendas registadas',rendas.length+(ultima?' · última a '+dPT(ultima):'')):'',
    c.increase!=null&&c.increase!==''?ctKv('Aumento anual',dec(c.increase)+'%'+(c.start?' · próximo a '+dPT(pzAniversario(c.start)):'')):''].join('');
  /* registar a renda é dos Movimentos: com o serviço desligado nesta conta o
     atalho não aparece */
  const botoes=[servicoLigado('transactions')&&isActive(c)&&pode(pid,'tx.add')?`<button type="button" class="btn sm primary" data-toca="camada" data-click="ctRegistarRenda('${jsq(pid)}','${id}')">Registar renda</button>`:'',
    movs.length?`<button type="button" class="btn sm" data-toca="camada" data-click="ctVerMovimentos('${id}')">Ver movimentos</button>`:''].join('');
  return `<div class="card ct-sec ct-valores">${tres}${kv}${botoes?`<div class="ct-botoes">${botoes}</div>`:''}</div>`;
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
  const movs=(db.transactions||[]).filter(t=>t.contractId===c.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  if(!movs.length)return;
  pickModal('Movimentos do contrato',movs.map(t=>({v:t.id,label:(t.label||'Movimento')+' · '+euro2(t.amount),sub:dPT(t.date),icon:'swap'})),
    o=>{closeModal();chamarServico('transactions','txView',o.v)});
}
/* O cartão «Perante a AT»: o estado num selo (declarado a verde, por indicar
   a cobalto, não declarado a cinzento — uma escolha do senhorio, sem cor de
   aviso), e o que se sabe do declarado — o número que a AT deu, a finalidade,
   a celebração, as renovações e o quadro do Anexo F —, com as notas do IRS:
   a isenção, a taxa reduzida pela duração e a comunicação de fevereiro (com o
   botão de a marcar), e a taxa das rendas moderadas.
   Recebe: c — o contrato.
   Devolve: o HTML do cartão. */
function ctAtDaFicha(c){
  const fisc=fiscoDe(c),fin=(FISCO_FINALIDADES.find(x=>x[0]===fisc.finalidade)||[])[1]||'';
  /* a redução pela duração é só dos contratos de habitação permanente (o
     irsReducao já o sabe), e é ela — não a taxa das rendas moderadas — que
     pede o quadro 4.2 e a comunicação de fevereiro */
  const irsDoAno=irsTaxa(c,YEAR),escrita=Number(c.taxRate)>0,taxaReduzida=fisc.estado==='declarado'&&!!irsDoAno.reducao;
  const isento=irsDoAno.motivo==='isento'?irsDoAno.isencao:null,bonusRM=irsAno(YEAR).taxas.bonusRendaMenor;
  /* a comunicação de fevereiro do ano em causa, com o botão de a marcar */
  const comunicacao=fisc.estado==='declarado'?ctComunicacaoNota(c):'';
  const selo=fisc.estado==='declarado'?'<span class="badge in">Declarado</span>':fisc.estado==='naoDeclarado'?'<span class="badge grey">Não declarado</span>':'<span class="badge">Por indicar</span>';
  let corpo='';
  if(fisc.estado==='declarado'){
    const renovs=(fisc.renovacoes||[]).filter(r=>r.fim).sort((a,b)=>String(a.fim).localeCompare(String(b.fim)));
    /* os recibos eletrónicos das rendas deste ano, pela marca de cada renda
       (os Movimentos, a quem os pode ver); com a dispensa da página
       Declaração não há recibos, há o Modelo 44 */
    const dispensa=!!(db.settings&&db.settings.irs&&db.settings.irs.dispensaRecibos===true);
    const rendasAno=servicoLigado('transactions')&&pode(c.propertyId,'tx.view')
      ?(db.transactions||[]).filter(t=>t.contractId===c.id&&ehRenda(t)&&String(t.date||'').slice(0,4)===String(YEAR)):[];
    const porEmitir=rendasAno.filter(t=>!t.recibo).length;
    const recibos=dispensa?'dispensado · Modelo 44':rendasAno.length?(porEmitir?porEmitir+' de '+rendasAno.length+' por emitir em '+YEAR:'todos emitidos em '+YEAR):'';
    corpo=ctKv('N.º do contrato',String(fisc.numero||'').trim()?esc(fisc.numero):'<span class="badge red">Falta o n.º</span>')
      +ctKv('Finalidade',esc(fin))
      +ctKv('Celebrado a',fisc.celebracao?dPT(fisc.celebracao)+(fisc.renovavel===true?' · renovável':fisc.renovavel===false?' · não renovável':''):'')
      +ctKv('Renovações',renovs.length?renovs.length+' · a última até '+dPT(renovs[renovs.length-1].fim):'')
      +ctKv('Recibos eletrónicos',recibos)
      +ctKv('Anexo F',isento?'quadro 4.1 · isento':taxaReduzida?'quadro 4.2 · pela duração':'quadro 4.1 · '+esc(irsTaxaPorque(c)));
  }else corpo=`<p class="hint">${fisc.estado==='naoDeclarado'?'Fica fora do resumo do Anexo F e dos prazos da AT.':'Comunicaste este contrato às Finanças (Modelo 2)? Indica-o ao editar: o resumo do Anexo F e os prazos da AT dependem disso.'}</p>`;
  const notas=[
    isento?'Isento de IRS: '+esc(isento.nome)+'. As rendas declaram-se na linha do quadro 4.1 do Anexo F, sem imposto, e o quadro '+esc(isento.quadro)+' aponta para ela'
      +(isento.codigo?' (código '+esc(isento.codigo)+').':' (o código ainda não se conhece: o Anexo F destes rendimentos não foi aprovado).'):'',
    taxaReduzida?'Pela duração, este contrato tem direito à taxa reduzida de '+dec(irsDoAno.reducao.taxa)+' %'
      +(irsDoAno.reducao.bonus&&bonusRM?', já com os '+dec(bonusRM.pontos)+' pontos a menos de uma renda mais baixa do que a do contrato anterior (quadro 4.2B)':'')
      +'. Isso pede duas coisas: o quadro 4.2 do Anexo F preenchido, e a duração e as renovações comunicadas no Portal das Finanças até 15 de fevereiro.'
      +(!escrita&&irsDoAno.motivo==='moderada'?' Em '+YEAR+' a renda dá-lhe ainda os '+dec(irsDoAno.taxa)+' % das rendas moderadas, que ficam por serem mais baixos.':''):'',
    comunicacao,
    !taxaReduzida&&c.rent>0&&!escrita&&irsDoAno.motivo==='moderada'?'Com a renda até '+euro(irsAno(YEAR).taxas.rendaModerada.limiteMensal)+' por mês, as rendas de '+YEAR+' pagam a taxa de '+dec(irsDoAno.taxa)+' % das rendas moderadas (EBF art. 45.º-C), em vez de '+dec(irsAno(YEAR).taxas.habitacional)+' %.':''
  ].filter(Boolean).map(t=>`<div class="ct-nota">${t}</div>`).join('');
  return ctSecao('Perante a AT',corpo+notas,selo);
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
   a quem pode ver inquilinos — ver ctFicha).
   Recebe: c — o contrato; verPessoas — se o cargo deixa ver os inquilinos.
   Devolve: o HTML do cartão, ou '' sem nada para mostrar. */
function ctCaucaoDaFicha(c,verPessoas){
  const contacto=(tel,email)=>[tel?fmtPhone(tel):'',email||''].filter(Boolean).join(' · ');
  const corpo=[c.deposit>0?ctKv('Caução',euro2(c.deposit)):'',
    c.advance>0?ctKv('Rendas antecipadas',c.advance+(Number(c.advance)===1?' mês':' meses')):'',
    c.iban?ctKv('IBAN',`<span class="ct-iban">${esc(fmtIBAN(c.iban))}</span>`):'',
    (c.ownerPhone||c.ownerEmail)?ctKv('Contacto do senhorio',esc(contacto(c.ownerPhone,c.ownerEmail))):'',
    verPessoas&&(c.tenantPhone||c.tenantEmail)?ctKv('Contacto do inquilino',esc(contacto(c.tenantPhone,c.tenantEmail))):''].join('');
  return corpo?`<div class="card ct-sec ct-sec-kv">${corpo}</div>`:'';
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
  openModal(titulo,`<div class="ct-lista-anexos">${corpo}</div>`,`<button type="button" class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>`);
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
      it.push({label:'Gerar contrato em PDF',icon:'down',toca:'camada',act:`ctPdfJanela('${jsq(id)}')`});
      /* renovar regista a renovação (fisco.renovacoes) e leva o fim para a
         frente — mudar só a data de fim perdia o histórico que o 4.2A pede */
      if(ok&&c.end&&c.active!==false)it.push({label:'Renovar…',icon:'cal',toca:'camada',act:`ctRenovar('${jsq(id)}')`});
      /* o «Reativar» apaga o c.end, e por isso só se oferece a quem
         terminou mesmo: num contrato por começar, um clique destruía a data
         de fim e o menu voltava a oferecê-lo, para sempre */
      if(ok)it.push(ctEstado(c)!=='terminado'?{label:'Terminar contrato',icon:'x',toca:'dados',act:`endContract('${jsq(id)}')`}
        :{label:'Reativar contrato',icon:'check',toca:'dados',act:`reactivateContract('${jsq(id)}')`},
        {label:'Apagar contrato',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delContract('${jsq(id)}')`});
      return it.length?menu('fichaCt',it):'';
    },
    editar:ok?{rotulo:'Editar',act:`ctModal('${jsq(id)}')`}:null,
  });
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
  foldState={};
  /* Quem não pode alterar recebe a FICHA, e não este formulário com os campos
     apagados. E antes do openModal: não se decora uma janela já aberta,
     escolhe-se qual é a janela a abrir. */
  const _c=id?contract(id):null;
  if(_c&&!podeEditar(_c.propertyId,'contract.add',_c))return ctView(id);
  if(!db.properties.length)return toast('Cria primeiro um imóvel.');
  /* só onde posso adicionar contratos: os meus imóveis e os de colaboração com o cargo certo */
  const rentables=casasComo('contract.add').filter(p=>p.use==='investimento');
  if(!id&&!rentables.length)return toast(db.properties.some(p=>p.use==='investimento')?fraseSemPerm('contract.add'):'Nenhum imóvel de arrendamento. Muda o uso na ficha do imóvel para criar contratos.');
  cForm=normContract(id?JSON.parse(JSON.stringify(contract(id))):{propertyId:(pid&&(prop(pid)||{}).use==='investimento'&&pode(pid,'contract.add')?pid:rentables[0].id),start:today(),
    tenantIds:tid&&tenant(tid)?[tid]:[]});
  if(!id)fillOwnerContact();
  if(!id&&tid&&tenant(tid))fillTenantContact(tid);
  if(id)ctReconheceContactos();
  const ok=!!id&&podeEditar(cForm.propertyId,'contract.add',contract(id));
  const m=id?menu('ct',[{label:'Gerar contrato em PDF',icon:'down',toca:'camada',act:`ctPdfJanela('${jsq(id)}')`}].concat(ok?[
    ctEstado(cForm)!=='terminado'?{label:'Terminar contrato',icon:'x',act:`endContract('${jsq(id)}')`}:{label:'Reativar contrato',icon:'check',act:`reactivateContract('${jsq(id)}')`},
    {label:'Apagar contrato',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delContract('${jsq(id)}')`}]:[])):'';
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
/* Devolve o handler que o modal usa ao guardar: valida imóvel, renda,
   inquilinos e datas e grava (ctGravar). O erro diz-se junto do campo
   (componentes.js:falhaCampo), que também o anuncia. Num contrato que já tinha
   fim e o vê ir para a frente, pergunta primeiro se é uma renovação ou uma
   correção da data (ctFimPergunta) — a renovação fica no histórico.
   Recebe: nada.
   Devolve: a função de guardar (sem argumentos), pronta a pôr em onSave. */
function ctSaver(){
  return ()=>{
    collectCt();
    if(!cForm.propertyId)return falhaCampo('c_prop','Escolhe o imóvel.');
    const recusa=motivoRecusa(cForm.propertyId,'contract.add',contract(cForm.id));if(recusa)return toast(recusa);
    if(!(cForm.rent>0))return falhaCampo('c_rent','Indica a renda mensal.');
    if(!cForm.tenantIds.length)return falhaCampo('c_tenants','Escolhe pelo menos um inquilino.');
    /* um fim antes do início guardava sem aviso e o contrato sumia das
       rendas e projeções, sem sinal nenhum do porquê */
    if(cForm.start&&cForm.end&&cForm.end<cForm.start)return falhaCampo('c_end','O fim do contrato é antes do início — verifica as datas.');
    const antes=contract(cForm.id),fimAntes=antes&&antes.end;
    /* só quando o fim vai para a frente (uma renovação nunca o encurta) e a
       renovação ainda não foi escrita à mão nas renovações */
    if(fimAntes&&cForm.end&&cForm.end>fimAntes&&!(fiscoDe(cForm).renovacoes||[]).some(r=>r.inicio===pzAddDias(fimAntes,1)))
      return ctFimPergunta(fimAntes);
    ctGravar();
  };
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
   grava o contrato.
   Recebe: renov — 1 se é uma renovação, 0 se é uma correção da data.
   Devolve: nada — grava (ctGravar). */
function ctFimResposta(renov){
  closeModal();
  if(Number(renov)&&_ctFimAntes)ctJuntaRenovacao(cForm,pzAddDias(_ctFimAntes,1),cForm.end);
  _ctFimAntes='';
  ctGravar();
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
   fecha o formulário e aponta os movimentos que ficaram fora das datas.
   Devolve: nada. */
function ctGravar(){
  const i=db.contracts.findIndex(x=>x.id===cForm.id);
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
  if(fora.length)return toast(fora.length===1?'1 movimento deste contrato está fora das datas dele.'
    :fora.length+' movimentos deste contrato estão fora das datas dele.',
    {rotulo:'Ver',ms:9000,fn:()=>verMovimentosFora(cForm.id)});
  toast('Contrato guardado.');
}
/* HTML do formulário do contrato, montado a partir de cForm, como a prancheta
   M-NovoContrato: os campos em grupos (.sect) — o que se arrenda (o imóvel, o
   quarto em chips, os inquilinos e o nome), a renda (o imposto e a líquida, o
   dia do pagamento e o aumento), o prazo (as datas com a frase da duração e
   da oposição, a caução, as rendas antecipadas e o IBAN), a renda recorrente
   e o estado do contrato em interruptores com a situação perante a AT num
   segmentado, e os contactos —; recolhidos, o inventário, as fotos, as chaves
   e os anexos; e as notas. O obrigatório leva o asterisco vermelho e o erro
   diz-se junto do campo (ctSaver). Os ids são os de sempre, lidos pelo
   collectCt. Só devolve a string — é o ctModal/repaintCt que a põe no modal e
   pinta as miniaturas.
   Recebe: nada — lê o cForm.
   Devolve: string com o HTML do formulário do contrato. */
function ctBody(){
  const c=cForm,p=prop(c.propertyId),rooms=(p&&p.rentalMode==='quartos')?(p.rooms||[]):[];
  /* ctVivo: é o único aviso contra assinar dois contratos para o mesmo
     quarto, e um quarto prometido para 2028 já está prometido */
  const taken=db.contracts.filter(x=>x.id!==c.id&&x.propertyId===c.propertyId&&ctVivo(x)).map(x=>x.roomId);
  const tags=ctTenants(c).map(t=>({id:t.id,label:t.name}));
  const inv=c.inventory||[];
  const nSum=(c.keys||[]).length?sum(c.keys.map(k=>k.qty))+' chaves':'';
  const rec=servicoLigado('recurring');
  /* o nome, o imposto e o aumento em branco valem alguma coisa: o exemplo é
     esse valor, e a dica por baixo di-lo («Em branco: …») */
  const nomeVazio=(c.tenantIds||[]).length?ctPick(c):'';
  return `<div class="form ct-form">
    <div class="sect ct-gf" id="ct_arrenda">
      <label>Imóvel <span class="req">*</span>${sel('c_prop',c.propertyId,propOptsPara('contract.add',c.propertyId).filter(o=>{const x=prop(o.v);return x&&(x.use==='investimento'||x.id===c.propertyId)}),'onCtProp','rascunho')}</label>
      ${rooms.length?ctQuartosHtml(c,rooms,taken)
       :(p&&p.use==='investimento'?`<div class="hint ct-colado">Este imóvel está definido como arrendado por inteiro. Para arrendar por quartos, muda isso na ficha do imóvel.</div>`:'')}
      <div class="ct-campo"><div class="flabel">Inquilinos <span class="req">*</span></div><div id="c_tenants">${tagField(tags,'Adicionar','addCtTenant()','delCtTenant','','camada')}</div></div>
      <label>Nome do contrato (opcional)<input id="c_name" value="${esc(c.name||'')}" placeholder="Ex: ${esc(nomeVazio||'Ana · T2 Lisboa')}" autocomplete="off"></label>
      <div class="hint ct-colado">É por este nome que o contrato aparece nos movimentos e nas listas. ${nomeVazio?`Em branco: «${esc(nomeVazio)}», o dos inquilinos.`:'Em branco, usa-se o nome dos inquilinos.'}</div>
    </div>
    <div class="sect ct-gf" id="ct_renda"><h3 class="ct-gf-tit">Renda</h3>
      <label>Renda mensal (€) <span class="req">*</span><input id="c_rent" type="text" inputmode="decimal" class="num" value="${c.rent||''}" placeholder="Ex: 450" data-input="liveNet()"></label>
      <label>Imposto sobre a renda (%, opcional)<input id="c_tax" type="text" inputmode="decimal" class="num" value="${c.taxRate?dec(c.taxRate):''}" placeholder="Ex: ${dec(irsRate(c))}" data-input="liveNet()"></label>
      <div class="hint ct-colado">Em branco: <b id="c_taxVazio">${dec(irsRate(c))} %</b>, a estimativa para ${YEAR}. ${esc(irsTaxasTexto(YEAR))} É uma estimativa sobre a renda bruta: as despesas dedutíveis (IMI, condomínio, obras) baixam o imposto.</div>
      <div class="ct-net" id="netBox">${netBox()}</div>
      <div class="ct-campo"><span class="flabel" id="c_diasRot">A renda paga-se</span>
        <div class="ct-par ct-dias" role="group" aria-labelledby="c_diasRot">
          <label>entre o dia<input id="c_day" type="text" inputmode="numeric" class="num" value="${c.payDay||''}" placeholder="Opcional"></label>
          <label>e o dia<input id="c_dayTo" type="text" inputmode="numeric" class="num" value="${c.payDayTo||''}" placeholder="Opcional"></label></div>
        <div class="hint">Num mês que não tenha esse dia (o 31 em abril), conta o último dia do mês.</div></div>
      <label>Aumento anual (%, opcional)<input id="c_inc" type="text" inputmode="decimal" class="num" value="${c.increase==null?'':dec(c.increase)}" placeholder="Ex: ${dec(db.settings.growth)}"></label>
      <div class="hint ct-colado">Aumento em branco: ${dec(db.settings.growth)} % ao ano nas projeções (o das Definições), sem o aviso do aumento nos prazos.</div>
    </div>
    <div class="sect ct-gf" id="ct_prazo"><h3 class="ct-gf-tit">Prazo</h3>
      <div class="ct-par">
        <label>Início<input id="c_start" type="date" value="${c.start||''}" data-change="liveNet()"></label>
        <label>Fim<input id="c_end" type="date" value="${c.end||''}" data-change="liveNet()"></label></div>
      <p class="hint ct-colado" id="c_prazoFrase">${esc(ctFraseDoPrazo(c))}</p>
      <div class="ct-par">
        <label>Caução (€)<input id="c_dep" type="text" inputmode="decimal" class="num" value="${c.deposit||''}" placeholder="Opcional"></label>
        <label>Rendas antecipadas (meses)<input id="c_adv" type="text" inputmode="numeric" class="num" value="${c.advance||''}" placeholder="Opcional"></label></div>
      ${rec?`<div class="hint ct-colado">Com rendas antecipadas, a renda recorrente arranca depois dos meses pagos à cabeça.</div>`:''}
      <label>IBAN para pagamento das rendas (opcional)<input id="c_iban" value="${esc(c.iban)}" placeholder="Ex: PT50 0002 0123 1234 5678 9015 4" autocomplete="off"></label>
    </div>
    <div class="sect ct-gf" id="ct_fisco">
      ${rec?ctInterruptor('c_autorec',c.autoRec!==false,'Criar movimento recorrente da renda','Todos os meses a renda fica por confirmar em Planeados.'):''}
      ${ctInterruptor('c_active',c.active!==false,'Contrato em vigor','Desligado, o contrato deixa de contar para as rendas e as projeções.')}
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
          <input class="i-q" id="invq_${it.id}" type="text" inputmode="numeric" value="${it.qty}" placeholder="Ex: 1" aria-label="Quantidade">
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
          <input class="i-q" id="keyq_${k.id}" type="text" inputmode="numeric" value="${k.qty}" placeholder="Ex: 1" aria-label="Quantidade">
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
/* O quarto do contrato, num imóvel arrendado por quartos: um chip por quarto
   (role radio) e «Imóvel inteiro» à cabeça. Os que já têm contrato vivo dizem
   «· já arrendado» e continuam a poder escolher-se — um contrato novo pode
   ser o que começa quando o de agora acabar —, mas não passam despercebidos.
   O valor vive num campo escondido (c_room), que o collectCt lê.
   Recebe: c — o contrato do formulário; rooms — os quartos do imóvel; taken — os ids dos quartos com contrato vivo.
   Devolve: o HTML do campo. */
function ctQuartosHtml(c,rooms,taken){
  const cur=c.roomId||'';
  const opcoes=[{v:'',label:'Imóvel inteiro'}].concat(rooms.map(r=>({v:r.id,label:r.name,ja:taken.indexOf(r.id)>-1})));
  return `<div class="ct-campo"><span class="flabel" id="c_roomRot">Quarto</span><input type="hidden" id="c_room" value="${esc(cur)}">
    <div class="chips-fila ct-quartos" role="radiogroup" aria-labelledby="c_roomRot">${opcoes.map(o=>
      `<button type="button" class="chip${cur===o.v?' on':''}${o.ja?' ct-ja':''}" role="radio" aria-checked="${cur===o.v?'true':'false'}" data-v="${esc(o.v)}" data-toca="rascunho" data-click="ctEscolheQuarto('${jsq(o.v)}')">${esc(o.label)}${o.ja?'<span class="ct-ja-txt"> · já arrendado</span>':''}</button>`).join('')}</div></div>`;
}
/* Um chip do quarto foi tocado: guarda a escolha no campo escondido e acende
   o chip, sem repintar o formulário (o foco e o que se escreveu ficam).
   Recebe: rid — o id do quarto ('' para o imóvel inteiro).
   Devolve: nada — mexe no campo e nos chips. */
function ctEscolheQuarto(rid){
  const v=String(rid||''),i=document.getElementById('c_room');if(i)i.value=v;
  const g=document.querySelector('.ct-quartos');if(!g)return;
  [].slice.call(g.querySelectorAll('[role="radio"]')).forEach(b=>{
    const on=b.getAttribute('data-v')===v;
    b.classList.toggle('on',on);b.setAttribute('aria-checked',on?'true':'false');
  });
}
/* Um interruptor do formulário (a prancheta: «Criar movimento recorrente da
   renda»): a caixa de marcar da casa, com o papel de interruptor e o aspeto
   do .interruptor, dentro de um rótulo que se toca inteiro. É uma caixa, e
   não um botão, para o collectCt a ler como sempre leu (chk).
   Recebe: id — o id da caixa; on — se está ligada; titulo — o que liga; sub — a frase por baixo.
   Devolve: o HTML do interruptor. */
function ctInterruptor(id,on,titulo,sub){
  return `<label class="ct-sw-linha"><span class="ct-sw-txt"><b>${esc(titulo)}</b><span class="small">${esc(sub)}</span></span><input type="checkbox" role="switch" class="ct-sw" id="${esc(id)}"${on?' checked':''}></label>`;
}
/* A frase por baixo das datas: quanto dura o contrato e, com fim, até quando
   se avisa o inquilino para ele não renovar (os 120 dias que os prazos
   contam — prazos.js:prazosDe). Sem fim, diz que não há prazo a avisar.
   Recebe: c — o contrato (o do formulário, ou o que ctEmEdicao devolve).
   Devolve: o texto (por escapar); '' com as datas trocadas. */
function ctFraseDoPrazo(c){
  const iso=/^\d{4}-\d{2}-\d{2}$/;
  if(!iso.test(String(c.end||'')))return 'Sem data de fim: não há oposição à renovação a avisar.';
  if(iso.test(String(c.start||''))&&c.end<c.start)return '';
  let dur='';
  if(iso.test(String(c.start||''))){
    const m=Math.round(pzDias(c.end,c.start)/30.44);
    dur=m>=12&&m%12===0?(m/12===1?'1 ano':m/12+' anos'):(m===1?'1 mês':m+' meses');
  }
  const op=pzAddDias(c.end,-120);
  return (dur?dur.charAt(0).toUpperCase()+dur.slice(1)+'. ':'')+'Para não renovar, avisa o inquilino até '+dPT(op)+' (120 dias) — a app lembra-te antes, nos prazos.';
}
/* O contrato como está escrito no formulário agora, para a estimativa da
   taxa: a renda, as datas, a finalidade, a celebração, a isenção e as duas
   perguntas do art. 72.º n.os 23 e 24 dos campos que estão no ecrã, o resto
   do cForm. Não grava nada.
   Devolve: um objeto novo com a forma de um contrato. */
function ctEmEdicao(){
  const eR=document.getElementById('c_rent');
  const f=Object.assign({},fiscoDe(cForm));
  if(document.getElementById('c_ffin'))f.finalidade=val('c_ffin');
  if(document.getElementById('c_fcel'))f.celebracao=val('c_fcel');
  if(document.getElementById('c_fisen'))f.isencao=val('c_fisen');
  if(document.getElementById('c_facima')){const r=val('c_facima');f.rendaAcimaDoLimite=r==='1'?true:r==='0'?false:null}
  if(document.getElementById('c_fant'))f.rendaAnterior=num(val('c_fant'))||0;
  return Object.assign({},cForm,{rent:eR?num(eR.value):cForm.rent,start:val('c_start')||cForm.start,end:val('c_end')||cForm.end,fisco:f});
}
// HTML do resumo bruto → imposto → líquido. Lê os campos do formulário se
// já estiverem no DOM; antes disso usa os valores de cForm. Sem taxa escrita,
// a estimativa do ano corrente (irsRate), com o motivo à vista. Vive numa
// caixa da superfície 2 (.ct-net), com a líquida a verde e o imposto a laranja.
// Recebe: nada — lê os campos ou o cForm.
// Devolve: string com o HTML do resumo (ou um aviso, se faltar a renda).
function netBox(){
  /* «campo presente e vazio» (apagado de propósito → estimativa) é diferente de «ainda sem DOM» (cForm) */
  const eT=document.getElementById('c_tax'),est=ctEmEdicao();
  const r=est.rent,escrita=eT?num(eT.value):(Number(cForm.taxRate)||0);
  const tx=escrita>0?escrita:irsRate(est);
  if(!r)return `<div class="small">Escreve a renda para veres a líquida.</div>`;
  const imposto=r*tx/100;
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
// #c_taxVazio, o #c_prazoFrase, o #c_fisenHint e o hidden do #c_fn23.
function liveNet(){
  const b=document.getElementById('netBox');if(b)b.innerHTML=netBox();
  const v=document.getElementById('c_taxVazio'),t=document.getElementById('c_tax');
  const est=ctEmEdicao(),r=dec(irsRate(est));
  if(v)v.textContent=r+' %';
  if(t)t.placeholder='Ex: '+r;
  const fr=document.getElementById('c_prazoFrase');if(fr)fr.textContent=ctFraseDoPrazo(est);
  const n=document.getElementById('c_fn23');if(n)n.hidden=!ctN23Visivel(est);
  const h=document.getElementById('c_fisenHint');if(h)h.textContent=ctIsencaoTexto(fiscoDe(est).isencao);
}
/* Copia o que está nos campos do modal para cForm. Chamar SEMPRE antes de
   repintar ou de mexer nas listas (inventário, chaves, fotos), senão o que
   o utilizador escreveu perde-se. Também normaliza os dias de pagamento
   (1–31, o "até" nunca antes do "de") e as rendas antecipadas (0–36).
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
  /* o bloco fiscal: cada campo só quando está no ecrã (só o contrato declarado
     os tem), e o estado nunca daqui — muda-se pelos botões (setFiscoEstado).
     No fim passa pelo normFisco, que guarda os ids das renovações que já lá
     estavam: é por eles que os campos c_rini_/c_rfim_ se voltam a encontrar. */
  const f=c.fisco=fiscoDe(c);
  if(document.getElementById('c_fnum'))f.numero=val('c_fnum');
  if(document.getElementById('c_ffin'))f.finalidade=val('c_ffin');
  if(document.getElementById('c_fcel'))f.celebracao=val('c_fcel');
  if(document.getElementById('c_fren')){const r=val('c_fren');f.renovavel=r==='1'?true:r==='0'?false:null}
  (f.renovacoes||[]).forEach(r=>{
    const a=document.getElementById('c_rini_'+r.id);if(a)r.inicio=a.value;
    const b=document.getElementById('c_rfim_'+r.id);if(b)r.fim=b.value;
  });
  if(document.getElementById('c_fces'))f.cessacaoMotivo=val('c_fces');
  if(document.getElementById('c_fisen'))f.isencao=val('c_fisen');
  if(document.getElementById('c_facima')){const r=val('c_facima');f.rendaAcimaDoLimite=r==='1'?true:r==='0'?false:null}
  if(document.getElementById('c_fant'))f.rendaAnterior=num(val('c_fant'))||0;
  c.fisco=normFisco(f);
}
// Repinta o corpo do modal a partir de cForm e recarrega as miniaturas das
// fotos. Não recolhe os campos — chama collectCt() antes, se for preciso.
// Devolve: nada — redesenha o corpo do modal.
function repaintCt(){const b=modalBodyEl();if(!b)return;b.innerHTML=ctBody();marcarDatasVazias(b);
  const p=prop(cForm.propertyId);if(p)paintThumbs(p.photos)}

/* A secção «Declaração» do formulário: o estado do contrato perante a AT, e o que
   a AT pergunta quando está declarado.

   Três botões, e os três são escolhas — «não declarado» é uma decisão do
   senhorio, não um erro da app: escreve-se com a mesma cor e a mesma letra
   que os outros dois, e a frase por baixo diz só o que muda (fica fora do
   resumo e dos prazos). O que se pede ao contrato declarado é o que o Anexo F
   e o Modelo 2 pedem, campo a campo, com a razão à frente de cada um: o
   número da AT vai em cada linha do quadro 4.1, a celebração no 4.2, as
   renovações no 4.2A, o motivo da cessação na comunicação à AT. E o que mexe
   na taxa: a isenção de um programa de arrendamento acessível (quadro 6D) e,
   num contrato celebrado desde 2024 com redução possível, as duas perguntas
   do art. 72.º — a renda acima de 150 % do limite (n.º 23) e a renda do
   contrato anterior (n.º 24) —, escondidas quando não se aplicam (o liveNet
   mostra-as quando a celebração ou as datas mudam).
   Devolve: string com o HTML da secção. */
function fiscoSect(){
  const c=cForm,f=fiscoDe(c),renovs=f.renovacoes||[];
  const vA=irsAno(YEAR),L=vA.taxas.limiteRendaAlta,B=vA.taxas.bonusRendaMenor,isens=vA.isencoes||[];
  const isOpts=[{v:'',label:'Nenhuma'}].concat(isens.map(x=>({v:x.id,label:x.nome})));
  if(f.isencao&&!isens.some(x=>x.id===f.isencao))isOpts.push({v:f.isencao,label:f.isencao.toUpperCase()});
  /* o segmentado da casa (a prancheta): três escolhas curtas, com a mesma
     letra e a mesma cor — «não declarado» é uma decisão, não um erro */
  const seg=`<div class="ct-campo"><span class="flabel" id="c_fiscoRot">Perante a AT</span>
    <div class="segm ct-at-segm" role="radiogroup" aria-labelledby="c_fiscoRot">${[['','Por indicar'],['declarado','Declarado'],['naoDeclarado','Não declarado']]
      .map(([k,lb])=>`<button type="button" role="radio" aria-checked="${f.estado===k?'true':'false'}" class="${f.estado===k?'on':''}" data-toca="rascunho" data-click="setFiscoEstado('${k}')">${lb}</button>`).join('')}</div></div>`;
  if(f.estado==='naoDeclarado')return seg+`<div class="hint ct-colado">Este contrato fica fora do resumo do Anexo F e dos prazos da AT. Podes mudar isto quando quiseres.</div>`;
  if(f.estado!=='declarado')return seg+`<div class="hint ct-colado">Comunicaste este contrato às Finanças (Modelo 2)? Marca aqui: o resumo do Anexo F e os prazos da AT dependem disso.${/^\d{4}-\d{2}-\d{2}$/.test(String(c.start||''))?' O prazo é '+dPT(fimDoMesSeguinte(c.start))+', o fim do mês seguinte ao início.':''}</div>`;
  /* a cessação só faz sentido num contrato que acaba ou já acabou */
  const cessa=!!c.end||c.active===false;
  /* a redução pela duração é só dos contratos de habitação permanente (irsReducao) */
  const reduzida=irsTaxa(c,YEAR).reducao;
  /* cada dica logo a seguir ao campo de que fala: lado a lado só o que cabe
     a 390px (a data e o «Renovável») */
  return seg+`
    <label>N.º do contrato na AT (opcional)<input id="c_fnum" type="text" inputmode="numeric" class="num" value="${esc(f.numero)}" placeholder="Ex: 1234567" autocomplete="off"></label>
    <div class="hint ct-colado">Vem no comprovativo do Modelo 2; o Anexo F pede-o em cada linha.</div>
    <label>Finalidade${sel('c_ffin',f.finalidade,[{v:'',label:'—'}].concat(FISCO_FINALIDADES.map(x=>({v:x[0],label:x[1]}))),'liveNet','rascunho')}</label>
    <div class="ct-par">
      <label>Data de celebração<input id="c_fcel" type="date" value="${esc(f.celebracao)}" data-change="liveNet()"></label>
      <label>Renovável${sel('c_fren',f.renovavel===true?'1':f.renovavel===false?'0':'',[{v:'',label:'Não sei'},{v:'1',label:'Sim'},{v:'0',label:'Não'}],'','rascunho')}</label></div>
    <div class="hint ct-colado">O dia em que assinaram: o quadro 4.2 do Anexo F pede-o nos contratos de longa duração.</div>
    <label>Isenção de IRS${sel('c_fisen',f.isencao,isOpts,'liveNet','rascunho')}</label>
    <div class="hint ct-colado" id="c_fisenHint">${esc(ctIsencaoTexto(f.isencao))}</div>
    ${L&&B?`<div id="c_fn23"${ctN23Visivel(c)?'':' hidden'}><div class="form">
      <label>Renda acima de ${dec(L.percentagem)} % do limite do concelho?${sel('c_facima',f.rendaAcimaDoLimite===true?'1':f.rendaAcimaDoLimite===false?'0':'',[{v:'',label:'Não sei'},{v:'0',label:'Não'},{v:'1',label:'Sim'}],'liveNet','rascunho')}</label>
      <div class="hint ct-colado">Num contrato de habitação celebrado desde ${dPT(L.desde)}, uma renda mensal acima de ${dec(L.percentagem)} % dos limites gerais da tipologia no concelho (os do arrendamento acessível) faz perder a redução pela duração, e o contrato vai ao quadro 4.1 (CIRS art. 72.º n.º 23). A app não tem essas tabelas: indica-o aqui. Em «Não sei» conta-se a redução.</div>
      <label>Renda do contrato anterior neste imóvel (€)<input id="c_fant" type="text" inputmode="decimal" value="${f.rendaAnterior?dec(f.rendaAnterior):''}" placeholder="Opcional" data-input="liveNet()"></label>
      <div class="hint ct-colado">Se a renda deste contrato for pelo menos ${dec(B.rendaMenorPct)} % mais baixa do que a do anterior, a taxa desce mais ${dec(B.pontos)} pontos (CIRS art. 72.º n.º 24, quadro 4.2B do Anexo F). Em branco: não se aplica.</div>
    </div></div>`:''}
    <div><div class="flabel">Renovações</div>
      ${renovs.length?`<div class="form u-g-9px">${renovs.map(r=>`<div class="invrow u-gtc-1fr-1fr-auto u-ai-end">
        <label>Início<input id="c_rini_${esc(r.id)}" type="date" value="${esc(r.inicio)}"></label>
        <label>Fim<input id="c_rfim_${esc(r.id)}" type="date" value="${esc(r.fim)}"></label>
        <button type="button" class="btn sm danger" data-toca="rascunho" data-click="delRenov('${jsq(r.id)}')" aria-label="Remover renovação">${ic('trash',14)}</button></div>`).join('')}</div>`:''}
      <div class="toolbar ${renovs.length?'u-m-4px-0-0':'u-m-0-0-0'}"><button type="button" class="btn sm" data-toca="rascunho" data-click="addRenov()">${ic('plus',14)} Adicionar renovação</button></div>
      <div class="hint">Início e fim de cada renovação. O quadro 4.2A do Anexo F pede os da última.</div></div>
    ${cessa?`<label>Motivo da cessação (opcional)<input id="c_fces" value="${esc(f.cessacaoMotivo)}" placeholder="Ex: Fim do prazo" autocomplete="off"></label>
    <div class="hint ct-colado">A AT pergunta-o ao comunicar o fim do contrato: fim do prazo, acordo, denúncia…</div>`:''}
    ${reduzida?`<div class="hint">Taxa reduzida pela duração (${dec(reduzida.taxa)} %): vai ao quadro 4.2 do Anexo F, e até 15 de fevereiro comunica-se a duração e as renovações no Portal das Finanças.</div>`:''}`;
}
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
/* A explicação curta da isenção escolhida, para a dica por baixo da escolha:
   o texto da versão do ano e onde se declara; sem isenção, para que serve.
   Recebe: id — o valor de fisco.isencao ('' ou o id de uma isenção).
   Devolve: o texto (sem HTML). */
function ctIsencaoTexto(id){
  const x=id?(irsAno(YEAR).isencoes||[]).find(i=>i.id===id):null;
  if(!id)return 'Só os contratos de um programa de arrendamento acessível estão isentos de IRS. Com isenção, a taxa estimada passa a 0 %.';
  if(!x)return 'Esta isenção não existe nas regras de '+YEAR+'.';
  return x.texto+' Declara-se no quadro '+x.quadro+' do Anexo F'+(x.codigo?' (código '+x.codigo+')':' (o código ainda não se conhece)')+'.';
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
/* O ano dos rendimentos cuja comunicação de fevereiro (Portaria 110/2019) a
   ficha propõe marcar: o anterior, se teve redução e ainda não está marcado
   (ou se está, até ao dia do prazo — para se poder desmarcar); senão o
   corrente, se tem redução. É o mesmo ano que os prazos avisam.
   Recebe: c — o contrato; hoje — 'AAAA-MM-DD'.
   Devolve: o ano (número), ou null quando não há o que comunicar. */
function ctAnoComunicacao(c,hoje){
  const a=Number(String(hoje).slice(0,4)),Y=a-1;
  if(ctViveNoAno(c,Y)&&irsTaxa(c,Y).reducao&&(!irsComunicado(c,Y)||hoje<=irsAno(Y).prazos.comunicacaoDuracao))return Y;
  return ctViveNoAno(c,a)&&irsTaxa(c,a).reducao?a:null;
}
/* O contrato esteve em vigor algum dia do ano? Do início ao fim efetivo
   (ctFimEfetivo); sem fim, até sempre. Um ano antes de o contrato começar,
   ou depois de acabar, não tem duração nenhuma a comunicar.
   Recebe: c — o contrato; ano — o ano (número).
   Devolve: true ou false. */
function ctViveNoAno(c,ano){
  const fim=ctFimEfetivo(c);
  return !!c.start&&c.start<=ano+'-12-31'&&(!fim||fim>=ano+'-01-01');
}
/* O fim de um contrato contando as renovações registadas: o c.end, ou o fim
   de uma renovação escrita à mão que vai para lá dele.
   Recebe: c — o contrato.
   Devolve: 'AAAA-MM-DD', ou '' sem fim. */
function ctFimEfetivo(c){
  let fim=(c&&c.end)||'';
  (fiscoDe(c).renovacoes||[]).forEach(r=>{if(fim&&r.fim&&r.fim>fim)fim=r.fim});
  return fim;
}
/* A linha da ficha sobre a comunicação de fevereiro do ano em causa: feita (e
   quando) ou por fazer (e até quando), com o botão de a marcar ou desmarcar
   para quem pode alterar o contrato.
   Recebe: c — o contrato.
   Devolve: o HTML (texto escapado e o botão), ou '' sem nada a comunicar. */
function ctComunicacaoNota(c){
  const h=today(),ano=ctAnoComunicacao(c,h);if(ano==null)return '';
  const feita=irsComunicado(c,ano),prazo=irsAno(ano).prazos.comunicacaoDuracao;
  const txt=feita?'Duração e renovações de '+ano+' comunicadas no Portal das Finanças a '+dPT(feita)+'.'
    :'Duração e renovações de '+ano+' por comunicar no Portal das Finanças: '+(h>prazo?'o prazo era ':'até ')+dPT(prazo)+'.';
  const btn=podeEditar(c.propertyId,'contract.add',c)?`<div class="toolbar u-m-9px-0-0"><button type="button" class="btn sm" data-toca="${feita?'dados':'camada'}" data-click="${feita?`ctMarcarComunicada('${jsq(c.id)}',${ano},0)`:`ctComunicadaPergunta('${jsq(c.id)}',${ano})`}">${feita?'Desmarcar':'Marcar como comunicada'}</button></div>`:'';
  return esc(txt)+btn;
}
/* A janela pequena de «Marcar como comunicada»: o dia em que a comunicação
   foi feita no Portal, proposto hoje (ou o dia do prazo, se já passou) — o
   4.2A pergunta se foi feita a tempo, e a data de hoje, num ano já fechado,
   dizia que não.
   Recebe: id — o id do contrato; ano — o ano dos rendimentos.
   Devolve: nada — abre a janela. */
function ctComunicadaPergunta(id,ano){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const h=today(),prazo=irsAno(ano).prazos.comunicacaoDuracao,dia=h>prazo?prazo:h;
  openModal('Comunicação de '+anoIrs(ano),`<div class="form">
    <div class="hint">A duração e as renovações de ${anoIrs(ano)} comunicam-se no Portal das Finanças até ${dPT(prazo)}.</div>
    <label>Comunicada a <span class="req">*</span><input id="c_comdia" type="date" max="${esc(h)}" value="${esc(dia)}"></label></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="ctMarcarComunicada('${jsq(id)}',${anoIrs(ano)},1)">Marcar</button>`);
}
/* Marca (com o dia da janela, ctComunicadaPergunta) ou desmarca a
   comunicação de fevereiro de um ano num contrato, e grava pelo caminho de
   sempre (save + render, que repinta a ficha aberta). Marcada, o aviso do 15
   de fevereiro desse ano cala-se.
   Recebe: id — o id do contrato; ano — o ano dos rendimentos; on — 1 marca, 0 desmarca.
   Devolve: nada. */
function ctMarcarComunicada(id,ano,on){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const f=fiscoDe(c),com=Object.assign({},f.comunicacoes),k=String(anoIrs(ano));
  if(Number(on)){
    const dia=val('c_comdia');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))return falhaCampo('c_comdia','Indica o dia da comunicação.');
    if(dia>today())return falhaCampo('c_comdia','O dia da comunicação não pode ser depois de hoje.');
    com[k]=dia;
    closeModal();
  }else delete com[k];
  c.fisco=normFisco(Object.assign({},f,{comunicacoes:com}));
  save();render();
  toast(Number(on)?'Comunicação de '+k+' marcada como feita.':'Comunicação de '+k+' desmarcada.');
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
   sugestão (ctRenovacaoSugerida).
   Recebe: id — o id do contrato.
   Devolve: nada — abre a janela. */
function ctRenovar(id){
  const c=contract(id);if(!c||!c.end)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  openModal('Renovar contrato',`<div class="form">
    <div class="hint">O contrato termina a ${dPT(ctFimEfetivo(c))}. A renovação começa a ${dPT(pzAddDias(ctFimEfetivo(c),1))} e fica registada nas renovações, e o fim do contrato passa a ser o novo. As rendas planeadas seguem-no.</div>
    <label>Novo fim <span class="req">*</span><input id="c_renfim" type="date" value="${esc(ctRenovacaoSugerida(c))}"></label>
    <div class="hint u-mt-n6px">A data proposta repete a duração do período que agora acaba.</div></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="ctRenovarOk('${jsq(id)}')">Renovar</button>`);
}
/* Grava a renovação da janela «Renovar…»: uma entrada nas renovações (do dia
   a seguir ao fim antigo até ao fim novo), o fim novo no contrato, e as
   rendas planeadas acertadas pelo syncContractRec.
   Recebe: id — o id do contrato.
   Devolve: nada — grava, fecha a janela e redesenha. */
function ctRenovarOk(id){
  const c=contract(id);if(!c||!c.end)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const fim=val('c_renfim'),fe=ctFimEfetivo(c);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fim))return falhaCampo('c_renfim','Indica a nova data de fim.');
  if(fim<=fe)return falhaCampo('c_renfim','O novo fim tem de ser depois de '+dPT(fe)+'.');
  /* uma renovação já registada à mão para lá do fim conta: a nova começa
     depois dela, e não se escreve a mesma outra vez */
  ctJuntaRenovacao(c,pzAddDias(fe,1),fim);
  c.end=fim;
  if(servicoLigado('recurring'))syncContractRec(c);
  save();closeModal();buildNav();render();
  toast('Renovação registada: o contrato vai até '+dPT(fim)+'.');
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
        <b>${esc([chosen.phone?fmtPhone(chosen.phone):'',chosen.email].filter(Boolean).join(' · ')||'sem contacto na ficha')}</b></div>`
      :`<div class="row">
        <label>Email (opcional)<input id="${owners?'c_omail':'c_tmail'}" type="email" inputmode="email" value="${esc(owners?c.ownerEmail:c.tenantEmail)}" placeholder="Ex: ${owners?'rui@exemplo.pt':'ana@exemplo.pt'}" autocomplete="off"></label>
        <label>Telemóvel (opcional)<input id="${owners?'c_ophone':'c_tphone'}" type="tel" inputmode="tel" value="${esc(owners?c.ownerPhone:c.tenantPhone)}" placeholder="Ex: ${owners?'912 345 678':'913 456 789'}" autocomplete="off"></label></div>`}
  </div>`;
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
// Ao trocar o imóvel do contrato: limpa o quarto (pertencia ao anterior),
// puxa o contacto do proprietário novo e repinta.
// Devolve: nada — repinta o formulário.
function onCtProp(){collectCt();cForm.propertyId=val('c_prop');cForm.roomId=null;fillOwnerContact();repaintCt()}
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
// Pede confirmação e termina o contrato: fica inativo, ganha data de fim
// (hoje, se não tiver) e o movimento recorrente da renda é desligado.
// Recebe: id — id do contrato.
// Devolve: nada — pede confirmação e, se aceite, grava e redesenha a vista.
function endContract(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  confirmModal('Terminar contrato',`Marcar o contrato de ${esc(ctNames(c))} como terminado? Deixa de contar para as rendas e projeções.`,()=>{
    c.active=false;if(!c.end)c.end=today();if(servicoLigado('recurring'))syncContractRec(c);save();closeAllModals();buildNav();render();toast('Contrato terminado.');
  });
}
// Pede confirmação e reativa o contrato: limpa a data de fim e volta a
// ligar o movimento recorrente da renda.
// Recebe: id — id do contrato.
// Devolve: nada — pede confirmação e, se aceite, grava e redesenha a vista.
function reactivateContract(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  confirmModal('Reativar contrato',`Reativar o contrato de ${esc(ctNames(c))}? Volta a contar para as rendas e projeções.`,()=>{
    c.active=true;c.end='';if(servicoLigado('recurring'))syncContractRec(c);save();closeAllModals();buildNav();render();toast('Contrato reativado.');
  });
}
/* Apaga o contrato, com confirmação: sai da lista, o recorrente automático
   da renda vai com ele e os movimentos ligados ficam órfãos (mantêm-se, mas
   sem contractId). O toast dá para desfazer tudo; os anexos só se apagam do
   IndexedDB quando o desfazer expira sem ser usado.
   Recebe: id — id do contrato a apagar.
   Devolve: nada — pede confirmação e, se aceite, grava e redesenha a vista. */
function delContract(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c,true);if(recusa)return toast(recusa);
  confirmModal('Apagar contrato',`Apagar o contrato de ${esc(ctNames(c))}? Os movimentos ficam, mas deixam de estar ligados a ele.`,()=>{
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
