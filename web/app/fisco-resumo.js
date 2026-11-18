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
   cônjuge, pela letra dele no Rosto (l.titular, que pode ser o A — D30), com
   linhas do cônjuge (a conjunta); a tua quota-parte, com
   alguma linha abaixo de 100 %; e nada quando é tudo teu.
   Recebe: r — o resumo (resumoFiscal); ls — as linhas do quadro.
   Devolve: o texto ('' quando é tudo teu). */
function fiscoParte(r,ls){
  if(r.porInteiro)return 'valores por inteiro';
  const meu=ls.some(l=>l.titularId===r.titularId),outras=ls.filter(l=>l.titularId!==r.titularId);
  if(outras.length){const t='titular '+(outras[0].titular||'B');return meu?'a tua parte e a do '+t:'a parte do '+t}
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
   paga nem abate). Uma linha com troços (uma renovação a meio do ano,
   rendas depois do termo — D41, D15) paga a taxa média deles, pesada pelas
   rendas (fiscoTaxaDaLinha): cada renda à taxa do troço do mês dela.
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
    ls.forEach(l=>{if(l.liquido>0)l.imposto=r2(l.liquido*fica*fiscoTaxaDaLinha(l)/100)});
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
/* O último dia em que um contrato viveu, para os gastos do período arrendado
   e para a cobertura dos meses: o dia da cessação (irs.js:irsCessacao, que o
   «Terminar» grava — o c.end é o termo e não muda, D02/D39); num terminado
   sem ela, o c.end (o «Terminar» antigo escrevia lá o dia — irs.js:
   irsFimReal); num que continua, nenhum: passado o termo sem a renovação
   registada ele continua em vigor, como no motor da taxa (irsSegmentosDoAno —
   a renovação automática, D15), e uma renovação escrita no bloco fiscal
   também o leva (D42). Um terminado sem data nenhuma não diz quando acabou, e
   não se adivinha.
   Recebe: c — o contrato.
   Devolve: 'AAAA-MM-DD'; '' sem fim (continua); null num terminado sem data. */
function fiscoFimDaVida(c){
  const d=irsCessacao(c).data;if(d)return d;
  if(c&&c.active===false)return c.end||null;
  return '';
}
/* Havia algum contrato do imóvel em vigor nesta data? É o que separa uma obra
   feita entre arrendamentos (dedutível nos 24 meses antes do seguinte) de uma
   reparação durante um, e um gasto do período arrendado de um gasto com o
   imóvel vazio. Conta qualquer contrato, declarado ou não, do início ao
   último dia em que viveu (fiscoFimDaVida): a cessação, e nunca o termo de um
   contrato que acabou antes dele (D02) nem o de um que se renovou (D42).
   Recebe: pid — o id do imóvel; d — a data 'AAAA-MM-DD'.
   Devolve: true se havia. */
function fiscoHaviaContrato(pid,d){
  return (db.contracts||[]).some(c=>{
    if(!c||c.propertyId!==pid||!c.start||c.start>d)return false;
    const f=fiscoFimDaVida(c);
    return f!==null&&(!f||f>=d);
  });
}
/* Os meses de um ano em que um contrato esteve em vigor e os que têm renda,
   pelo mês a que cada renda respeita (D04): de max(início, compra do imóvel,
   1 de janeiro) a min(o último dia em que viveu — fiscoFimDaVida —, a venda do
   imóvel, hoje, 31 de dezembro). Conta-se cada mês tocado (um contrato que
   começa a 20 de março conta março). Um terminado sem data nenhuma, ou sem
   início, não diz quando viveu: os meses em vigor ficam null, e as rendas
   contam-se no ano inteiro.
   Recebe: c — o contrato; p — o imóvel (pode faltar); ano — o ano (número);
   meses — {'AAAA-MM': 1} dos meses com renda do contrato (irsMesDaRenda).
   Devolve: {mesesEmVigor: n | null, mesesComRenda: n}. */
function fiscoCoberturaDoAno(c,p,ano,meses){
  const A=String(ano),fimV=fiscoFimDaVida(c),ms=Object.keys(meses||{});
  const conta=(de,ate)=>ms.filter(m=>m>=de&&m<=ate).length;
  if(!c.start||fimV===null)return {mesesEmVigor:null,mesesComRenda:conta(A+'-01',A+'-12')};
  let ini=A+'-01-01',fim=A+'-12-31';
  [c.start,p&&p.purchaseDate].forEach(x=>{if(x&&x>ini)ini=x});
  [fimV,p&&p.vendido,today()].forEach(x=>{if(x&&x<fim)fim=x});
  if(ini>fim)return {mesesEmVigor:0,mesesComRenda:0};
  const n=x=>Number(x.slice(0,4))*12+Number(x.slice(5,7));
  return {mesesEmVigor:n(fim)-n(ini)+1,mesesComRenda:conta(ini.slice(0,7),fim.slice(0,7))};
}
/* O troço da taxa a que vai uma renda (D41, D15): o último troço do ano que
   toca o mês a que ela respeita, a regra do irs.js:irsTaxaDaRenda (lida aqui
   dos troços já feitos: o motor por renda relia todos os movimentos). Uma
   renda de um mês de outro ano (a de dezembro paga em janeiro, uma
   antecipada) vai ao troço do ano do mesmo período do contrato; sem ele, ao
   primeiro troço do ano (se é de antes) ou ao último; e num ano em que o
   contrato não viveu, ao troço do mês dela. Sem nada, a taxa do ano
   (irsTaxa), num troço do ano inteiro.
   Recebe: c — o contrato; t — a renda; segs — irsSegmentosDoAno(c, ano); ano — o ano (número).
   Devolve: o troço ({de, ate, periodo, taxa, motivo, reducao, semRenovacao}). */
function fiscoTrocoDaRenda(c,t,segs,ano){
  const A=String(ano),m=irsMesDaRenda(t);
  if(m.slice(0,4)===A){
    const ini=m+'-01',fim=m+'-31',ss=segs.filter(s=>s.de<=fim&&s.ate>=ini);
    if(ss.length)return ss[ss.length-1];
  }
  const s=m.slice(0,4)===A?null:irsTaxaDaRenda(c,t);
  if(segs.length){
    if(s&&s.periodo!=null){const x=segs.find(g=>g.periodo===s.periodo);if(x)return x}
    return m<segs[0].de.slice(0,7)?segs[0]:segs[segs.length-1];
  }
  if(s)return s;
  const tx=irsTaxa(c,ano);
  return {de:A+'-01-01',ate:A+'-12-31',periodo:null,taxa:tx.taxa,motivo:tx.motivo,reducao:tx.reducao||null,semRenovacao:!!tx.semRenovacao};
}
/* A cessação de um contrato faz regularizar a redução (CIRS art. 72.º n.º
   20)? Só com um motivo que a versão do ano da cessação marca `regulariza`
   (irsAno(ano).quadro10.motivos — o 01, por motivo do senhorio, antes do
   prazo) — o código vive na versão, nunca aqui.
   Recebe: c — o contrato.
   Devolve: true ou false. */
function fiscoCessacaoRegulariza(c){
  const x=irsCessacao(c);if(!x.data||!x.motivo)return false;
  const q=irsAno(Number(x.data.slice(0,4))).quadro10,ms=q&&Array.isArray(q.motivos)?q.motivos:[];
  const m=ms.find(y=>y&&String(y.codigo)===x.motivo);
  return !!(m&&m.regulariza);
}
/* A taxa com que um troço com redução pela duração fica depois da
   regularização do n.º 20: a da duração efetivamente decorrida
   (irs.js:irsTaxaDecorrida), nunca acima da que o troço teria sem a redução
   (a base, ou a das rendas moderadas quando cabe — essa não se perde).
   Recebe: c — o contrato; ano — o ano do troço; dec — irsTaxaDecorrida(c).
   Devolve: a taxa (número). */
function fiscoTaxaRegularizada(c,ano,dec){
  return Math.min(dec.taxa,irsTaxaDoPeriodo(c,ano,-1).taxa);
}
/* A taxa média de uma linha, pesada pelas rendas de cada troço (l._trocos);
   sem troços, l.taxa. É a que o imposto da linha paga: cada renda à taxa do
   troço do mês a que respeita (D41).
   Recebe: l — a linha.
   Devolve: a taxa (número). */
