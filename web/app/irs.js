/* ================= IRS =================
   O que a app sabe dizer sobre o IRS de um senhorio: a taxa especial sobre as
   rendas e a renda líquida que dela sai, a coluna do Anexo F onde um gasto
   cai, o que é renda, o estado de um contrato perante a AT, o NIF com dígito
   de controlo e o prazo do Modelo 2. Nada disto declara nada — resume, e
   aponta o que falta. Quem o mostra é o serviço Declaração (fisco.js); as
   regras são da base, porque as cópias (o CSV), as definições (IRS e
   dedução), os contratos e as projeções também as usam.

   O que muda de ano para ano NÃO vive aqui: as taxas, os escalões da
   duração, a taxa das rendas moderadas, as datas da AT, os quadros e os
   códigos do Anexo F, as isenções e as suas condições, o que mudou e o guia
   de preenchimento vivem numa versão por ano dos rendimentos — um ficheiro
   cada, irs-2025.js, irs-2026.js… —, que se regista com registarAnoIrs. Aqui
   fica o motor que as lê. Um ano sem versão usa a mais recente antes dele, e
   diz-se.

   O contrato no tempo: o termo estipulado (c.end, com as renovações
   registadas — irsFimEfetivo) decide o escalão de cada período e nunca muda
   quando o contrato acaba antes; o dia em que acabou mesmo é o
   fisco.cessacao (irsFimReal). A taxa conta-se período a período, cada
   renovação a partir da do período anterior (OC 20217/2020, também no regime
   de 2023 — decisão do Martinho, 2026-11-17; a que atravessa a mudança de
   regime conta o regime novo desde o início, OC 20268/2024 — D1,
   2026-11-23), o regime do contrato pela data de celebração, e o ano parte-se nos troços em
   que vale cada taxa (irsSegmentosDoAno). A comunicação da duração faz-se uma
   vez por período (irsComunicacaoDoAno), não todos os anos.

   Os quadros raros também são do motor: o 6A (os 5 % dos imóveis
   reabilitados), o 6B e o 6C são benefícios da versão (irsBeneficios), e o
   direito real de habitação duradoura tem a taxa do art. 72.º n.º 5 e o
   quadro 4.3 (irsTaxa, motivo 'dhd').

   A coluna do Anexo F de um gasto, o que é uma renda e o NIF vivem no
   irs-papeis.js, logo a seguir (carregado depois deste). */

/* as versões registadas, pelo ano dos rendimentos (registarAnoIrs) */
const IRS_ANOS={};
/* Regista a versão de um ano dos rendimentos. Cada irs-AAAA.js chama-a uma vez,
   ao carregar, com tudo o que vale para os rendimentos desse ano (o formato
   está no próprio irs-2025.js). Uma versão é dados, nunca código: o motor que
   os lê é este ficheiro.
   Recebe: v — a versão ({ano, entrega, modelo, taxas, isencoes, englobamento,
   naturezas, quadros, prazos, novidades, passos}).
   Devolve: nada — guarda-a em IRS_ANOS. */
function registarAnoIrs(v){IRS_ANOS[v.ano]=v;for(const k in IRS_NATUREZAS_POR_ANO)delete IRS_NATUREZAS_POR_ANO[k]}
/* os códigos da natureza de cada ano pedido, guardados em memória
   (irsNaturezasDoAno): o resumo pede-os a cada movimento; esvazia-se quando
   se regista uma versão */
const IRS_NATUREZAS_POR_ANO={};
/* Os códigos da natureza das rendas de um ano dos rendimentos — os da versão
   desse ano (irsAno(ano).naturezas), sem montar a versão inteira de cada vez:
   guardados por ano pedido. É o próprio objeto da versão (não se mexe nele).
   Recebe: ano (opcional) — o ano dos rendimentos.
   Devolve: {habitacional, naoHabitacional, indemnizacao, outras, dhd} (ou {}). */
function irsNaturezasDoAno(ano){
  const a=anoIrs(ano);
  if(!Object.prototype.hasOwnProperty.call(IRS_NATUREZAS_POR_ANO,a))IRS_NATUREZAS_POR_ANO[a]=irsAno(a).naturezas||{};
  return IRS_NATUREZAS_POR_ANO[a];
}
/* Os anos com versão própria, do mais antigo ao mais recente.
   Devolve: array de números. */
function irsAnosConhecidos(){return Object.keys(IRS_ANOS).map(Number).sort((a,b)=>a-b)}
/* Um ano dos rendimentos com sentido, ou o corrente. Protege quem passa o
   índice de um map (netRent como callback recebia 0, 1, 2…) e quem não passa
   ano nenhum.
   Recebe: a — o ano (número ou texto; aguenta tudo).
   Devolve: um ano (número inteiro). */
function anoIrs(a){const n=Number(a);return Number.isInteger(n)&&n>=1990&&n<=2200?n:YEAR}
/* A versão das regras para um ano dos rendimentos: a do próprio ano; sem ela,
   a mais recente antes dele (o ano corrente antes de haver a versão nova);
   antes da primeira, a primeira. O `exato` diz se é a do ano pedido — a
   página Declaração avisa quando não é. Emprestada a outro ano, o `ias` e o
   `revisto` ficam vazios (são do ano da versão), e as datas da AT passam para esse ano: a entrega e todas as de `prazos` (a comunicação de
   fevereiro e as que a versão ganhar) — são datas fixas da lei (CIRS art.
   60.º, Portaria 110/2019), e a entrega dos rendimentos de 2027 nunca é em
   2027. As datas absolutas da lei (o `desde` de um regime, o `celebradoAte`
   de uma isenção, a data da revisão) não andam: não são do ano dos
   rendimentos.
   Recebe: ano (opcional) — o ano dos rendimentos; sem ele, o corrente.
   Devolve: a versão, com {pedido, exato} acrescentados (objeto novo). */
function irsAno(ano){
  const pedido=anoIrs(ano),anos=irsAnosConhecidos();
  const base=anos.filter(a=>a<=pedido).pop()||anos[0],v=IRS_ANOS[base],d=pedido-base;
  const out=Object.assign({},v,{pedido:pedido,exato:base===pedido});
  if(d){
    const mv=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)?(Number(s.slice(0,4))+d)+s.slice(4):s;
    out.entrega={de:mv(v.entrega.de),ate:mv(v.entrega.ate)};
    const pz={};Object.keys(v.prazos||{}).forEach(k=>{pz[k]=mv(v.prazos[k])});
    out.prazos=pz;
    /* o IAS e a data da revisão são do ano da versão: emprestados, não valem */
    out.ias=null;out.revisto='';
  }
  return out;
}
/* Meses entre duas datas, com o fim inclusive (1 jan a 31 dez são 12 meses).
   Recebe: ini, fim — 'AAAA-MM-DD'.
   Devolve: o número de meses inteiros, ou 0 sem as duas datas. */
function irsMeses(ini,fim){
  if(!ini||!fim)return 0;
  const s=new Date(ini+'T00:00:00'),e=new Date(fim+'T00:00:00');e.setDate(e.getDate()+1);
  return Math.max(0,(e.getFullYear()-s.getFullYear())*12+(e.getMonth()-s.getMonth())-(e.getDate()<s.getDate()?1:0));
}
/* Uma data a n dias de outra, em hora local (sem toISOString: com o horário
   de verão, a meia-noite local em UTC é a véspera, e o dia saía trocado).
   Recebe: iso — 'AAAA-MM-DD'; n — os dias (negativo para trás).
   Devolve: 'AAAA-MM-DD', ou '' sem data válida. */
function irsSomaDias(iso,n){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));if(!m)return '';
  const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3])+n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
/* O dia antes de uma data, em hora local (irsSomaDias).
   Recebe: iso — 'AAAA-MM-DD'.
   Devolve: 'AAAA-MM-DD' do dia anterior, ou '' sem data válida. */
function irsVespera(iso){return irsSomaDias(iso,-1)}
/* Os períodos de um contrato: o inicial (início e fim) e cada renovação
   registada no bloco fiscal, pela ordem em que começam. O fim do inicial é o
   do contrato — ou, havendo renovações, a véspera da primeira: quem renova
   pelo «Renovar…» da ficha leva o c.end para o fim da renovação, e o
   contrato inicial não passa a durar o que duraram os dois (o escalão de
   cada período conta-se por si). O c.end é o termo estipulado: o dia em que
   o contrato acabou mesmo (fisco.cessacao) não mexe nos períodos — a duração
   que decide o escalão é a do contrato, não a que se viveu (art. 72.º n.º 20).
   Recebe: c — o contrato.
   Devolve: [{inicio, fim}] — o primeiro é sempre o do contrato. */
function irsPeriodos(c){
  const rs=(fiscoDe(c).renovacoes||[]).filter(r=>r&&r.inicio).map(r=>({inicio:r.inicio,fim:r.fim||''}))
    .sort((a,b)=>a.inicio<b.inicio?-1:a.inicio>b.inicio?1:0);
  const ini=(c&&c.start)||'';let fim=(c&&c.end)||'';
  if(rs.length&&ini&&rs[0].inicio>ini&&(!fim||fim>=rs[0].inicio))fim=irsVespera(rs[0].inicio);
  return [{inicio:ini,fim:fim}].concat(rs);
}
/* O termo de um contrato contando as renovações registadas: o c.end, ou o fim
   de uma renovação escrita no bloco que vai para lá dele. É o fim
   estipulado, nunca o dia em que acabou mesmo (irsFimReal).
   Recebe: c — o contrato (aguenta null).
   Devolve: 'AAAA-MM-DD', ou '' sem fim. */
function irsFimEfetivo(c){
  let fim=(c&&c.end)||'';
  (fiscoDe(c).renovacoes||[]).forEach(r=>{if(fim&&r&&r.fim&&r.fim>fim)fim=r.fim});
  return fim;
}
/* A cessação de um contrato, lida com cuidado: o dia em que acabou mesmo e o
   código do motivo do quadro 10 (fisco.cessacao, que o «Terminar contrato»
   escreve). Um contrato antigo, ou um bloco com lixo, dá os dois vazios.
   Recebe: c — o contrato (aguenta null).
   Devolve: {data:'AAAA-MM-DD'|'', motivo:'01'…|''} (objeto novo). */
function irsCessacao(c){
  const x=fiscoDe(c).cessacao,o=x&&typeof x==='object'&&!Array.isArray(x)?x:{};
  return {data:/^\d{4}-\d{2}-\d{2}$/.test(String(o.data||''))?String(o.data):'',
    motivo:/^\d{2}$/.test(String(o.motivo||''))?String(o.motivo):''};
}
/* O último dia em que o contrato esteve em vigor: o da cessação, se o há;
   senão, num contrato terminado, o c.end (o «Terminar» antigo escrevia lá
   o dia); senão o termo com as renovações (irsFimEfetivo).
   Recebe: c — o contrato (aguenta null).
   Devolve: 'AAAA-MM-DD', ou '' sem fim conhecido. */
