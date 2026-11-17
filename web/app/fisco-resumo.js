/* ================= FISCO · RESUMO =================
   O resumo do Anexo F de um ano (resumoFiscal), a função pura por trás da
   página, do texto, do CSV e do PDF: o ano que a página mostra, as linhas
   por contrato e por titular, a repartição dos gastos, as obras dos 24
   meses, os prazos que dependem do ano. Os avisos que daí saem são do
   fisco-avisos.js; a página é o fisco.js. Partiu-se do fisco.js (KAN-125). */

/* o ano escolhido no seletor; vazio é «automático» (fiscoAnoAtual) */
let fiscoAno='';
/* as colunas de gastos que contam no ano em que o imóvel deu rendas, e não só
   no período arrendado (CIRS art. 41.º n.º 5) */
const FISCO_SEM_PERIODO={imi:1,selo:1};
/* O ano que a página mostra: o escolhido; senão o automático (fiscoAnoAuto).
   Devolve: o ano (número). */
function fiscoAnoAtual(){return fiscoAno?Number(fiscoAno):fiscoAnoAuto()}
/* O ano automático, sem nenhum escolhido: até junho e havendo rendas no ano
   anterior, o ano anterior — é o que se está a declarar. Depois de junho o
   ano corrente, que é o que se vai acompanhando.
   Devolve: o ano (número). */
