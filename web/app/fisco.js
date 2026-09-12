/* ================= FISCO ================= */
/* A página do IRS de um senhorio: o quadro 4.1 do Anexo F, linha a linha, com
   o que a app sabe e o que falta apontado ao lado.

   A app RESUME, não declara. Nunca inventa um número nem um código: uma linha
   sem código de freguesia fica com a falta escrita, não com um código
   plausível. E um contrato marcado como «não declarado» é uma escolha do
   senhorio — fica fora do quadro e dos totais, listado à parte sem juízo, com
   o nome e o valor e mais nada.

   Cash basis: uma renda conta no ano da data do movimento; um gasto no ano em
   que foi pago. Com um titular escolhido tudo entra pela quota-parte dele — o
   Anexo F é por titular, e um imóvel a meias tem duas declarações.

   O que é estimativa diz-se como tal: os gastos de um imóvel com dois
   contratos no mesmo ano repartem-se pelas linhas na proporção das rendas de
   cada uma; o rateio que a lei pede quando o imóvel se arrenda por partes (por
   VPT ou por área) fica para quem preenche, com o VPT à mão na ficha do imóvel. */

/* o ano escolhido no seletor; vazio é «automático» (fiscoAnoAtual) */
let fiscoAno='';
/* as colunas de gastos do quadro 4.1, pela ordem em que o Anexo F as pede */
const fiscoCols=['conservacao','condominio','imi','selo','taxas','outros'];

/* O ano que a página mostra: o escolhido; senão, até junho e havendo rendas no
   ano anterior, o ano anterior — é o que se está a declarar. Depois de junho
   o ano corrente, que é o que se vai acompanhando.
   Devolve: o ano (número). */
function fiscoAnoAtual(){
  if(fiscoAno)return Number(fiscoAno);
  const ant=String(YEAR-1);
  if(new Date().getMonth()+1<=6&&(db.transactions||[]).some(t=>ehRenda(t)&&String(t.date||'').startsWith(ant)))return YEAR-1;
  return YEAR;
}
/* o rótulo curto de uma coluna de gastos, para caber num cabeçalho de tabela
   Recebe: k — o id da coluna (de IRS_COLUNAS).
   Devolve: o rótulo (texto). */
function fiscoColRotulo(k){
  return {conservacao:'Conservação',condominio:'Condomínio',imi:'IMI',selo:'Selo',taxas:'Taxas',outros:'Outros'}[k]||irsColunaNome(k)||k;
}
/* «1 renda», «3 rendas»
   Recebe: n — a contagem; sing — a palavra no singular; plur — no plural.
   Devolve: o texto com o número à frente. */
function fiscoN(n,sing,plur){return n+' '+(n===1?sing:plur)}
/* A data 24 meses antes de outra, em texto — o limite das obras que o artigo
   41.º do CIRS deixa deduzir antes de o arrendamento começar. Só se compara,
   por isso vale a aritmética no ano e nunca um Date (nem toISOString).
   Recebe: iso — a data 'AAAA-MM-DD'.
   Devolve: 'AAAA-MM-DD' dois anos antes, ou '' sem data. */
function fiscoMenos24(iso){
  const m=/^(\d{4})(-\d{2}-\d{2})$/.exec(String(iso||''));
  return m?String(Number(m[1])-2)+m[2]:'';
}
/* Havia algum contrato do imóvel em vigor nesta data? É o que separa uma obra
   feita entre arrendamentos (dedutível nos 24 meses antes do seguinte) de uma
   reparação durante um. Com data de fim, vale a data; sem ela, vale o estado
   — um contrato sem fim e inativo não diz quando acabou, e não se adivinha.
   Recebe: pid — o id do imóvel; d — a data 'AAAA-MM-DD'.
   Devolve: true se havia. */
function fiscoHaviaContrato(pid,d){
  return (db.contracts||[]).some(c=>c.propertyId===pid&&c.start&&c.start<=d&&(c.end?c.end>=d:c.active!==false));
}
/* Os contratos para que um gasto conta como «obras antes do arrendamento»:
   por imóvel que o gasto toca, os contratos que começam DEPOIS da data e até
   24 meses depois, quando o gasto está marcado à mão como obras24 ou é
   conservação numa altura em que o imóvel não tinha contrato em vigor. Entre
   vários, só os que começam mais cedo: a obra precede UM arrendamento, e um
   gasto contado em dois anos seria contado duas vezes (dois quartos a começar
   no mesmo dia repartem-na).
   Recebe: t — o movimento (despesa); col — a coluna do Anexo F já calculada (irsColunaDe).
   Devolve: objeto {idDoImovel: [contratos]}; vazio quando não é obra dos 24 meses. */