function irsFimReal(c){
  if(!c)return '';
  const d=irsCessacao(c).data;if(d)return d;
  return c.active===false?(c.end||''):irsFimEfetivo(c);
}
/* O contrato identifica pelo nome quem lá mora? A pergunta do inquilino
   empresa (D16, que muda a D47: para a AT basta a identificação da pessoa
   singular que lá mora — PIV 28246, 26024, 30248; a proibição de sublocar
   não é condição, PIV 30723), em fisco.empresaMorador. A pergunta antiga
   (fisco.empresaHabitacao, que juntava a identificação e a sublocação) lê-se
   só de recurso: um «Sim» antigo identifica; um «Não» antigo não diz qual das
   duas faltava, e conta como por responder.
   Recebe: c — o contrato (aguenta null).
   Devolve: true (identifica), false (não identifica) ou null (por responder). */
function irsEmpresaMorador(c){
  const f=fiscoDe(c);
  if(f.empresaMorador===true||f.empresaMorador===false)return f.empresaMorador;
  return f.empresaHabitacao===true?true:null;
}
/* O arrendamento de habitação a uma pessoa coletiva é, para a AT, não
   habitacional? Quando a finalidade escrita é habitação (permanente ou não),
   algum inquilino tem NIF de pessoa coletiva (irs-papeis.js:nifColetivo — a
   condição em que o formulário faz a pergunta, contrato.js:ctEmpresaVisivel)
   e a resposta é que o contrato não identifica quem lá mora
   (irsEmpresaMorador === false). Por responder, fica a finalidade escrita e a
   Declaração aponta o que falta.
   Recebe: c — o contrato (aguenta null).
   Devolve: true ou false. */
function irsEmpresaNaoHabitacional(c){
  if(!c||['hp','hnp'].indexOf(fiscoDe(c).finalidade)<0||irsEmpresaMorador(c)!==false)return false;
  return ctTenants(c).some(t=>nifColetivo(t&&t.nif));
}
/* A finalidade de um contrato para o IRS: a escrita, ou 'nh' quando o
   inquilino empresa faz dele não habitacional (irsEmpresaNaoHabitacional) —
   a natureza do não habitacional, a taxa dele, sem a redução pela duração,
   sem as rendas moderadas e sem as isenções e os benefícios da habitação.
   Recebe: c — o contrato (aguenta null).
   Devolve: '', 'hp', 'hnp', 'nh' ou 'dhd'. */
function irsFinalidade(c){return irsEmpresaNaoHabitacional(c)?'nh':fiscoDe(c).finalidade}
/* O número do artigo 72.º de um escalão da duração (o quadro 10 pede o regime
   por ele): o que a versão escreve no escalão (`n`), ou o lugar dele no
   regime — o mais longo é o n.º 5, o seguinte o n.º 4, e assim para baixo
   (o regime de 2019 tem os n.os 2 a 5, o de 2023 os n.os 3 a 5).
   Recebe: regime — {escaloes}; e — o escalão.
   Devolve: o número (2 a 5), ou 0 sem escalão. */
function irsNumeroDoEscalao(regime,e){
  if(!e)return 0;
  if(Number(e.n)>0)return Number(e.n);
  return 5-((regime&&regime.escaloes)||[]).filter(x=>x.meses>e.meses).length;
}
/* O passo da cadeia num período: o escalão da duração dele no regime dado e
   a taxa que lhe cabe, vindo de um período com a taxa `ant` (null: nenhum
   com redução antes dele). Cada renovação conta isolada, pelo escalão da
   SUA duração, e desce − porRenovacao pontos a partir da taxa anterior, até
   ao `minimo` do escalão; os escalões sem passo (10 e 20 anos) dão a sua
   taxa; uma renovação nunca fica pior do que a taxa do seu escalão; e a que
   daria mais alta do que a anterior mantém a anterior (OC 20217/2020, ponto
   II).
   Recebe: reg — o regime ({escaloes}); meses — a duração do período; ant —
   a taxa do período anterior (ou null).
   Devolve: {taxa, escalao}, ou null quando a duração não chega a escalão
   nenhum. */
function irsPassoDaCadeia(reg,meses,ant){
  const e=((reg&&reg.escaloes)||[]).slice().sort((x,y)=>y.meses-x.meses).find(x=>meses>=x.meses);
  if(!e)return null;
  let t=e.taxa;
  if(ant!=null&&e.porRenovacao)t=Math.max(Number(e.minimo)||0,Math.min(e.taxa,ant-e.porRenovacao));
  if(ant!=null&&t>ant)t=ant;
  return {taxa:t,escalao:e};
}
/* A taxa pela duração de cada período de um contrato, pela ordem dos
   períodos (CIRS art. 72.º n.os 2 a 5; OC 20217/2020), passo a passo
   (irsPassoDaCadeia). O regime (os da versão, cada um com `desde`/`ate`) é o
   da data em que o contrato foi celebrado, no período inicial — a lei
   aplica cada regime aos contratos «celebrados» desde a sua data (Lei
   56/2023 art. 50.º n.º 7, OC 20268/2024 ponto 2 b); as instruções do 4.2
   para o de 2019) —, com o início de recurso quando a celebração não está
   escrita; numa renovação, o do dia em que ela começa (as renovações
   «verificadas» desde a data). Um contrato celebrado antes de 2019 fica sem
   redução no período inicial, mesmo que comece depois.
   A renovação que atravessa a mudança de regime (começada no regime de 2023
   num contrato que vinha do de 2019 já com redução, abaixo da taxa base do
   ano) conta como se o regime novo valesse desde o início (OC 20268/2024,
   pontos 7 e 8; decisão do Martinho D1, 2026-11-23): a taxa de partida é a
   que os períodos de antes teriam no regime novo — 5 anos dão 15 %, e a
   renovação de 5 anos desce para 13 % —, e as seguintes descem a partir
   dela. Vindo de um período SEM redução (26 % num contrato de 3 anos), o
   ofício não diz nada: a renovação desce a partir da taxa anterior, como no
   resto (fica `abInitio` false). Isto vale para os dois regimes (decisão do
   Martinho, 2026-11-17); no de 2023 o `minimo` é o limite global dos 10
   pontos.
   Sem fim, sem regime ou sem escalão, o período não tem redução, e o
   seguinte começa de novo. A taxa aqui é a do regime — no de 2019 pode
   passar os 25 % (26 % num contrato de 3 anos): quem decide se é redução é
   irsReducaoDoPeriodo. O bónus do n.º 24 não entra na cadeia (a leitura
   prudente: é uma redução «adicional» do contrato novo).
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos (a versão
   de onde se leem os regimes).
   Devolve: [{inicio, fim, meses, taxa (null sem redução), n, regime,
   escalao, abInitio}], um por período de irsPeriodos — abInitio true na
   renovação contada pelo regime novo desde o início. */
function irsCadeia(c,ano){
  const v=irsAno(ano),regs=(v.taxas.duracao)||[],base=Number(v.taxas.habitacional)||25;
  const cel=/^\d{4}-\d{2}-\d{2}$/.test(String(fiscoDe(c).celebracao||''))?String(fiscoDe(c).celebracao):'';
  const ps=irsPeriodos(c),regDe=d=>regs.find(r=>d>=r.desde&&(!r.ate||d<=r.ate))||null;
  let ant=null,regAnt=null,ini=0;
  return ps.map((p,k)=>{
    const o={inicio:p.inicio,fim:p.fim,meses:0,taxa:null,n:0,regime:null,escalao:null,abInitio:false};
    const reg=p.inicio&&p.fim?regDe(k===0&&cel?cel:p.inicio):null;
    if(!reg){ant=null;regAnt=null;ini=k+1;return o}
    o.meses=irsMeses(p.inicio,p.fim);
    let a=ant;
    if(a!=null&&regAnt&&reg!==regAnt&&String(reg.desde)>String(regAnt.desde)&&base>a){
      /* os períodos de antes, desde o início desta cadeia, contados no regime novo */
      a=null;
      for(let j=ini;j<k;j++){const x=irsPassoDaCadeia(reg,irsMeses(ps[j].inicio,ps[j].fim),a);a=x?x.taxa:null}
      o.abInitio=true;
    }
    const x=irsPassoDaCadeia(reg,o.meses,a);
    if(!x){ant=null;regAnt=null;ini=k+1;o.abInitio=false;return o}
    o.taxa=x.taxa;o.regime=reg;o.escalao=x.escalao;o.n=irsNumeroDoEscalao(reg,x.escalao);
    ant=x.taxa;regAnt=reg;
    return o;
  });
}
/* O período em vigor num ano: o último começado até 31 de dezembro que
   ainda vive nesse ano (o fim depois de 1 de janeiro, ou sem fim). Um
   contrato que ainda não começou conta pelo inicial (as projeções de um
   contrato futuro); um que passou do termo sem renovação registada não tem
   nenhum (-1) — as rendas desse tempo não têm a taxa do período que acabou.
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: o índice em irsPeriodos, ou -1. */
function irsPeriodoDoAno(c,ano){
  const a=anoIrs(ano),ini=a+'-01-01',fim=a+'-12-31',ps=irsPeriodos(c);
  let i=-1;
  ps.forEach((p,k)=>{if(p.inicio&&p.inicio<=fim&&(!p.fim||p.fim>=ini))i=k});
  if(i<0&&!ps.some(p=>p.inicio&&p.inicio<=fim))i=0;
  return i;
}
/* A redução pela duração de um período (CIRS art. 72.º n.os 3 a 5), só no
   arrendamento para habitação permanente — ou de finalidade por indicar,
   que a app assume habitação até a pessoa dizer outra coisa. A taxa é a da
   cadeia (irsCadeia), e só é redução quando fica abaixo da taxa base do ano
   (`taxas.habitacional`): um contrato de 2 a 5 anos do regime de 2019 (26 %)
   paga os 25 % e não tem redução nenhuma — sem quadro 4.2 nem comunicação
   (Lei 56/2023 art. 50.º n.º 8 b)); os que já estavam abaixo ficam até ao
   termo ou à renovação (alínea a)).
   Os n.os 23 e 24 (parâmetros na versão: taxas.limiteRendaAlta e
   taxas.bonusRendaMenor). Um contrato celebrado desde a data do n.º 23 com a
   renda acima de 150 % do limite do concelho (fisco.rendaAcimaDoLimite, que a
   pessoa indica — a app não tem as tabelas) não tem redução nenhuma; por
   indicar conta como dentro do limite. O n.º 24 é um facto e uma conta à
   parte: `elegivel24` diz que o contrato novo (período inicial, celebrado
   desde a data da versão) tem a renda pelo menos 5 % abaixo da do contrato
   anterior no mesmo imóvel (fisco.rendaAnterior) — é o que mostra o quadro
   4.2B; `bonus` diz que a estimativa desceu mesmo os 5 pontos, o que nunca
   vai abaixo do `minimo` da versão (a leitura prudente: num contrato de 20
   anos a letra daria 0 %, e quem decide é a AT).
   Recebe: c — o contrato; ano — o ano dos rendimentos; i — o índice do
   período em irsPeriodos (-1 ou null: nenhum).
   Devolve: {taxa, meses, renovacoes, desde, ate, n, bonus, elegivel24} —
   renovacoes é quantas renovações há antes do período, desde/ate as datas
   dele e n o número do art. 72.º do escalão — ou null sem redução. */
