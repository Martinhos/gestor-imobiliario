/* ================= FISCO ================= */
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
   contam no ano em que o imóvel deu rendas (CIRS art. 41.º n.º 5). Com um
   titular escolhido tudo entra pela quota-parte dele — o Anexo F é por
   titular, e um imóvel a meias tem duas declarações (CIRS art. 19.º).

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

/* o ano escolhido no seletor; vazio é «automático» (fiscoAnoAtual) */
let fiscoAno='';
/* as colunas de gastos que contam no ano em que o imóvel deu rendas, e não só
   no período arrendado (CIRS art. 41.º n.º 5) */
const FISCO_SEM_PERIODO={imi:1,selo:1};

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
/* As escolhas do senhorio para o IRS (db.settings.irs), sempre completas — um
   settings antigo, ou um que ainda não passou pelo fillCats, não as tem. Só
   lê: quem grava é o fiscoGravarIrs.
   Devolve: {conjunta, titulares, dispensaRecibos, outrosRendimentos} (objeto novo). */
function fiscoIrsDefs(){return normIrsDefs(db.settings&&db.settings.irs)}
/* A letra de um proprietário nas colunas «Titular» do Anexo F: em tributação
   conjunta a que ele escolheu (A, por omissão), sem conjunta sempre A — cada
   um entrega o seu Anexo F.
   Recebe: oid — o id do proprietário; defs (opcional) — o fiscoIrsDefs() já lido.
   Devolve: 'A' ou 'B'. */
function fiscoLetra(oid,defs){
  const d=defs||fiscoIrsDefs();
  return d.conjunta&&d.titulares[oid]==='B'?'B':'A';
}
/* O titular de uma linha: com um proprietário escolhido, a letra dele; sem
   ninguém escolhido (valores por inteiro), as letras dos donos do imóvel com
   quota — «A/B» num imóvel dos dois cônjuges em conjunta, que no Anexo F vai
   em duas linhas, uma por titular, cada uma com a sua quota (CIRS art. 19.º;
   INCERTO nas instruções — escolhe o titular no painel para ver a parte de cada um).
   Recebe: p — o imóvel (pode faltar); titularId — o id do proprietário escolhido, ou vazio.
   Devolve: 'A', 'B' ou 'A/B'. */
function fiscoTitularDe(p,titularId){
  const d=fiscoIrsDefs();
  if(titularId)return fiscoLetra(titularId,d);
  if(!p||!d.conjunta)return 'A';
  const s=sharesOf(p),ls={};
  Object.keys(s).forEach(o=>{if(s[o]>0)ls[fiscoLetra(o,d)]=1});
  const out=Object.keys(ls).sort();
  return out.length?out.join('/'):'A';
}
/* O contrato anterior sobre o mesmo imóvel — o que o quadro 4.2B pede ao lado
   do novo (o número e a renda): o que começou mais tarde antes deste.
   Recebe: c — o contrato novo.
   Devolve: o contrato anterior, ou null. */
function fiscoContratoAnterior(c){
  if(!c||!c.propertyId||!c.start)return null;
  return (db.contracts||[]).filter(x=>x.id!==c.id&&x.propertyId===c.propertyId&&x.start&&x.start<c.start)
    .sort((a,b)=>a.start<b.start?1:a.start>b.start?-1:0)[0]||null;
}
/* A data-limite do Modelo 44 — a declaração anual das rendas de quem está
   dispensado do recibo eletrónico: o fim de fevereiro do ano seguinte desde as
   rendas de 2025 (DL 49/2025); até às de 2024, o fim de janeiro. Em hora
   local, sem toISOString.
   Recebe: ano — o ano das rendas (número).
   Devolve: 'AAAA-MM-DD'. */