function fiscoTaxaDaLinha(l){
  const ts=(l&&l._trocos)||[],R=sum(ts.map(s=>s.rendas));
  return R>0?sum(ts.map(s=>s.rendas*s.taxa))/R:Number(l&&l.taxa)||0;
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
/* O papel de cada receita lido uma vez por resumo: vive enquanto corre um
   resumoFiscal (e os dos anos anteriores que ele pede), e esvazia-se no fim —
   um movimento mudado depois lê-se de novo. */
let fiscoPapeis=null;
/* O papel de uma receita na Declaração (irs-papeis.js:irsReceitaDe — pelo id
   fixo das categorias, e não pelo nome: renomear as Rendas, ou pô-las fora
   dos totais, não as tira do Anexo F, D19), com a cache do resumo.
   Recebe: t — o movimento.
   Devolve: 'renda', 'caucao', 'indemnizacao', 'outra', 'reembolsoGasto',
   'fora', 'porClassificar', ou '' quando não é uma receita. */
function fiscoPapelDe(t){
  if(!t||t.kind!=='income')return '';
  if(fiscoPapeis&&fiscoPapeis.has(t))return fiscoPapeis.get(t);
  const p=irsReceitaDe(t).papel||'';
  if(fiscoPapeis)fiscoPapeis.set(t,p);
  return p;
}
/* As receitas que se declaram no Anexo F, e a linha a que vão: a renda, a
   caução (renda do ano em que se recebe, OC 20256 — D03) e o reembolso do
   inquilino na linha do contrato; a indemnização (natureza 05, D21) e as
   outras receitas prediais (natureza 02, D51) numa linha à parte do mesmo
   contrato. */
const FISCO_PAPEIS_DECLARAM={renda:'renda',caucao:'renda',indemnizacao:'indemnizacao',outra:'outra'};
/* A receita entra na linha principal do contrato (a renda, a caução, o
   reembolso do inquilino)? É o que conta para os anos com rendas de um
   contrato (as obras dos 24 meses, o quadro 10).
   Recebe: t — o movimento.
   Devolve: true ou false. */
function fiscoNaLinhaDoContrato(t){return FISCO_PAPEIS_DECLARAM[fiscoPapelDe(t)]==='renda'}
/* É a renda de um mês (o que conta para a cobertura dos meses, D04)? O papel
   'renda' fora dos Reembolsos: nem a caução, nem as indemnizações, nem um
   reembolso do inquilino enchem um mês.
   Recebe: t — o movimento.
   Devolve: true ou false. */
function fiscoRendaDoMes(t){
  return fiscoPapelDe(t)==='renda'&&catIrsId('catsIn',t.category)!=='reembolsos';
}
/* A categoria dos consumos (a água, a luz, o gás e a internet que o senhorio
   paga), pelo nome da regra do mapa: a AT só os aceita quando o contrato diz
   que a renda os inclui (o campo 30 da Modelo 2 — D26). Sem id fixo: uma
   categoria renomeada fica «a confirmar», que é o lado seguro. */
const FISCO_CONSUMOS='Água, luz e gás';
/* Há, nesta data, um contrato do imóvel em vigor cuja renda inclui os
   consumos (fisco.consumosIncluidos — D26)? Do início ao último dia em que
   viveu (fiscoFimDaVida); os não declarados não contam.
   Recebe: pid — o id do imóvel; d — a data 'AAAA-MM-DD'.
   Devolve: true ou false. */
function fiscoConsumosIncluidos(pid,d){
  return (db.contracts||[]).some(c=>{
    if(!c||c.propertyId!==pid||!c.start||c.start>d||ctNaoDeclarado(c)||fiscoDe(c).consumosIncluidos!==true)return false;
    const f=fiscoFimDaVida(c);
    return f!==null&&(!f||f>=d);
  });
}
/* A parte de uma nota de IMI própria (t.notaPropria — «é a minha nota», D32)
   que cabe a um titular: a nota inteira para quem a pagou, ou para quem
   declara quando ela não diz quem pagou; nada para os outros. Por inteiro
   (sem titular) conta uma vez. A quota não entra: a AT já a liquidou pela
   quota de quem a recebeu.
   Recebe: t — a despesa; o — o titular ('' por inteiro); eu — quem declara.
   Devolve: 1 ou 0. */
function fiscoParteDaNota(t,o,eu){
  if(!o)return 1;
  return (t.paidBy||eu)===o?1:0;
}
/* A linha de uma receita que não é a renda do contrato, mas é dele: a
   indemnização que compensa rendas (natureza 05, CIRS art. 8.º n.º 2 g) —
   D21) ou as outras receitas prediais, como a cedência de uso que não é
   arrendamento (natureza 02 — D51). Os códigos vêm da versão do ano
   (irsAno(ano).naturezas). Vai ao 4.1, à taxa base da finalidade do contrato
   (a da habitação, ou a do não habitacional), sem a redução pela duração nem
   a isenção do contrato, e não pede recibo — INCERTO: a lei dá as reduções
   e as isenções às rendas do contrato, e não diz se valem para estas.
   Recebe: c — o contrato; p — o imóvel; q — a quota-parte; ano — o ano;
   titularId — o titular da linha; papel — 'indemnizacao' ou 'outra'.
   Devolve: a linha (fiscoLinhaNova), com o papel, a natureza e a taxa dela. */
function fiscoLinhaDaReceita(c,p,q,ano,titularId,papel){
  const l=fiscoLinhaNova(c,p,q,ano,titularId),v=irsAno(ano),T=v.taxas||{},n=v.naturezas||{},nh=fiscoDe(c).finalidade==='nh';
  return Object.assign(l,{papel:papel,natureza:(papel==='indemnizacao'?n.indemnizacao:n.outras)||'',naturezaAssumida:false,
    quadro:v.quadros.semReducao,taxaReduzida:false,taxa:nh?T.naoHabitacional:T.habitacional,taxaEscrita:null,motivoTaxa:nh?'nh':'base',
    isencao:null,comunicado:'',comunicacao:null,bonus:false,elegivel24:false,atualizacao2023:null,
    datas:{inicio:c.start||'',fim:'',renovacaoInicio:'',renovacaoFim:''}});
}
/* Tira a uma linha uma devolução de renda (D53): baixa as rendas (nunca
   abaixo de zero), reparte a descida pelos troços da taxa na proporção das
   rendas de cada um, e a renda devolvida sem recibo deixa de pedir recibo —
   a de valor igual ao da devolução, se a houver.
   Recebe: l — a linha; parte — o que abate (euros); tr — os troços da linha
   ({chave: {seg, rendas}}); semRec — os valores das rendas da linha sem
   recibo; valor — o valor da devolução (o do movimento).
   Devolve: nada — muda a linha, os troços e a lista. */
function fiscoAbateDevolucao(l,parte,tr,semRec,valor){
  const ab=Math.max(0,Math.min(parte,l.rendas));if(!(ab>0))return;
  const R=l.rendas;l.rendas-=ab;l.devolucoes+=ab;
  if(tr){const f=R>0?(R-ab)/R:0;Object.keys(tr).forEach(k=>{tr[k].rendas*=f})}
  const i=semRec?semRec.findIndex(x=>Math.abs(x-valor)<0.005):-1;
  if(i>-1){semRec.splice(i,1);l.recibosPorEmitir=Math.max(0,l.recibosPorEmitir-1)}
}
/* Os meses de um ano em que um contrato viveu, de max(início, compra, 1 de
   janeiro) a min(o último dia em que viveu, a venda, hoje, 31 de dezembro) —
   a janela de fiscoCoberturaDoAno, mês a mês.
   Recebe: c — o contrato; p — o imóvel (pode faltar); ano — o ano (número).
   Devolve: ['AAAA-MM'], ou null quando não se sabe (sem início, ou terminado
   sem data nenhuma). */
function fiscoMesesDoContrato(c,p,ano){
  const A=String(ano),fimV=fiscoFimDaVida(c);
  if(!c||!c.start||fimV===null)return null;
  let ini=A+'-01-01',fim=A+'-12-31';
  [c.start,p&&p.purchaseDate].forEach(x=>{if(x&&x>ini)ini=x});
  [fimV,p&&p.vendido,today()].forEach(x=>{if(x&&x<fim)fim=x});
  const out=[];
  for(let m=ini.slice(0,7);m<=fim.slice(0,7);){
    out.push(m);
    const y=Number(m.slice(0,4)),n=Number(m.slice(5,7));
    m=n<12?y+'-'+String(n+1).padStart(2,'0'):(y+1)+'-01';
  }
  return out;
}
/* O quadro 5 do Anexo F — a sublocação (CIRS art. 8.º n.º 2 c), art. 41.º n.º
   6; D52): os contratos de um imóvel que a pessoa arrenda e subarrenda
   (p.subarrendamento.ativo) não vão ao 4.1 nem ao 4.2. Por contrato e
   titular: a renda recebida do subarrendatário (com a caução e os reembolsos
   dele), as retenções, a renda paga ao senhorio — a renda mensal do imóvel
   (subarrendamento.rendaMensal) nos meses em que algum subarrendamento dele
   viveu no ano, repartida pelos contratos na proporção da renda recebida e
   pela quota do titular — e o NIF do senhorio. O rendimento é a diferença,
   sem dedução nenhuma; paga a taxa base da finalidade — INCERTO: se a
   redução pela duração vale no subarrendamento a lei não o diz, e o quadro 5
   não tem onde a pôr. A natureza é a do quadro 5 da versão
   (irsAno(ano).quadro5.naturezas: habitacional ou não).
   Recebe: E — {chave: entrada} acumuladas no ciclo das rendas; ano — o ano;
   props — {id: imóvel}.
   Devolve: [{contratoId, nome, imovel, propertyId, titularId, titular,
   quota, natureza, inquilinos, nifSenhorio, rendaRecebida, retencoes,
   rendaPaga, liquido, taxa, imposto, prejuizo, faltas}], pelo imóvel, pelo
   nome e pelo titular — o imposto escreve-o o resumo. */
function fiscoQuadro5(E,ano,props){
  const es=Object.keys(E).map(k=>E[k]),v=irsAno(ano),T=v.taxas||{},n=((v.quadro5||{}).naturezas)||{};
  const porImovel={};es.forEach(e=>{(porImovel[e.propertyId]||(porImovel[e.propertyId]=[])).push(e)});
  Object.keys(porImovel).forEach(pid=>{
    const p=props[pid],sub=(p&&p.subarrendamento)||{},ls=porImovel[pid],meses={};
    ls.forEach(e=>{
      const c=contract(e.contratoId),ms=c?fiscoMesesDoContrato(c,p,ano):null;
      (ms||Object.keys(e._meses)).forEach(m=>{meses[m]=1});
    });
    const total=(Number(sub.rendaMensal)||0)*Object.keys(meses).length;
    const tits={};ls.forEach(e=>{(tits[e.titularId]||(tits[e.titularId]=[])).push(e)});
    Object.keys(tits).forEach(o=>{
      const xs=tits[o],R=sum(xs.map(e=>e.rendaRecebida));
      xs.forEach(e=>{e.rendaPaga=total*e.quota*(R>0?e.rendaRecebida/R:1/xs.length)});
    });
  });
  return es.map(e=>{
    const c=contract(e.contratoId),nh=c&&fiscoDe(c).finalidade==='nh',p=props[e.propertyId],sub=(p&&p.subarrendamento)||{},faltas=[];
    const nif=nifValido(sub.nifSenhorio);
    if(nif===null)faltas.push('NIF do senhorio');else if(nif===false)faltas.push('NIF do senhorio não bate certo');
    if(!(Number(sub.rendaMensal)>0))faltas.push('renda paga ao senhorio');
    if(!e.inquilinos.length)faltas.push('inquilino do contrato');
    e.inquilinos.forEach(t=>{const x=fiscoFaltaDoInquilino(t.nome,t.nif,t.pais);if(x)faltas.push(x)});
    const out={contratoId:e.contratoId,nome:e.nome,imovel:e.imovel,propertyId:e.propertyId,titularId:e.titularId,titular:e.titular,
      quota:e.quota,natureza:(nh?n.naoHabitacional:n.habitacional)||'',inquilinos:e.inquilinos,nifSenhorio:sub.nifSenhorio||'',
      rendaRecebida:r2(e.rendaRecebida),retencoes:r2(e.retencoes),rendaPaga:r2(e.rendaPaga),liquido:0,
      taxa:nh?T.naoHabitacional:T.habitacional,imposto:0,prejuizo:0,faltas:faltas};
    out.liquido=r2(out.rendaRecebida-out.rendaPaga);
    return out;
  }).sort((a,b)=>String(a.imovel).localeCompare(String(b.imovel),'pt')||String(a.nome).localeCompare(String(b.nome),'pt')||String(a.titular).localeCompare(String(b.titular),'pt'));
}
/* O que falta ao inquilino de uma linha (o 4.1/4.2 e o quadro 5) para a AT o
   identificar: o NIF português, ou — sem ele — o país de residência (D59). Um
   número que não é um NIF português num inquilino que mora fora de Portugal é
   o número fiscal do país dele: o NIF fica em branco e vai o país, por isso não
   é uma falta; num inquilino sem país (ou em Portugal), um NIF que não bate
   certo é.
   Recebe: nome — o nome do inquilino; nif — o NIF escrito; pais — o país de
   residência, em texto (pode vir vazio).
   Devolve: o texto da falta, ou '' sem falta. */
function fiscoFaltaDoInquilino(nome,nif,pais){
  const ok=nifValido(nif),pa=String(pais||'').trim(),fora=!!pa&&!/^portugal$/i.test(pa);
  if(ok===false)return fora?'':'NIF do inquilino '+nome+' não bate certo';
  if(ok===null&&!pa)return 'NIF ou país do inquilino '+nome;
  return '';
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
   A comunicação da duração do período de que dependem as rendas do ano
   (comunicacao: irs.js:irsComunicacaoDoAno, ou null — D01, D35); o facto do
   n.º 24 à parte da descida (elegivel24 mostra o 4.2B; bonus diz que a taxa
   desceu — D36); a resposta à atualização de 2023 nos contratos começados
   antes de 2022 (atualizacao2023: 'sim', 'nao', '' por responder, ou null
   quando não se aplica — D76). O resumo acerta depois a taxa, o quadro, o
   bonus e o elegivel24 pelos troços das rendas, e escreve os segmentos e a
   cobertura dos meses (resumoFiscal). A quota (q) é a do dia da primeira
   renda; quando as quotas mudaram a meio do ano, quotas diz cada uma
   (fiscoQuotasDoAno — cada movimento conta pela do seu dia), senão null.
   É a linha das rendas (papel 'renda': com a caução, caucao, e os
   reembolsos do inquilino, reembolsos; menos as devolucoes — D03, D20, D53).
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
  ts.forEach(t=>{const x=fiscoFaltaDoInquilino(t.name,t.nif,t.pais);if(x)faltas.push(x)});
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
    comunicado:irsComunicado(c,ano)||'',comunicacao:is?null:irsComunicacaoDoAno(c,ano),
    bonus:!!(tx.reducao&&tx.reducao.bonus),elegivel24:!!(tx.reducao&&tx.reducao.elegivel24),
    atualizacao2023:c.start&&c.start<'2022-01-01'?(f.atualizacao2023==='sim'||f.atualizacao2023==='nao'?f.atualizacao2023:''):null,
    renda:Number(c.rent)||0,rendaAnterior:Number(f.rendaAnterior)||0,
    contratoAnterior:ant?{id:ant.id,nome:ctName(ant),numero:fiscoDe(ant).numero}:null,
    celebracao:f.celebracao||c.start||'',acimaDoLimite:f.rendaAcimaDoLimite===true?true:f.rendaAcimaDoLimite===false?false:null,
    /* o termo do 4.2A é o do contrato inicial: com renovações, o c.end já é o
       da última, que vai na coluna dela */
    datas:{inicio:c.start||'',fim:(ps[0]&&ps[0].fim)||c.end||'',renovacaoInicio:ult?ult.inicio:'',renovacaoFim:ult?ult.fim:''},
    inquilinos:ts.map(t=>({id:t.id,nome:t.name,nif:t.nif||'',pais:t.pais||''})),
    papel:'renda',rendas:0,retencoes:0,caucao:0,reembolsos:0,devolucoes:0,
    gastos:g,obras24:{valor:0,inicioGastos:''},anosAnteriores:{},liquido:0,imposto:0,prejuizo:0,
    segmentos:null,mesesEmVigor:null,mesesComRenda:0,quotas:p?fiscoQuotasDoAno(p,titularId||'',ano):null,
    faltas:faltas,recibosPorEmitir:0};
}
/* As quotas de um titular num imóvel ao longo de um ano, quando mudaram a
   meio dele (saldos.js:quotasMudaramNoAno): cada renda e cada gasto já
   contam pela quota do seu dia (fiscoQuota), e a linha di-lo. Pelos dias em
   que as quotas podem mudar (1 de janeiro e o primeiro dia de cada período
   novo), sem repetir uma quota igual à de antes.
   Recebe: p — o imóvel; o — o titular ('' por inteiro); ano — o ano (número).
   Devolve: [{desde:'AAAA-MM-DD', quota (0 a 1)}] com mais do que uma, ou
   null quando a quota foi a mesma o ano inteiro. */