function irsReducaoDoPeriodo(c,ano,i){
  if(!c||i==null||i<0)return null;
  const F=fiscoDe(c),fin=irsFinalidade(c);if(fin&&fin!=='hp')return null;
  const a=anoIrs(ano),T=irsAno(a).taxas,cad=irsCadeia(c,a),p=cad[i];
  if(!p||p.taxa==null)return null;
  const cel=F.celebracao||cad[0].inicio,L=T.limiteRendaAlta;
  if(L&&cel&&cel>=L.desde&&F.rendaAcimaDoLimite===true)return null;
  let taxa=p.taxa;
  if(!(taxa<T.habitacional))return null;
  /* n.º 24: em cêntimos inteiros, para 950 € contra 1 000 € dar «5 % abaixo» sem
     o arredondamento do 0,95 o estragar */
  const B=T.bonusRendaMenor,renda=Number(c.rent)||0,ant=Number(F.rendaAnterior)||0;
  const elegivel24=!!(B&&cel&&cel>=B.desde&&i===0&&ant>0&&renda>0&&Math.round(renda*100)*100<=Math.round(ant*100)*(100-B.rendaMenorPct));
  let bonus=false;
  if(elegivel24){const t2=Math.max(B.minimo,taxa-B.pontos);if(t2<taxa){taxa=t2;bonus=true}}
  return {taxa:taxa,meses:p.meses,renovacoes:i,desde:p.inicio,ate:p.fim,n:p.n,bonus:bonus,elegivel24:elegivel24};
}
/* A redução pela duração de um contrato num ano: a do período em vigor nesse
   ano (irsPeriodoDoAno — o contrato ou a última renovação começada até 31
   de dezembro e ainda viva), pelas regras de irsReducaoDoPeriodo. Um ano
   com dois períodos (uma renovação a meio) parte-se em irsSegmentosDoAno;
   aqui fica o último.
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: {taxa, meses, renovacoes, desde, ate, n, bonus, elegivel24}, ou
   null quando não há redução. */
function irsReducao(c,ano){
  if(!c)return null;
  const a=anoIrs(ano);
  return irsReducaoDoPeriodo(c,a,irsPeriodoDoAno(c,a));
}
/* Os textos de cada campo do contrato que uma isenção pode pedir
   confirmado (o `pede` da versão), para o meio de uma frase. */
const IRS_PEDE_TEXTO={
  nrau3536:'sem confirmares que o contrato está sujeito aos arts. 35.º ou 36.º do NRAU, a isenção não conta',
  alRegistado2022:'sem confirmares que o alojamento local estava registado e afeto a esse fim a 31/12/2022, e a inscrição do contrato nos prazos da lei, a isenção não conta'};
/* A isenção de um contrato num ano, condição a condição. A isenção é a que o
   bloco fiscal indica (fisco.isencao), se a versão desse ano a tem na lista
   (irs-AAAA.js:isencoes — o RSAA só existe desde 2026); depois cada condição
   que a versão escreve nela:
   - desde / celebradoAte — o contrato celebrado (fisco.celebracao, senão o
     início) nesse intervalo (o RSAA desde 1/9/2026; o PAA de 1/7/2019 a
     31/8/2026; o ex-alojamento local de 2023 a 2024). Com
     `datasPelaCelebracao` (a renda antiga, anterior ao RAU), as datas leem-se
     só na celebração escrita: sem ela, um início fora do intervalo não corta
     — quem herdou ou comprou o prédio com o inquilino escreve muitas vezes o
     dia em que passou a senhorio — e diz-se em `aviso`, para confirmar;
   - prazoMinimo — {finalidade: meses}: a duração mínima do contrato (o
     período inicial, do início ao termo estipulado) por finalidade (o RSAA:
     3 anos na residência permanente, 3 meses na temporária — DL 97/2026,
     anexo III, art. 5.º). Um contrato sem termo não chumba;
   - ateAno — as rendas até esse ano (o ex-alojamento local até 2029);
   - finalidade — a finalidade do contrato (texto ou lista; por indicar
     conta como habitação permanente, como na taxa);
   - pede — o campo (ou os campos) do bloco fiscal que têm de estar
     confirmados (true), ex.: 'nrau3536', 'alRegistado2022'; o texto do que
     falta é o `pedeTexto` da versão, ou o de IRS_PEDE_TEXTO;
   - pedeIhru (ou prazoIhru) — o dia em que o contrato foi ao IHRU
     (fisco.ihru) até ao prazo (o `prazoIhru` 'MM-DD' do ano seguinte ao da
     celebração); antes de o prazo passar, sem data a isenção ainda conta;
     depois, sem data ou com uma data tardia, não.
   Sem data de celebração, as condições de datas não se verificam (a
   Declaração aponta a data em falta).
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: {is, motivo, aviso} — is a isenção da versão quando todas passam
   (senão null); motivo '' ou a frase da primeira condição que falha
   (minúscula, sem ponto final); aviso '' ou, com a isenção a contar, a frase
   do que fica por confirmar (o início escrito depois do RAU, sem a
   celebração). */
function irsIsencaoAvaliada(c,ano){
  const f=fiscoDe(c),id=f.isencao;
  if(!c||!id)return {is:null,motivo:'',aviso:''};
  const a=anoIrs(ano),is=(irsAno(a).isencoes||[]).find(x=>x&&x.id===id)||null;
  const falha=m=>({is:null,motivo:m,aviso:''}),dia=x=>dPT(x)||String(x);
  if(!is){
    const outra=irsAnosConhecidos().map(y=>(IRS_ANOS[y].isencoes||[]).find(x=>x&&x.id===id)).find(Boolean);
    return falha('a isenção escolhida'+(outra?' ('+(outra.curto||outra.nome)+')':'')+' não existe nas regras de '+a);
  }
  const celEscrita=/^\d{4}-\d{2}-\d{2}$/.test(String(f.celebracao||''))?String(f.celebracao):'';
  const cel=celEscrita||c.start||'',soInicio=!!is.datasPelaCelebracao&&!celEscrita;
  let aviso='';
  const datas=[];
  if(is.desde&&cel&&cel<is.desde)datas.push('a isenção só vale para contratos celebrados desde '+dia(is.desde));
  if(is.celebradoAte&&cel&&cel>is.celebradoAte)datas.push('a isenção só vale para contratos celebrados até '+dia(is.celebradoAte));
  if(datas.length){
    if(!soInicio)return falha(datas[0]);
    aviso='o início escrito no contrato ('+dia(c.start)+') é posterior ao que a isenção pede ('+datas[0].replace(/^a isenção só vale para /,'')+'): se o contrato é mais antigo (herdaste ou compraste o prédio com o inquilino), escreve a data de celebração; se não, a isenção não se aplica';
  }
  if(is.ateAno&&a>Number(is.ateAno))return falha('a isenção só vale para as rendas até '+is.ateAno);
  const fin=irsFinalidade(c)||'hp';
  if(is.finalidade){
    const fs=[].concat(is.finalidade);
    if(fs.indexOf(fin)<0)return falha('a isenção só vale para contratos de '+fs.map(x=>{const n=FISCO_FINALIDADES.find(y=>y[0]===x);return n?n[1].toLowerCase():x}).join(' ou '));
  }
  const pm=is.prazoMinimo&&typeof is.prazoMinimo==='object'?Number(is.prazoMinimo[fin])||0:0;
  if(pm>0){
    const p0=irsPeriodos(c)[0]||{},meses=p0.inicio&&p0.fim?irsMeses(p0.inicio,p0.fim):0;
    if(p0.inicio&&p0.fim&&meses<pm){
      const dur=pm%12===0?(pm/12===1?'um ano':pm/12+' anos'):(pm===1?'um mês':pm+' meses');
      return falha('a isenção pede um contrato de pelo menos '+dur+(fin==='hnp'?' na residência temporária':' na habitação permanente')+', e este tem '+(meses===1?'um mês':meses+' meses'));
    }
  }
  for(const campo of [].concat(is.pede||[])){
    if(f[campo]!==true)return falha(is.pedeTexto||IRS_PEDE_TEXTO[campo]||'falta confirmar no contrato uma condição da isenção');
  }
  if(is.pedeIhru||is.prazoIhru){
    const env=/^\d{4}-\d{2}-\d{2}$/.test(String(f.ihru||''))?String(f.ihru):'';
    const prazo=/^\d{2}-\d{2}$/.test(String(is.prazoIhru||''))&&/^\d{4}-/.test(cel)?(Number(cel.slice(0,4))+1)+'-'+is.prazoIhru:'';
    if(env&&prazo&&env>prazo)return falha('o contrato foi ao IHRU depois de '+dia(prazo)+': a isenção não conta');
    if(!env&&(!prazo||today()>prazo))return falha('sem a data do envio ao IHRU, a isenção não conta');
  }
  return {is:is,motivo:'',aviso:aviso};
}
/* A isenção de um contrato num ano, quando todas as condições da versão
   passam (irsIsencaoAvaliada).
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: a isenção da versão ({id, nome, curto, quadro, codigo, lei,
   texto…}), ou null. */
function irsIsencao(c,ano){return irsIsencaoAvaliada(c,ano).is}
/* Porque é que a isenção escolhida no contrato não conta num ano: a frase da
   primeira condição que falha (irsIsencaoAvaliada), para «A tratar».
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: '' (sem isenção escolhida, ou ela conta) ou a frase, ex.: «sem a
   data do envio ao IHRU, a isenção não conta». */