function fiscoPrazoModelo44(ano){
  const a=Number(ano)+1,d=new Date(a,ano>=2025?2:1,0);
  return a+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
/* O AIMI do ano para o quadro 9: as despesas «Impostos › AIMI» pagas no ano
   (fora dos gastos — CIRS art. 41.º n.º 1), pelo peso de cada imóvel e pela
   quota do titular; uma sem imóvel conta inteira sem titular, ou quando foi
   ele quem a pagou. A parte que abate à coleta (CIMI art. 135.º-I; CIRS art.
   78.º n.º 1 l)) é a do VPT dos prédios que deram rendas no ano sobre o VPT de
   todos os prédios urbanos sujeitos ao AIMI (o 9102), e nunca mais do que a
   coleta das rendas — sem englobamento, a estimativa à taxa de cada contrato.
   INCERTO: o art. 135.º-I remete para a coleta à taxa de 28 %; a leitura
   prudente fica pela estimativa da página, que é igual ou mais baixa. O 9102
   conta só os prédios urbanos que a app tem; sem o VPT de um deles, a parte
   não se calcula e diz-se qual falta.
   Recebe: ano — o ano; titularId — o titular, ou vazio; props — os imóveis do
   âmbito {id: imóvel}; quotaDe — a quota de um imóvel; L — as linhas;
   imposto — a coleta estimada das rendas (euros).
   Devolve: {total, n, predios:[{propertyId, imovel, quadro, vpt}],
   vptArrendados, vptTotal, semVpt:[nome], parte, abate} — parte e abate null
   quando falta um VPT — ou null sem AIMI no ano. */
function fiscoAimi(ano,titularId,props,quotaDe,L,imposto){
  const A=String(ano);let total=0,n=0;
  (db.transactions||[]).forEach(t=>{
    if(t.kind!=='expense'||!String(t.date||'').startsWith(A)||!countsInTotals(t))return;
    if(String(t.category||'').trim()!=='Impostos'||String(t.sub||'').trim()!=='AIMI')return;
    const ps=txProps(t),amt=Number(t.amount)||0;let v=0;
    if(ps.length)ps.forEach(p=>{if(!props[p.id])return;const w=txWeight(t,p.id,false);if(w>0)v+=amt*w*quotaDe(p)});
    else if(!titularId||t.paidBy===titularId)v=amt;
    if(v>0){total+=v;n++}
  });
  if(!n)return null;
  const vptDe=p=>(Number(p.vpt)||0)*quotaDe(p),vistos={},predios=[];
  L.forEach(l=>{const p=props[l.propertyId];if(!p||vistos[p.id])return;vistos[p.id]=1;
    predios.push({propertyId:p.id,imovel:p.name,quadro:l.quadro,vpt:r2(vptDe(p))})});
  const urbanos=Object.keys(props).map(k=>props[k]).filter(p=>p.tipoPredio!=='R');
  const semVpt=urbanos.filter(p=>!(Number(p.vpt)>0)).map(p=>p.name);
  const vptArr=sum(predios.map(x=>x.vpt)),vptTot=sum(urbanos.map(vptDe));
  const parte=semVpt.length||!(vptTot>0)?null:r2(total*Math.min(1,vptArr/vptTot));
  return {total:r2(total),n:n,predios:predios,vptArrendados:r2(vptArr),vptTotal:r2(vptTot),semVpt:semVpt,
    parte:parte,abate:parte==null?null:r2(Math.min(parte,Math.max(0,imposto)))};
}
/* A data 24 meses antes de outra, em texto — o limite das obras que o artigo
   41.º n.º 7 do CIRS deixa deduzir antes de o arrendamento começar. Só se
   compara, por isso vale a aritmética no ano e nunca um Date (nem toISOString).
   Recebe: iso — a data 'AAAA-MM-DD'.
   Devolve: 'AAAA-MM-DD' dois anos antes, ou '' sem data. */
function fiscoMenos24(iso){
  const m=/^(\d{4})(-\d{2}-\d{2})$/.exec(String(iso||''));
  return m?String(Number(m[1])-2)+m[2]:'';
}
/* Havia algum contrato do imóvel em vigor nesta data? É o que separa uma obra
   feita entre arrendamentos (dedutível nos 24 meses antes do seguinte) de uma
   reparação durante um, e um gasto do período arrendado de um gasto com o
   imóvel vazio. Conta qualquer contrato, declarado ou não. Com data de fim,
   vale a data; sem ela, vale o estado — um contrato sem fim e inativo não diz
   quando acabou, e não se adivinha.
   Recebe: pid — o id do imóvel; d — a data 'AAAA-MM-DD'.
   Devolve: true se havia. */
function fiscoHaviaContrato(pid,d){
  return (db.contracts||[]).some(c=>c.propertyId===pid&&c.start&&c.start<=d&&(c.end?c.end>=d:c.active!==false));
}
/* Os contratos para que um gasto conta como «obras antes do arrendamento»
   (CIRS art. 41.º n.º 7): por imóvel que o gasto toca, os contratos que começam
   DEPOIS da data e até 24 meses depois, quando o gasto está marcado à mão como
   obras24 ou é conservação numa altura em que o imóvel não tinha contrato em
   vigor. Entre vários, só os que começam mais cedo: a obra precede UM
   arrendamento, e um gasto contado em dois anos seria contado duas vezes (dois
   quartos a começar no mesmo dia repartem-na).
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
   contrato no ano. As rendas do imóvel que não têm linha (contratos não
   declarados, rendas sem contrato) pesam na divisão e a parte delas não vai a
   linha nenhuma: sem isto os gastos do imóvel inteiro caíam na linha do único
   contrato declarado. Sem rendas em lado nenhum (só rendas a zero), em partes
   iguais pelas linhas, para nunca dividir por zero.
   Recebe: ls — as linhas do imóvel; valor — o que repartir (euros); fn — chamada
   com (linha, parte) por cada linha; resto (opcional) — as rendas do imóvel fora das linhas.
   Devolve: nada — entrega a parte de cada linha a fn. */
function fiscoReparte(ls,valor,fn,resto){
  const tot=sum(ls.map(l=>l.rendas))+(Number(resto)||0);
  ls.forEach(l=>fn(l,valor*(tot>0?l.rendas/tot:1/ls.length)));
}
/* Uma linha do Anexo F ainda sem valores: a identificação do contrato, do
   imóvel e dos inquilinos, o quadro onde vai (o 4.2 quando há redução pela
   duração, o 4.1 nos outros), a taxa e a natureza do ano, as datas do 4.2A e
   as faltas que se veem sem olhar às rendas — o que a AT pergunta e a app não
   tem. Um NIF que não bate certo é uma falta como as outras: vai para o Anexo
   F tal e qual, e volta recusado.
   E o que os subquadros pedem: o titular (fiscoTitularDe), a isenção do
   contrato (irs.js:irsIsencao, pela taxa — um isento fica no 4.1 com taxa 0 e
   vai ao 6D), a data da comunicação de fevereiro (irs.js:irsComunicado; ''
   por fazer), a descida do n.º 24 (4.2B, com a renda e o contrato
   anteriores) e a data de celebração, que diz se o 4.2C se aplica — nos
   campos titular, isencao ({id, nome, curto, quadro, codigo} ou null),
   comunicado, bonus, renda, rendaAnterior, contratoAnterior ({id, nome,
   numero} ou null), celebracao e acimaDoLimite (true, false ou null).
   Recebe: c — o contrato; p — o imóvel (pode faltar); q — a quota-parte (0–1);
   ano — o ano dos rendimentos; titularId (opcional) — o titular escolhido.
   Devolve: a linha (objeto), com rendas, retenções e gastos a zero. */
function fiscoLinhaNova(c,p,q,ano,titularId){
  const f=fiscoDe(c),ts=ctTenants(c),faltas=[],v=irsAno(ano),tx=irsTaxa(c,ano);
  const is=tx.motivo==='isento'?(tx.isencao||{}):null,ant=fiscoContratoAnterior(c);
  if(ctFiscoPorIndicar(c))faltas.push('contrato por indicar se está declarado');
  if(ctDeclarado(c)&&!f.numero)faltas.push('n.º do contrato na AT');
  if(!p||!p.freguesiaCodigo)faltas.push('código da freguesia');
  if(!p||!p.tipoPredio)faltas.push('tipo de prédio');
  if(!p||!p.matrix)faltas.push('artigo matricial');
  if(!ts.length)faltas.push('inquilino do contrato');
  ts.forEach(t=>{
    const ok=nifValido(t.nif);
    if(ok===false)faltas.push('NIF do inquilino '+t.name+' não bate certo');
    else if(ok===null&&!String(t.pais||'').trim())faltas.push('NIF ou país do inquilino '+t.name);
  });
  if(tx.reducao&&!f.finalidade)faltas.push('finalidade do contrato (a redução pela duração é só da habitação permanente)');
  const ps=irsPeriodos(c),ult=ps.length>1?ps[ps.length-1]:null;
  const g={};v.colunas.forEach(k=>{g[k]=0});
  return {contratoId:c.id,propertyId:p?p.id:(c.propertyId||null),nome:ctName(c),imovel:p?p.name:'',
    atNumero:f.numero,inicio:c.start||'',estado:f.estado,
    freguesiaCodigo:p?p.freguesiaCodigo:'',tipoPredio:p?p.tipoPredio:'',artigo:p?p.matrix:'',fracao:p?p.fraction:'',
    quota:q,natureza:naturezaIrs(c,ano),titular:fiscoTitularDe(p,titularId),
    quadro:tx.reducao&&!is?v.quadros.comReducao:v.quadros.semReducao,taxaReduzida:!!tx.reducao&&!is,
    taxa:is?0:taxRateOf(c,ano),taxaEscrita:!is&&Number(c.taxRate)>0,motivoTaxa:tx.motivo,
    isencao:is?{id:is.id||f.isencao,nome:is.nome||'',curto:is.curto||is.nome||'',quadro:is.quadro||'6D',codigo:is.codigo||''}:null,
    comunicado:irsComunicado(c,ano)||'',
    bonus:!!(tx.reducao&&tx.reducao.bonus),renda:Number(c.rent)||0,rendaAnterior:Number(f.rendaAnterior)||0,
    contratoAnterior:ant?{id:ant.id,nome:ctName(ant),numero:fiscoDe(ant).numero}:null,
    celebracao:f.celebracao||c.start||'',acimaDoLimite:f.rendaAcimaDoLimite===true?true:f.rendaAcimaDoLimite===false?false:null,
    /* o termo do 4.2A é o do contrato inicial: com renovações, o c.end já é o
       da última, que vai na coluna dela */
    datas:{inicio:c.start||'',fim:(ps[0]&&ps[0].fim)||c.end||'',renovacaoInicio:ult?ult.inicio:'',renovacaoFim:ult?ult.fim:''},
    inquilinos:ts.map(t=>({id:t.id,nome:t.name,nif:t.nif||'',pais:t.pais||''})),
    rendas:0,retencoes:0,gastos:g,obras24:{valor:0,inicioGastos:''},anosAnteriores:{},liquido:0,imposto:0,
    faltas:faltas,recibosPorEmitir:0};
}
/* O resumo do Anexo F de um ano — a função pura por trás da página, do texto e
   do CSV. Uma linha por contrato NÃO marcado como não declarado com rendas no
   ano; os não declarados vão para «fora», somados; as rendas sem contrato (ou
   de um contrato entretanto apagado) para «semContrato», por imóvel. Uma renda
   cujo mês (periodo) é de um ano anterior entra na linha na mesma e fica
   apontada em anosAnteriores, para o quadro 8. Os gastos do imóvel no ano
   entram pela coluna que irsColunaDe lhes dá, com o peso de
   metricas.js:txWeight (um movimento de grupo reparte-se pelos imóveis) e pela
   quota, só se foram pagos com um contrato em vigor (o IMI e o selo sempre), e
   repartem-se pelas linhas do imóvel na proporção das rendas (fiscoReparte).
   As obras dos 24 meses (fiscoObra24De) entram só na linha do contrato a que
   pertencem, no primeiro ano em que ele tem rendas, e nunca voltam a entrar
   nas colunas normais — nem neste ano nem noutro. Por linha, o rendimento
   líquido e o imposto estimado à taxa do contrato nesse ano.

   Com um titular, entram só os imóveis onde ele tem quota, e tudo pela quota.
   Sem titular vale o âmbito da vista; com um grupo de proprietários no filtro,
   o grupo é ignorado (o Anexo F é por pessoa) e os valores vão por inteiro.
   Recebe: ano — o ano (número ou texto); titularId — o id do proprietário
   (vazio ou nulo para todos, por inteiro).
   Devolve: {ano, versao, colunas, titularId, imoveis, linhas, fora,
   semContrato, totais, avisos, semRegra, obrasSoltas, foraDoPeriodo} — versao
   é irsAno(ano); linhas: [{contratoId, propertyId, nome, imovel, atNumero,
   inicio, estado, freguesiaCodigo, tipoPredio, artigo, fracao, quota,
   natureza, quadro, taxaReduzida, taxa, taxaEscrita, motivoTaxa, datas:{inicio,
   fim, renovacaoInicio, renovacaoFim}, inquilinos:[{id, nome, nif, pais}],
   rendas, retencoes, gastos:{<coluna>: euros}, obras24:{valor, inicioGastos},
   anosAnteriores:[{ano, valor}], liquido, imposto, faltas:[texto],
   recibosPorEmitir}]; fora: [{contratoId, nome, imovel, rendas, n, quota}];
   semContrato: [{propertyId, imovel, rendas, n, ids}]; totais: {rendas,
   retencoes, gastos, obras24, liquido, imposto, prejuizo, anosAnteriores};
   avisos: [{texto, abrir, toca}]; semRegra: n.º de despesas que caíram em
   «outros» por não terem regra; obrasSoltas: n.º de despesas do ano marcadas
   como obras24 sem contrato a começar depois; foraDoPeriodo: n.º de despesas
   do ano pagas sem contrato em vigor, que não entram; imoveis: quantos imóveis
   entraram; aimi: o fiscoAimi (null sem AIMI). Os campos dos subquadros em
   cada linha vêm do fiscoLinhaNova; totais.isentos {n, rendas, liquido} fica
   fora de totais.liquido e de totais.imposto. */
function resumoFiscal(ano,titularId){
  ano=Number(ano)||YEAR;titularId=titularId||'';
  const A=String(ano),v=irsAno(ano),cols=v.colunas;
  const perm=p=>pode(p.id,'tx.view')||pode(p.id,'report.view')||pode(p.id,'loan.view');
  const quotaDe=p=>p?(titularId?shareOf(p,titularId):1):(titularId?0:1);
  const base=(ownerIsGrp()?db.properties.filter(perm):pidProps(null)).filter(p=>pode(p.id,'report.view')&&quotaDe(p)>0);
  const props={};base.forEach(p=>{props[p.id]=p});
  const noAno=t=>String(t.date||'').startsWith(A);
  const linhas={},fora={},semC={},resto={};
  const sobra=(pid,valor)=>{if(pid)resto[pid]=(resto[pid]||0)+valor};
  /* as rendas do ano, cada uma para a linha do seu contrato — ou para fora, ou
     para as sem contrato; estas duas pesam na repartição dos gastos (resto) */
  (db.transactions||[]).forEach(t=>{
    if(!ehRenda(t)||!noAno(t))return;
    const c=t.contractId?contract(t.contractId):null;
    const pid=(c&&c.propertyId)||t.propertyId||'';
    const p=props[pid];
    if(pid&&!p)return;                 // fora do âmbito: de outro dono, ou sem permissão
    if(!pid&&titularId)return;         // sem imóvel não há quota de ninguém
    const q=quotaDe(p),bruta=rendaBruta(t)*q;
    if(!c){const s=semC[pid]||(semC[pid]={propertyId:pid||null,imovel:p?p.name:'Sem imóvel',rendas:0,n:0,ids:[]});
      s.rendas+=bruta;s.n++;s.ids.push(t.id);sobra(pid,bruta);return}
    if(ctNaoDeclarado(c)){const f=fora[c.id]||(fora[c.id]={contratoId:c.id,nome:ctName(c),imovel:p?p.name:'',rendas:0,n:0,quota:q});
      f.rendas+=bruta;f.n++;sobra(pid,bruta);return}
    const l=linhas[c.id]||(linhas[c.id]=fiscoLinhaNova(c,p,q,ano,titularId));
    l.rendas+=bruta;l.retencoes+=(Number(t.retencao)||0)*q;
    const y=Number(String(t.periodo||'').slice(0,4));
    if(y&&y<ano)l.anosAnteriores[y]=(l.anosAnteriores[y]||0)+bruta;
    if(!t.recibo&&ctDeclarado(c))l.recibosPorEmitir++;
  });
  const L=Object.keys(linhas).map(k=>linhas[k]);
  const porImovel={};L.forEach(l=>{if(l.propertyId)(porImovel[l.propertyId]||(porImovel[l.propertyId]=[])).push(l)});
  /* as obras dos 24 meses, de qualquer ano: o que aqui entra fica marcado —
     por imóvel, porque um movimento de grupo pode ser obra num imóvel vago e
     gasto corrente noutro — para não voltar a entrar nas colunas normais, nem
     sequer quando a linha do contrato a que pertence não é deste ano. A obra
     entra na linha do contrato no PRIMEIRO ano em que ele tem rendas — o do
     início, quase sempre, que é o que a AT pede; um contrato que começa em
     dezembro e recebe a primeira renda em janeiro não tem linha no ano do
     início, e a obra perdia-se nos dois */
  const primeiroAno={};
  (db.transactions||[]).forEach(t=>{
    if(!ehRenda(t)||!t.contractId)return;
    const y=String(t.date||'').slice(0,4);
    if(/^\d{4}$/.test(y)&&(!primeiroAno[t.contractId]||y<primeiroAno[t.contractId]))primeiroAno[t.contractId]=y;
  });
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
      const ls=alvo[pid].map(c=>linhas[c.id]).filter(l=>l&&primeiroAno[l.contratoId]===A);
      if(!ls.length)return;
      const w=txWeight(t,pid,false);if(!(w>0))return;
      fiscoReparte(ls,(Number(t.amount)||0)*w*quotaDe(p),(l,parte)=>{
        l.obras24.valor+=parte;
        if(!l.obras24.inicioGastos||d<l.obras24.inicioGastos)l.obras24.inicioGastos=d;
      });
    });
  });
  /* os gastos do ano, por coluna, repartidos pelas linhas de cada imóvel. Um
     gasto pago com o imóvel sem contrato em vigor não entra (só o período
     arrendado conta; o IMI e o selo contam no ano em que o imóvel deu rendas)
     — salvo quando a coluna foi escolhida à mão no movimento: aí a pessoa
     decidiu, e manda. Uma despesa marcada à mão como obras24 sem contrato a
     começar depois não tem linha onde caia — conta-se, para o aviso dizer
     que ficou de fora */
  let semRegra=0,obrasSoltas=0,foraDoPeriodo=0;
  (db.transactions||[]).forEach(t=>{
    if(t.kind!=='expense'||!noAno(t))return;
    const r=irsColunaDe(t);if(r.col==='nao')return;
    const jaFoi=consumidos[t.id]||{},d=String(t.date||'');
    let entrou=false,vazio=false;
    Object.keys(porImovel).forEach(pid=>{
      if(jaFoi[pid])return;
      const w=txWeight(t,pid,false);if(!(w>0))return;
      if(r.col!=='obras24'&&!FISCO_SEM_PERIODO[r.col]&&r.origem!=='movimento'&&!fiscoHaviaContrato(pid,d)){vazio=true;return}
      entrou=true;
      if(r.col!=='obras24')fiscoReparte(porImovel[pid],(Number(t.amount)||0)*w*quotaDe(props[pid]),(l,parte)=>{l.gastos[r.col]+=parte},resto[pid]);
    });
    if(vazio)foraDoPeriodo++;
    if(!entrou)return;
    if(r.col==='obras24')obrasSoltas++;
    else if(r.origem==='omissao')semRegra++;
  });
  /* arredondar ao cêntimo no fim, para os totais baterem com as linhas; o
     líquido e o imposto de cada linha saem dos valores já arredondados. As
     linhas isentas entram nas rendas, nas retenções e nos gastos (são do
     quadro 4.1), mas não no líquido nem no imposto: o delas vai a isentos,
     à parte */
  const totais={rendas:0,retencoes:0,gastos:{},obras24:0,liquido:0,imposto:0,prejuizo:0,anosAnteriores:0,isentos:{n:0,rendas:0,liquido:0}};cols.forEach(k=>{totais.gastos[k]=0});
  L.forEach(l=>{
    l.rendas=r2(l.rendas);l.retencoes=r2(l.retencoes);l.obras24.valor=r2(l.obras24.valor);
    cols.forEach(k=>{l.gastos[k]=r2(l.gastos[k]);totais.gastos[k]+=l.gastos[k]});
    l.anosAnteriores=Object.keys(l.anosAnteriores).map(Number).sort((a,b)=>a-b).map(y=>({ano:y,valor:r2(l.anosAnteriores[y])}));
    l.liquido=r2(l.rendas-sum(cols.map(k=>l.gastos[k]))-l.obras24.valor);
    l.imposto=l.isencao?0:r2(l.liquido*l.taxa/100);
    totais.rendas+=l.rendas;totais.retencoes+=l.retencoes;totais.obras24+=l.obras24.valor;
    totais.anosAnteriores+=sum(l.anosAnteriores.map(x=>x.valor));
    if(l.isencao){totais.isentos.n++;totais.isentos.rendas+=l.rendas;totais.isentos.liquido+=l.liquido}
    else{totais.liquido+=l.liquido;totais.imposto+=l.imposto}
  });
  ['rendas','retencoes','obras24','liquido','anosAnteriores'].forEach(k=>{totais[k]=r2(totais[k])});
  totais.isentos.rendas=r2(totais.isentos.rendas);totais.isentos.liquido=r2(totais.isentos.liquido);
  cols.forEach(k=>{totais.gastos[k]=r2(totais.gastos[k])});
  /* um resultado negativo não paga imposto: reporta-se aos seis anos seguintes (CIRS art. 55.º) */
  totais.imposto=Math.max(0,r2(totais.imposto));totais.prejuizo=totais.liquido<0?-totais.liquido:0;
  const pt=(a,b)=>String(a).localeCompare(String(b),'pt');
  L.sort((a,b)=>pt(a.quadro,b.quadro)||pt(a.imovel,b.imovel)||pt(a.inicio,b.inicio)||pt(a.nome,b.nome));
  const F=Object.keys(fora).map(k=>fora[k]).map(f=>Object.assign(f,{rendas:r2(f.rendas)})).sort((a,b)=>pt(a.nome,b.nome));
  const S=Object.keys(semC).map(k=>semC[k]).map(s=>Object.assign(s,{rendas:r2(s.rendas)})).sort((a,b)=>pt(a.imovel,b.imovel));
  return {ano:ano,versao:v,colunas:cols,titularId:titularId,imoveis:base.length,linhas:L,fora:F,semContrato:S,totais:totais,
    avisos:fiscoAvisos(ano,L,F,S,semRegra,obrasSoltas,foraDoPeriodo),semRegra:semRegra,obrasSoltas:obrasSoltas,foraDoPeriodo:foraDoPeriodo,
    aimi:fiscoAimi(ano,titularId,props,quotaDe,L,totais.imposto)};
}
/* O que há a tratar antes de preencher o quadro: contratos por indicar,
   declarados sem número, inquilinos sem NIF, imóveis sem os dados matriciais,
   rendas sem recibo ou sem contrato, despesas sem regra ou pagas com o imóvel
   vazio, o imposto do selo de um contrato que começou no ano — cada um com o
   toque que leva ao sítio certo. Os contratos não declarados são o último,
   sem toque e sem pedido: não são uma falta, são uma escolha, e diz-se só que
   ficam fora. Cada toque abre a ficha de outro serviço (contratos,
   inquilinos, imóveis, movimentos): com esse serviço desligado nesta conta o
   aviso fica, que a falta é a mesma, mas sem o toque. Com a dispensa dos
   recibos ligada (fiscoIrsDefs), as rendas sem recibo não são falta e entra
   em vez delas a linha do Modelo 44, com o prazo (fiscoPrazoModelo44).
   À cabeça, o que vale para o ano inteiro e não se trata em ficha nenhuma:
   um ano sem versão própria das regras (o `exato` do irs.js:irsAno) usa as
   de outro, e as taxas e os quadros podem ter mudado — âmbar; e uma versão
   ainda provisória (o Anexo F do ano por aprovar) diz-se com o texto dela —
   cinzento.
   Recebe: ano — o ano; L — as linhas do resumo; F — os contratos fora; S — as
   rendas sem contrato; semRegra — n.º de despesas sem regra de dedução;
   obrasSoltas — n.º de despesas marcadas como obras24 sem contrato a seguir;
   foraDoPeriodo — n.º de despesas pagas sem contrato em vigor.
   Cada aviso diz também o seu nível, para o selo da página: 'falta' (um dado
   que a AT pede e não está — o contrato, o NIF, a matriz), 'aviso' (o que
   convém tratar antes de entregar) e 'info' (o que só se diz: o Modelo 44 por
   entregar e os não declarados).
   Devolve: [{texto, abrir, toca, nivel}] — abrir é o código do onclick ('' sem
   ação); toca a família do ponto ('camada' abre uma ficha, 'ecra' muda de
   ecrã); nivel 'falta', 'aviso' ou 'info'. */