function fiscoQuotasDoAno(p,o,ano){
  if(!p||typeof quotasMudaramNoAno!=='function')return null;
  const A=String(ano),ms=quotasMudaramNoAno(p,A);if(!ms.length)return null;
  const out=[];
  [A+'-01-01'].concat(ms).forEach(d=>{
    const q=fiscoQuota(p,o,d),ult=out[out.length-1];
    if(!ult||Math.abs(ult.quota-q)>1e-9)out.push({desde:d,quota:q});
  });
  return out.length>1?out:null;
}
/* Os anos em que um contrato recebeu rendas (pela data do movimento — o ano
   em que se declaram): as receitas da linha dele (fiscoNaLinhaDoContrato —
   a renda, a caução, o reembolso do inquilino, pelo papel e não pelo nome).
   Recebe: c — o contrato.
   Devolve: [AAAA…] (números), do mais antigo ao mais recente. */
function fiscoAnosComRendaDe(c){
  const ys={};
  (db.transactions||[]).forEach(t=>{
    if(!t||!c||t.contractId!==c.id||!fiscoNaLinhaDoContrato(t))return;
    const y=Number(String(t.date||'').slice(0,4));if(y)ys[y]=1;
  });
  return Object.keys(ys).map(Number).sort((a,b)=>a-b);
}
/* O «ano de início do benefício» do quadro 10: o ano da primeira declaração
   em que as rendas do contrato tiveram o benefício (as instruções do Anexo
   F) — o primeiro ano com rendas e o mesmo regime (irsRegimeQuadro10);
   senão o primeiro com rendas e algum benefício; sem rendas nenhumas, o ano
   do início do contrato.
   Recebe: c — o contrato; regime — o código do regime ('01'…); ano — o ano da cessação.
   Devolve: o ano (número). */