function irsIsencaoMotivo(c,ano){return irsIsencaoAvaliada(c,ano).motivo}
/* O que fica por confirmar numa isenção que conta num ano: a frase do
   `aviso` de irsIsencaoAvaliada (a renda antiga com só o início escrito,
   posterior ao RAU), para «A tratar» e para a ficha.
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: '' ou a frase (minúscula, sem ponto final). */
function irsIsencaoAviso(c,ano){return irsIsencaoAvaliada(c,ano).aviso||''}
/* Os benefícios do quadro 6 que não são isenções (6A, 6B, 6C — a lista
   `beneficios` da versão do ano), condição a condição, para um contrato num
   ano. Só entram os que o imóvel ou o contrato marcam (`marca`:
   'imovel.reabilitacao' — p.reabilitacao com o tipo escolhido —,
   'imovel.lojaComHistoria', 'contrato.egf' — true); o imóvel é o do
   contrato. Lidos com cuidado: um campo por normalizar ou com lixo não
   marca nada. Cada condição que a versão escreve no benefício:
   - um DHD nunca (vai ao 4.3, e o quadro 6 identifica linhas do 4.1); um
     imóvel fora de Portugal (p.pais) nunca;
   - vigenteAte — o ano dos rendimentos até ao ano desse dia (o 6C só até
     2026, enquanto o Orçamento não o prorrogar);
   - um benefício de taxa (`taxa`) não vale num contrato isento (a isenção
     ganha, irsIsencao);
   - tipos, certificado, inicioDesde/inicioAte, concluida — a reabilitação do
     imóvel (p.reabilitacao: {tipo, inicio, conclusao, certificado}): o tipo
     da lista, o certificado da câmara, o início no intervalo e a conclusão
     até 31 de dezembro do ano; no ano da conclusão, a taxa só vale nas
     rendas dos meses depois dela (irsInicioDaReabilitacao: `desde` no item,
     e irsSegmentosDoAno parte o ano nesse dia — a linha continua uma só,
     que o 6A identifica inteira); concluída em dezembro depois do dia 1,
     não vale nesse ano;
   - donoEm — a data de compra do imóvel (purchaseDate) até esse dia (a PIV
     28153: dono a 6 de outubro de 2023); sem ela não se sabe, e não vale;
   - tipoPredio — o tipo do prédio ('R' rústico);
   - finalidade — a finalidade do contrato (lista; por indicar conta como
     habitação permanente, como na taxa);
   - contratosAte e anos — o contrato celebrado (fisco.celebracao, senão o
     início) até esse dia, e o ano dos rendimentos dentro dos `anos` a contar
     do ano da celebração (o 6C: 12 anos).
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: [{beneficio, aplica, motivo[, conclusao, desde]}] — beneficio o da
   versão; aplica true quando todas as condições passam; motivo '' ou a
   frase da primeira que falha (minúscula, sem ponto final), para «A
   tratar»; no ano da conclusão da reabilitação (com aplica), conclusao a
   data dela e desde o dia em que a taxa começa ('AAAA-MM-01'). [] sem nada
   marcado. */
function irsBeneficiosAvaliados(c,ano){
  if(!c)return [];
  const a=anoIrs(ano),bs=irsAno(a).beneficios||[],F=fiscoDe(c);
  const p=((typeof db!=='undefined'&&db&&db.properties)||[]).find(x=>x&&x.id===c.propertyId)||null;
  const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
  const R=obj(p&&p.reabilitacao),data=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))?String(x):'';
  const dia=x=>{const d=irsDiaMes(x);return d?d+' de '+x.slice(0,4):String(x)};
  const out=[];
  bs.forEach(b=>{
    if(!b||!b.id)return;
    const m=String(b.marca||''),k=m.slice(m.indexOf('.')+1);
    const v=m.indexOf('imovel.')===0?(p?p[k]:undefined):m.indexOf('contrato.')===0?F[k]:undefined;
    if(!(v===true||(v&&typeof v==='object'&&!Array.isArray(v)&&String(v.tipo||'').trim())))return;
    const Q='o quadro '+b.quadro+' não conta',fin=irsFinalidade(c)||'',cel=data(F.celebracao)||data(c.start);
    const falha=()=>{
      if(fin==='dhd')return 'num direito real de habitação duradoura a linha vai ao quadro '+(irsAno(a).quadros.dhd||'4.3')+', e o quadro '+b.quadro+' só identifica linhas do '+irsAno(a).quadros.semReducao;
      if(p&&String(p.pais||'').trim())return 'o imóvel fica fora de Portugal: '+Q;
      if(b.vigenteAte&&a>Number(String(b.vigenteAte).slice(0,4)))return 'a lei só o tem em vigor até '+dia(b.vigenteAte)+': sem nova prorrogação, '+Q+' em '+a;
      if(b.taxa!=null&&irsIsencao(c,a))return 'o contrato já está isento de IRS';
      if(b.tipos&&[].concat(b.tipos).indexOf(String(R.tipo||''))<0)return 'falta dizer se a reabilitação foi numa área de reabilitação urbana ou no NRAU';
      if(b.certificado&&R.certificado!==true)return 'sem o certificado da câmara (o início e a conclusão da reabilitação), '+Q;
      if(b.inicioDesde||b.inicioAte){
        const ini=data(R.inicio);
        if(!ini)return 'sem a data de início da reabilitação, '+Q;
        if((b.inicioDesde&&ini<b.inicioDesde)||(b.inicioAte&&ini>b.inicioAte))return 'a reabilitação só conta se começou entre '+dia(b.inicioDesde)+' e '+dia(b.inicioAte);
      }
      if(b.concluida){
        const con=data(R.conclusao);
        if(!con)return 'sem a data de conclusão da reabilitação, '+Q;
        if(con>a+'-12-31')return 'a reabilitação só ficou concluída a '+dia(con)+': '+Q+' em '+a;
        const des=irsInicioDaReabilitacao(con);
        if(des>a+'-12-31')return 'a reabilitação só ficou concluída a '+dia(con)+': os '+dec(b.taxa)+' % começam nas rendas de janeiro de '+des.slice(0,4)+', e as de '+a+' ficam fora do quadro '+b.quadro;
      }
      if(b.donoEm){
        const pd=data(p&&p.purchaseDate);
        if(!pd)return 'sem a data de compra do imóvel não se sabe se já eras dono a '+dia(b.donoEm);
        if(pd>b.donoEm)return 'compraste o imóvel depois de '+dia(b.donoEm)+', e o benefício é só de quem já era dono nesse dia';
      }
      if(b.tipoPredio&&(!p||p.tipoPredio!==b.tipoPredio))return 'só vale num prédio '+(b.tipoPredio==='R'?'rústico':'urbano');
      if(b.finalidade){
        const fs=[].concat(b.finalidade);
        if(fs.indexOf(fin||'hp')<0)return 'só vale nos contratos '+fs.map(x=>{const n=FISCO_FINALIDADES.find(y=>y[0]===x);return n?n[1].toLowerCase():x}).join(' ou ');
      }
      if(b.contratosAte||b.anos){
        if(!cel)return 'sem a data de celebração do contrato, '+Q;
        if(b.contratosAte&&cel>b.contratosAte)return 'só vale para os arrendamentos celebrados até '+dia(b.contratosAte);
        const ult=Number(cel.slice(0,4))+Number(b.anos)-1;
        if(b.anos&&a>ult)return 'os '+b.anos+' anos do benefício acabaram em '+ult;
      }
      return '';
    };
    const motivo=falha(),item={beneficio:b,aplica:!motivo,motivo:motivo};
    /* o ano da conclusão: as rendas de antes não vêm de um imóvel recuperado */
    if(!motivo&&b.concluida){
      const con=data(R.conclusao),des=con?irsInicioDaReabilitacao(con):'';
      if(con&&con>=a+'-01-01'&&des>a+'-01-01'){item.conclusao=con;item.desde=des}
    }
    out.push(item);
  });
  return out;
}
/* O dia a partir do qual as rendas de um imóvel reabilitado têm a taxa do 6A
   (o antigo art. 71.º n.º 7 do EBF: as rendas «inteiramente decorrentes» do
   arrendamento de um imóvel recuperado): o 1.º dia do mês a seguir ao da
   conclusão — a renda do mês da conclusão ainda paga, em parte, um imóvel em
   obras —, ou o próprio dia quando a conclusão é a 1 de um mês. A leitura é
   prudente; a AT não tem doutrina sobre o ano da conclusão, e a Declaração
   avisa nesse ano.
   Recebe: con — a data de conclusão 'AAAA-MM-DD'.
   Devolve: 'AAAA-MM-DD', ou '' sem data válida. */
function irsInicioDaReabilitacao(con){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(con||''));if(!m)return '';
  if(m[3]==='01')return con;
  const y=Number(m[1]),n=Number(m[2]);
  return n<12?y+'-'+String(n+1).padStart(2,'0')+'-01':(y+1)+'-01-01';
}
/* Os benefícios do quadro 6 (6A, 6B, 6C) que valem para a linha de um
   contrato num ano: os de irsBeneficiosAvaliados com todas as condições
   cumpridas. O 6A dá a taxa (irsTaxa: motivo 'reabilitacao'); o 6B e o 6C
   mudam a conta da linha (fatorObras24, fator), que o resumo faz.
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: [{id, quadro, campos, …}] — os benefícios da versão (os próprios
   objetos: não se mexe neles). */
function irsBeneficios(c,ano){return irsBeneficiosAvaliados(c,ano).filter(x=>x.aplica).map(x=>x.beneficio)}
/* Os benefícios do quadro 6 que valem num troço do ano: os de
   irsBeneficiosAvaliados que se aplicam e cujo `desde` (o 6A no ano da
   conclusão) não é depois do primeiro dia do troço. Sem dia, os do ano
   (irsBeneficios).
   Recebe: c — o contrato (aguenta null); ano — o ano dos rendimentos; de
   (opcional) — o primeiro dia do troço 'AAAA-MM-DD'.
   Devolve: [benefício da versão] (os próprios objetos). */
function irsBeneficiosDoTroco(c,ano,de){
  const d=/^\d{4}-\d{2}-\d{2}$/.test(String(de||''))?String(de):'';
  return irsBeneficiosAvaliados(c,ano).filter(x=>x.aplica&&(!d||!x.desde||d>=x.desde)).map(x=>x.beneficio);
}
/* O mês a que uma renda respeita: o `periodo` ('AAAA-MM') quando o tem, senão
   o mês da data — a mesma regra do planeados.js:mesDaRenda (a de agosto paga
   a 3 de setembro é de agosto), aqui na base do IRS.
   Recebe: t — o movimento.
   Devolve: 'AAAA-MM' (ou '' sem data). */