function fiscoObra24De(t,col){
  const out={};
  if(col!=='obras24'&&col!=='conservacao')return out;
  const d=String(t.date||'');if(!d)return out;
  txProps(t).forEach(p=>{
    if(col==='conservacao'&&fiscoHaviaContrato(p.id,d))return;
    const cs=(db.contracts||[]).filter(c=>c.propertyId===p.id&&c.start&&d<c.start&&d>=fiscoMenos24(c.start))
      .sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);
    if(cs.length)out[p.id]=cs.filter(c=>c.start===cs[0].start);
  });
  return out;
}
/* Reparte um valor pelas linhas de um imóvel na proporção das rendas de cada
   uma — a estimativa que o resumo assume para um imóvel com mais do que um
   contrato no ano. Sem rendas em nenhuma (só com rendas a zero), em partes
   iguais, para nunca dividir por zero.
   Recebe: ls — as linhas do imóvel; valor — o que repartir (euros); fn — chamada
   com (linha, parte) por cada linha.
   Devolve: nada — entrega a parte de cada linha a fn. */
function fiscoReparte(ls,valor,fn){
  const tot=sum(ls.map(l=>l.rendas));
  ls.forEach(l=>fn(l,valor*(tot>0?l.rendas/tot:1/ls.length)));
}
/* Uma linha do quadro 4.1 ainda sem valores: a identificação do contrato, do
   imóvel e dos inquilinos, e as faltas que se veem sem olhar às rendas — o
   que a AT pergunta e a app não tem. Um NIF que não bate certo é uma falta
   como as outras: vai para o Anexo F tal e qual, e volta recusado.
   Recebe: c — o contrato; p — o imóvel (pode faltar); q — a quota-parte (0–1).
   Devolve: a linha (objeto), com rendas, retenções e gastos a zero. */
function fiscoLinhaNova(c,p,q){
  const f=fiscoDe(c),ts=ctTenants(c),faltas=[];
  if(ctFiscoPorIndicar(c))faltas.push('contrato por indicar se está declarado');
  if(ctDeclarado(c)&&!f.numero)faltas.push('n.º do contrato na AT');
  if(!p||!p.freguesiaCodigo)faltas.push('código da freguesia');
  if(!p||!p.tipoPredio)faltas.push('tipo de prédio');
  if(!p||!p.matrix)faltas.push('artigo matricial');
  if(!ts.length)faltas.push('inquilino do contrato');
  ts.forEach(t=>{
    const v=nifValido(t.nif);
    if(v===false)faltas.push('NIF do inquilino '+t.name+' não bate certo');
    else if(v===null&&!String(t.pais||'').trim())faltas.push('NIF ou país do inquilino '+t.name);
  });
  const g={};fiscoCols.forEach(k=>{g[k]=0});
  return {contratoId:c.id,propertyId:p?p.id:(c.propertyId||null),nome:ctName(c),imovel:p?p.name:'',
    atNumero:f.numero,inicio:c.start||'',estado:f.estado,
    freguesiaCodigo:p?p.freguesiaCodigo:'',tipoPredio:p?p.tipoPredio:'',artigo:p?p.matrix:'',fracao:p?p.fraction:'',
    quota:q,natureza:naturezaIrs(c),
    inquilinos:ts.map(t=>({id:t.id,nome:t.name,nif:t.nif||'',pais:t.pais||''})),
    rendas:0,retencoes:0,gastos:g,obras24:{valor:0,inicioGastos:''},
    taxaReduzida:irsRate(c)<25,faltas:faltas,recibosPorEmitir:0};
}
/* O resumo do Anexo F de um ano — a função pura por trás da página, do texto e
   do CSV. Uma linha por contrato NÃO marcado como não declarado com rendas no
   ano; os não declarados vão para «fora», somados; as rendas sem contrato (ou
   de um contrato entretanto apagado) para «semContrato», por imóvel. Os gastos
   do imóvel no ano entram pela coluna que irsColunaDe lhes dá, com o peso de
   metricas.js:txWeight (um movimento de grupo reparte-se pelos imóveis) e pela
   quota, e repartem-se pelas linhas do imóvel na proporção das rendas. As
   obras dos 24 meses (fiscoObra24De) entram só na linha do contrato que
   começou neste ano, e nunca voltam a entrar nas colunas normais — nem neste
   ano nem noutro.

   Com um titular, entram só os imóveis onde ele tem quota, e tudo pela quota.
   Sem titular vale o âmbito da vista; com um grupo de proprietários no filtro,
   o grupo é ignorado (o Anexo F é por pessoa) e os valores vão por inteiro.
   Recebe: ano — o ano (número ou texto); titularId — o id do proprietário
   (vazio ou nulo para todos, por inteiro).
   Devolve: {ano, titularId, imoveis, linhas, fora, semContrato, totais, avisos,
   semRegra, obrasSoltas} — linhas: [{contratoId, propertyId, nome, imovel, atNumero,
   inicio, estado, freguesiaCodigo, tipoPredio, artigo, fracao, quota,
   natureza, inquilinos:[{id, nome, nif, pais}], rendas, retencoes,
   gastos:{conservacao, condominio, imi, selo, taxas, outros}, obras24:{valor,
   inicioGastos}, taxaReduzida, faltas:[texto], recibosPorEmitir}]; fora:
   [{contratoId, nome, imovel, rendas, n, quota}]; semContrato: [{propertyId,
   imovel, rendas, n, ids}]; totais: {rendas, retencoes, gastos, obras24};
   avisos: [{texto, abrir, toca}]; semRegra: n.º de despesas que caíram em
   «outros» por não terem regra; obrasSoltas: n.º de despesas do ano marcadas
   como obras24 sem contrato a começar depois; imoveis: quantos imóveis entraram. */