function fiscoAnoInicioBeneficio(c,regime,ano){
  const ys=fiscoAnosComRendaDe(c).filter(y=>y<=ano);
  const igual=ys.find(y=>irsRegimeQuadro10(c,y)===regime);if(igual)return igual;
  const algum=ys.find(y=>irsRegimeQuadro10(c,y)!=='');if(algum)return algum;
  return Number(String(c.start||'').slice(0,4))||Number(ano);
}
/* Os contratos que acabaram no ano e tiveram redução de taxa ou isenção — o
   quadro 10 do Anexo F (D09): os do âmbito da declaração e não marcados como
   não declarados, com a cessação (irs.js:irsCessacao) nesse ano; sem ela, um
   terminado com o c.end no ano, e o motivo por dizer. O regime vem da versão
   (irs.js:irsRegimeQuadro10); sem benefício no ano, não vai ao quadro 10.
   Recebe: ano — o ano (número); props — {id: imóvel} da declaração.
   Devolve: [{contratoId, nome, imovel, regime, numero, anoInicioBeneficio,
   data, motivo}] — motivo o código ('' por dizer), pela data. */
function fiscoCessadosDoAno(ano,props){
  const A=String(ano),out=[];
  (db.contracts||[]).forEach(c=>{
    if(!c||!props[c.propertyId]||ctNaoDeclarado(c))return;
    const x=irsCessacao(c);let data=x.data,motivo=x.motivo;
    if(!data){if(c.active!==false||!c.end)return;data=c.end;motivo=''}
    if(data.slice(0,4)!==A)return;
    const regime=irsRegimeQuadro10(c,ano);if(!regime)return;
    out.push({contratoId:c.id,nome:ctName(c),imovel:props[c.propertyId].name||'',regime:regime,numero:fiscoDe(c).numero||'',
      anoInicioBeneficio:fiscoAnoInicioBeneficio(c,regime,ano),data:data,motivo:motivo});
  });
  return out.sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:String(a.nome).localeCompare(String(b.nome),'pt'));
}
/* A regularização do art. 72.º n.º 20 (D10): um contrato que acabou no ano
   antes do prazo por motivo do senhorio (fiscoCessacaoRegulariza) perde a
   redução do período em que acabou, desde o início dele — a taxa passa a ser
   a da duração efetivamente decorrida (irs.js:irsTaxaDecorrida). Os anos já
   entregues não se reescrevem: a diferença de cada ano anterior desse período
   estima-se aqui, para a declaração do ano da cessação, sem juros (a AT
   junta-os). Em cada ano, só os troços desse período com a taxa da duração:
   (taxa decorrida − taxa do troço) sobre o imposto que o troço pagou
   (fiscoTaxaRegularizada); os períodos anteriores, já cumpridos, não se
   tocam. Os anos leem-se dos resumos sem extras (nunca recursa).
   Recebe: ano — o ano da cessação (número); props — {id: imóvel} da
   declaração; anterior — (Y) → resumoFiscal(Y, eu, {semExtras:true}), em cache.
   Devolve: [{contratoId, nome, anos:[{ano, diferenca}], total}] — um por
   contrato com o motivo do n.º 20 e redução no período em que acabou; anos
   só os com diferença. */
function fiscoRegularizacoes(ano,props,anterior){
  const A=String(ano),out=[];
  (db.contracts||[]).forEach(c=>{
    if(!c||!props[c.propertyId]||ctNaoDeclarado(c))return;
    if(irsCessacao(c).data.slice(0,4)!==A||!fiscoCessacaoRegulariza(c))return;
    const dec=irsTaxaDecorrida(c);if(!dec||!irsReducaoDoPeriodo(c,ano,dec.periodo))return;
    const ys=fiscoAnosComRendaDe(c).filter(y=>y>=Number(String(dec.desde).slice(0,4))&&y<ano),anos=[];
    ys.forEach(Y=>{
      let d=0;
      (anterior(Y).linhas||[]).forEach(l=>{
        if(l.contratoId!==c.id)return;
        (l._trocos||[]).forEach(s=>{
          if(s.periodo!==dec.periodo||s.motivo!=='duracao'||!(s.taxa>0)||!(s.imposto>0))return;
          const nova=fiscoTaxaRegularizada(c,Y,dec);
          if(nova>s.taxa)d+=s.imposto*(nova-s.taxa)/s.taxa;
        });
      });
      if(r2(d)>0)anos.push({ano:Y,diferenca:r2(d)});
    });
    out.push({contratoId:c.id,nome:ctName(c),anos:anos,total:r2(sum(anos.map(a=>a.diferenca)))});
  });
  return out;
}
/* O prejuízo dos anos anteriores que abate ao imposto estimado (CIRS art.
   55.º n.º 1 b): o resultado negativo da categoria F reporta-se aos seis anos
   seguintes, titular a titular — confirmado no CIRS em vigor a 2026-11-17,
   redação da Lei 12/2022 para os rendimentos desde 2023; Q10/D73, decisão do
   Martinho). Com o que a app sabe: o prejuízo de cada titular em cada ano
   anterior (os resumos sem extras), consumido pela ordem — o mais antigo
   primeiro — pelos líquidos positivos dos anos seguintes; o que sobra dos
   seis anos abate ao líquido positivo deste ano, nunca ao de outro titular.
   Contam os anos até doze para trás (os seis da janela e os que ainda podiam
   consumir os prejuízos de antes dela), e só os que têm rendas (sem elas não
   há linha, nem resultado). O n.º 8 (o reporte cai se os prédios não derem
   rendas 36 meses, seguidos ou não, nos cinco anos seguintes aos gastos) só
   se sabe depois: não se aplica aqui, e o aviso di-lo. O abate reparte-se
   pelas linhas positivas do titular na proporção do líquido, cada parte à
   taxa da sua linha (o método do fiscoImpostoPorTitular).
   Recebe: ano — o ano (número); porTitular — totais.porTitular deste ano;
   L — as linhas deste ano (com o imposto); anterior — (Y) → resumo sem extras.
   Devolve: {porTitular: {[titularId]: {anos:[{ano, prejuizo, usado}], usado,
   resto, imposto}}, usado, imposto, anosSemDados:[AAAA…]} — prejuizo o que
   desse ano ainda havia por reportar no início deste; usado o que abate
   agora (≤ o líquido positivo); resto o que fica para os anos seguintes;
   imposto quanto o imposto estimado desce; anosSemDados os anos da janela sem
   nenhum movimento nem contrato na app. */
function fiscoReporte(ano,porTitular,L,anterior){
  const J=6,ini=ano-2*J,comRendas={},comDados={};
  (db.transactions||[]).forEach(t=>{
    const y=Number(String((t&&t.date)||'').slice(0,4));if(!(y>=ini&&y<ano))return;
    comDados[y]=1;if(FISCO_PAPEIS_DECLARAM[fiscoPapelDe(t)])comRendas[y]=1;
  });
  (db.contracts||[]).forEach(c=>{
    if(!c||!c.start)return;
    const f=fiscoFimDaVida(c);
    for(let y=ano-J;y<ano;y++)if(c.start<=y+'-12-31'&&(!f||f>=y+'-01-01'))comDados[y]=1;
  });
  /* por titular, os prejuízos por reportar, pela ordem dos anos */
  const fila={};
  Object.keys(comRendas).map(Number).sort((a,b)=>a-b).forEach(Y=>{
    const pt=((anterior(Y)||{}).totais||{}).porTitular||{};
    Object.keys(pt).forEach(k=>{
      const q=fila[k]||(fila[k]=[]),x=pt[k];
      let pos=Number(x.liquido)||0;
      q.forEach(i=>{if(pos>0&&i.ano>=Y-J&&i.resto>0){const u=Math.min(i.resto,pos);i.resto-=u;pos-=u}});
      if(Number(x.prejuizo)>0)q.push({ano:Y,resto:Number(x.prejuizo)});
    });
  });
  const porT={};let usadoT=0,impostoT=0;
  Object.keys(fila).forEach(k=>{
    const q=fila[k].filter(i=>i.ano>=ano-J&&r2(i.resto)>0);if(!q.length)return;
    let pos=Math.max(0,Number((porTitular[k]||{}).liquido)||0);
    const anos=q.map(i=>{const u=Math.min(i.resto,pos);pos-=u;return {ano:i.ano,prejuizo:r2(i.resto),usado:r2(u)}});
    const usado=r2(sum(anos.map(a=>a.usado)));
    const resto=r2(sum(anos.filter(a=>a.ano>ano-J).map(a=>a.prejuizo-a.usado)));
    const ls=L.filter(l=>(l.titularId||'')===k&&!l.isencao&&l.liquido>0),P=sum(ls.map(l=>l.liquido));
    const desce=P>0?sum(ls.map(l=>l.liquido*Math.min(1,usado/P)*fiscoTaxaDaLinha(l)/100)):0;
    const imposto=r2(Math.min(desce,sum(ls.map(l=>l.imposto))));
    porT[k]={anos:anos,usado:usado,resto:resto,imposto:imposto};
    usadoT+=usado;impostoT+=imposto;
  });
  const sem=[];for(let y=ano-J;y<ano;y++)if(!comDados[y])sem.push(y);
  return {porTitular:porT,usado:r2(usadoT),imposto:r2(impostoT),anosSemDados:sem};
}
/* Os contratos vivos no ano sem nenhuma renda recebida nele (D04): hoje nem
   têm linha. Os do âmbito da declaração, não marcados como não declarados,
   com meses em vigor no ano (fiscoCoberturaDoAno) e sem linha.
   Recebe: ano — o ano (número); props — {id: imóvel}; L — as linhas;
   mesesDe — {contractId: {'AAAA-MM': 1}} dos meses com renda.
   Devolve: [{contratoId, nome, imovel, propertyId, mesesEmVigor,
   mesesComRenda}] — mesesComRenda conta as rendas do ano pagas noutro (a de
   dezembro paga em janeiro). */