function fiscoAvisos(ano,L,F,S,semRegra,obrasSoltas,foraDoPeriodo){
  const out=[],add=(texto,abrir,toca,nivel)=>out.push({texto:texto,abrir:abrir||'',toca:toca||'',nivel:nivel||'aviso'});
  /* o toque só se o serviço que ele abre está ligado; senão [abrir, toca] vazios */
  const se=(id,abrir,toca)=>servicoLigado(id)?[abrir,toca]:['',''];
  const v=irsAno(ano);
  if(!v.exato)add('Ainda não há versão das regras de '+ano+'. '+(v.pedido>v.ano
    ?'Usam-se as de '+v.ano+', a mais recente, com as datas passadas para '+ano+' — as taxas e os quadros podem ter mudado.'
    :'Usam-se as de '+v.ano+', a mais antiga que a app tem.'),'','','aviso');
  else if(v.modelo&&!v.modelo.oficial&&v.modelo.texto)add(v.modelo.texto,'','','info');
  const umCt=ls=>ls.length===1?se('contracts',`ctView('${jsq(ls[0].contratoId)}')`,'camada'):se('contracts',"go('contracts')",'ecra');
  const porIndicar=L.filter(l=>!l.estado);
  if(porIndicar.length)add(porIndicar.length===1?'Contrato '+porIndicar[0].nome+': por indicar se foi declarado à AT'
    :porIndicar.length+' contratos com rendas em '+ano+' por indicar se foram declarados à AT',...umCt(porIndicar),'falta');
  const semNum=L.filter(l=>l.estado==='declarado'&&!l.atNumero);
  if(semNum.length)add(semNum.length===1?'Contrato '+semNum[0].nome+': declarado à AT, sem o n.º do contrato'
    :semNum.length+' contratos declarados à AT sem o n.º do contrato',...umCt(semNum),'falta');
  const semFin=L.filter(l=>l.taxaReduzida&&l.faltas.some(x=>/^finalidade/.test(x)));
  if(semFin.length)add(semFin.length===1?'Contrato '+semFin[0].nome+': diz se é habitação permanente — a redução pela duração depende disso'
    :semFin.length+' contratos longos sem finalidade: a redução pela duração é só da habitação permanente',...umCt(semFin),'falta');
  const vistos={};
  L.forEach(l=>l.inquilinos.forEach(t=>{
    if(vistos[t.id])return;vistos[t.id]=1;
    const v=nifValido(t.nif);
    if(v===false)add('Inquilino '+t.nome+': o NIF não bate certo',...se('tenants',`personView('tenant','${jsq(t.id)}')`,'camada'),'falta');
    else if(v===null&&!String(t.pais||'').trim())add('Inquilino '+t.nome+': sem NIF nem país de residência',...se('tenants',`personView('tenant','${jsq(t.id)}')`,'camada'),'falta');
  }));
  const imv={};
  L.forEach(l=>{
    if(!l.propertyId||imv[l.propertyId])return;imv[l.propertyId]=1;
    const falta=[!l.freguesiaCodigo?'código da freguesia':'',!l.tipoPredio?'tipo de prédio':'',!l.artigo?'artigo matricial':''].filter(Boolean);
    if(falta.length)add('Imóvel '+l.imovel+': sem '+listaE(falta),...se('properties',`propView('${jsq(l.propertyId)}')`,'camada'),'falta');
  });
  /* quem está dispensado dos recibos eletrónicos não tem recibos em falta: tem
     o Modelo 44, a declaração anual das rendas (CIRS art. 115.º) */
  const dispensa=fiscoIrsDefs().dispensaRecibos;
  if(dispensa&&L.length)add('Modelo 44: tens dispensa dos recibos eletrónicos — entrega a declaração anual das rendas de '+ano+' até '+dPT(fiscoPrazoModelo44(ano))+', no Portal das Finanças','','','info');
  const comRecibos=dispensa?[]:L.filter(l=>l.recibosPorEmitir>0),nRec=sum(comRecibos.map(l=>l.recibosPorEmitir));
  if(nRec)add(fiscoN(nRec,'renda','rendas')+' de '+ano+' sem recibo eletrónico emitido',
    ...(comRecibos.length===1?umCt(comRecibos):se('transactions',"go('transactions')",'ecra')));
  /* o selo do contrato (10 % de uma renda, pago com o Modelo 2) é dedutível e
     esquece-se: só se o contrato começou no ano e o prazo do Modelo 2 ainda
     caía nele — senão o selo pode ter sido pago no ano seguinte, com razão */
  const semSelo=L.filter(l=>l.estado==='declarado'&&l.inicio.slice(0,4)===String(ano)&&fimDoMesSeguinte(l.inicio).slice(0,4)===String(ano)&&!(l.gastos.selo>0));
  if(semSelo.length)add((semSelo.length===1?'Contrato '+semSelo[0].nome+': começou em '+ano+' e não há imposto do selo nos gastos'
    :semSelo.length+' contratos começaram em '+ano+' sem imposto do selo nos gastos')+' — o que se paga com o Modelo 2 (10 % de uma renda) é dedutível: regista-o como despesa, em Impostos › Imposto do selo',
    ...se('transactions',"go('transactions')",'ecra'));
  const nSem=sum(S.map(s=>s.n));
  if(nSem)add(fiscoN(nSem,'renda','rendas')+' de '+ano+' sem contrato ligado '+(nSem===1?'fica':'ficam')+' fora do quadro',
    ...(nSem===1?se('transactions',`txView('${jsq(S[0].ids[0])}')`,'camada'):se('transactions',"go('transactions')",'ecra')));
  if(semRegra)add(fiscoN(semRegra,'despesa sem regra de dedução conta','despesas sem regra de dedução contam')+' em Outros: define-a nas Definições → Categorias, etiquetas e IRS',
    "go('settings');goSet('irs')",'ecra');
  if(foraDoPeriodo)add(fiscoN(foraDoPeriodo,'despesa paga','despesas pagas')+' em '+ano+' com o imóvel sem contrato em vigor '+(foraDoPeriodo===1?'fica':'ficam')+' fora: só conta o período arrendado. Se é deste período, corrige as datas do contrato ou escolhe a coluna na ficha da despesa',
    ...se('transactions',"go('transactions')",'ecra'));
  if(obrasSoltas)add(fiscoN(obrasSoltas,'despesa marcada como obras dos 24 meses','despesas marcadas como obras dos 24 meses')+' de '+ano+' sem contrato a começar depois: '+(obrasSoltas===1?'fica':'ficam')+' fora até o haver',
    ...se('transactions',"go('transactions')",'ecra'));
  if(F.length)add(fiscoN(F.length,'contrato marcado como não declarado fica','contratos marcados como não declarados ficam')+' fora deste resumo.','','','info');
  return out;
}