function resumoFiscal(ano,titularId){
  ano=Number(ano)||YEAR;titularId=titularId||'';
  const A=String(ano);
  const perm=p=>pode(p.id,'tx.view')||pode(p.id,'report.view')||pode(p.id,'loan.view');
  const quotaDe=p=>p?(titularId?shareOf(p,titularId):1):(titularId?0:1);
  const base=(ownerIsGrp()?db.properties.filter(perm):pidProps(null)).filter(p=>pode(p.id,'report.view')&&quotaDe(p)>0);
  const props={};base.forEach(p=>{props[p.id]=p});
  const noAno=t=>String(t.date||'').startsWith(A);
  const linhas={},fora={},semC={};
  /* as rendas do ano, cada uma para a linha do seu contrato — ou para fora, ou
     para as sem contrato */
  (db.transactions||[]).forEach(t=>{
    if(!ehRenda(t)||!noAno(t))return;
    const c=t.contractId?contract(t.contractId):null;
    const pid=(c&&c.propertyId)||t.propertyId||'';
    const p=props[pid];
    if(pid&&!p)return;                 // fora do âmbito: de outro dono, ou sem permissão
    if(!pid&&titularId)return;         // sem imóvel não há quota de ninguém
    const q=quotaDe(p),bruta=rendaBruta(t)*q;
    if(!c){const s=semC[pid]||(semC[pid]={propertyId:pid||null,imovel:p?p.name:'Sem imóvel',rendas:0,n:0,ids:[]});
      s.rendas+=bruta;s.n++;s.ids.push(t.id);return}
    if(ctNaoDeclarado(c)){const f=fora[c.id]||(fora[c.id]={contratoId:c.id,nome:ctName(c),imovel:p?p.name:'',rendas:0,n:0,quota:q});
      f.rendas+=bruta;f.n++;return}
    const l=linhas[c.id]||(linhas[c.id]=fiscoLinhaNova(c,p,q));
    l.rendas+=bruta;l.retencoes+=(Number(t.retencao)||0)*q;
    if(!t.recibo&&ctDeclarado(c))l.recibosPorEmitir++;
  });
  const L=Object.keys(linhas).map(k=>linhas[k]);
  const porImovel={};L.forEach(l=>{if(l.propertyId)(porImovel[l.propertyId]||(porImovel[l.propertyId]=[])).push(l)});
  /* as obras dos 24 meses, de qualquer ano: o que aqui entra fica marcado —
     por imóvel, porque um movimento de grupo pode ser obra num imóvel vago e
     gasto corrente noutro — para não voltar a entrar nas colunas normais, nem
     sequer quando a linha do contrato a que pertence não é deste ano */
  const consumidos={};
  (db.transactions||[]).forEach(t=>{
    if(t.kind!=='expense')return;
    const r=irsColunaDe(t);if(r.col==='nao')return;
    const alvo=fiscoObra24De(t,r.col),pids=Object.keys(alvo);
    if(!pids.length)return;
    consumidos[t.id]=alvo;
    const d=String(t.date||'');
    pids.forEach(pid=>{
      const p=props[pid];if(!p)return;
      const ls=alvo[pid].map(c=>linhas[c.id]).filter(l=>l&&String(l.inicio).startsWith(A));
      if(!ls.length)return;
      const w=txWeight(t,pid,false);if(!(w>0))return;
      fiscoReparte(ls,(Number(t.amount)||0)*w*quotaDe(p),(l,parte)=>{
        l.obras24.valor+=parte;
        if(!l.obras24.inicioGastos||d<l.obras24.inicioGastos)l.obras24.inicioGastos=d;
      });
    });
  });
  /* os gastos do ano, por coluna, repartidos pelas linhas de cada imóvel; uma
     despesa marcada à mão como obras24 sem contrato a começar depois não tem
     linha onde caia — conta-se, para o aviso dizer que ficou de fora */
  let semRegra=0,obrasSoltas=0;
  (db.transactions||[]).forEach(t=>{
    if(t.kind!=='expense'||!noAno(t))return;
    const r=irsColunaDe(t);if(r.col==='nao')return;
    const jaFoi=consumidos[t.id]||{};
    let entrou=false;
    Object.keys(porImovel).forEach(pid=>{
      if(jaFoi[pid])return;
      const w=txWeight(t,pid,false);if(!(w>0))return;
      entrou=true;
      if(r.col!=='obras24')fiscoReparte(porImovel[pid],(Number(t.amount)||0)*w*quotaDe(props[pid]),(l,parte)=>{l.gastos[r.col]+=parte});
    });
    if(!entrou)return;
    if(r.col==='obras24')obrasSoltas++;
    else if(r.origem==='omissao')semRegra++;
  });
  /* arredondar ao cêntimo no fim, para os totais baterem com as linhas */
  const totais={rendas:0,retencoes:0,gastos:{},obras24:0};fiscoCols.forEach(k=>{totais.gastos[k]=0});
  L.forEach(l=>{
    l.rendas=r2(l.rendas);l.retencoes=r2(l.retencoes);l.obras24.valor=r2(l.obras24.valor);
    fiscoCols.forEach(k=>{l.gastos[k]=r2(l.gastos[k]);totais.gastos[k]+=l.gastos[k]});
    totais.rendas+=l.rendas;totais.retencoes+=l.retencoes;totais.obras24+=l.obras24.valor;
  });
  totais.rendas=r2(totais.rendas);totais.retencoes=r2(totais.retencoes);totais.obras24=r2(totais.obras24);
  fiscoCols.forEach(k=>{totais.gastos[k]=r2(totais.gastos[k])});
  const pt=(a,b)=>String(a).localeCompare(String(b),'pt');
  L.sort((a,b)=>pt(a.imovel,b.imovel)||pt(a.inicio,b.inicio)||pt(a.nome,b.nome));
  const F=Object.keys(fora).map(k=>fora[k]).map(f=>Object.assign(f,{rendas:r2(f.rendas)})).sort((a,b)=>pt(a.nome,b.nome));
  const S=Object.keys(semC).map(k=>semC[k]).map(s=>Object.assign(s,{rendas:r2(s.rendas)})).sort((a,b)=>pt(a.imovel,b.imovel));
  return {ano:ano,titularId:titularId,imoveis:base.length,linhas:L,fora:F,semContrato:S,totais:totais,
    avisos:fiscoAvisos(ano,L,F,S,semRegra,obrasSoltas),semRegra:semRegra,obrasSoltas:obrasSoltas};
}
/* O que há a tratar antes de preencher o quadro: contratos por indicar,
   declarados sem número, inquilinos sem NIF, imóveis sem os dados matriciais,
   rendas sem recibo ou sem contrato, despesas sem regra — cada um com o toque
   que leva ao sítio certo. Os contratos não declarados são o último, sem
   toque e sem pedido: não são uma falta, são uma escolha, e diz-se só que
   ficam fora.
   Recebe: ano — o ano; L — as linhas do resumo; F — os contratos fora; S — as
   rendas sem contrato; semRegra — n.º de despesas sem regra de dedução;
   obrasSoltas — n.º de despesas marcadas como obras24 sem contrato a seguir.
   Devolve: [{texto, abrir, toca}] — abrir é o código do onclick ('' sem ação);
   toca a família do ponto ('camada' abre uma ficha, 'ecra' muda de ecrã). */