function fiscoSemRendasDoAno(ano,props,L,mesesDe){
  const com={};L.forEach(l=>{com[l.contratoId]=1});
  return (db.contracts||[]).filter(c=>c&&!com[c.id]&&props[c.propertyId]&&!ctNaoDeclarado(c)).map(c=>{
    const p=props[c.propertyId],cob=fiscoCoberturaDoAno(c,p,ano,mesesDe[c.id]);
    return {contratoId:c.id,nome:ctName(c),imovel:p.name||'',propertyId:c.propertyId,mesesEmVigor:cob.mesesEmVigor,mesesComRenda:cob.mesesComRenda};
  }).filter(x=>x.mesesEmVigor>0).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt'));
}
/* O resumo do Anexo F de um ano — a função pura por trás da página, do texto e
   do CSV. Uma linha por contrato não marcado como não declarado com rendas no
   ano e por titular com quota no imóvel (fiscoTitulares: eu e, em conjunta, o
   cônjuge; cada movimento pela quota do seu dia), e mais uma por natureza
   quando o contrato tem indemnizações (05) ou outras receitas prediais (02);
   as receitas escolhem-se pelo papel (irs-papeis.js:irsReceitaDe, pelo id das
   categorias — D19), com a caução e os reembolsos do inquilino na linha das
   rendas (D03, D20) e as devoluções de renda a abater-lhe (D53); os não
   declarados vão a «fora», as rendas sem contrato a «semContrato», os
   contratos de um imóvel subarrendado ao quadro 5 (D52). Os gastos do ano
   pela coluna do irsColunaDe, com o peso (txWeight) e a quota, só no período
   arrendado (fiscoHaviaContrato; o IMI e o selo sempre), repartidos pelas
   rendas (fiscoReparte); as obras dos 24 meses (fiscoObra24De) no ano do
   início; as «a confirmar» não contam (aConfirmar). Cada renda paga a taxa da
   lei do troço do mês a que respeita (fiscoTrocoDaRenda — D41, D15), e o
   imposto sai titular a titular (fiscoImpostoPorTitular). Os contratos com
   benefício que acabaram vão ao quadro 10 (D09), os do n.º 20 à regularização
   (D10), e o prejuízo dos anos anteriores abate pelo reporte (D73). Um
   movimento sem imóvel é de quem o registou; sem saber quem és, tudo por
   inteiro. O que a app não conta sozinha diz-se para os avisos (D05, D19,
   D20, D21, D28, D51, D65, D68). A forma de cada campo está no miolo
   (fiscoResumoDoAno); aqui abre-se a cache dos papéis das receitas.
   Recebe: ano — o ano (número ou texto); eu (opcional) — o id de quem declara
   ('' por inteiro; omitido, o da sessão); opcoes (opcional) — {semExtras:true}:
   sem regularização, reporte nem avisos (o que os anos anteriores dão a este).
   Devolve: {ano, versao, colunas, titularId, titulares, porInteiro, semSessao,
   variosTitulares, imoveis, linhas, fora, semContrato, totais, avisos,
   aConfirmar, semRegra, obrasSoltas, foraDoPeriodo, aimi, semRegrasDoAno,
   cessados, regularizacoes, reporte, contratosSemRendas, quadro5,
   obrasPorConfirmar, foraPorEscolha, semImovel, porClassificar,
   reembolsosGasto, seguroDeRenda, rendasForaDosTotais}. */
function resumoFiscal(ano,eu,opcoes){
  const dono=!fiscoPapeis;if(dono)fiscoPapeis=new Map();
  try{return fiscoResumoDoAno(ano,eu,opcoes)}finally{if(dono)fiscoPapeis=null}
}
/* O miolo do resumoFiscal, com a cache dos papéis das receitas já aberta.
   Recebe: ano, eu, opcoes — os do resumoFiscal.
   Devolve: o resumo — linhas as de fiscoLinhaNova (papel 'renda') e
   fiscoLinhaDaReceita (papel 'indemnizacao' ou 'outra'), com rendas,
   retencoes, caucao, reembolsos, devolucoes, gastos {coluna: euros}, obras24,
   anosAnteriores [{ano, valor, retencoes}], liquido, imposto (≥ 0), prejuizo,
   campo, comunicacao, segmentos ([{de, ate, taxa, motivo, reducao,
   semRenovacao, rendas, imposto[, regulariza, taxaAntes]}] ou null),
   elegivel24, bonus, atualizacao2023, quotas, mesesEmVigor (ou null) e
   mesesComRenda; totais {rendas, retencoes (as das linhas e as do quadro 5),
   gastos, obras24, liquido, imposto (a soma das linhas e do quadro 5),
   prejuizo, porTitular, anosAnteriores, isentos, regularizacao,
   impostoDepoisDoReporte (= max(0, imposto − reporte.imposto)), quadro5 {n,
   rendaRecebida, rendaPaga, liquido, retencoes, imposto}}; semRegrasDoAno — o
   ano é antes da primeira versão (D50); cessados (fiscoCessadosDoAno),
   regularizacoes (fiscoRegularizacoes; [] sem extras), reporte (fiscoReporte;
   null sem extras), contratosSemRendas (fiscoSemRendasDoAno), quadro5
   (fiscoQuadro5); obrasPorConfirmar [{contratoId, nome, imovel, valor,
   inicioGastos, resposta: null | false}] (D28); foraPorEscolha (D65) e
   semImovel (D68) [{txId, nome, data, valor, col, …}]; porClassificar
   [{txId, nome, valor, propertyId, data, contratoId, categoria, sub}] (D05,
   D51); reembolsosGasto [{txId, nome, valor, propertyId, data, tipo:
   'condominio' | 'seguro', sub, abatido}] (D20); seguroDeRenda [{txId, nome,
   valor, propertyId, data}] (D21); rendasForaDosTotais {n, valor} (D19). */