function fiscoAnoAuto(){
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
/* Quantos contratos há nas linhas: em tributação conjunta um contrato num
   imóvel dos dois tem uma linha por titular, e conta uma vez.
   Recebe: ls — as linhas (do resumoFiscal).
   Devolve: o número de contratos. */
function fiscoNContratos(ls){const v={};ls.forEach(l=>{v[l.contratoId]=1});return Object.keys(v).length}
/* O que são os valores de um quadro, para o subtítulo dele na página e no
   PDF: por inteiro, sem saber quem és (fiscoTitulares); a tua parte e a do
   titular B, com linhas do cônjuge (a conjunta); a tua quota-parte, com
   alguma linha abaixo de 100 %; e nada quando é tudo teu.
   Recebe: r — o resumo (resumoFiscal); ls — as linhas do quadro.
   Devolve: o texto ('' quando é tudo teu). */
function fiscoParte(r,ls){
  if(r.porInteiro)return 'valores por inteiro';
  const meu=ls.some(l=>l.titularId===r.titularId),doB=ls.some(l=>l.titularId!==r.titularId);
  if(doB)return meu?'a tua parte e a do titular B':'a parte do titular B';
  return ls.some(l=>l.quota<1)?'a tua quota-parte':'';
}
/* O contrato anterior sobre o mesmo imóvel — o que o quadro 4.2B pede ao lado
   do novo (o número e a renda): o que começou mais tarde antes deste, entre
   os que arrendavam a MESMA parte (o mesmo quarto, ou os dois sem quarto) e
   já tinham acabado quando este começou — o último dia em vigor
   (irs.js:irsFimReal) até ao início dele; um terminado sem data nenhuma
   conta como acabado. Num imóvel por quartos, o contrato de outro quarto
   ainda em vigor nunca é o anterior (D38). Sem nenhum, null: o 4.2B fica
   «por identificar», como já dizia.
   Recebe: c — o contrato novo.
   Devolve: o contrato anterior, ou null. */
function fiscoContratoAnterior(c){
  if(!c||!c.propertyId||!c.start)return null;
  const quarto=c.roomId||'';
  const acabou=x=>{const fim=irsFimReal(x);return fim?fim<=c.start:x.active===false};
  return (db.contracts||[]).filter(x=>x&&x.id!==c.id&&x.propertyId===c.propertyId&&(x.roomId||'')===quarto&&x.start&&x.start<c.start&&acabou(x))
    .sort((a,b)=>a.start<b.start?1:a.start>b.start?-1:0)[0]||null;
}
/* O número do primeiro campo de cada quadro de linhas do Anexo F (4001 no
   4.1, 4501 no 4.2), por onde o 4.2A, o 4.2B, o 6D, o quadro 8 e o 9 ligam
   as linhas (D77). Lê-se da versão do ano quando ela o trouxer
   (`quadros.campos`, {'4.1':'4001', …}); até lá, o do impresso de hoje. */
const FISCO_CAMPOS0={'4.1':4001,'4.2':4501};
/* O número do campo de cada linha, pela ordem final das linhas dentro do
   seu quadro: '4001', '4002'… no 4.1; '4501'… no 4.2. Um quadro sem número
   conhecido fica com ''.
   Recebe: L — as linhas, já ordenadas; v — a versão do ano (irsAno).
   Devolve: nada — escreve l.campo em cada linha. */
function fiscoNumerarCampos(L,v){
  const q=(v&&v.quadros&&v.quadros.campos)||FISCO_CAMPOS0,n={};
  L.forEach(l=>{
    const ini=Number(q[l.quadro]);
    if(!(ini>0)){l.campo='';return}
    n[l.quadro]=(n[l.quadro]||0)+1;
    l.campo=String(ini+n[l.quadro]-1);
  });
}
/* O campo da fração tem mais do que uma fração? O Anexo F leva uma por
   linha, com a renda que lhe cabe (D69). Separadores: a vírgula, « e », a
   barra e o «+». O «R/C» (rés-do-chão) não é uma segunda fração.
   Recebe: fr — o texto da fração do imóvel.
   Devolve: true quando há mais do que uma. */
function fiscoVariasFracoes(fr){
  const s=String(fr||'').replace(/\br\s*\/\s*c\b/ig,'rc');
  return /,|\/|\+|\se\s/i.test(s);
}
/* O imposto estimado de cada titular, com as perdas dentro dele (CIRS art.
   55.º n.º 1): o resultado negativo de um titular só abate aos resultados
   positivos DELE no mesmo ano, nunca aos de outro (D72). Dentro de cada
   titular, as linhas negativas abatem às positivas na proporção do
   líquido delas, e cada parte paga a taxa da sua linha; o que sobra da
   perda é o prejuízo a reportar desse titular. Uma linha nunca tem imposto
   negativo (D98): a linha com líquido negativo fica com imposto 0 e o
   prejuízo dela. As linhas isentas ficam de fora (o líquido delas não
   paga nem abate).
   Recebe: L — as linhas, já com liquido e taxa arredondados.
   Devolve: {[titularId]: {liquido, imposto, prejuizo}} — e escreve
   l.imposto (≥ 0) e l.prejuizo em cada linha. */
function fiscoImpostoPorTitular(L){
  const por={},grupos={};
  L.forEach(l=>{
    l.prejuizo=l.isencao?0:r2(Math.max(0,-l.liquido));
    l.imposto=0;
    const k=l.titularId||'';
    if(!por[k])por[k]={liquido:0,imposto:0,prejuizo:0};
    if(!l.isencao)(grupos[k]||(grupos[k]=[])).push(l);
  });
  Object.keys(grupos).forEach(k=>{
    const ls=grupos[k],P=sum(ls.filter(l=>l.liquido>0).map(l=>l.liquido)),N=sum(ls.filter(l=>l.liquido<0).map(l=>-l.liquido));
    /* a fração de cada linha positiva que fica depois de abater as perdas */
    const fica=P>N&&P>0?(P-N)/P:0;
    ls.forEach(l=>{if(l.liquido>0)l.imposto=r2(l.liquido*fica*l.taxa/100)});
    por[k]={liquido:r2(P-N),imposto:r2(sum(ls.map(l=>l.imposto))),prejuizo:r2(Math.max(0,N-P))};
  });
  return por;
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
   F tal e qual, e volta recusado. A taxa é a da lei do ano (irs.js:irsTaxa),
   nunca a escrita no contrato, que vai em taxaEscrita (o número, ou null).
   Sem finalidade, a natureza 07 é assumida (naturezaAssumida) e é uma falta
   em todas as linhas; sem data de início e com mais do que uma fração no
   mesmo campo, também. As faltas começam sempre pelo mesmo texto (os avisos
   procuram-nas pelo princípio): 'finalidade do contrato', 'data de início
   do contrato', 'fração: mais do que uma'. As datas da última renovação do
   4.2A são só de um período começado até 31 de dezembro do ano.
   E o que os subquadros pedem: o titular (fiscoTitularDe), a isenção do
   contrato (irs.js:irsIsencao, pela taxa — um isento fica no 4.1 com taxa 0 e
   vai ao 6D), a data da comunicação de fevereiro (irs.js:irsComunicado; ''
   por fazer), a descida do n.º 24 (4.2B, com a renda e o contrato
   anteriores) e a data de celebração, que diz se o 4.2C se aplica — nos
   campos titular, isencao ({id, nome, curto, quadro, codigo} ou null),
   comunicado, bonus, renda, rendaAnterior, contratoAnterior ({id, nome,
   numero} ou null), celebracao e acimaDoLimite (true, false ou null); e
   titularId, o id do proprietário de quem é a linha ('' por inteiro).
   Recebe: c — o contrato; p — o imóvel (pode faltar); q — a quota-parte (0–1);
   ano — o ano dos rendimentos; titularId (opcional) — o titular da linha.
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
  /* sem finalidade a app assume habitação (a natureza 07 e a taxa dela), mas
     di-lo sempre — numa loja ou garagem a natureza é 06 e a taxa 28 % (D16) */
  if(!f.finalidade)faltas.push('finalidade do contrato (a natureza 06 ou 07 e a taxa dependem dela)');
  if(!c.start)faltas.push('data de início do contrato');
  if(p&&fiscoVariasFracoes(p.fraction))faltas.push('fração: mais do que uma no mesmo campo ('+String(p.fraction).trim()+') — no Anexo F cada fração vai numa linha, com a renda que lhe cabe');
  /* o 4.2A pede a última renovação DESTE ano: só contam os períodos
     começados até 31 de dezembro (D13), como na taxa (irs.js:irsPeriodoDoAno) */
  const ps=irsPeriodos(c),vivos=ps.filter((x,i)=>i===0||(x.inicio&&x.inicio<=ano+'-12-31')),ult=vivos.length>1?vivos[vivos.length-1]:null;
  const g={};v.colunas.forEach(k=>{g[k]=0});
  const escrita=Number(c.taxRate)>0?Number(c.taxRate):null;
  return {contratoId:c.id,propertyId:p?p.id:(c.propertyId||null),nome:ctName(c),imovel:p?p.name:'',
    atNumero:f.numero,inicio:c.start||'',estado:f.estado,
    freguesiaCodigo:p?p.freguesiaCodigo:'',tipoPredio:p?p.tipoPredio:'',artigo:p?p.matrix:'',fracao:p?p.fraction:'',
    quota:q,natureza:naturezaIrs(c,ano),naturezaAssumida:!f.finalidade,titular:fiscoTitularDe(p,titularId,ano),titularId:titularId||'',
    quadro:tx.reducao&&!is?v.quadros.comReducao:v.quadros.semReducao,taxaReduzida:!!tx.reducao&&!is,campo:'',
    /* na Declaração a taxa é sempre a da lei do ano (art. 72.º; Q9/D17); a
       escrita no contrato fica ao lado, para a nota e o aviso */
    taxa:is?0:tx.taxa,taxaEscrita:is?null:escrita,motivoTaxa:tx.motivo,
    isencao:is?{id:is.id||f.isencao,nome:is.nome||'',curto:is.curto||is.nome||'',quadro:is.quadro||'6D',codigo:is.codigo||''}:null,
    comunicado:irsComunicado(c,ano)||'',
    bonus:!!(tx.reducao&&tx.reducao.bonus),renda:Number(c.rent)||0,rendaAnterior:Number(f.rendaAnterior)||0,
    contratoAnterior:ant?{id:ant.id,nome:ctName(ant),numero:fiscoDe(ant).numero}:null,
    celebracao:f.celebracao||c.start||'',acimaDoLimite:f.rendaAcimaDoLimite===true?true:f.rendaAcimaDoLimite===false?false:null,
    /* o termo do 4.2A é o do contrato inicial: com renovações, o c.end já é o
       da última, que vai na coluna dela */
    datas:{inicio:c.start||'',fim:(ps[0]&&ps[0].fim)||c.end||'',renovacaoInicio:ult?ult.inicio:'',renovacaoFim:ult?ult.fim:''},
    inquilinos:ts.map(t=>({id:t.id,nome:t.name,nif:t.nif||'',pais:t.pais||''})),
    rendas:0,retencoes:0,gastos:g,obras24:{valor:0,inicioGastos:''},anosAnteriores:{},liquido:0,imposto:0,prejuizo:0,
    faltas:faltas,recibosPorEmitir:0};
}
/* O resumo do Anexo F de um ano — a função pura por trás da página, do texto e
   do CSV. Uma linha por contrato NÃO marcado como não declarado com rendas no
   ano e por titular com quota no imóvel; os não declarados vão para «fora»,
   somados; as rendas sem contrato (ou de um contrato apagado) para
   «semContrato», por imóvel. Uma renda de um mês (periodo) de um ano anterior
   entra na linha e fica em anosAnteriores, para o quadro 8. Os gastos do ano
   entram pela coluna do irsColunaDe, com o peso de metricas.js:txWeight e pela
   quota, só se foram pagos com um contrato em vigor (o IMI e o selo sempre), e
   repartem-se pelas linhas do imóvel na proporção das rendas (fiscoReparte).
   As obras dos 24 meses (fiscoObra24De) só na linha do contrato a que
   pertencem, no ano em que ele começa (sem rendas nesse ano, no primeiro com
   rendas). As despesas «a confirmar» não contam: ficam em aConfirmar. O
   imposto, à taxa da lei do ano, sai titular a titular
   (fiscoImpostoPorTitular); cada linha leva o n.º do campo (fiscoNumerarCampos).
   A declaração é a de quem a pede (fiscoTitulares): eu e, em conjunta, o
   titular B — só os imóveis onde um deles tem quota, e tudo pela quota de
   cada um (os não declarados e as rendas sem contrato pela soma). Um
   movimento sem imóvel é da conta que o registou: inteiro para quem o
   recebeu ou pagou, se é titular, e para mim sem «pago por». Sem saber quem
   és, tudo por inteiro.
   Recebe: ano — o ano (número ou texto); eu (opcional) — o id de quem declara ('' por
   inteiro; omitido, o da sessão: fiscoEu); opcoes (opcional) — {semExtras:true}, sem efeito ainda.
   Devolve: {ano, versao, colunas, titularId, titulares, porInteiro, semSessao,
   variosTitulares, imoveis, linhas, fora, semContrato, totais, avisos,
   aConfirmar, semRegra, obrasSoltas, foraDoPeriodo, aimi} — linhas as de
   fiscoLinhaNova, com rendas, retencoes, gastos:{<coluna>: euros}, obras24,
   anosAnteriores:[{ano, valor}], liquido, imposto (≥ 0), prejuizo e campo
   ('4001'…, '4501'…); fora: [{contratoId, nome, imovel, rendas, n, quota}];
   semContrato: [{propertyId, imovel, rendas, n, ids}]; totais: {rendas,
   retencoes, gastos, obras24, liquido, imposto, prejuizo, porTitular:
   {[titularId]: {liquido, imposto, prejuizo}}, anosAnteriores, isentos:{n,
   rendas, liquido}} — o imposto e o prejuízo, a soma dos de cada titular;
   aConfirmar: [{txId, nome, data, valor (o do movimento), propertyId, imovel,
   categoria, sub, origem}]; semRegra quantas delas são da omissão;
   obrasSoltas e foraDoPeriodo, n.º de despesas; aimi: fiscoAimi. */
function resumoFiscal(ano,eu,opcoes){
  ano=Number(ano)||YEAR;
  const quem=fiscoTitulares(eu,ano),tits=quem.ids;
  const A=String(ano),v=irsAno(ano),cols=v.colunas;
  /* a quota de um titular num imóvel ('' por inteiro: tudo); as partes de um
     imóvel, [[titular, quota]] dos titulares com quota; e a soma delas */
  const quotaDe=(p,o,data)=>fiscoQuota(p,o,data);
  const partes=(p,data)=>!tits.length?[['',1]]:tits.map(o=>[o,quotaDe(p,o,data)]).filter(x=>x[1]>0);
  const quotaCasa=(p,data)=>sum(partes(p,data).map(x=>x[1]));
  /* os imóveis da declaração: os onde algum titular tem quota no ano */
  const quotaNoAno=p=>!tits.length?1:sum(tits.map(o=>fiscoQuotaNoAno(p,o,ano)));
  /* um movimento sem imóvel é da conta que o registou (na nuvem vive nos
     registos dela): por inteiro para quem o recebeu ou pagou, se é um dos
     titulares, e para mim sem «pago por»; de outro, não é desta declaração */
  const partesSem=t=>!tits.length?[['',1]]:!t.paidBy?[[quem.eu,1]]:tits.indexOf(t.paidBy)>-1?[[t.paidBy,1]]:[];
  const base=pidProps(null).filter(p=>pode(p.id,'report.view')&&quotaNoAno(p)>0);
  const props={};base.forEach(p=>{props[p.id]=p});
  const noAno=t=>String(t.date||'').startsWith(A);
  const linhas={},fora={},semC={},resto={};
  /* as rendas fora das linhas, por imóvel e titular, já na quota dele */
  const sobra=(pid,o,valor)=>{if(pid){const k=pid+'|'+o;resto[k]=(resto[k]||0)+valor}};
  /* as rendas do ano, cada uma para a linha do seu contrato e de cada titular
     — ou para fora, ou para as sem contrato; estas duas pesam na repartição
     dos gastos (resto) */
  (db.transactions||[]).forEach(t=>{
    if(!ehRenda(t)||!noAno(t))return;
    const c=t.contractId?contract(t.contractId):null;
    const pid=(c&&c.propertyId)||t.propertyId||'';
    const p=props[pid];
    if(pid&&!p)return;                 // fora do âmbito: de outro dono, ou sem permissão
    const ps=p?partes(p,t.date):partesSem(t);
    if(!ps.length)return;              // sem imóvel e de outro: não é desta declaração
    const bruto=rendaBruta(t),q=sum(ps.map(x=>x[1])),bruta=bruto*q;
    if(!c){const s=semC[pid]||(semC[pid]={propertyId:pid||null,imovel:p?p.name:'Sem imóvel',rendas:0,n:0,ids:[]});
      s.rendas+=bruta;s.n++;s.ids.push(t.id);ps.forEach(x=>sobra(pid,x[0],bruto*x[1]));return}
    if(ctNaoDeclarado(c)){const f=fora[c.id]||(fora[c.id]={contratoId:c.id,nome:ctName(c),imovel:p?p.name:'',rendas:0,n:0,quota:q});
      f.rendas+=bruta;f.n++;ps.forEach(x=>sobra(pid,x[0],bruto*x[1]));return}
    const y=Number(String(t.periodo||'').slice(0,4));
    ps.forEach(([o,qo])=>{
      const k=c.id+'|'+o,l=linhas[k]||(linhas[k]=fiscoLinhaNova(c,p,qo,ano,o)),b=bruto*qo;
      l.rendas+=b;l.retencoes+=(Number(t.retencao)||0)*qo;
      if(y&&y<ano)l.anosAnteriores[y]=(l.anosAnteriores[y]||0)+b;
      if(!t.recibo&&ctDeclarado(c))l.recibosPorEmitir++;
    });
  });
  const L=Object.keys(linhas).map(k=>linhas[k]);
  /* as linhas de cada imóvel, por titular: cada um reparte a sua parte dos
     gastos pelas suas linhas */
  const porImovel={};L.forEach(l=>{if(l.propertyId){const k=l.propertyId+'|'+l.titularId;(porImovel[k]||(porImovel[k]=[])).push(l)}});
  /* as obras dos 24 meses, de qualquer ano: o que aqui entra fica marcado —
     por imóvel, porque um movimento de grupo pode ser obra num imóvel vago e
     gasto corrente noutro — para não voltar a entrar nas colunas normais, nem
     sequer quando a linha do contrato a que pertence não é deste ano. A obra
     entra na linha do contrato no ano em que ele COMEÇA, que é o que as
     instruções pedem, quando ele tem rendas (e linha) nesse ano — mesmo que a
     primeira renda tenha sido paga antes, na assinatura (D63). Só quando o
     ano do início não tem rendas (um contrato que começa em dezembro e recebe
     a primeira renda em janeiro) vai para o primeiro ano com rendas, para a
     obra não se perder nos dois */
  const anosComRenda={};
  (db.transactions||[]).forEach(t=>{
    if(!ehRenda(t)||!t.contractId)return;
    const y=String(t.date||'').slice(0,4);
    if(/^\d{4}$/.test(y))(anosComRenda[t.contractId]||(anosComRenda[t.contractId]={}))[y]=1;
  });
  const anoDasObras=id=>{
    const ys=anosComRenda[id];if(!ys)return '';
    const c=contract(id),y0=c&&/^\d{4}-/.test(String(c.start||''))?String(c.start).slice(0,4):'';
    return y0&&ys[y0]?y0:Object.keys(ys).sort()[0];
  };
  const consumidos={};
  (db.transactions||[]).forEach(t=>{
    if(t.kind!=='expense')return;
    const r=irsColunaDe(t)||{};if(r.col==='nao')return;
    const alvo=fiscoObra24De(t,r.col),pids=Object.keys(alvo);
    if(!pids.length)return;
    consumidos[t.id]=alvo;
    const d=String(t.date||'');
    pids.forEach(pid=>{
      const p=props[pid];if(!p)return;
      const w=txWeight(t,pid,false);if(!(w>0))return;
      partes(p,t.date).forEach(([o,qo])=>{
        const ls=alvo[pid].map(c=>linhas[c.id+'|'+o]).filter(l=>l&&anoDasObras(l.contratoId)===A);
        if(!ls.length)return;
        fiscoReparte(ls,(Number(t.amount)||0)*w*qo,(l,parte)=>{
          l.obras24.valor+=parte;
          if(!l.obras24.inicioGastos||d<l.obras24.inicioGastos)l.obras24.inicioGastos=d;
        });
      });
    });
  });
  /* os gastos do ano, por coluna, repartidos pelas linhas de cada imóvel. Um
     gasto pago com o imóvel sem contrato em vigor não entra (só o período
     arrendado conta; o IMI e o selo contam no ano em que o imóvel deu rendas)
     — salvo quando a coluna foi escolhida à mão no movimento: aí a pessoa
     decidiu, e manda. Uma despesa marcada à mão como obras24 sem contrato a
     começar depois não tem linha onde caia — conta-se, para o aviso dizer
     que ficou de fora.
     Uma despesa «a confirmar» (a coluna 'confirmar' do mapa, uma sem regra
     nenhuma — a omissão —, ou uma coluna que o ano não tem) não conta em
     coluna nenhuma: vai para aConfirmar, com o nome e o valor, se toca um
     imóvel da declaração com linha no ano (D61 e os gastos do D06/D07/D24–
     D27/D60). Na dúvida a app não deduz */
  let obrasSoltas=0,foraDoPeriodo=0;
  const aConfirmar=[];
  const pidsComLinha={};Object.keys(porImovel).forEach(k=>{pidsComLinha[porImovel[k][0].propertyId]=1});
  (db.transactions||[]).forEach(t=>{
    if(t.kind!=='expense'||!noAno(t))return;
    const r=irsColunaDe(t)||{};if(r.col==='nao')return;
    if(r.col!=='obras24'&&(r.origem==='omissao'||cols.indexOf(r.col)<0)){
      const toca=txProps(t).filter(p=>pidsComLinha[p.id]&&txWeight(t,p.id,false)>0);
      if(!toca.length)return;
      const p0=prop(t.propertyId)||toca[0];
      aConfirmar.push({txId:t.id,nome:t.label||[t.category,t.sub].filter(Boolean).join(' › ')||'Despesa',data:String(t.date||''),
        valor:r2(Number(t.amount)||0),propertyId:t.propertyId||null,imovel:t.propertyId?(p0?p0.name:''):toca.map(p=>p.name).join(', '),
        categoria:t.category||'',sub:t.sub||'',origem:r.origem||''});
      return;
    }
    const jaFoi=consumidos[t.id]||{},d=String(t.date||'');
    let entrou=false,vazio=false;
    Object.keys(porImovel).forEach(k=>{
      const ls=porImovel[k],pid=ls[0].propertyId,o=ls[0].titularId;
      if(jaFoi[pid])return;
      const w=txWeight(t,pid,false);if(!(w>0))return;
      if(r.col!=='obras24'&&!FISCO_SEM_PERIODO[r.col]&&r.origem!=='movimento'&&!fiscoHaviaContrato(pid,d)){vazio=true;return}
      entrou=true;
      if(r.col!=='obras24')fiscoReparte(ls,(Number(t.amount)||0)*w*quotaDe(props[pid],o,t.date),(l,parte)=>{l.gastos[r.col]+=parte},resto[k]);
    });
    if(vazio)foraDoPeriodo++;
    if(!entrou)return;
    if(r.col==='obras24')obrasSoltas++;
  });
  aConfirmar.sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:String(a.nome).localeCompare(String(b.nome),'pt'));
  const semRegra=aConfirmar.filter(x=>x.origem==='omissao').length;
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
    totais.rendas+=l.rendas;totais.retencoes+=l.retencoes;totais.obras24+=l.obras24.valor;
    totais.anosAnteriores+=sum(l.anosAnteriores.map(x=>x.valor));
    if(l.isencao){totais.isentos.n++;totais.isentos.rendas+=l.rendas;totais.isentos.liquido+=l.liquido}
    else totais.liquido+=l.liquido;
  });
  ['rendas','retencoes','obras24','liquido','anosAnteriores'].forEach(k=>{totais[k]=r2(totais[k])});
  totais.isentos.rendas=r2(totais.isentos.rendas);totais.isentos.liquido=r2(totais.isentos.liquido);
  cols.forEach(k=>{totais.gastos[k]=r2(totais.gastos[k])});
  /* o imposto e o prejuízo, titular a titular (CIRS art. 55.º): um resultado
     negativo não paga imposto, abate só aos positivos do mesmo titular e o
     resto reporta-se aos seis anos seguintes. O KPI e os totais dos quadros
     saem deste mesmo cálculo (a soma dos l.imposto) */
  totais.porTitular=fiscoImpostoPorTitular(L);
  const PT=Object.keys(totais.porTitular).map(k=>totais.porTitular[k]);
  totais.imposto=r2(sum(PT.map(x=>x.imposto)));totais.prejuizo=r2(sum(PT.map(x=>x.prejuizo)));
  const pt=(a,b)=>String(a).localeCompare(String(b),'pt');
  /* as duas linhas de um contrato dos dois cônjuges ficam juntas, a A primeiro */
  L.sort((a,b)=>pt(a.quadro,b.quadro)||pt(a.imovel,b.imovel)||pt(a.inicio,b.inicio)||pt(a.nome,b.nome)||pt(a.titular,b.titular));
  fiscoNumerarCampos(L,v);
  const F=Object.keys(fora).map(k=>fora[k]).map(f=>Object.assign(f,{rendas:r2(f.rendas)})).sort((a,b)=>pt(a.nome,b.nome));
  const S=Object.keys(semC).map(k=>semC[k]).map(s=>Object.assign(s,{rendas:r2(s.rendas)})).sort((a,b)=>pt(a.imovel,b.imovel));
  const donos={};L.forEach(l=>{donos[l.titularId]=1});
  const r={ano:ano,versao:v,colunas:cols,titularId:quem.eu,titulares:tits.slice(),porInteiro:quem.porInteiro,semSessao:quem.semSessao,
    variosTitulares:Object.keys(donos).length>1,imoveis:base.length,linhas:L,fora:F,semContrato:S,totais:totais,
    avisos:[],aConfirmar:aConfirmar,semRegra:semRegra,obrasSoltas:obrasSoltas,foraDoPeriodo:foraDoPeriodo,
    aimi:fiscoAimi(ano,t=>sum(partesSem(t).map(x=>x[1])),props,p=>quotaCasa(p,A+'-12-31'),L,totais.imposto)};
  r.avisos=fiscoAvisos(r);
  return r;
}