function fiscoAvisos(ano,L,F,S,semRegra,obrasSoltas){
  const out=[],add=(texto,abrir,toca)=>out.push({texto:texto,abrir:abrir||'',toca:toca||''});
  const umCt=ls=>ls.length===1?[`ctView('${jsq(ls[0].contratoId)}')`,'camada']:["go('contracts')",'ecra'];
  const porIndicar=L.filter(l=>!l.estado);
  if(porIndicar.length)add(porIndicar.length===1?'Contrato '+porIndicar[0].nome+': por indicar se foi declarado à AT'
    :porIndicar.length+' contratos com rendas em '+ano+' por indicar se foram declarados à AT',...umCt(porIndicar));
  const semNum=L.filter(l=>l.estado==='declarado'&&!l.atNumero);
  if(semNum.length)add(semNum.length===1?'Contrato '+semNum[0].nome+': declarado à AT, sem o n.º do contrato'
    :semNum.length+' contratos declarados à AT sem o n.º do contrato',...umCt(semNum));
  const vistos={};
  L.forEach(l=>l.inquilinos.forEach(t=>{
    if(vistos[t.id])return;vistos[t.id]=1;
    const v=nifValido(t.nif);
    if(v===false)add('Inquilino '+t.nome+': o NIF não bate certo',`personView('tenant','${jsq(t.id)}')`,'camada');
    else if(v===null&&!String(t.pais||'').trim())add('Inquilino '+t.nome+': sem NIF nem país de residência',`personView('tenant','${jsq(t.id)}')`,'camada');
  }));
  const imv={};
  L.forEach(l=>{
    if(!l.propertyId||imv[l.propertyId])return;imv[l.propertyId]=1;
    const falta=[!l.freguesiaCodigo?'código da freguesia':'',!l.tipoPredio?'tipo de prédio':'',!l.artigo?'artigo matricial':''].filter(Boolean);
    if(falta.length)add('Imóvel '+l.imovel+': sem '+listaE(falta),`propView('${jsq(l.propertyId)}')`,'camada');
  });
  const comRecibos=L.filter(l=>l.recibosPorEmitir>0),nRec=sum(comRecibos.map(l=>l.recibosPorEmitir));
  if(nRec)add(fiscoN(nRec,'renda','rendas')+' de '+ano+' sem recibo eletrónico emitido',
    ...(comRecibos.length===1?umCt(comRecibos):["go('transactions')",'ecra']));
  const nSem=sum(S.map(s=>s.n));
  if(nSem)add(fiscoN(nSem,'renda','rendas')+' de '+ano+' sem contrato ligado '+(nSem===1?'fica':'ficam')+' fora do quadro',
    nSem===1?`txView('${jsq(S[0].ids[0])}')`:"go('transactions')",nSem===1?'camada':'ecra');
  if(semRegra)add(fiscoN(semRegra,'despesa sem regra de dedução conta','despesas sem regra de dedução contam')+' em Outros: define-a nas Definições → IRS e dedução',
    "go('settings');goSet('irs')",'ecra');
  if(obrasSoltas)add(fiscoN(obrasSoltas,'despesa marcada como obras dos 24 meses','despesas marcadas como obras dos 24 meses')+' de '+ano+' sem contrato a começar depois: '+(obrasSoltas===1?'fica':'ficam')+' fora até o haver',
    "go('transactions')",'ecra');
  if(F.length)add(fiscoN(F.length,'contrato marcado como não declarado fica','contratos marcados como não declarados ficam')+' fora deste resumo.','','');
  return out;
}