/* A vista do separador IRS · Anexo F, como a prancheta D-Declaracao: o
   painel com o titular e o ano; a barra com o ano dos rendimentos num
   seletor, o titular e as ações da página (partilhar o resumo, exportar o
   CSV e o PDF, e o guia de preenchimento, que é o público); os cinco números
   do ano; a grelha com «A tratar antes de entregar» (que diz também quando o
   ano não tem versão própria das regras), «A tua situação fiscal» e os
   prazos da AT; um cartão por quadro, o 4.1 e o 4.2, cada um com onde se
   preenche, o resumo dos seus contratos e os campos de cada contrato (com
   o 4.2A, o 4.2B e o 4.2C no do 4.2); os
   isentos do 6D, as obras dos 24 meses, as rendas de anos anteriores, o AIMI
   do quadro 9, o que ficou fora por escolha e as rendas sem contrato. Sem
   imóveis, ou sem rendas no ano, diz-o e aponta a saída.
   Devolve: o HTML da vista (string). */
function vFisco(){
  const ano=fiscoAnoAtual(),auto=!fiscoAno,grupo=ownerIsGrp(),titular=grupo?'':ownerFilter;
  const anos=yearsWithData(null);if(anos.indexOf(ano)<0)anos.push(ano);anos.sort((a,b)=>a-b);
  const panel=anaPanel(`<div class="u-d-flex u-fxd-column u-g-9px">
    ${anaSelDono(titular,false)}
    <div class="u-w-100pc">${sel('fiscoSel',String(ano),anos.map(y=>({v:String(y),label:String(y)})),'onFiscoAno','vista')}</div></div>
    <div class="hint u-mt-9px">O Anexo F é por titular: com um escolhido, rendas e gastos entram na quota-parte dele.${grupo?' Um grupo de proprietários não se aplica aqui — os valores vão por inteiro.':''}${auto&&ano===YEAR-1?' Até junho mostra-se o ano anterior, que é o que se está a declarar.':''}</div>`);
  const r=resumoFiscal(ano,titular);
  /* a saída do vazio leva aos Imóveis: com esse serviço desligado nesta conta
     o botão não se escreve, e a frase diz quem o liga */
  if(!r.imoveis)return panel+(esperaDoServidor()||`<div class="empty"><b>Sem imóveis</b>O Anexo F parte das rendas de cada imóvel.
    ${servicoLigado('properties')?saida('Adicionar imóvel',"go('properties')",'ecra'):vazioServicoDesligado('properties')}</div>`);
  if(!r.linhas.length&&!r.fora.length&&!r.semContrato.length){
    const outros=anos.filter(y=>y!==ano&&(db.transactions||[]).some(t=>ehRenda(t)&&String(t.date||'').startsWith(String(y))));
    return panel+`<div class="ana fis">`+fisBarra(ano,anos,titular,false)+`<div class="empty"><b>Sem rendas em ${ano}</b>${outros.length?'Há rendas em '+esc(outros.join(', '))+'. ':''}Uma renda entra aqui quando o movimento é da categoria Rendas e está ligado ao contrato.
      ${saida('Escolher outro ano','hdrFiltToggle()','vista')}</div></div>`;
  }
  /* Os cartões dos quadros empilham-se numa grelha de uma coluna com o mesmo
     intervalo que as colunas da casa (14px). A coluna é minmax(0,1fr) e não
     1fr: um item de grelha não encolhe abaixo do seu conteúdo, e a tabela do
     resumo, mais larga do que o ecrã, alargava a página em vez de rolar
     dentro do .tablewrap. */
  const Q=r.versao.quadros;
  return panel+`<div class="ana fis">`+fisBarra(ano,anos,titular,true)+fiscoKpis(r)
    +`<div class="fis-grelha">`+fiscoObrigacoesCard(r)+fiscoSituacaoCard(r)+fisPrazosCard()+`</div>`
    +`<div class="fiscoPilha u-d-grid u-gtc-minmax-0-1fr u-g-14px">`
    +fiscoQuadroCard(r,Q.semReducao)+fiscoQuadroCard(r,Q.comReducao)+fiscoIsentosCard(r)+fiscoObrasCard(r)
    +fiscoAnosAnterioresCard(r)+fiscoAimiCard(r)+fiscoForaCard(r)+fiscoSemContratoCard(r)+fisNadaForaCard(r)+`</div></div>`;
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
/* A barra do topo do IRS (a prancheta): o ano dos rendimentos num seletor
   (um ano por cada um com movimentos, e o da página — o sel() da casa, como o
   do painel, e não uma pílula por ano, que com vários anos enchia a barra), o
   titular — com alguém escolhido o nome e o × que o deixa, sem ninguém «por
   inteiro» e o ▾ que abre o painel — e as ações da página: partilhar o
   resumo (ou copiá-lo, onde não há partilha), exportar o CSV, exportar o PDF
   (fisco-pdf.js:fiscoPdf, que vem com este serviço; o escritor do PDF é o
   do serviço Contratos, e por isso o botão só se escreve com ele ligado —
   o servicoLigado, o idioma de guarda da casa) e o guia de preenchimento, que é o público
   (/guias/declarar-rendas), numa página nova. O rótulo «Ano de rendimentos»
   embrulha o seletor e dá-lhe o nome; o rótulo «Titular» e o chip dele vão
   juntos numa caixa (estilos.css:.fis-titular): soltos, o rótulo ficava no
   fim da fila e o chip descia sozinho para a seguinte, no telemóvel. O texto
   do chip vai num <span>, que leva as reticências de um nome comprido.
   Recebe: ano — o ano da página; anos — os anos a oferecer; titular — o id do
   proprietário escolhido, ou ''; acoes — escrever os botões das ações.
   Devolve: o HTML da barra (string). */
function fisBarra(ano,anos,titular,acoes){
  const anoSel=`<label class="fis-ano"><span class="lbl">Ano de rendimentos</span>${sel('fiscoAnoSel',String(ano),anos.map(y=>({v:String(y),label:String(y)})),'onFiscoAnoBarra','vista')}</label>`;
  const tit=!db.owners.length?'':titular
    ?`<button type="button" class="chip on" data-toca="vista" data-click="limparAmbito()" aria-label="Titular: ${esc(ownerFilterName())}, na quota-parte (limpar)"><span>${esc(ownerFilterName())} · quota-parte</span>${ic('x',14)}</button>`
    :`<button type="button" class="chip" data-toca="vista" data-click="hdrFiltToggle()"><span>Todos · por inteiro</span>${ic('chevD',16)}</button>`;
  const pdf=servicoLigado('contracts')?`<button type="button" class="btn" data-toca="nada" data-click="fiscoPdf()">Exportar PDF</button>`:'';
  return `<div class="ana-barra"><div class="chips-fila ana-ambito">${anoSel}${tit?`<span class="fis-titular"><span class="lbl fis-lbl">Titular</span>${tit}</span>`:''}</div>
    ${acoes?`<div class="ana-acoes"><button type="button" class="btn" data-toca="nada" data-click="fiscoPartilhar()">Partilhar resumo</button>
    <button type="button" class="btn" data-toca="nada" data-click="fiscoCsv()">Exportar CSV</button>${pdf}
    <a class="btn" href="/guias/declarar-rendas" target="_blank" rel="noopener" data-toca="nada">Guia de preenchimento</a></div>`:''}</div>`;
}
/* O ano escolhido no seletor da barra (fisBarra): guarda-o e volta a
   desenhar, com o foco de volta ao seletor novo quando a escolha foi pelo
   teclado (vistas.js:lfReporFoco) — o render refaz a barra inteira.
   Devolve: nada — guarda o ano e redesenha a vista. */
function onFiscoAnoBarra(){
  const antes=document.activeElement;
  fiscoAno=val('fiscoAnoSel')||'';render();lfReporFoco(antes);
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
    ${kpi('Rendas ilíquidas',euro(T.rendas),'',fiscoN(r.linhas.length,'contrato','contratos')+' em '+r.ano,'O que entrou como renda mais o que o inquilino reteve na fonte, no ano em que foi recebido. É o valor que vai aos quadros 4.1 e 4.2; cauções e empréstimos recebidos ficam de fora.')}
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
   fração, o n.º na AT e a taxa e porquê), as rendas que vão ao quadro e o
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
    const sub=[l.imovel,l.artigo?'art. '+l.artigo:'',l.fracao?'fr. '+l.fracao:'',l.atNumero?'n.º '+l.atNumero:'',taxa.trim()].filter(Boolean).map(esc).join(' · ');
    const falta=l.faltas.length?`<span class="fis-qr-falta"><span class="badge red">${esc(cap(l.faltas[0]))}</span>${l.faltas.length>1?` <span class="small">+${l.faltas.length-1}</span>`:''}</span>`:'';
    const toque=comContratos?` data-toca="camada" data-click="ctView('${jsq(l.contratoId)}')" aria-label="${esc(l.nome)}: abrir o contrato"`:'';
    return `<div class="fis-qr-linha${comContratos?' tap':''}"${toque}><div class="fis-qr-nome"><b>${esc(l.nome)}</b><span class="small">${sub}</span>${falta}</div>
      <div class="fis-qr-num"><b>${euro2(l.rendas)}</b><span class="small">${l.isencao?'isento':'imposto '+euro2(l.imposto)}</span></div></div>`;
  };
  const conta=ls.filter(l=>!l.isencao),isentos=ls.length-conta.length;
  const rendas=r2(sum(ls.map(l=>l.rendas))),liquido=r2(sum(conta.map(l=>l.liquido))),imposto=Math.max(0,r2(sum(conta.map(l=>l.imposto))));
  const onde=red?`Preenche no <b>quadro ${esc(q)}</b> do Anexo F: uma linha por contrato, e no ${esc(r.versao.quadros.datas)} as datas de cada um.`
    :`Preenche no <b>quadro ${esc(q)}</b> do Anexo F: uma linha por contrato.`;
  return `<p class="fis-onde">${onde}</p><div class="fis-qr">${ls.map(linha).join('')}
    <div class="fis-qr-linha fis-qr-total"><div class="fis-qr-nome"><b>Total do quadro ${esc(q)}</b><span class="small">${fiscoN(ls.length,'contrato','contratos')} · líquido ${euro2(liquido)}</span></div>
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
  const tot=`<div class="fis-ctc fis-ctc-total"><div class="fis-ctc-cab"><div class="fis-ctc-nome"><b>Total do quadro ${esc(q)}</b><span class="small">${fiscoN(ls.length,'contrato','contratos')}</span></div></div>
    <dl class="fis-campos">${somas.map(x=>`<div class="fis-campo"><dt>${esc(x[0])}</dt><dd>${euro2(x[1])}</dd></div>`).join('')}</dl></div>`;
  const sub=r.ano+(r.titularId?' · quota-parte de '+esc(ownerFilterName()):' · valores por inteiro');
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
/* O cartão de um contrato num quadro: à cabeça o nome, o imóvel (e a
   quota-parte, quando não é inteiro) e a taxa do ano e porquê (ou «isento»,
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
  const sub=[l.imovel,l.quota<1?'quota-parte '+pct(l.quota,0):'',taxa].filter(Boolean).join(' · ');
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
/* O cartão «A tua situação fiscal» (a prancheta M-SituacaoFiscal): o que só
   o senhorio sabe e muda o que vai a cada quadro, em linhas que gravam ao
   mexer — a tributação conjunta num interruptor e, com ela, a letra de cada
   proprietário dos imóveis com rendas no ano num segmentado A/B; e a dispensa
   dos recibos eletrónicos noutro interruptor, com quem está dispensado e o
   Modelo 44 que isso obriga a entregar. Grava logo (fiscoSetIrs,
   fiscoSetTitular), em db.settings.irs, que vai com as definições.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string). */
function fiscoSituacaoCard(r){
  const d=fiscoIrsDefs(),ids=[],visto={};
  r.linhas.forEach(l=>{const p=l.propertyId?prop(l.propertyId):null;
    if(p)ownersOfProp(p).forEach(o=>{if(!visto[o]){visto[o]=1;ids.push(o)}})});
  const interruptor=(id,campo,on,nome)=>`<button type="button" class="interruptor" role="switch" id="${id}" aria-checked="${on?'true':'false'}" aria-label="${nome}" data-toca="dados" data-click="fiscoSetIrs('${campo}',${on?'false':'true'})"></button>`;
  const ab=o=>{const l=fiscoLetra(o,d),nome=esc((owner(o)||{}).name||'');
    return `<div class="fis-linha"><span class="fis-linha-txt">${nome}</span><div class="segm fis-ab" role="group" id="fiscoTit_${esc(o)}" aria-label="Titular de ${nome}">${['A','B'].map(x=>
      `<button type="button" class="${l===x?'on':''}" aria-pressed="${l===x}" data-toca="dados" data-click="fiscoSetTitular('${jsq(o)}','${x}')">${x}</button>`).join('')}</div></div>`};
  const titulares=!d.conjunta?'':ids.length?`<p class="lbl fis-sit-lbl">Titular de cada proprietário</p>${ids.map(ab).join('')}
    <p class="hint fis-sit-nota">A: sujeito passivo A. B: o cônjuge (sujeito passivo B). Cada linha dos quadros leva a letra de quem é o imóvel. Um imóvel dos dois vai em duas linhas, uma por titular, cada uma com a sua quota-parte: escolhe o titular no painel para ver a parte de cada um.</p>`
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
/* O cartão do quadro 6D: os contratos isentos (PAA, programas municipais,
   RSAA) com rendas no ano, cada um com o n.º, o programa e o código, e o
   rendimento líquido isento. Ficam também na linha do 4.1, que é o que o 6D
   pede; não pagam imposto, e no englobamento contam só para a taxa. Sem
   isentos, não se escreve.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o HTML do cartão (string), ou '' sem isentos. */
function fiscoIsentosCard(r){
  const ls=r.linhas.filter(l=>l.isencao);if(!ls.length)return '';
  return fisCartao('Quadro 6D — rendimentos isentos',fiscoN(ls.length,'contrato isento','contratos isentos')+' em '+r.ano,
    `<div>${ls.map(l=>`<div class="stat"><span class="u-minw-0">${esc(l.nome)}<div class="small">${esc(l.imovel)}${l.imovel?' · ':''}n.º ${l.atNumero?esc(l.atNumero):'—'} · ${esc(l.isencao.nome||l.isencao.curto)} · ${l.isencao.codigo?'código '+esc(l.isencao.codigo):'código por conhecer'}</div></span><b>${euro2(l.rendas)}</b></div>`).join('')}
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
    '<div>'+ls.map(l=>`<div class="stat"><span>${esc(l.nome)}<div class="small">${esc(l.imovel)} · quadro ${esc(l.quadro)} · desde ${dPT(l.obras24.inicioGastos)}</div></span><b>${euro2(l.obras24.valor)}</b></div>`).join('')
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
    '<div>'+ls.map(l=>l.anosAnteriores.map(a=>`<div class="stat"><span>${esc(l.nome)}<div class="small">quadro ${esc(l.quadro)} · respeitam a ${a.ano}</div></span><b>${euro2(a.valor)}</b></div>`).join('')).join('')+'</div>'
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
/* O resumo em texto simples, para partilhar ou copiar: totais (com os isentos
   do 6D e o AIMI do quadro 9, quando os há; o imposto sem englobamento), uma
   entrada por contrato com o quadro, o titular, a identificação, os valores,
   a comunicação de fevereiro e o 4.2B no 4.2, e as faltas, e depois o
   que ficou fora, as rendas sem contrato e o que há a tratar. Os mesmos
   números da página.
   Devolve: o texto (string, várias linhas). */