function irsMesDaRenda(t){
  const p=String((t&&t.periodo)||'');
  return /^\d{4}-\d{2}$/.test(p)?p:String((t&&t.date)||'').slice(0,7);
}
/* Os meses de um ano que já decorreram com o contrato em vigor (DL 97/2026,
   art. 3.º n.º 3: «o número de meses decorridos em cada ano»): de max(o
   início, a compra do imóvel, 1 de janeiro) a min(o último dia em que viveu
   — irsFimReal —, a venda do imóvel, 31 de dezembro), cada mês tocado (um
   contrato que começa a 20 de setembro conta setembro), e só os meses antes
   do de hoje — o mês corrente conta quando já tem renda (quem chama junta-o).
   A compra e a venda cortam porque as rendas de antes e de depois não são de
   quem declara (o resumo também não as conta).
   Recebe: c — o contrato (aguenta null); ano — o ano dos rendimentos.
   Devolve: ['AAAA-MM'] por ordem, ou null quando não se sabe (sem início, ou
   terminado sem data nenhuma). */
function irsMesesDecorridos(c,ano){
  if(!c||!/^\d{4}-\d{2}-\d{2}$/.test(String(c.start||'')))return null;
  const A=String(anoIrs(ano)),fimReal=irsFimReal(c);
  if(c.active===false&&!fimReal)return null;
  const p=c.propertyId?(db.properties||[]).find(x=>x&&x.id===c.propertyId):null;
  let ini=A+'-01-01',fim=A+'-12-31';
  [c.start,p&&p.purchaseDate].forEach(x=>{if(/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))&&x>ini)ini=x});
  [fimReal,p&&p.vendido].forEach(x=>{if(/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))&&x<fim)fim=x});
  const hoje=today().slice(0,7),out=[];
  for(let m=ini.slice(0,7);m<=fim.slice(0,7)&&m<hoje;){
    out.push(m);
    const y=Number(m.slice(0,4)),n=Number(m.slice(5,7));
    m=n<12?y+'-'+String(n+1).padStart(2,'0'):(y+1)+'-01';
  }
  return out;
}
/* O teste das rendas moderadas de um contrato num ano (EBF art. 45.º-C; DL
   97/2026, art. 3.º), com o que a Declaração precisa para o explicar.
   A renda mensal do teste mede o que se recebeu (decisão do Martinho D2,
   2026-11-23): o valor das rendas do ano a dividir pelos meses decorridos
   com o contrato em vigor (irsMesesDecorridos, mais os meses que já têm
   renda) — e não pelos meses com renda lançada: um pagamento de três meses
   num movimento não triplica a renda, e um mês por pagar baixa a média.
   Mais os móveis e serviços pagos à parte (fisco.extrasMensais). Sem rendas
   no ano, ou sem meses (um contrato que ainda não começou, um que acabou
   antes), é a renda do contrato (c.rent) mais os extras. As rendas são as do
   contrato com o papel de renda (irs-papeis.js:irsReceitaDe, como o resumo),
   pelo mês a que respeitam: também as «Fora dos totais» das Rendas e o
   reembolso do inquilino; a caução não (decisão do Martinho de 2026-11-17),
   nem a indemnização e as outras receitas prediais (naturezas 05 e 02).
   Quando o que entrou e a renda do contrato ficam de lados diferentes do
   limite, a taxa segue o que entrou e `difere` di-lo (o aviso da
   Declaração). `variosMeses` aponta os meses com vez e meia a renda do
   contrato ou mais (um pagamento de vários meses num movimento, ou duas
   rendas no mesmo mês): aí não há rendas «em falta» a registar.
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: null quando a versão do ano não tem rendas moderadas, o ano passa
   o `ate` dela, ou o contrato não é de habitação (nh, dhd) ou está isento;
   senão {renda, recebido, meses, mesesComRenda, rendaContrato, limite, cabe,
   cabeContrato, difere, semRendas, variosMeses:[{mes, valor, n}]}. */
function irsTesteModerada(c,ano){
  if(!c)return null;
  const a=anoIrs(ano),m=irsAno(a).taxas.rendaModerada;
  if(!m||a>Number(m.ate))return null;
  const fin=irsFinalidade(c);if(fin==='nh'||fin==='dhd'||irsIsencao(c,a))return null;
  return irsTesteModeradaBruto(c,a,m);
}
/* O miolo do teste das rendas moderadas (irsTesteModerada), sem olhar para
   a finalidade nem para a isenção: a conta com o limite dado.
   Recebe: c — o contrato; a — o ano (número); m — {limiteMensal} (o
   rendaModerada da versão; sem ele, o limite fica 0).
   Devolve: {renda, recebido, meses, mesesComRenda, rendaContrato, limite,
   cabe, cabeContrato, difere, semRendas, variosMeses}. */
function irsTesteModeradaBruto(c,a,m){
  const A=String(a),f=fiscoDe(c),extra=Math.max(0,Number(f.extrasMensais)||0),porMes={},nPorMes={};
  (db.transactions||[]).forEach(t=>{
    if(!t||t.kind!=='income'||!c.id||t.contractId!==c.id)return;
    if(irsReceitaDe(t).papel!=='renda')return;
    const mes=irsMesDaRenda(t);if(mes.slice(0,4)!==A)return;
    porMes[mes]=(porMes[mes]||0)+rendaBruta(t);nPorMes[mes]=(nPorMes[mes]||0)+1;
  });
  const comRenda=Object.keys(porMes).sort(),recebido=Math.round(comRenda.reduce((s,x)=>s+porMes[x],0)*100)/100;
  const dec0=irsMesesDecorridos(c,a),todos={};
  (dec0||[]).concat(comRenda).forEach(x=>{todos[x]=1});
  const meses=Object.keys(todos).length,rent=Math.max(0,Number(c.rent)||0),rendaContrato=rent+extra;
  const semRendas=!(recebido>0)||!meses;
  const renda=semRendas?rendaContrato:Math.max(0,recebido/meses)+extra;
  const lim=Number(m&&m.limiteMensal)||0,cabeR=x=>x>0&&Math.round(x*100)<=Math.round(lim*100);
  const cabe=cabeR(renda),cabeContrato=cabeR(rendaContrato);
  const variosMeses=rent>0?comRenda.filter(x=>porMes[x]>=rent*1.5).map(x=>({mes:x,valor:Math.round(porMes[x]*100)/100,n:nPorMes[x]})):[];
  return {renda:renda,recebido:recebido,meses:meses,mesesComRenda:comRenda.length,rendaContrato:rendaContrato,limite:lim,
    cabe:cabe,cabeContrato:cabeContrato,difere:!semRendas&&rendaContrato>0&&cabe!==cabeContrato,semRendas:semRendas,variosMeses:variosMeses};
}
/* A renda mensal com que se testa o limite das rendas moderadas num ano: a
   de irsTesteModeradaBruto (o que entrou a dividir pelos meses decorridos,
   mais os extras; sem rendas, a renda do contrato) — também num ano sem
   rendas moderadas na versão, para quem só quer o número.
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: euros por mês (número ≥ 0). */
function irsRendaMensalDoTeste(c,ano){
  if(!c)return 0;
  const a=anoIrs(ano);
  return irsTesteModeradaBruto(c,a,irsAno(a).taxas.rendaModerada).renda;
}
/* Os quartos (ou partes) do mesmo imóvel arrendados em contratos à parte que,
   juntos, passam o limite das rendas moderadas, cada um cabendo nele (D2 c,
   decisão do Martinho de 2026-11-23: a taxa continua a testar-se contrato a
   contrato, e a Declaração avisa). O DL 97/2026 mede a renda pela
   «totalidade do valor pago pelo prédio … ou fração autónoma» (art. 3.º n.º
   1) e só conta «os imóveis» com renda moderada (art. 2.º n.º 2); a AT não
   disse se soma os contratos da mesma fração. Conta, mês a mês no ano, os
   contratos do imóvel em vigor nesse mês com o teste das rendas moderadas
   (irsTesteModerada: de habitação e não isentos), cada um pela renda do seu
   teste.
   Recebe: pid — o id do imóvel; ano (opcional) — o ano dos rendimentos.
   Devolve: null, ou {propertyId, mes, soma, limite, contratos:[{id, renda}]}
   — mes o primeiro mês em que passa ('AAAA-MM'), soma a maior soma do ano,
   contratos os em vigor nesse mês. */
function irsModeradaPorFracao(pid,ano){
  if(!pid)return null;
  const a=anoIrs(ano),A=String(a),cs=(db.contracts||[]).filter(c=>c&&c.propertyId===pid&&c.start);
  if(cs.length<2)return null;
  const ts=cs.map(c=>({c:c,t:irsTesteModerada(c,a)})).filter(x=>x.t);
  if(ts.length<2)return null;
  /* os contratos em vigor num mês (um terminado sem data nenhuma não diz quando viveu: fica de fora) */
  const vivosEm=mes=>{
    const ini=mes+'-01',fim=irsSomaDias(irsSomaDias(ini,31).slice(0,8)+'01',-1);
    return ts.filter(x=>{const f=irsFimReal(x.c);return x.c.start<=fim&&(!f||f>=ini)&&!(x.c.active===false&&!f)});
  };
  let primeiro='',soma=0;const lim=ts[0].t.limite;
  for(let n=1;n<=12;n++){
    const mes=A+'-'+String(n).padStart(2,'0'),vivos=vivosEm(mes);
    if(vivos.length<2||!vivos.every(x=>x.t.cabe))continue;
    const s=Math.round(vivos.reduce((z,x)=>z+x.t.renda,0)*100)/100;
    if(Math.round(s*100)<=Math.round(lim*100))continue;
    if(!primeiro)primeiro=mes;
    if(s>soma)soma=s;
  }
  if(!primeiro)return null;
  return {propertyId:pid,mes:primeiro,soma:soma,limite:lim,contratos:vivosEm(primeiro).map(x=>({id:x.c.id,renda:x.t.renda}))};
}
/* A taxa de um contrato num ano com um período dado em vigor — o miolo de
   irsTaxa e de cada troço de irsSegmentosDoAno. A isenção vem antes de tudo
   (0 %); o não habitacional paga a taxa da versão — a finalidade é a do IRS
   (irsFinalidade: também o inquilino empresa que o contrato não diz quem lá
   mora, D16); a habitação fica com a
   mais baixa entre a base, a redução do período (irsReducaoDoPeriodo) e a
   das rendas moderadas, quando a versão a tem, o ano está dentro dela e a
   renda do ano (irsRendaMensalDoTeste) não passa o limite.
   Um direito real de habitação duradoura (finalidade 'dhd') paga a taxa da
   versão (taxas.dhd, art. 72.º n.º 5) e vai ao 4.3: sem redução. Um imóvel
   reabilitado com o 6A (irsBeneficios, um benefício com `taxa`) paga essa
   taxa quando não é mais alta do que a outra — sem redução, para a linha
   ficar no 4.1 com o 6A e nunca ir ao 4.2 (instruções do 6A: identifica
   campos do 4.1); no ano da conclusão, só nos troços desde o mês a seguir a
   ela (irsBeneficiosDoTroco, com o primeiro dia do troço).
   É também a taxa das regras do ano da Declaração para uma renda de outro
   ano num contrato que não viveu nesse ano (N014): o resumo pede-a com o
   período do contrato a que a renda respeita.
   Recebe: c — o contrato (aguenta null); ano — o ano dos rendimentos; i —
   o índice do período (-1: nenhum, depois do termo sem renovação); de
   (opcional) — o primeiro dia do troço 'AAAA-MM-DD' (sem ele, o ano inteiro).
   Devolve: {taxa, motivo, reducao[, isencao][, beneficio]} como irsTaxa. */