/* A vista do separador Declaração: o painel com o titular e o ano, e para o ano
   escolhido as obrigações, o quadro 4.1, as obras dos 24 meses, o que ficou
   fora por escolha e as rendas sem contrato. Sem imóveis, ou sem rendas no
   ano, diz-o e aponta a saída.
   Devolve: o HTML da vista (string). */
function vFisco(){
  const ano=fiscoAnoAtual(),auto=!fiscoAno,grupo=ownerIsGrp(),titular=grupo?'':ownerFilter;
  const anos=yearsWithData(null);if(anos.indexOf(ano)<0)anos.push(ano);anos.sort((a,b)=>a-b);
  const panel=anaPanel(`<div style="display:flex;flex-direction:column;gap:9px">
    ${db.owners.length?`<div style="width:100%">${sel('ownerSel',titular,[{v:'',label:'Todos os proprietários'}].concat(db.owners.map(o=>({v:o.id,label:o.name}))),'onOwnerFilter','vista')}</div>`:''}
    <div style="width:100%">${sel('fiscoSel',String(ano),anos.map(y=>({v:String(y),label:String(y)})),'onFiscoAno','vista')}</div></div>
    <div class="hint" style="margin-top:9px">O Anexo F é por titular: com um escolhido, rendas e gastos entram na quota-parte dele.${grupo?' Um grupo de proprietários não se aplica aqui — os valores vão por inteiro.':''}${auto&&ano===YEAR-1?' Até junho mostra-se o ano anterior, que é o que se está a declarar.':''}</div>`);
  const r=resumoFiscal(ano,titular);
  if(!r.imoveis)return panel+(esperaDoServidor()||`<div class="empty"><b>Sem imóveis</b>O Anexo F parte das rendas de cada imóvel.
    ${saida('Adicionar imóvel',"go('properties')",'ecra')}</div>`);
  if(!r.linhas.length&&!r.fora.length&&!r.semContrato.length){
    const outros=anos.filter(y=>y!==ano&&(db.transactions||[]).some(t=>ehRenda(t)&&String(t.date||'').startsWith(String(y))));
    return panel+`<div class="empty"><b>Sem rendas em ${ano}</b>${outros.length?'Há rendas em '+esc(outros.join(', '))+'. ':''}Uma renda entra aqui quando o movimento é da categoria Rendas e está ligado ao contrato.
      ${saida('Escolher outro ano','hdrFiltToggle()','vista')}</div>`;
  }
  return panel+`<div class="toolbar">
    <button class="btn" data-toca="nada" onclick="fiscoPartilhar()">Partilhar</button>
    <button class="btn" data-toca="nada" onclick="fiscoCsv()">CSV</button></div>`
    +fiscoKpis(r)+fiscoObrigacoesCard(r)+fiscoQuadroCard(r)+fiscoObrasCard(r)+fiscoForaCard(r)+fiscoSemContratoCard(r);
}
/* Os quatro números do ano à cabeça, em cartões com explicação ao toque:
   rendas ilíquidas, retenções, gastos dedutíveis e obras dos 24 meses — os
   totais do quadro, antes de o ler linha a linha.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML da grelha (string). */