function fiscoTexto(){
  const ano=fiscoAnoAtual(),r=resumoFiscal(ano,ownerIsGrp()?'':ownerFilter);
  const gastos=g=>r.colunas.map(k=>fiscoColRotulo(k)+' '+euro2(g[k])).join(' · '),a=r.aimi,I=r.totais.isentos;
  return `ANEXO F · QUADROS 4.1 E 4.2 — ${ano}${r.titularId?' · '+ownerFilterName()+' (quota-parte)':''}
${r.versao.exato?'Regras de '+r.versao.ano+(r.versao.modelo.oficial?'':' (provisórias)'):'Ainda sem regras de '+ano+': usam-se as de '+r.versao.ano}

Rendas ilíquidas ${euro2(r.totais.rendas)} · retenções ${euro2(r.totais.retencoes)}
${gastos(r.totais.gastos)}${r.totais.obras24?'\nObras antes do arrendamento '+euro2(r.totais.obras24):''}
Rendimento líquido ${euro2(r.totais.liquido)} · imposto estimado ${euro2(r.totais.imposto)} (sem englobamento)${I.n?'\nIsentos (quadro 6D): rendas '+euro2(I.rendas)+' · líquido '+euro2(I.liquido)+' — fora do imposto':''}${a?'\nAIMI (quadro 9): pago '+euro2(a.total)+(a.abate!=null?' · abate ao imposto cerca de '+euro2(a.abate):a.semVpt.length?' · falta o VPT de '+listaE(a.semVpt):''):''}

POR CONTRATO
${r.linhas.map(l=>`  [${l.quadro}] ${l.atNumero?'n.º '+l.atNumero:'sem n.º na AT'} · ${l.nome} — ${l.imovel||'sem imóvel'}${l.quota<1?' · quota-parte '+pct(l.quota,0):''} · titular ${l.titular||'A'}
    Início ${dPT(l.inicio)||'—'} · freguesia ${l.freguesiaCodigo||'—'} · ${l.tipoPredio||'—'} · artigo ${l.artigo||'—'}${l.fracao?' · fração '+l.fracao:''} · natureza ${l.natureza}${l.isencao?' · isento (quadro '+l.isencao.quadro+(l.isencao.codigo?', código '+l.isencao.codigo:'')+')':' · taxa '+dec(l.taxa)+' %'}
    Inquilinos: ${l.inquilinos.length?l.inquilinos.map(t=>t.nome+' ('+(t.nif||t.pais||'sem NIF')+')').join(', '):'—'}
    Rendas ilíquidas ${euro2(l.rendas)} · retenções ${euro2(l.retencoes)}${l.anosAnteriores.length?' · de anos anteriores: '+l.anosAnteriores.map(a=>a.ano+' '+euro2(a.valor)).join(', '):''}
    ${gastos(l.gastos)}${l.obras24.valor?'\n    Obras antes do arrendamento '+euro2(l.obras24.valor)+' (desde '+dPT(l.obras24.inicioGastos)+')':''}${l.quadro===r.versao.quadros.comReducao?'\n    '+r.versao.quadros.datas+': '+(l.comunicado==null?'':(l.comunicado?'comunicada a '+dPT(l.comunicado):'por comunicar')+' · ')+'início '+(dPT(l.datas.inicio)||'—')+' · termo '+(dPT(l.datas.fim)||'—')+(l.datas.renovacaoInicio?' · última renovação '+dPT(l.datas.renovacaoInicio)+' a '+(dPT(l.datas.renovacaoFim)||'—'):'')+(l.bonus?'\n    4.2B: −5 p.p. · renda '+euro2(l.renda)+' · renda anterior '+(l.rendaAnterior?euro2(l.rendaAnterior):'—'):''):''}${l.faltas.length?'\n    Falta: '+l.faltas.join(', ')+'.':''}`).join('\n')}
${r.fora.length?'\nFORA DA DECLARAÇÃO\n'+r.fora.map(f=>`  ${f.nome}${f.imovel?' — '+f.imovel:''}: ${euro2(f.rendas)}`).join('\n')+'\n':''}${r.semContrato.length?'\nRENDAS SEM CONTRATO\n'+r.semContrato.map(s=>`  ${s.imovel}: ${euro2(s.rendas)} (${fiscoN(s.n,'movimento','movimentos')})`).join('\n')+'\n':''}${r.avisos.length?'\nA TRATAR\n'+r.avisos.map(a=>'  · '+a.texto).join('\n')+'\n':''}
Resumo feito pela app com o que tem registado. Os gastos de um imóvel com mais do que um contrato repartem-se pelas rendas; o rateio por VPT ou área fica para quem preenche. O imposto é uma estimativa.
`;
}
/* Partilha o resumo do Anexo F: folha de partilha do Android, Web Share API,
   ou cópia para a área de transferência — a mesma ordem da Avaliação. Uma
   cópia recusada (sem permissão, documento sem foco) diz-se num aviso, em vez
   de o botão parecer não fazer nada e ficar um erro por apanhar.
   Devolve: nada de útil — só o efeito de partilhar (ou copiar) o texto. */