function irsTaxaDoPeriodo(c,ano,i,de){
  const a=anoIrs(ano),T=irsAno(a).taxas,is=c?irsIsencao(c,a):null,fin=c?irsFinalidade(c):'';
  if(is)return {taxa:0,motivo:'isento',reducao:null,isencao:is};
  if(fin==='dhd')return {taxa:T.dhd!=null?T.dhd:T.habitacional,motivo:'dhd',reducao:null};
  let out;
  if(fin==='nh')out={taxa:T.naoHabitacional,motivo:'nh',reducao:null};
  else{
    const r=irsReducaoDoPeriodo(c,a,i),m=T.rendaModerada;
    out={taxa:T.habitacional,motivo:'base',reducao:r};
    if(r&&r.taxa<out.taxa)out={taxa:r.taxa,motivo:'duracao',reducao:r};
    if(c&&m&&a<=m.ate&&m.taxa<out.taxa){
      const renda=irsRendaMensalDoTeste(c,a);
      if(renda>0&&Math.round(renda*100)<=Math.round(m.limiteMensal*100))out={taxa:m.taxa,motivo:'moderada',reducao:r};
    }
  }
  const b=c?irsBeneficiosDoTroco(c,a,de).find(x=>x&&x.taxa!=null&&Number(x.taxa)<=out.taxa):null;
  if(b)out={taxa:Number(b.taxa),motivo:'reabilitacao',reducao:null,beneficio:b};
  return out;
}
/* O subarrendamento de um contrato: o bloco do imóvel dele quando a pessoa
   arrenda o imóvel e o subarrenda (p.subarrendamento.ativo) — os contratos
   dele vão ao quadro 5 (D52), e não ao 4.1 nem ao 4.2.
   Recebe: c — o contrato (aguenta null).
   Devolve: o bloco ({ativo, nifSenhorio, rendaMensal…}), ou null. */
function irsSubarrendamentoDe(c){
  const p=c&&c.propertyId?(db.properties||[]).find(x=>x&&x.id===c.propertyId):null;
  const s=p&&p.subarrendamento;
  return s&&typeof s==='object'&&!Array.isArray(s)&&s.ativo===true?s:null;
}
/* A taxa do quadro 5 (a sublocação: CIRS art. 8.º n.º 2 c), art. 72.º),
   sobre a diferença entre a renda recebida e a paga ao senhorio — a regra
   única da Declaração (fisco-resumo.js:fiscoQuadro5) e da ficha, da lista,
   da Avaliação e das Projeções (irsTaxa). O não habitacional paga a taxa da
   versão; a habitação, a das rendas moderadas quando a versão a tem, o ano
   está dentro dela e a renda do subarrendatário cabe no limite
   (irsTesteModeradaBruto: o DL 97/2026 inclui o «subarrendamento
   habitacional», art. 2.º n.º 1 b); a AT ainda não o confirmou, e
   `porConfirmar` di-lo), senão a base. Sem a redução pela duração (o quadro
   5 não tem onde a pôr: INCERTO, decisão da vaga 3) nem a isenção (o irsTaxa
   põe-na antes).
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: null sem subarrendamento ativo (ou num DHD); senão {taxa, motivo
   ('nh'|'base'|'moderada'), porConfirmar, reducao:null, sublocacao:true}. */
function irsTaxaDoSubarrendamento(c,ano){
  if(!c||!irsSubarrendamentoDe(c))return null;
  const a=anoIrs(ano),T=irsAno(a).taxas,fin=irsFinalidade(c);
  if(fin==='dhd')return null;
  if(fin==='nh')return {taxa:T.naoHabitacional,motivo:'nh',porConfirmar:false,reducao:null,sublocacao:true};
  const m=T.rendaModerada;
  if(m&&a<=Number(m.ate)&&Number(m.taxa)<Number(T.habitacional)&&irsTesteModeradaBruto(c,a,m).cabe)
    return {taxa:Number(m.taxa),motivo:'moderada',porConfirmar:true,reducao:null,sublocacao:true};
  return {taxa:T.habitacional,motivo:'base',porConfirmar:false,reducao:null,sublocacao:true};
}
/* A renda de um mês de um contrato subarrendado partida no que conta para o
   imposto (CIRS art. 8.º n.º 2 c): só a diferença): a renda do contrato, a
   parte da renda paga ao senhorio que lhe cabe — a do imóvel inteiro
   (subarrendamento.rendaMensal), ou a da parte subarrendada quando só se
   subarrenda parte (parte 'parte' com rendaParte), repartida pelos
   contratos do imóvel em vigor hoje na proporção da renda (como o quadro 5)
   — e a diferença (nunca negativa).
   Recebe: c — o contrato (aguenta null).
   Devolve: null sem subarrendamento ativo; senão {renda, paga, diferenca}
   em euros por mês. */
function irsSublocacaoMensal(c){
  const s=irsSubarrendamentoDe(c);if(!s)return null;
  const renda=Math.max(0,Number(c.rent)||0);
  const total=s.parte==='parte'&&Number(s.rendaParte)>0?Number(s.rendaParte):Math.max(0,Number(s.rendaMensal)||0);
  const vivos=(db.contracts||[]).filter(x=>x&&x.propertyId===c.propertyId&&x.id!==c.id&&isActive(x));
  const soma=renda+vivos.reduce((z,x)=>z+Math.max(0,Number(x.rent)||0),0);
  const paga=Math.round((soma>0?total*renda/soma:total)*100)/100;
  return {renda:renda,paga:paga,diferenca:Math.max(0,Math.round((renda-paga)*100)/100)};
}
/* A taxa especial do IRS sobre as rendas de um contrato num ano, e porquê
   (CIRS art. 72.º; EBF art. 45.º-C), no período em vigor nesse ano
   (irsPeriodoDoAno). Não habitacional: a taxa da versão (28 %). Habitacional:
   a base (25 %), a redução pela duração quando a há (irsReducao), e a das
   rendas moderadas quando a versão a tem, o ano está dentro dela e a renda
   mensal do ano (irsRendaMensalDoTeste — as rendas do ano, não a de hoje) não
   passa o limite — fica sempre a mais baixa.
   Antes de tudo, a isenção (irsIsencao, com as condições da versão): um
   contrato isento paga 0 %, fica na linha do 4.1 e o quadro da isenção
   aponta para ela — é o que as instruções pedem. Depois, o direito real de
   habitação duradoura (5 %, quadro 4.3) e o imóvel reabilitado do 6A (5 %,
   no 4.1, antes da duração e das rendas moderadas: irsTaxaDoPeriodo).
   Depois do termo sem renovação registada (num contrato que não acabou), a
   redução do período que acabou não passa para as rendas seguintes:
   `semRenovacao` diz-o. Um ano com uma renovação a meio parte-se em
   irsSegmentosDoAno; aqui fica a taxa do último período.
   Um contrato num imóvel subarrendado (depois da isenção) tem a taxa do
   quadro 5, sobre a diferença (irsTaxaDoSubarrendamento): a ficha e a lista
   dizem a mesma que a Declaração. Os troços (irsSegmentosDoAno) não mudam.
   É a estimativa: a taxa escrita no contrato manda sobre ela (taxRateOf),
   fora da Declaração.
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: {taxa, motivo, reducao} — motivo é 'isento', 'dhd',
   'reabilitacao', 'nh', 'base', 'duracao' ou 'moderada'; reducao o que
   irsReducao devolveu (ou null), mesmo quando a moderada ganha, porque é ela
   que manda o contrato para o quadro 4.2 (null no isento, no DHD, na
   reabilitação e na sublocação); no isento há ainda isencao, a da versão;
   na reabilitação beneficio, o da versão (o 6A); na sublocação
   sublocacao:true e porConfirmar; depois do termo sem renovação,
   semRenovacao:true. */
function irsTaxa(c,ano){
  const a=anoIrs(ano);
  const sub=c&&!irsIsencao(c,a)?irsTaxaDoSubarrendamento(c,a):null;
  if(sub)return sub;
  const i=c?irsPeriodoDoAno(c,a):-1,out=irsTaxaDoPeriodo(c,a,i);
  if(c&&i<0&&c.active!==false&&!irsCessacao(c).data)out.semRenovacao=true;
  return out;
}
/* O ano de um contrato partido nos troços em que vale cada taxa: um por
   período (o contrato e cada renovação) dentro do que o contrato viveu no
   ano — do início (ou 1 de janeiro) ao fim real (irsFimReal: a cessação, ou
   o c.end de um contrato terminado; num contrato que continua, 31 de
   dezembro). O que fica depois do termo sem renovação registada, num
   contrato que continua (ou entre um período e a renovação seguinte), é um
   troço sem período: `semRenovacao`, à taxa base (ou à das rendas moderadas,
   quando a renda cabe) — a renovação automática do Código Civil (art. 1096.º)
   não se adivinha. A AT reparte assim as rendas de um ano com uma renovação
   a meio (OC 20217/2020, ponto III): cada renda vai ao troço do mês a que
   respeita. No ano da conclusão de uma reabilitação do 6A, o troço parte-se
   também no dia em que os 5 % começam (irsBeneficiosAvaliados: `desde`).
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: [{de, ate, periodo, taxa, motivo, reducao, semRenovacao[, isencao][, beneficio]}]
   — periodo o índice em irsPeriodos (null depois do termo); motivo o de
   irsTaxa, ou 'semRenovacao' quando fica a taxa base; reducao o de
   irsReducaoDoPeriodo (ou null). [] num ano em que o contrato não viveu. */