function fiscoKpis(r){
  const g=sum(fiscoCols.map(k=>r.totais.gastos[k]));
  return `<div class="grid" style="margin-bottom:14px">
    ${kpi('Rendas ilíquidas',euro(r.totais.rendas),'',fiscoN(r.linhas.length,'contrato','contratos')+' em '+r.ano,'O que entrou como renda mais o que o inquilino reteve na fonte. É o valor que vai ao quadro 4.1; cauções e empréstimos recebidos ficam de fora.')}
    ${kpi('Retenções na fonte',euro(r.totais.retencoes),'','entregues à AT pelo inquilino','O IRS que um inquilino com contabilidade organizada reteve e entregou por ti. Abate ao imposto a pagar; a renda declara-se pelo valor ilíquido.')}
    ${kpi('Gastos dedutíveis',euro(g),'','conservação, condomínio, IMI, selo, taxas e outros','A soma das seis colunas de gastos do quadro 4.1, pela regra de cada categoria (Definições → IRS e dedução). Ficam fora os juros, o mobiliário e as obras que acrescentam valor.')}
    ${kpi('Obras dos 24 meses',euro(r.totais.obras24),'',r.totais.obras24?'antes do arrendamento':'nenhuma em '+r.ano,'Conservação paga nos 24 meses antes de um contrato começar, com o imóvel sem contrato em vigor. Entra na linha desse contrato, à parte das outras colunas.')}</div>`;
}
/* O cartão «Obrigações de <ano>»: os avisos do resumo, cada um a abrir o sítio
   onde se trata; o dos não declarados fica liso, que não há nada a tratar.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string). */
function fiscoObrigacoesCard(r){
  const row=a=>a.abrir?`<div class="card tap" style="padding:11px 13px" data-toca="${esc(a.toca||'camada')}" onclick="${a.abrir}"><b style="font-weight:600">${esc(a.texto)}</b></div>`
    :`<div class="card" style="padding:11px 13px"><span class="small">${esc(a.texto)}</span></div>`;
  const corpo=r.avisos.length?`<div class="list" style="gap:8px">${r.avisos.map(row).join('')}</div>`
    :`<div class="hint">Com o que a app sabe, não falta nada para preencher o quadro 4.1 de ${r.ano}.</div>`;
  return card('Obrigações de '+r.ano,r.avisos.length?fiscoN(r.avisos.length,'ponto a tratar','pontos a tratar'):'Nada em falta',
    corpo+`<div class="hint" style="margin-top:9px">A app resume, não declara: o que falta fica escrito aqui e ao pé de cada linha. Os prazos com data — Modelo 2, recibos, entrega do Anexo F — estão nos Prazos da visão geral.</div>`);
}
/* O cartão do quadro 4.1: uma tabela com uma linha por contrato e a linha dos
   totais, e o hint que diz o que é estimativa.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string). */
function fiscoQuadroCard(r){
  const G=r.totais.gastos;
  const cab=`<thead><tr><th>Contrato</th><th style="text-align:left">Início</th><th style="text-align:left">Imóvel</th><th style="text-align:left">Inquilinos</th><th style="text-align:left">Nat.</th><th>Rendas ilíquidas</th><th>Retenções</th>${fiscoCols.map(k=>`<th>${esc(fiscoColRotulo(k))}</th>`).join('')}</tr></thead>`;
  const tot=`<tr><td colspan="5"><b>Total</b></td><td><b>${euro2(r.totais.rendas)}</b></td><td><b>${euro2(r.totais.retencoes)}</b></td>${fiscoCols.map(k=>`<td><b>${euro2(G[k])}</b></td>`).join('')}</tr>`;
  return card('Anexo F · quadro 4.1','Rendimentos prediais de '+r.ano+(r.titularId?' · quota-parte de '+esc(ownerFilterName()):' · valores por inteiro'),
    `<div class="tablewrap"><table class="table">${cab}<tbody>${r.linhas.map(fiscoLinhaHtml).join('')}${tot}</tbody></table></div>
    <div class="hint" style="margin-top:9px">Rendas ilíquidas: o que entrou mais o que o inquilino reteve na fonte. Os gastos de um imóvel com mais do que um contrato no ano repartem-se pelas linhas na proporção das rendas de cada uma — é uma estimativa; o rateio por VPT ou por área, quando o imóvel se arrenda por partes, fica para quem preenche.${r.semRegra?' '+fiscoN(r.semRegra,'despesa sem regra de dedução conta','despesas sem regra de dedução contam')+' em Outros.':''}</div>`);
}
/* Uma linha da tabela do quadro 4.1: o n.º na AT (ou «—») e o nome, o início,
   o imóvel com os dados matriciais, os inquilinos com NIF ou país, a natureza,
   as rendas, as retenções e as seis colunas de gastos; as faltas em small por
   baixo do contrato. Tocar abre a ficha do contrato.
   Recebe: l — a linha do resumo.
   Devolve: o HTML do <tr> (string). */