function fiscoResumoDoAno(ano,eu,opcoes){
  ano=Number(ano)||YEAR;
  const quem=fiscoTitulares(eu,ano),tits=quem.ids;
  const A=String(ano),v=irsAno(ano),cols=v.colunas;
  /* a quota de um titular num imóvel na data ('' por inteiro: a casa menos a
     dos donos fora da app nesse dia — fiscoQuota); as partes de um imóvel,
     [[titular, quota]] dos titulares com quota; e a soma delas */
  const quotaDe=(p,o,data)=>fiscoQuota(p,o,data);
  const quem0=tits.length?tits:[''];
  const partes=(p,data)=>quem0.map(o=>[o,quotaDe(p,o,data)]).filter(x=>x[1]>0);
  const quotaCasa=(p,data)=>sum(partes(p,data).map(x=>x[1]));
  /* os imóveis da declaração: os onde algum titular tem quota no ano (uma
     casa vendida antes do ano já não entra — fiscoQuotaNoAno) */
  const quotaNoAno=p=>sum(quem0.map(o=>fiscoQuotaNoAno(p,o,ano)));
  /* um movimento sem imóvel é da conta que o registou (na nuvem vive nos
     registos dela): por inteiro para quem o recebeu ou pagou, se é um dos
     titulares, e para mim sem «pago por»; de outro, não é desta declaração */
  const partesSem=t=>!tits.length?[['',1]]:!t.paidBy?[[quem.eu,1]]:tits.indexOf(t.paidBy)>-1?[[t.paidBy,1]]:[];
  const base=pidProps(null).filter(p=>pode(p.id,'report.view')&&quotaNoAno(p)>0);
  const props={};base.forEach(p=>{props[p.id]=p});
  const noAno=t=>String(t.date||'').startsWith(A);
  const linhas={},fora={},semC={},resto={},segsDe={},trocosDe={},semRecibo={},sub5={};
  /* as rendas fora das linhas, por imóvel e titular, já na quota dele */
  const sobra=(pid,o,valor)=>{if(pid){const k=pid+'|'+o;resto[k]=(resto[k]||0)+valor}};
  /* um imóvel que a pessoa arrenda e subarrenda: os contratos dele vão ao
     quadro 5, sem gastos (D52) */
  const sublocado=p=>!!(p&&p.subarrendamento&&p.subarrendamento.ativo);
  /* os imóveis da declaração que uma receita toca: o do contrato, o dela, ou
     os do grupo / de «Todos» */
  const dosProps=(t,c)=>{const pid=(c&&c.propertyId)||t.propertyId;return pid?(props[pid]?[props[pid]]:[]):txProps(t).filter(p=>props[p.id])};
  /* os imóveis com seguro de renda («Seguros › Renda garantida») no ano: um
     reembolso do seguro neles pode ser a indemnização das rendas (D21) */
  const comSeguroDeRenda={};
  (db.transactions||[]).forEach(t=>{
    if(t&&t.kind==='expense'&&noAno(t)&&t.category==='Seguros'&&t.sub==='Renda garantida')txProps(t).forEach(p=>{comSeguroDeRenda[p.id]=1});
  });
  const porClassificar=[],reembolsosGasto=[],seguroDeRenda=[],reembCondominio=[],foraDosTotais={n:0,valor:0};
  /* as receitas do ano pelo papel de cada uma (irs-papeis.js:irsReceitaDe —
     pelo id das categorias, nunca pelo nome; o «Fora dos totais» nas Rendas
     não as tira, D19): a renda, a caução (D03) e o reembolso do inquilino
     (D20) para a linha do seu contrato e de cada titular; a indemnização e as
     outras receitas prediais para uma linha à parte do mesmo contrato (D21,
     D51); num imóvel subarrendado, para o quadro 5 (D52) — ou para fora, ou
     para as sem contrato; estas duas pesam na repartição dos gastos (resto).
     O reembolso de um gasto (o do condomínio sem contrato, o do seguro) e as
     receitas por classificar só se apontam (D05, D20, D21, D51) */
  (db.transactions||[]).forEach(t=>{
    if(!t||t.kind!=='income'||!noAno(t))return;
    const papel=fiscoPapelDe(t),linha=FISCO_PAPEIS_DECLARAM[papel];
    const c=t.contractId?contract(t.contractId):null;
    if(papel==='porClassificar'||papel==='reembolsoGasto'){
      const ps=dosProps(t,c);if(!ps.length)return;
      const nome=t.label||[t.category,t.sub].filter(Boolean).join(' › ')||'Receita',valor=r2(rendaBruta(t));
      const e={txId:t.id,nome:nome,valor:valor,propertyId:ps.length===1?ps[0].id:(t.propertyId||null),data:String(t.date||'')};
      if(papel==='porClassificar'){porClassificar.push(Object.assign(e,{contratoId:c?c.id:null,categoria:t.category||'',sub:t.sub||''}));return}
      const tipo=catIrsId('catsIn',t.category,t.sub)==='reembolsos/condominio'?'condominio':'seguro';
      if(tipo==='seguro'&&ps.some(p=>comSeguroDeRenda[p.id])){seguroDeRenda.push(e);return}
      const x=Object.assign(e,{tipo:tipo,sub:t.sub||'',abatido:0});reembolsosGasto.push(x);
      if(tipo==='condominio')reembCondominio.push({t:t,e:x});
      return;
    }
    if(!linha)return;
    const pid=(c&&c.propertyId)||t.propertyId||'';
    const p=props[pid];
    if(pid&&!p)return;                 // fora do âmbito: de outro dono, ou sem permissão
    const ps=p?partes(p,t.date):partesSem(t);
    if(!ps.length)return;              // sem imóvel e de outro: não é desta declaração
    const bruto=rendaBruta(t),q=sum(ps.map(x=>x[1])),bruta=bruto*q;
    /* uma renda numa categoria «Fora dos totais» continua a declarar-se (D19) */
    const exc=()=>{if(isExc(t.kind,t.category,t.sub)){foraDosTotais.n++;foraDosTotais.valor+=bruta}};
    if(!c){const s=semC[pid]||(semC[pid]={propertyId:pid||null,imovel:p?p.name:'Sem imóvel',rendas:0,n:0,ids:[]});
      s.rendas+=bruta;s.n++;s.ids.push(t.id);ps.forEach(x=>sobra(pid,x[0],bruto*x[1]));exc();return}
    if(ctNaoDeclarado(c)){const f=fora[c.id]||(fora[c.id]={contratoId:c.id,nome:ctName(c),imovel:p?p.name:'',rendas:0,n:0,quota:q});
      f.rendas+=bruta;f.n++;ps.forEach(x=>sobra(pid,x[0],bruto*x[1]));return}
    exc();
    if(sublocado(p)){
      ps.forEach(([o,qo])=>{
        const k=c.id+'|'+o,e=sub5[k]||(sub5[k]={contratoId:c.id,nome:ctName(c),imovel:p.name||'',propertyId:p.id,titularId:o,
          titular:fiscoTitularDe(p,o,ano),quota:qo,inquilinos:ctTenants(c).map(x=>({id:x.id,nome:x.name,nif:x.nif||'',pais:x.pais||''})),
          rendaRecebida:0,retencoes:0,rendaPaga:0,_meses:{}});
        e.rendaRecebida+=bruto*qo;e.retencoes+=(Number(t.retencao)||0)*qo;
        if(fiscoRendaDoMes(t))e._meses[irsMesDaRenda(t)]=1;
      });
      return;
    }
    const y=Number(String(t.periodo||'').slice(0,4));
    if(linha!=='renda'){
      ps.forEach(([o,qo])=>{
        const k=c.id+'|'+o+'|'+linha,l=linhas[k]||(linhas[k]=fiscoLinhaDaReceita(c,p,qo,ano,o,linha)),b=bruto*qo,ret=(Number(t.retencao)||0)*qo;
        l.rendas+=b;l.retencoes+=ret;
        if(y&&y<ano){const a=l.anosAnteriores[y]||(l.anosAnteriores[y]={valor:0,retencoes:0});a.valor+=b;a.retencoes+=ret}
      });
      return;
    }
    /* o troço da taxa do mês a que a renda respeita (D41, D15) */
    const segs=segsDe[c.id]||(segsDe[c.id]=irsSegmentosDoAno(c,ano)),s=fiscoTrocoDaRenda(c,t,segs,ano),sk=s.de+'|'+s.ate;
    const reemb=catIrsId('catsIn',t.category)==='reembolsos';
    ps.forEach(([o,qo])=>{
      const k=c.id+'|'+o,l=linhas[k]||(linhas[k]=fiscoLinhaNova(c,p,qo,ano,o)),b=bruto*qo,ret=(Number(t.retencao)||0)*qo;
      l.rendas+=b;l.retencoes+=ret;
      if(papel==='caucao')l.caucao+=b;else if(reemb)l.reembolsos+=b;
      if(y&&y<ano){const a=l.anosAnteriores[y]||(l.anosAnteriores[y]={valor:0,retencoes:0});a.valor+=b;a.retencoes+=ret}
      /* a renda, a caução e o reembolso do inquilino pedem recibo (CIRS art. 115.º n.º 5 a)) */
      if(!t.recibo&&ctDeclarado(c)){l.recibosPorEmitir++;(semRecibo[k]||(semRecibo[k]=[])).push(Number(t.amount)||0)}
      const tr=trocosDe[k]||(trocosDe[k]={}),x=tr[sk]||(tr[sk]={seg:s,rendas:0});x.rendas+=b;
    });
  });
  /* a devolução de uma renda (Devoluções ao inquilino › Devolução de renda,
     D53) abate às rendas da linha do contrato a que está ligada — sem
     contrato, às linhas das rendas do imóvel, na proporção delas — e nunca é
     gasto, mesmo com uma coluna escolhida à mão (o ciclo dos gastos salta-a).
     Num imóvel subarrendado abate à renda recebida do quadro 5 */
  (db.transactions||[]).forEach(t=>{
    if(!t||!noAno(t)||!irsDevolucaoDeRenda(t))return;
    const c=t.contractId?contract(t.contractId):null,valor=Number(t.amount)||0;
    (c?(props[c.propertyId]?[props[c.propertyId]]:[]):txProps(t).filter(p=>props[p.id])).forEach(p=>{
      const w=c?1:txWeight(t,p.id,false);if(!(w>0))return;
      partes(p,t.date).forEach(([o,qo])=>{
        const parte=valor*w*qo;
        if(sublocado(p)){
          const es=Object.keys(sub5).map(k=>sub5[k]).filter(e=>e.propertyId===p.id&&e.titularId===o&&(!c||e.contratoId===c.id));
          const R=sum(es.map(e=>e.rendaRecebida));
          es.forEach(e=>{e.rendaRecebida=Math.max(0,e.rendaRecebida-parte*(R>0?e.rendaRecebida/R:1/es.length))});
          return;
        }
        const ks=Object.keys(linhas).filter(k=>{const l=linhas[k];return l.papel==='renda'&&l.titularId===o&&(c?l.contratoId===c.id:l.propertyId===p.id)});
        if(!ks.length)return;
        fiscoReparte(ks.map(k=>linhas[k]),parte,(l,x)=>{const k=l.contratoId+'|'+o;fiscoAbateDevolucao(l,x,trocosDe[k],semRecibo[k],valor)});
      });
    });
  });
  const L=Object.keys(linhas).map(k=>linhas[k]);
  const Q5=fiscoQuadro5(sub5,ano,props);
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
    if(!t||!t.contractId||!fiscoNaLinhaDoContrato(t))return;
    const y=String(t.date||'').slice(0,4);
    if(/^\d{4}$/.test(y))(anosComRenda[t.contractId]||(anosComRenda[t.contractId]={}))[y]=1;
  });
  const anoDasObras=id=>{
    const ys=anosComRenda[id];if(!ys)return '';
    const c=contract(id),y0=c&&/^\d{4}-/.test(String(c.start||''))?String(c.start).slice(0,4):'';
    return y0&&ys[y0]?y0:Object.keys(ys).sort()[0];
  };
  /* A lei só as deixa deduzir se, entretanto, o imóvel não teve outro uso
     que não o arrendamento (CIRS art. 41.º n.º 7; PIV 26713 — D28): só
     entram com a pergunta do contrato respondida «sim»
     (fisco.obrasSemOutroUso === true). Por responder, ou com «não», ficam
     fora, em obrasPorConfirmar (resposta null ou false), e não passam às
     colunas normais — uma obra com a casa vazia não é gasto corrente */
  const consumidos={},obrasPC={};
  (db.transactions||[]).forEach(t=>{
    if(t.kind!=='expense'||irsDevolucaoDeRenda(t))return;
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
          const sim=fiscoDe(contract(l.contratoId)).obrasSemOutroUso;
          const o24=sim===true?l.obras24:(obrasPC[l.contratoId]||(obrasPC[l.contratoId]={contratoId:l.contratoId,nome:l.nome,imovel:l.imovel,
            valor:0,inicioGastos:'',resposta:sim===false?false:null}));
          o24.valor+=parte;
          if(!o24.inicioGastos||d<o24.inicioGastos)o24.inicioGastos=d;
        });
      });
    });
  });
  const obrasPorConfirmar=Object.keys(obrasPC).map(k=>obrasPC[k]).map(x=>Object.assign(x,{valor:r2(x.valor)}))
    .filter(x=>x.valor>0).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt'));
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
     D27/D60). Na dúvida a app não deduz.
     Os consumos (Água, luz e gás) a confirmar contam em Outros quando um
     contrato em vigor no imóvel nesse dia diz que a renda os inclui (D26). A
     nota de IMI própria conta inteira para quem a pagou, sem quota (D32). A
     devolução da caução é gasto do ano em que se devolve, mesmo uns dias
     depois do fim do contrato (OC 20256 — D03); a devolução de uma renda
     nunca é gasto (abate às rendas, D53). Uma despesa da casa vazia que conta
     por ter a coluna escolhida à mão diz-se em foraPorEscolha (D65); uma sem
     imóvel nenhum, de quem declara, com coluna dedutível ou a confirmar, em
     semImovel (D68) */
  let obrasSoltas=0,foraDoPeriodo=0;
  const aConfirmar=[],foraPorEscolha=[],semImovel=[];
  const pidsComLinha={};Object.keys(porImovel).forEach(k=>{pidsComLinha[porImovel[k][0].propertyId]=1});
  (db.transactions||[]).forEach(t=>{
    if(t.kind!=='expense'||!noAno(t)||irsDevolucaoDeRenda(t))return;
    let r=irsColunaDe(t)||{};if(r.col==='nao')return;
    const nome=t.label||[t.category,t.sub].filter(Boolean).join(' › ')||'Despesa',d=String(t.date||'');
    if(!txProps(t).length){
      if(partesSem(t).length)semImovel.push({txId:t.id,nome:nome,data:d,valor:r2(Number(t.amount)||0),col:r.col,categoria:t.category||'',sub:t.sub||''});
      return;
    }
    /* os consumos que a renda inclui, só nos imóveis onde a inclui */
    let soEm=null;
    if(r.col==='confirmar'&&r.origem!=='movimento'&&String(t.category||'').trim()===FISCO_CONSUMOS){
      const com=txProps(t).filter(p=>props[p.id]&&fiscoConsumosIncluidos(p.id,d));
      if(com.length){r={col:'outros',origem:'consumos'};soEm={};com.forEach(p=>{soEm[p.id]=1})}
    }
    if(r.col!=='obras24'&&(r.origem==='omissao'||cols.indexOf(r.col)<0)){
      const toca=txProps(t).filter(p=>pidsComLinha[p.id]&&txWeight(t,p.id,false)>0);
      if(!toca.length)return;
      const p0=prop(t.propertyId)||toca[0];
      aConfirmar.push({txId:t.id,nome:nome,data:d,
        valor:r2(Number(t.amount)||0),propertyId:t.propertyId||null,imovel:t.propertyId?(p0?p0.name:''):toca.map(p=>p.name).join(', '),
        categoria:t.category||'',sub:t.sub||'',origem:r.origem||''});
      return;
    }
    const jaFoi=consumidos[t.id]||{};
    const semPeriodo=r.col==='obras24'||!!FISCO_SEM_PERIODO[r.col]||catIrsId('cats',t.category,t.sub)==='devolucoes/caucao';
    const nota=r.col==='imi'&&t.notaPropria===true;
    let entrou=false,vazio=false,porEscolha=false;
    Object.keys(porImovel).forEach(k=>{
      const ls=porImovel[k],pid=ls[0].propertyId,o=ls[0].titularId;
      if(jaFoi[pid]||(soEm&&!soEm[pid]))return;
      const w=txWeight(t,pid,false);if(!(w>0))return;
      if(!semPeriodo&&!fiscoHaviaContrato(pid,d)){
        if(r.origem!=='movimento'){vazio=true;return}
        porEscolha=true;
      }
      entrou=true;
      const q=nota?fiscoParteDaNota(t,o,quem.eu):quotaDe(props[pid],o,t.date);
      if(r.col!=='obras24')fiscoReparte(ls,(Number(t.amount)||0)*w*q,(l,parte)=>{l.gastos[r.col]+=parte},resto[k]);
    });
    if(vazio)foraDoPeriodo++;
    if(!entrou)return;
    if(porEscolha)foraPorEscolha.push({txId:t.id,nome:nome,data:d,valor:r2(Number(t.amount)||0),propertyId:t.propertyId||null,col:r.col});
    if(r.col==='obras24')obrasSoltas++;
  });
  /* o reembolso do condomínio sem contrato abate ao gasto do condomínio do
     imóvel no ano (Q7 — D20), na quota de cada titular, sem o deixar
     negativo; o que abateu diz-se em reembolsosGasto[].abatido */
  if(cols.indexOf('condominio')>-1)reembCondominio.forEach(({t,e})=>{
    let ab=0;
    Object.keys(porImovel).forEach(k=>{
      const ls=porImovel[k],pid=ls[0].propertyId,o=ls[0].titularId;
      const w=txWeight(t,pid,false);if(!(w>0))return;
      const tem=sum(ls.map(l=>l.gastos.condominio));if(!(tem>0))return;
      const x=Math.min(rendaBruta(t)*w*quotaDe(props[pid],o,t.date),tem);
      ls.forEach(l=>{l.gastos.condominio-=x*l.gastos.condominio/tem});
      ab+=x;
    });
    e.abatido=r2(ab);
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
    l.caucao=r2(l.caucao);l.reembolsos=r2(l.reembolsos);l.devolucoes=r2(l.devolucoes);
    cols.forEach(k=>{l.gastos[k]=r2(l.gastos[k]);totais.gastos[k]+=l.gastos[k]});
    l.anosAnteriores=Object.keys(l.anosAnteriores).map(Number).sort((a,b)=>a-b).map(y=>({ano:y,valor:r2(l.anosAnteriores[y].valor),retencoes:r2(l.anosAnteriores[y].retencoes)}));
    l.liquido=r2(l.rendas-sum(cols.map(k=>l.gastos[k]))-l.obras24.valor);
    totais.rendas+=l.rendas;totais.retencoes+=l.retencoes;totais.obras24+=l.obras24.valor;
    totais.anosAnteriores+=sum(l.anosAnteriores.map(x=>x.valor));
    if(l.isencao){totais.isentos.n++;totais.isentos.rendas+=l.rendas;totais.isentos.liquido+=l.liquido}
    else totais.liquido+=l.liquido;
  });
  ['rendas','retencoes','obras24','liquido','anosAnteriores'].forEach(k=>{totais[k]=r2(totais[k])});
  totais.isentos.rendas=r2(totais.isentos.rendas);totais.isentos.liquido=r2(totais.isentos.liquido);
  cols.forEach(k=>{totais.gastos[k]=r2(totais.gastos[k])});
  /* os troços da taxa de cada linha (D41, D15): cada renda foi ao troço do mês
     a que respeita; a linha paga a taxa de cada troço sobre a parte das rendas
     dele, vai ao 4.2 se algum troço com rendas tem redução, e a taxa que mostra
     é a do último troço com rendas. Na declaração do ano da cessação com o
     motivo do n.º 20 (fiscoCessacaoRegulariza), os troços do período em que o
     contrato acabou pagam a taxa da duração decorrida (fiscoTaxaRegularizada):
     a redução dele cai desde o início do período — a linha fica no 4.2, com o
     4.2A e o quadro 10 a dizê-lo à AT */
  const mostra={};
  L.forEach(l=>{
    const tr=trocosDe[l.contratoId+'|'+l.titularId];
    if(l.isencao||!tr||l.papel!=='renda')return;
    const c=contract(l.contratoId),cess=irsCessacao(c);
    const dec=cess.data.slice(0,4)===A&&fiscoCessacaoRegulariza(c)?irsTaxaDecorrida(c):null;
    const ts=Object.keys(tr).map(k=>tr[k]).sort((a,b)=>a.seg.de<b.seg.de?-1:a.seg.de>b.seg.de?1:0).map(x=>{
      const s=x.seg,o={de:s.de,ate:s.ate,periodo:s.periodo,taxa:s.taxa,motivo:s.motivo,reducao:s.reducao||null,semRenovacao:!!s.semRenovacao,rendas:r2(x.rendas),imposto:0};
      if(dec&&s.periodo===dec.periodo&&s.motivo==='duracao'){
        const nova=fiscoTaxaRegularizada(c,ano,dec);
        if(nova>o.taxa){o.taxaAntes=o.taxa;o.taxa=nova;o.regulariza=true}
      }
      return o;
    });
    Object.defineProperty(l,'_trocos',{value:ts,enumerable:false,writable:true,configurable:true});
    const com=ts.some(s=>s.rendas>0)?ts.filter(s=>s.rendas>0):ts,ult=com[com.length-1];
    const red=com.some(s=>s.reducao);
    l.taxa=ult.taxa;
    l.motivoTaxa=ult.regulariza?(dec.reducao?'duracao':'base'):ult.motivo==='semRenovacao'?'base':ult.motivo;
    l.quadro=red?v.quadros.comReducao:v.quadros.semReducao;l.taxaReduzida=red;
    l.bonus=com.some(s=>s.reducao&&s.reducao.bonus);
    l.elegivel24=com.some(s=>s.reducao&&s.reducao.elegivel24);
    mostra[l.contratoId+'|'+l.titularId]=com.length>1||com.some(s=>s.semRenovacao||s.regulariza);
  });
  /* a cobertura dos meses de cada contrato (D04): os meses do ano em que viveu
     e os que têm renda, pelo mês a que cada renda respeita */
  const mesesDe={};
  (db.transactions||[]).forEach(t=>{
    if(!t||!t.contractId||!fiscoRendaDoMes(t))return;
    const m=irsMesDaRenda(t);if(m)(mesesDe[t.contractId]||(mesesDe[t.contractId]={}))[m]=1;
  });
  L.forEach(l=>{
    const c=contract(l.contratoId),cob=c?fiscoCoberturaDoAno(c,props[l.propertyId],ano,mesesDe[c.id]):{mesesEmVigor:null,mesesComRenda:0};
    l.mesesEmVigor=cob.mesesEmVigor;l.mesesComRenda=cob.mesesComRenda;
  });
  /* o imposto e o prejuízo, titular a titular (CIRS art. 55.º): um resultado
     negativo não paga imposto, abate só aos positivos do mesmo titular e o
     resto reporta-se aos seis anos seguintes. O KPI e os totais dos quadros
     saem deste mesmo cálculo (a soma dos l.imposto e, com a sublocação, dos
     do quadro 5). A diferença do quadro 5 entra no titular como uma linha à
     taxa dela; negativa não abate às outras rendas (art. 41.º n.º 6: não
     beneficia de dedução nenhuma — INCERTO se a AT a reporta) */
  const Q5L=Q5.map(e=>({titularId:e.titularId,liquido:Math.max(0,e.liquido),taxa:e.taxa,isencao:null,imposto:0,prejuizo:0}));
  totais.porTitular=fiscoImpostoPorTitular(L.concat(Q5L));
  Q5.forEach((e,i)=>{e.imposto=Q5L[i].imposto});
  const PT=Object.keys(totais.porTitular).map(k=>totais.porTitular[k]);
  totais.imposto=r2(sum(PT.map(x=>x.imposto)));totais.prejuizo=r2(sum(PT.map(x=>x.prejuizo)));
  totais.quadro5={n:Q5.length,rendaRecebida:r2(sum(Q5.map(e=>e.rendaRecebida))),rendaPaga:r2(sum(Q5.map(e=>e.rendaPaga))),
    liquido:r2(sum(Q5.map(e=>e.liquido))),retencoes:r2(sum(Q5.map(e=>e.retencoes))),imposto:r2(sum(Q5.map(e=>e.imposto)))};
  totais.retencoes=r2(totais.retencoes+totais.quadro5.retencoes);
  /* o imposto de cada troço: o da linha repartido pelas rendas × taxa de
     cada um, com o último a fechar a soma ao cêntimo (l.imposto = a soma dos
     segmentos); os segmentos mostram-se quando o ano tem mais do que um troço
     com rendas, rendas depois do termo sem renovação, ou a regularização */
  L.forEach(l=>{
    const ts=l._trocos;if(!ts||!ts.length)return;
    const W=sum(ts.map(s=>s.rendas*s.taxa));let falta=l.imposto;
    ts.forEach((s,i)=>{
      const resto=ts.slice(i+1).some(x=>x.rendas*x.taxa>0);
      s.imposto=W>0?(resto?r2(l.imposto*s.rendas*s.taxa/W):r2(falta)):0;
      falta-=s.imposto;
    });
    if(mostra[l.contratoId+'|'+l.titularId])l.segmentos=ts.filter(s=>s.rendas>0||ts.every(x=>!(x.rendas>0))).map(s=>{
      const o={de:s.de,ate:s.ate,taxa:s.taxa,motivo:s.motivo,reducao:!!s.reducao,semRenovacao:s.semRenovacao,rendas:s.rendas,imposto:s.imposto};
      if(s.regulariza){o.regulariza=true;o.taxaAntes=s.taxaAntes}
      return o;
    });
  });
  const extras=!(opcoes&&opcoes.semExtras);
  /* os resumos dos anos anteriores, sem extras (sem regularização nem reporte:
     nunca recursam), um por ano dentro desta conta */
  const antes={};
  const anterior=Y=>antes[Y]||(antes[Y]=resumoFiscal(Y,eu,{semExtras:true}));
  const regs=extras?fiscoRegularizacoes(ano,props,anterior):[];
  totais.regularizacao=r2(sum(regs.map(x=>x.total)));
  const reporte=extras?fiscoReporte(ano,totais.porTitular,L.concat(Q5L),anterior):null;
  totais.impostoDepoisDoReporte=r2(Math.max(0,totais.imposto-(reporte?reporte.imposto:0)));
  const pt=(a,b)=>String(a).localeCompare(String(b),'pt');
  /* as duas linhas de um contrato dos dois cônjuges ficam juntas, a A
     primeiro; dentro do mesmo titular, a das rendas antes da 05 e da 02 */
  const ordemPapel=l=>l.papel==='renda'?0:1;
  L.sort((a,b)=>pt(a.quadro,b.quadro)||pt(a.imovel,b.imovel)||pt(a.inicio,b.inicio)||pt(a.nome,b.nome)||pt(a.titular,b.titular)
    ||ordemPapel(a)-ordemPapel(b)||pt(a.natureza,b.natureza));
  fiscoNumerarCampos(L,v);
  const F=Object.keys(fora).map(k=>fora[k]).map(f=>Object.assign(f,{rendas:r2(f.rendas)})).sort((a,b)=>pt(a.nome,b.nome));
  const S=Object.keys(semC).map(k=>semC[k]).map(s=>Object.assign(s,{rendas:r2(s.rendas)})).sort((a,b)=>pt(a.imovel,b.imovel));
  const donos={};L.concat(Q5).forEach(l=>{donos[l.titularId]=1});
  const r={ano:ano,versao:v,colunas:cols,titularId:quem.eu,titulares:tits.slice(),porInteiro:quem.porInteiro,semSessao:quem.semSessao,
    variosTitulares:Object.keys(donos).length>1,imoveis:base.length,linhas:L,fora:F,semContrato:S,totais:totais,
    avisos:[],aConfirmar:aConfirmar,semRegra:semRegra,obrasSoltas:obrasSoltas,foraDoPeriodo:foraDoPeriodo,
    /* o VPT do quadro 9 pela quota a 1 de janeiro: a titularidade do AIMI
       apura-se nesse dia (CIMI art. 135.º-A n.º 3) */
    aimi:fiscoAimi(ano,t=>sum(partesSem(t).map(x=>x[1])),props,p=>quotaCasa(p,A+'-01-01'),L,totais.imposto),
    semRegrasDoAno:ano<(irsAnosConhecidos()[0]||ano),
    cessados:fiscoCessadosDoAno(ano,props),regularizacoes:regs,reporte:reporte,
    contratosSemRendas:fiscoSemRendasDoAno(ano,props,L.concat(Q5),mesesDe),
    quadro5:Q5,obrasPorConfirmar:obrasPorConfirmar,foraPorEscolha:foraPorEscolha,semImovel:semImovel,
    porClassificar:porClassificar,reembolsosGasto:reembolsosGasto,seguroDeRenda:seguroDeRenda,
    rendasForaDosTotais:{n:foraDosTotais.n,valor:r2(foraDosTotais.valor)}};
  /* os avisos só no resumo que se mostra: os dos anos anteriores (sem extras)
     servem só para as contas deste */
  if(extras)r.avisos=fiscoAvisos(r);
  return r;
}