function irsSegmentosDoAno(c,ano){
  if(!c)return [];
  const a=anoIrs(ano),ini=a+'-01-01',fimA=a+'-12-31',ps=irsPeriodos(c);
  const de0=c.start&&c.start>ini?c.start:ini,cess=irsCessacao(c).data;
  let ate0=cess||(c.active===false?(c.end||''):'');
  if(!ate0||ate0>fimA)ate0=fimA;
  if(ate0<de0)return [];
  const out=[];
  /* os dias em que um benefício de taxa começa a meio do ano (o 6A no ano da conclusão) */
  const cortes=irsBeneficiosAvaliados(c,a).filter(x=>x.aplica&&x.desde&&x.beneficio&&x.beneficio.taxa!=null).map(x=>x.desde);
  const troco=(de,ate,i)=>{
    const d=cortes.find(x=>x>de&&x<=ate);
    if(d){troco(de,irsVespera(d),i);troco(d,ate,i);return}
    const t=irsTaxaDoPeriodo(c,a,i==null?-1:i,de),s={de:de,ate:ate,periodo:i,taxa:t.taxa,
      motivo:i==null&&t.motivo==='base'?'semRenovacao':t.motivo,reducao:t.reducao,semRenovacao:i==null};
    if(t.isencao)s.isencao=t.isencao;
    if(t.beneficio)s.beneficio=t.beneficio;
    out.push(s);
  };
  let cur=de0;
  for(let i=0;i<ps.length&&cur<=ate0;i++){
    const p=ps[i],pi=p.inicio||de0,prox=ps[i+1]&&ps[i+1].inicio?irsVespera(ps[i+1].inicio):'';
    let pf=p.fim||'';if(prox&&(!pf||prox<pf))pf=prox;
    if(pf&&pf<cur)continue;
    if(pi>ate0)break;
    if(pi>cur){const v=irsVespera(pi);troco(cur,v<ate0?v:ate0,null);cur=pi}
    const f=pf&&pf<ate0?pf:ate0;
    troco(cur,f,i);cur=irsSomaDias(f,1);
  }
  if(cur<=ate0)troco(cur,ate0,null);
  return out;
}
/* A taxa de um contrato num dia: o troço de irsSegmentosDoAno onde o dia
   cai (para uma renda, o dia do mês a que respeita).
   Recebe: c — o contrato; data — 'AAAA-MM-DD'.
   Devolve: o troço ({de, ate, periodo, taxa, motivo, reducao,
   semRenovacao}), ou null fora da vida do contrato ou sem data válida. */
function irsTaxaNaData(c,data){
  const d=String(data||'');
  if(!c||!/^\d{4}-\d{2}-\d{2}$/.test(d))return null;
  return irsSegmentosDoAno(c,Number(d.slice(0,4))).find(s=>s.de<=d&&d<=s.ate)||null;
}
/* O troço de uma renda: o último troço do ano que toca o mês a que ela
   respeita (irs-papeis.js não entra: o mês é o de irsMesDaRenda). O último, e
   não o do dia 1: num contrato que faz anos a meio do mês, a renda desse mês
   já é do período novo (a de junho de um contrato renovado a 15 de junho
   paga de 15 de junho a 14 de julho), e a do mês do termo sem renovação já
   cai depois dele.
   Recebe: c — o contrato; t — a renda (o movimento).
   Devolve: o troço de irsSegmentosDoAno, ou null fora da vida do contrato. */
function irsTaxaDaRenda(c,t){
  const m=irsMesDaRenda(t);
  if(!c||!/^\d{4}-\d{2}$/.test(m))return null;
  const ini=m+'-01',fim=irsSomaDias(irsSomaDias(ini,31).slice(0,8)+'01',-1);
  const ss=irsSegmentosDoAno(c,Number(m.slice(0,4))).filter(s=>s.de<=fim&&s.ate>=ini);
  return ss[ss.length-1]||null;
}
/* A taxa da duração que o contrato viveu mesmo, para a regularização do art.
   72.º n.º 20 (a cessação imputável ao senhorio): «a taxa aplicável à
   duração efetivamente decorrida» do período em que acabou — o contrato ou a
   renovação em vigor no dia da cessação —, contada como se ele tivesse sido
   estipulado até esse dia, pelas mesmas regras (irsReducaoDoPeriodo, com a
   cadeia dos períodos de antes intacta). Quando a duração decorrida não
   chega a um escalão, é a taxa base do ano da cessação. Os períodos
   anteriores, já cumpridos, não se tocam.
   Recebe: c — o contrato (aguenta null).
   Devolve: null sem cessação (ou sem período em vigor nesse dia); senão
   {periodo, desde, ate, meses, taxa, reducao} — periodo o índice em
   irsPeriodos, desde o início dele, ate o dia da cessação, reducao true
   quando a taxa decorrida ainda fica abaixo da base. */
function irsTaxaDecorrida(c){
  const d=irsCessacao(c).data;if(!c||!d)return null;
  const ps=irsPeriodos(c);let i=-1;
  ps.forEach((p,k)=>{if(p.inicio&&p.inicio<=d&&(!p.fim||p.fim>=d))i=k});
  if(i<0)return null;
  const rs=ps.slice(1,i+1).map((p,k)=>({inicio:p.inicio,fim:k===i-1?d:p.fim}));
  const curto=Object.assign({},c,{end:d,fisco:Object.assign({},fiscoDe(c),{renovacoes:rs})});
  const a=Number(d.slice(0,4)),r=irsReducaoDoPeriodo(curto,a,i);
  return {periodo:i,desde:ps[i].inicio,ate:d,meses:irsMeses(ps[i].inicio,d),taxa:r?r.taxa:irsAno(a).taxas.habitacional,reducao:!!r};
}
/* A comunicação da duração e das renovações de que dependem as rendas de um
   ano (Portaria 110/2019, art. 2.º b); FAQ 5936 da AT). Faz-se uma vez por
   período — o contrato inicial e cada renovação —, até 15 de fevereiro do
   ano seguinte ao início dele, e não todos os anos. O período é o último
   com redução vivo no ano (com uma renovação sem redução a meio do ano, o
   de antes, que é o que o 4.2A pergunta). A marca guarda-se pela chave do
   ano do início do período (fisco.comunicacoes). Uma data antiga que a
   migração das comunicações não pôde dar como feita (caía depois do prazo do
   período: dados.js, fisco.comunicacoesPorConfirmar[chave]) não é a data:
   diz-se à parte, por confirmar (N003).
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: null sem redução nesse ano (ou isento); senão {periodoInicio,
   chave, prazo, data, foraDePrazo[, porConfirmar, dataAntiga]} — chave o ano
   do início ('AAAA'), prazo o 15 de fevereiro seguinte
   (irsAno(chave).prazos.comunicacaoDuracao), data o dia em que se comunicou
   ('' por fazer), foraDePrazo se foi depois; sem data e com a marca da
   migração, porConfirmar true e dataAntiga 'AAAA-MM-DD' (só então existem). */
function irsComunicacaoDoAno(c,ano){
  if(!c)return null;
  const segs=irsSegmentosDoAno(c,ano).filter(s=>s.periodo!=null&&s.reducao),s=segs[segs.length-1];
  if(!s)return null;
  const p=irsPeriodos(c)[s.periodo];if(!p||!/^\d{4}-/.test(p.inicio))return null;
  const chave=p.inicio.slice(0,4),prazo=irsAno(Number(chave)).prazos.comunicacaoDuracao,f=fiscoDe(c);
  const data=(f.comunicacoes||{})[chave]||'';
  const out={periodoInicio:p.inicio,chave:chave,prazo:prazo,data:data,foraDePrazo:!!data&&!!prazo&&data>prazo};
  const pcs=f.comunicacoesPorConfirmar,pc=!data&&pcs&&typeof pcs==='object'&&!Array.isArray(pcs)?String(pcs[chave]||''):'';
  if(/^\d{4}-\d{2}-\d{2}$/.test(pc)){out.porConfirmar=true;out.dataAntiga=pc}
  return out;
}
/* A comunicação da duração de que dependem as rendas de um ano já feita: o
   dia em que o senhorio comunicou no Portal o período em vigor
   (irsComunicacaoDoAno) — a de um período conta em todos os anos dele.
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: 'AAAA-MM-DD', ou '' por fazer (ou sem nada a comunicar). */
function irsComunicado(c,ano){
  const x=irsComunicacaoDoAno(c,ano);
  return x?x.data:'';
}
/* As comunicações da duração de um contrato, uma por período com redução (o
   contrato e cada renovação registada), com o prazo de cada uma e o dia em
   que se fez — para os prazos e para a ficha.
   Recebe: c — o contrato (aguenta null).
   Devolve: [{periodoInicio, chave, prazo, data}], pela ordem dos períodos. */
function irsPrazosDeComunicacao(c){
  if(!c)return [];
  const com=fiscoDe(c).comunicacoes||{};
  return irsPeriodos(c).map((p,i)=>{
    if(!/^\d{4}-/.test(p.inicio))return null;
    /* a taxa do período no dia em que começa: no ano da conclusão de um 6A, antes dela a redução conta */
    const a=Number(p.inicio.slice(0,4)),t=irsTaxaDoPeriodo(c,a,i,p.inicio);
    if(!t.reducao)return null;
    const chave=String(a);
    return {periodoInicio:p.inicio,chave:chave,prazo:irsAno(a).prazos.comunicacaoDuracao,data:com[chave]||''};
  }).filter(Boolean);
}
/* O código do regime fiscal de um contrato no quadro 10 do Anexo F (os
   contratos que acabaram e tiveram benefício): pela isenção, o regime que a
   versão liga a ela; senão pelo número do art. 72.º do escalão do último
   troço com redução do ano (irsSegmentosDoAno — o período em que acabou).
   A tabela é da versão (`quadro10.regimes`, [{codigo, texto, n|isencao,
   sub}]); os regimes do subarrendamento (`sub`) são do quadro 5, e não
   entram aqui.
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: o código ('01'…), ou '' sem benefício ou sem a tabela na versão. */
function irsRegimeQuadro10(c,ano){
  if(!c)return '';
  const a=anoIrs(ano),q=irsAno(a).quadro10,rs=q&&Array.isArray(q.regimes)?q.regimes:[];
  const is=irsIsencao(c,a);
  if(is){const r=rs.find(x=>x&&x.isencao===is.id&&!x.sub);return r?String(r.codigo||''):''}
  const segs=irsSegmentosDoAno(c,a).filter(s=>s.reducao),s=segs[segs.length-1];
  if(!s)return '';
  const r=rs.find(x=>x&&Number(x.n)===s.reducao.n);
  return r?String(r.codigo||''):'';
}
/* A taxa estimada de um contrato num ano (irsTaxa), só o número.
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: a taxa em percentagem (número). */
function irsRate(c,ano){return irsTaxa(c,ano).taxa}
/* Porque é que a taxa estimada é a que é, para o meio de uma frase
   («estimado: renda moderada»).
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: o texto curto. */
function irsTaxaPorque(c,ano){
  const t=irsTaxa(c,ano);
  if(t.sublocacao)return t.motivo==='moderada'?'sublocação, renda moderada':t.motivo==='nh'?'sublocação, não habitacional':'sublocação';
  if(t.motivo==='reabilitacao')return (t.beneficio&&t.beneficio.curto)||'imóvel reabilitado';
  if(t.motivo==='dhd')return 'habitação duradoura (DHD)';
  return t.motivo==='isento'?'isento':t.motivo==='nh'?'não habitacional':t.motivo==='duracao'?'pela duração':t.motivo==='moderada'?'renda moderada':'taxa base';
}
/* As taxas especiais de um ano numa frase, para a dica do formulário do
   contrato: a da habitação e a do resto, os escalões da duração do regime em
   vigor, a dos imóveis reabilitados (o benefício da versão com `taxa` e
   `taxaTexto`: o 6A, D118) e, quando a versão a tem, a das rendas moderadas
   — tudo lido da versão, nada escrito à mão.
   Recebe: ano (opcional) — o ano dos rendimentos.
   Devolve: o texto (sem HTML). */