function fiscoLinhaHtml(l){
  const inq=l.inquilinos.length?l.inquilinos.map(t=>`${esc(t.nome)}<span class="small"> · ${t.nif?esc(fmtNIF(t.nif)):(t.pais?esc(t.pais):'sem NIF')}</span>`).join('<br>'):'<span class="small">—</span>';
  const im=[l.freguesiaCodigo||'—',l.tipoPredio||'—',l.artigo?'art. '+l.artigo:'—',l.fracao?'fr. '+l.fracao:''].filter(Boolean).map(esc).join(' · ');
  const v=x=>x?euro2(x):'—';
  return `<tr data-toca="camada" style="cursor:pointer" onclick="ctView('${jsq(l.contratoId)}')">
    <td style="white-space:normal;min-width:170px"><b>${l.atNumero?esc(l.atNumero):'—'}</b><div class="small">${esc(l.nome)}${!l.estado?' · por indicar':''}</div>${l.faltas.length?`<div class="small">Falta: ${esc(l.faltas.join(', '))}.</div>`:''}</td>
    <td style="text-align:left">${dPT(l.inicio)||'—'}${l.taxaReduzida?'<div class="small">taxa reduzida</div>':''}</td>
    <td style="text-align:left">${esc(l.imovel)}<div class="small">${im}</div></td>
    <td style="text-align:left;white-space:normal;min-width:150px">${inq}</td>
    <td style="text-align:left">${esc(l.natureza)}</td>
    <td>${euro2(l.rendas)}</td><td>${v(l.retencoes)}</td>
    ${fiscoCols.map(k=>`<td>${v(l.gastos[k])}</td>`).join('')}</tr>`;
}
/* O cartão das obras dos 24 meses anteriores ao arrendamento — só quando as há.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem obras. */
function fiscoObrasCard(r){
  const ls=r.linhas.filter(l=>l.obras24.valor>0);if(!ls.length)return '';
  return card('Obras antes do arrendamento','Gastos dos 24 meses anteriores ao início, nos contratos que começaram em '+r.ano,
    ls.map(l=>`<div class="stat"><span>${esc(l.nome)}<div class="small">${esc(l.imovel)} · desde ${dPT(l.obras24.inicioGastos)}</div></span><b>${euro2(l.obras24.valor)}</b></div>`).join('')
    +`<div class="stat"><span><b>Total</b></span><b>${euro2(r.totais.obras24)}</b></div>
    <div class="hint" style="margin-top:9px">Conservação e manutenção pagas antes de o contrato começar, nos 24 meses anteriores, quando o imóvel não tinha contrato em vigor — e o que marcaste à mão como obras dos 24 meses. Entram à parte das outras colunas e não se repetem noutro ano.</div>`);
}
/* O cartão «Fora da declaração»: os contratos marcados como não declarados com
   rendas no ano, com o valor, sem juízo. Tocar abre o contrato.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem contratos fora. */
function fiscoForaCard(r){
  if(!r.fora.length)return '';
  return card('Fora da declaração',fiscoN(r.fora.length,'contrato marcado como não declarado','contratos marcados como não declarados'),
    `<div class="list" style="gap:8px">${r.fora.map(f=>`<div class="card tap" style="padding:11px 13px" data-toca="camada" onclick="ctView('${jsq(f.contratoId)}')">
      <div class="row-between" style="align-items:center;gap:10px"><div style="min-width:0"><b>${esc(f.nome)}</b><div class="small">${esc(f.imovel)}${f.imovel?' · ':''}${fiscoN(f.n,'renda','rendas')} em ${r.ano}</div></div><b>${euro2(f.rendas)}</b></div></div>`).join('')}</div>
    <div class="hint" style="margin-top:9px">As rendas destes contratos não entram no quadro nem nos totais. O estado muda-se na ficha do contrato.</div>`);
}
/* O cartão «Rendas sem contrato»: as rendas do ano que não dizem de que
   contrato são, por imóvel, com a saída para as ligar.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem rendas soltas. */
function fiscoSemContratoCard(r){
  if(!r.semContrato.length)return '';
  const n=sum(r.semContrato.map(s=>s.n));
  return card('Rendas sem contrato',fiscoN(n,'renda','rendas')+' de '+r.ano+' sem contrato ligado',
    r.semContrato.map(s=>`<div class="stat"><span>${esc(s.imovel)}<div class="small">${fiscoN(s.n,'movimento','movimentos')}</div></span><b>${euro2(s.rendas)}</b></div>`).join('')
    +`<div class="hint" style="margin-top:9px">Uma renda só entra numa linha do quadro quando o movimento diz de que contrato é. Abre o movimento e liga-o ao contrato.</div>`
    +(n===1?saida('Abrir o movimento',`txView('${jsq(r.semContrato[0].ids[0])}')`,'camada'):saida('Ver movimentos',"go('transactions')",'ecra')));
}
/* O resumo em texto simples, para partilhar ou copiar: totais, uma entrada por
   contrato com a identificação, os valores e as faltas, e depois o que ficou
   fora, as rendas sem contrato e o que há a tratar. Os mesmos números da página.
   Devolve: o texto (string, várias linhas). */