function fiscoPartilhar(){
  const txt=fiscoTexto(),titulo='Anexo F · '+fiscoAnoAtual();
  if(window.Android&&window.Android.shareText)return window.Android.shareText(titulo,txt);
  if(navigator.share)return navigator.share({title:titulo,text:txt}).catch(()=>{});
  if(navigator.clipboard)return navigator.clipboard.writeText(txt).then(()=>toast('Resumo copiado.'),()=>toast('Não foi possível copiar o resumo.'));
  toast('Não foi possível partilhar.');
}
/* Exporta os quadros do ano para CSV (ponto e vírgula, campos entre aspas,
   para abrir no Excel): um cabeçalho, uma linha por contrato, e as dos
   contratos não declarados com «nao» na coluna declarado — só com nome,
   imóvel, quota e rendas, porque é só isso que se sabe deles aqui. As colunas
   novas vão sempre no fim, para quem já tem uma folha montada sobre as velhas:
   as últimas são o titular (A, B ou A/B), o código da isenção do 6D, a data
   da comunicação de fevereiro (4.2A) e a descida do n.º 24 com a renda
   anterior (4.2B).
   Devolve: nada — dispara a descarga do CSV. */
function fiscoCsv(){
  const ano=fiscoAnoAtual(),r=resumoFiscal(ano,ownerIsGrp()?'':ownerFilter),cols=r.colunas;
  const n=v=>String(r2(Number(v)||0));
  const rows=[['ano','declarado','contrato','n_at','inicio','imovel','freguesia','tipo_predio','artigo','fracao','natureza','inquilinos','nif_ou_pais','quota_pct','rendas_iliquidas','retencoes']
    .concat(cols).concat(['obras24','obras24_desde','recibos_por_emitir','faltas','quadro','taxa_pct','liquido','imposto_estimado','anos_anteriores','termo','ultima_renovacao',
    'titular','isencao_6d','comunicacao_4_2a','reducao_4_2b','renda_anterior_4_2b'])];
  r.linhas.forEach(l=>rows.push([ano,l.estado==='declarado'?'sim':'por indicar',l.nome,l.atNumero,l.inicio,l.imovel,l.freguesiaCodigo,l.tipoPredio,l.artigo,l.fracao,l.natureza,
    l.inquilinos.map(t=>t.nome).join(' / '),l.inquilinos.map(t=>t.nif||t.pais||'').join(' / '),n(l.quota*100),n(l.rendas),n(l.retencoes)]
    .concat(cols.map(k=>n(l.gastos[k]))).concat([n(l.obras24.valor),l.obras24.inicioGastos,l.recibosPorEmitir,l.faltas.join('; '),
      l.quadro,n(l.taxa),n(l.liquido),n(l.imposto),l.anosAnteriores.map(a=>a.ano+':'+n(a.valor)).join(' '),l.datas.fim,
      l.datas.renovacaoInicio?l.datas.renovacaoInicio+'/'+l.datas.renovacaoFim:'',
      l.titular||'A',l.isencao?(l.isencao.codigo||l.isencao.id):'',l.comunicado||'',l.bonus?'sim':'',l.bonus&&l.rendaAnterior?n(l.rendaAnterior):''])));
  r.fora.forEach(f=>{const c=contract(f.contratoId);
    rows.push([ano,'nao',f.nome,'',c?c.start||'':'',f.imovel,'','','','','',c?ctNames(c):'','',n(f.quota*100),n(f.rendas),'0']
      .concat(cols.map(()=>'0')).concat(['0','','','','','','','','','','','','','','','']))});
  download('anexo-f-'+ano+'.csv','text/csv;charset=utf-8',rows.map(row=>row.map(x=>'"'+String(x==null?'':x).split('"').join('""')+'"').join(';')).join('\n'));
  toast('CSV exportado.');
}
/* aplica o ano escolhido no seletor e volta a desenhar
   Devolve: nada — guarda o ano e redesenha a vista. */
function onFiscoAno(){fiscoAno=val('fiscoSel')||'';render()}
/* ---- registo do serviço (servicos.js) ---- */
// nº de filtros ativos no painel de análise do IRS · Anexo F: só o proprietário
// (o ano é o assunto da página, não um filtro)
// Devolve: número de filtros ativos (0 ou 1).
function fiscoAnaN(){return ownerFilter?1:0}
// limpa o ano em foco do IRS · Anexo F (o proprietário limpa-o a base, anaClear)
// Devolve: nada — limpa o filtro; quem chama repinta.
function fiscoAnaLimpar(){fiscoAno=''}
registarServico({id:'fisco',vistas:{fisco:'vFisco'},analise:{fisco:{n:'fiscoAnaN',limpar:'fiscoAnaLimpar'}}});