function irsTaxasTexto(ano){
  const a=anoIrs(ano),T=irsAno(a).taxas,atual=(T.duracao||[]).find(r=>!r.ate);
  const es=atual?atual.escaloes.slice().sort((x,y)=>x.meses-y.meses):[];
  let t='A taxa especial de IRS sobre rendas de habitação é '+dec(T.habitacional)+' % ('+dec(T.naoHabitacional)+' % no não habitacional)';
  if(es.length)t+=', e desce na habitação permanente pela duração: '+es.map(e=>dec(e.taxa)+' % com '+Math.round(e.meses/12)+' anos').join(', ')+' ou mais';
  t+='.';
  (irsAno(a).beneficios||[]).filter(b=>b&&b.taxa!=null&&b.taxaTexto).forEach(b=>{t+=' '+b.taxaTexto+', a taxa é '+dec(b.taxa)+' % (quadro '+b.quadro+').'});
  const m=T.rendaModerada;
  if(m&&a<=m.ate)t+=' Até '+m.ate+', as rendas de habitação até '+euro(m.limiteMensal)+' por mês pagam '+dec(m.taxa)+' %, se a duração não der menos.';
  return t;
}
/* a taxa de imposto que se aplica à renda de um contrato num ano: a que foi escrita; em
   branco (ou 0, que é como o formulário guarda o branco) a estimativa (irsRate)
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: a taxa em percentagem (número). */
const taxRateOf=(c,ano)=>Number(c.taxRate)>0?Number(c.taxRate):irsRate(c,ano);
/* A renda mensal de um contrato depois do imposto, à taxa que se lhe aplica
   (taxRateOf). Num imóvel subarrendado o imposto é só sobre a diferença
   para a renda paga ao senhorio (irsSublocacaoMensal; CIRS art. 8.º n.º 2
   c)).
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: euros (número). */
const netRent=(c,ano)=>{const s=irsSublocacaoMensal(c),t=taxRateOf(c,ano)/100;return s?s.renda-s.diferenca*t:c.rent*(1-t)};
/* A renda líquida mensal dos contratos em vigor de um imóvel, no ano
   corrente, só dos que têm estimativa (irsLiquidaParaMostrar: sem os do
   Anexo J e da categoria B sem taxa escrita).
   Recebe: p — o imóvel.
   Devolve: euros (número). */
const netRentOf=p=>sum(activeContracts(p.id).map(c=>irsLiquidaParaMostrar(c)).filter(x=>x!=null));
/* O contrato cujas rendas não têm a taxa especial do Anexo F, e por isso
   nenhuma estimativa do imposto (D133, D134): as tributadas na categoria B
   (Anexo B ou C, com a atividade) — a marca conta em qualquer estado menos
   no «Não declarado» (N056: a categoria B não depende de o contrato estar
   comunicado, e o formulário mostra a marca sempre que está ligada) e ganha
   ao país, como no fisco-resumo.js:fiscoForaDoAnexoF —, e as de um imóvel
   fora de Portugal (Anexo J, com o imposto pago lá). A regra é da base — a
   lista, a Avaliação, a Visão geral e as Projeções perguntam-na sem os
   Contratos ligados; o contrato.js:ctSemEstimativa delega nela.
   Recebe: c — o contrato (aguenta null).
   Devolve: 'catB', 'fora' ou ''. */
function irsSemEstimativa(c){
  if(!c)return '';
  const f=fiscoDe(c);
  if(f.categoriaB===true&&f.estado!=='naoDeclarado')return 'catB';
  return pzForaDePortugal(c.propertyId)?'fora':'';
}
/* A taxa de um contrato para mostrar fora da Declaração (a lista dos
   contratos, a Avaliação, as Projeções): a escrita no contrato, quando a
   há; sem ela, «sem estimativa» num contrato do Anexo J ou da categoria B
   (irsSemEstimativa — a categoria B nunca recebe os 28 % do não
   habitacional); senão a estimativa do ano (irsRate) e porquê.
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: {taxa (número, ou null sem estimativa), escrita, semEstimativa
   ('fora'|'catB'|''), porque (texto curto: «escrita no contrato», «Anexo J
   · sem estimativa», «categoria B · sem estimativa» ou o de irsTaxaPorque)}. */
function irsTaxaParaMostrar(c,ano){
  if(!c)return {taxa:null,escrita:false,semEstimativa:'',porque:''};
  if(Number(c.taxRate)>0)return {taxa:Number(c.taxRate),escrita:true,semEstimativa:'',porque:'escrita no contrato'};
  const s=irsSemEstimativa(c);
  if(s)return {taxa:null,escrita:false,semEstimativa:s,porque:s==='fora'?'Anexo J · sem estimativa':'categoria B · sem estimativa'};
  return {taxa:irsRate(c,ano),escrita:false,semEstimativa:'',porque:irsTaxaPorque(c,ano)};
}
/* A renda líquida mensal de um contrato para mostrar fora da Declaração: a
   de netRent, ou null quando não há taxa para a fazer (irsTaxaParaMostrar).
   Recebe: c — o contrato (aguenta null); ano (opcional) — o ano dos rendimentos.
   Devolve: euros por mês (número), ou null sem estimativa. */
function irsLiquidaParaMostrar(c,ano){
  if(!c||(!(Number(c.taxRate)>0)&&irsSemEstimativa(c)))return null;
  return netRent(c,ano);
}

/* o bloco fiscal de um contrato, sempre completo (um contrato que ainda não passou pelo
   normContract não o tem)
   Recebe: c — o contrato (aguenta null).
   Devolve: o bloco no formato de normFisco (o próprio, quando existe). */
const fiscoDe=c=>(c&&c.fisco)||normFisco(null);
/* o contrato foi comunicado à AT (Modelo 2)
   Recebe: c — o contrato.
   Devolve: true se o estado fiscal é «declarado». */
const ctDeclarado=c=>fiscoDe(c).estado==='declarado';
/* o senhorio marcou o contrato como não declarado: fica fora do resumo e dos prazos da AT
   Recebe: c — o contrato.
   Devolve: true se o estado fiscal é «naoDeclarado». */
const ctNaoDeclarado=c=>fiscoDe(c).estado==='naoDeclarado';
/* ainda não se disse se o contrato foi comunicado à AT
   Recebe: c — o contrato.
   Devolve: true se o estado fiscal está por indicar. */
const ctFiscoPorIndicar=c=>!fiscoDe(c).estado;
/* O último dia do mês seguinte ao de uma data — o prazo do Modelo 2 («até ao fim do mês
   seguinte» ao início, à alteração ou à cessação). Em hora local, sem toISOString.
   Recebe: iso — a data 'AAAA-MM-DD' (aguenta vazio).
   Devolve: 'AAAA-MM-DD', ou '' sem data válida. */
function fimDoMesSeguinte(iso){
  const m=/^(\d{4})-(\d{2})/.exec(String(iso||''));if(!m)return '';
  const d=new Date(Number(m[1]),Number(m[2])+1,0);   /* dia 0 de dois meses à frente = último dia do mês seguinte */
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
/* Uma data por extenso sem o ano, como se diz um prazo da AT («1 de abril»,
   «30 de junho»): o nome do mês vem do pt-PT do aparelho. Em hora local.
   Recebe: iso — 'AAAA-MM-DD' (aguenta vazio).
   Devolve: o texto, ou '' sem data válida. */
function irsDiaMes(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));if(!m)return '';
  return new Date(Number(m[1]),Number(m[2])-1,Number(m[3])).toLocaleDateString('pt-PT',{day:'numeric',month:'long'});
}
/* o código da natureza das rendas nos quadros 4.1 e 4.2 do Anexo F, o da versão do ano
   (desde os rendimentos de 2023: 07 arrendamento habitacional, 06 não habitacional); sem
   finalidade assume-se habitação, como na taxa. Um direito real de habitação duradoura
   dá o da prestação mensal no quadro 4.3 (naturezas.dhd, 01); a caução dele (02, 03) é
   do resumo, que sabe que receita é. Os códigos leem-se de irsNaturezasDoAno (guardados
   por ano: o resumo pede-os a cada movimento). A finalidade é a do IRS (irsFinalidade):
   o inquilino empresa num contrato que não identifica quem lá mora dá a do não
   habitacional (D16).
   Recebe: c — o contrato; ano (opcional) — o ano dos rendimentos.
   Devolve: o código (string). */
const naturezaIrs=(c,ano)=>{const n=irsNaturezasDoAno(ano),f=irsFinalidade(c);return f==='nh'?n.naoHabitacional:f==='dhd'?(n.dhd||n.habitacional):n.habitacional};
/* O aviso de responsabilidade da Declaração, o texto aprovado: o que a app faz e
   o que não faz. O PDF escreve-o hoje; as outras saídas (a página, o texto, o
   CSV e o guia) hão de escrevê-lo à letra, a partir daqui. */
const IRS_AVISO='A app resume; quem declara és tu, no Portal das Finanças. Confirma cada valor antes de entregar: o imposto aqui é uma estimativa.';