function fiscoTexto(){
  const ano=fiscoAnoAtual(),r=resumoFiscal(ano,ownerIsGrp()?'':ownerFilter);
  const gastos=g=>fiscoCols.map(k=>fiscoColRotulo(k)+' '+euro2(g[k])).join(' · ');
  return `ANEXO F · QUADRO 4.1 — ${ano}${r.titularId?' · '+ownerFilterName()+' (quota-parte)':''}

Rendas ilíquidas ${euro2(r.totais.rendas)} · retenções ${euro2(r.totais.retencoes)}
${gastos(r.totais.gastos)}${r.totais.obras24?'\nObras antes do arrendamento '+euro2(r.totais.obras24):''}

POR CONTRATO
${r.linhas.map(l=>`  ${l.atNumero?'n.º '+l.atNumero:'sem n.º na AT'} · ${l.nome} — ${l.imovel||'sem imóvel'}${l.quota<1?' · quota-parte '+pct(l.quota,0):''}
    Início ${dPT(l.inicio)||'—'} · freguesia ${l.freguesiaCodigo||'—'} · ${l.tipoPredio||'—'} · artigo ${l.artigo||'—'}${l.fracao?' · fração '+l.fracao:''} · natureza ${l.natureza}
    Inquilinos: ${l.inquilinos.length?l.inquilinos.map(t=>t.nome+' ('+(t.nif||t.pais||'sem NIF')+')').join(', '):'—'}
    Rendas ilíquidas ${euro2(l.rendas)} · retenções ${euro2(l.retencoes)}
    ${gastos(l.gastos)}${l.obras24.valor?'\n    Obras antes do arrendamento '+euro2(l.obras24.valor)+' (desde '+dPT(l.obras24.inicioGastos)+')':''}${l.faltas.length?'\n    Falta: '+l.faltas.join(', ')+'.':''}`).join('\n')}
${r.fora.length?'\nFORA DA DECLARAÇÃO\n'+r.fora.map(f=>`  ${f.nome}${f.imovel?' — '+f.imovel:''}: ${euro2(f.rendas)}`).join('\n')+'\n':''}${r.semContrato.length?'\nRENDAS SEM CONTRATO\n'+r.semContrato.map(s=>`  ${s.imovel}: ${euro2(s.rendas)} (${fiscoN(s.n,'movimento','movimentos')})`).join('\n')+'\n':''}${r.avisos.length?'\nA TRATAR\n'+r.avisos.map(a=>'  · '+a.texto).join('\n')+'\n':''}
Resumo feito pela app com o que tem registado. Os gastos de um imóvel com mais do que um contrato repartem-se pelas rendas; o rateio por VPT ou área fica para quem preenche.
`;
}
/* Partilha o resumo do Anexo F: folha de partilha do Android, Web Share API,
   ou cópia para a área de transferência — a mesma ordem da Avaliação.
   Devolve: nada de útil — só o efeito de partilhar (ou copiar) o texto. */
function fiscoPartilhar(){
  const txt=fiscoTexto(),titulo='Anexo F · '+fiscoAnoAtual();
  if(window.Android&&window.Android.shareText)return window.Android.shareText(titulo,txt);
  if(navigator.share)return navigator.share({title:titulo,text:txt}).catch(()=>{});
  if(navigator.clipboard)return navigator.clipboard.writeText(txt).then(()=>toast('Resumo copiado.'));
  toast('Não foi possível partilhar.');
}
/* Exporta o quadro 4.1 do ano para CSV (ponto e vírgula, campos entre aspas,
   para abrir no Excel): um cabeçalho, uma linha por contrato, e as dos
   contratos não declarados com «nao» na coluna declarado — só com nome,
   imóvel, quota e rendas, porque é só isso que se sabe deles aqui.
   Devolve: nada — dispara a descarga do CSV. */
function fiscoCsv(){
  const ano=fiscoAnoAtual(),r=resumoFiscal(ano,ownerIsGrp()?'':ownerFilter);
  const n=v=>String(r2(Number(v)||0));
  const rows=[['ano','declarado','contrato','n_at','inicio','imovel','freguesia','tipo_predio','artigo','fracao','natureza','inquilinos','nif_ou_pais','quota_pct','rendas_iliquidas','retencoes']
    .concat(fiscoCols).concat(['obras24','obras24_desde','recibos_por_emitir','faltas'])];
  r.linhas.forEach(l=>rows.push([ano,l.estado==='declarado'?'sim':'por indicar',l.nome,l.atNumero,l.inicio,l.imovel,l.freguesiaCodigo,l.tipoPredio,l.artigo,l.fracao,l.natureza,
    l.inquilinos.map(t=>t.nome).join(' / '),l.inquilinos.map(t=>t.nif||t.pais||'').join(' / '),n(l.quota*100),n(l.rendas),n(l.retencoes)]
    .concat(fiscoCols.map(k=>n(l.gastos[k]))).concat([n(l.obras24.valor),l.obras24.inicioGastos,l.recibosPorEmitir,l.faltas.join('; ')])));
  r.fora.forEach(f=>{const c=contract(f.contratoId);
    rows.push([ano,'nao',f.nome,'',c?c.start||'':'',f.imovel,'','','','','',c?ctNames(c):'','',n(f.quota*100),n(f.rendas),'0']
      .concat(fiscoCols.map(()=>'0')).concat(['0','','','']))});
  download('anexo-f-'+ano+'.csv','text/csv;charset=utf-8',rows.map(row=>row.map(x=>'"'+String(x==null?'':x).split('"').join('""')+'"').join(';')).join('\n'));
  toast('CSV exportado.');
}
/* aplica o ano escolhido no seletor e volta a desenhar
   Devolve: nada — guarda o ano e redesenha a vista. */
function onFiscoAno(){fiscoAno=val('fiscoSel')||'';render()}
