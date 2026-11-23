/* ================= FISCO · TITULARES =================
   Quem declara, e por que quota: as escolhas do senhorio para o IRS
   (db.settings.irs), a letra A ou B de cada proprietário, quem sou eu na
   Declaração, os titulares de cada ano (eu e, em tributação conjunta, o
   cônjuge escolhido), o titular de uma linha, a quota de cada um num imóvel
   na data de cada movimento (as quotas com data e os donos fora da app) e o
   AIMI do quadro 9 (de quem o pagou, inteiro). Partiu-se do fisco.js (KAN-125); o
   resumo é o fisco-resumo.js. O que a página é e como se lê o ano vive no
   topo do fisco.js. */

/* As escolhas do senhorio para o IRS (db.settings.irs), sempre completas — um
   settings antigo, ou um que ainda não passou pelo fillCats, não as tem. Só
   lê: quem grava é o fiscoGravarIrs.
   Devolve: {conjunta, titulares, dispensaRecibos, outrosRendimentos} (objeto novo). */
function fiscoIrsDefs(){return normIrsDefs(db.settings&&db.settings.irs)}
/* A situação de quem declara num ano (irs-papeis.js:irsSituacao), com o ano
   corrente quando não vem nenhum.
   Recebe: ano (opcional) — o ano dos rendimentos; eu (opcional) — o id de quem
   declara ('' sem ele: o cônjuge guardado no ano fica como está).
   Devolve: o objeto do irsSituacao ({conjunta, conjugeId, minhaLetra,
   letraConjuge, dispensaRecibos, aimi, deAno}). */
function fiscoSituacaoDoAno(ano,eu){
  return irsSituacao(ano===undefined||ano===null||ano===''?YEAR:ano,eu||'');
}
/* A letra de um proprietário nas colunas «Titular» do Anexo F, no ano dos
   rendimentos (D30, D91). Sem conjunta, sempre A — cada um entrega o seu
   Anexo F. Em conjunta, pela situação desse ano (fiscoSituacaoDoAno): o
   cônjuge escolhido leva a outra letra que não a minha, e quem não é o
   cônjuge leva a minha (na declaração só entram eu e ele: as letras são só
   a posição de cada um no Rosto, e nunca tiram nem põem rendas). Sem
   situação por ano (os campos antigos de settings.irs), a letra que cada um
   escolheu, A por omissão.
   Recebe: oid — o id do proprietário; ano (opcional) — o ano dos rendimentos
   (por omissão, o corrente); defs (opcional) — o fiscoIrsDefs() já lido.
   Devolve: 'A' ou 'B'. */
function fiscoLetra(oid,ano,defs){
  const s=fiscoSituacaoDoAno(ano,'');
  if(!s.conjunta)return 'A';
  /* o cônjuge sem conta dos bens comuns do casal leva a outra letra (D5) */
  if(fiscoEhConjugeFora(oid))return s.minhaLetra==='B'?'A':'B';
  if(s.deAno)return s.conjugeId&&oid===s.conjugeId?(s.minhaLetra==='B'?'A':'B'):s.minhaLetra;
  const d=defs||fiscoIrsDefs();
  return d.titulares[oid]==='B'?'B':'A';
}
/* Quem sou eu na Declaração: o proprietário da sessão (acessos.js:meuId — na
   nuvem o proprietário é a conta). Sem sessão (antes de entrar, ou sem
   nuvem), o único proprietário, quando há um só: é dele tudo o que lá está.
   Com vários e sem sessão não se sabe qual és, e não se adivinha: ''.
   Devolve: o id do proprietário, ou '' quando não se sabe. */
function fiscoEu(){
  const eu=meuId();if(eu)return eu;
  const os=db.owners||[];
  return os.length===1?os[0].id:'';
}
/* O cônjuge sem conta nos bens comuns do casal (D5): um titular da Declaração
   que não é proprietário na app. O id dele é este prefixo e o id de quem
   declara (fiscoConjugeForaId), para a quota dele se ler da casa de quem
   declara (fiscoQuotaDoConjugeFora) sem mais nada à volta. */
const FISCO_CONJUGE_FORA='conjuge~';
/* O id do cônjuge sem conta de quem declara (FISCO_CONJUGE_FORA).
   Recebe: eu — o id de quem declara.
   Devolve: o id (texto). */
function fiscoConjugeForaId(eu){return FISCO_CONJUGE_FORA+String(eu||'')}
/* O id é o do cônjuge sem conta dos bens comuns (fiscoConjugeForaId)? Quem
   mostra um titular pelo nome usa-o: este não está em db.owners, e o nome
   vem do resumo (r.conjugeFora.nome).
   Recebe: o — o id de um titular (aguenta tudo).
   Devolve: true ou false. */
function fiscoEhConjugeFora(o){return typeof o==='string'&&o.indexOf(FISCO_CONJUGE_FORA)===0&&o.length>FISCO_CONJUGE_FORA.length}
/* Os bens são comuns do casal neste ano (D5)? A escolha da situação do ano
   (irs-papeis.js:irsSituacao, porAno[AAAA].bensComuns — herdada como a
   conjunta; enquanto a situação não a trouxer, lida da entrada do ano dela em
   settings.irs.porAno), e só com a tributação conjunta.
   Recebe: s — a situação do ano (fiscoSituacaoDoAno).
   Devolve: true ou false. */
function fiscoBensComuns(s){
  if(!s||!s.conjunta)return false;
  if(typeof s.bensComuns==='boolean')return s.bensComuns;
  const pa=((db.settings&&db.settings.irs)||{}).porAno,e=pa&&s.deAno&&pa[s.deAno];
  return !!(e&&e.bensComuns===true);
}
/* A quota do cônjuge sem conta num imóvel numa data, nos bens comuns do casal
   (D5): a do dono fora da app desse dia, quando quem declara tem quota nesse
   dia e há UM só dono de fora — é ele o cônjuge. Com dois ou mais não se
   adivinha qual é (0, e o resumo di-lo em bensComuns.porDecidir); sem nenhum,
   a casa é só de quem declara na app (0: a linha fica inteira no titular dele).
   Recebe: p — o imóvel; eu — o id de quem declara; data — 'AAAA-MM-DD' (vazia: hoje).
   Devolve: a quota (0 a 1). */
function fiscoQuotaDoConjugeFora(p,eu,data){
  if(!p||!eu||!(fiscoQuota(p,eu,data)>0))return 0;
  const fs=quotasForaNaData(p,data);
  return fs.length===1?Math.max(0,Math.min(100,Number(fs[0].quota)||0))/100:0;
}
/* Os titulares da Declaração de um ano (D30, D91): eu e, em tributação
   conjunta nesse ano, o cônjuge escolhido (o conjugeId da situação do ano,
   irs-papeis.js:irsSituacao), seja qual for a letra de cada um — nunca «todos
   os de letra diferente da minha», que punha na conjunta os irmãos e os
   sócios com quem tenho casas. Cada um entra pela sua quota-parte, com a sua
   letra (fiscoLetra). Conjunta sem cônjuge escolhido (ou com um que já não é
   proprietário na app): só eu, e semConjuge di-lo; com os bens comuns do
   casal (fiscoBensComuns, D5), entra o cônjuge sem conta
   (fiscoConjugeForaId), pela quota do dono de fora de cada casa minha
   (fiscoQuotaDoConjugeFora). Sem saber quem és (fiscoEu vazio, ou '' pedido
   de propósito), ninguém: os valores vão por inteiro, de todos os
   proprietários, e com vários sem sessão diz-se.
   Recebe: eu (opcional) — o id de quem declara; omitido, o fiscoEu; '' para
   por inteiro; ano (opcional) — o ano dos rendimentos (por omissão, o corrente).
   Devolve: {eu, ids, porInteiro, semSessao, conjunta, semConjuge,
   conjugeFora} — ids os titulares, eu à cabeça ([] por inteiro); semSessao
   true quando é por inteiro por não haver sessão e haver mais do que um
   proprietário; conjunta a do ano; semConjuge true em conjunta sem um
   cônjuge com conta na lista (também com o cônjuge sem conta dos bens
   comuns); conjugeFora true quando esse entra. */
function fiscoTitulares(eu,ano){
  const auto=eu===undefined||eu===null;
  if(auto)eu=fiscoEu();
  if(!eu)return {eu:'',ids:[],porInteiro:true,semSessao:auto&&(db.owners||[]).length>1,conjunta:false,semConjuge:false,conjugeFora:false};
  const s=fiscoSituacaoDoAno(ano,eu),ids=[eu],cj=s.conjunta?s.conjugeId:'';
  if(cj&&cj!==eu&&(db.owners||[]).some(o=>o&&o.id===cj))ids.push(cj);
  const semConjuge=!!s.conjunta&&ids.length<2,fora=semConjuge&&fiscoBensComuns(s);
  if(fora)ids.push(fiscoConjugeForaId(eu));
  return {eu:eu,ids:ids,porInteiro:false,semSessao:false,conjunta:!!s.conjunta,semConjuge:semConjuge,conjugeFora:fora};
}
/* O titular de uma linha: a letra do titular dela; por inteiro (sem saber
   quem és), as letras dos donos do imóvel com quota — «A/B» num imóvel dos
   dois cônjuges em conjunta, que no Anexo F vai em duas linhas, uma por
   titular, cada uma com a sua quota (CIRS art. 19.º; INCERTO nas instruções,
   que não falam dos bens comuns em conjunta). Com sessão cada linha é já de
   um titular só (resumoFiscal), e o «A/B» não aparece.
   Os donos são os que tiveram quota algum dia do ano (fiscoDiasDasQuotas).
   Recebe: p — o imóvel (pode faltar); titularId — o id do titular da linha, ou vazio;
   ano (opcional) — o ano dos rendimentos (por omissão, o corrente).
   Devolve: 'A', 'B' ou 'A/B'. */
function fiscoTitularDe(p,titularId,ano){
  const d=fiscoIrsDefs();
  if(titularId)return fiscoLetra(titularId,ano,d);
  if(!p||!fiscoSituacaoDoAno(ano,'').conjunta)return 'A';
  const ls={};
  fiscoDiasDasQuotas(p,ano).forEach(dia=>{const s=quotasFiscais(p,dia);
    Object.keys(s).forEach(o=>{if(s[o]>0)ls[fiscoLetra(o,ano,d)]=1})});
  const out=Object.keys(ls).sort();
  return out.length?out.join('/'):'A';
}
/* Os dias de um ano em que as quotas de um imóvel podem mudar: 1 de janeiro
   e o primeiro dia de cada período novo das quotas guardadas
   (saldos.js:quotasPeriodos) que começa dentro do ano. Entre dois deles as
   quotas são as mesmas: é aí que se mede a maior do ano.
   Recebe: p — o imóvel (aguenta null); ano — o ano dos rendimentos (número
   ou texto; por omissão, o corrente).
   Devolve: array de 'AAAA-MM-DD', por ordem, sem repetidos. */
function fiscoDiasDasQuotas(p,ano){
  const A=String(anoIrs(ano)),ini=A+'-01-01',fim=A+'-12-31',dias=[ini];
  quotasPeriodos(p).forEach(e=>{const d=addDays(e.ate,1);if(d>ini&&d<=fim&&dias.indexOf(d)<0)dias.push(d)});
  return dias.sort();
}
/* A quota fiscal de um titular num imóvel numa data (D08, D29): a fração da
   casa inteira em vigor nesse dia (saldos.js:quotasFiscais) — com as quotas
   do período guardado a que a data pertence, e com os comproprietários fora
   da app abatidos (CIRS art. 19.º: cada renda e cada gasto pela quota de
   quando é recebida ou paga). Quem saiu da casa continua a contar nos dias
   em que era dono. Sem titular (a declaração por inteiro, sem saber quem
   és), a parte dos donos da app: a casa inteira menos a dos de fora nesse
   dia — o que é de quem não está na app não é de declaração nenhuma daqui.
   O cônjuge sem conta dos bens comuns (fiscoEhConjugeFora) tem a quota do
   dono de fora (fiscoQuotaDoConjugeFora, D5).
   Recebe: p — o imóvel; o — o id do titular ('' por inteiro); data — a data
   'AAAA-MM-DD' do movimento (vazia: hoje).
   Devolve: a quota (0 a 1). */
function fiscoQuota(p,o,data){
  if(!p)return o?0:1;
  if(!o)return Math.max(0,100-Math.min(100,sum(quotasForaNaData(p,data).map(f=>Number(f.quota)||0))))/100;
  if(fiscoEhConjugeFora(o))return fiscoQuotaDoConjugeFora(p,o.slice(FISCO_CONJUGE_FORA.length),data);
  const q=Number(quotasFiscais(p,data)[o]);
  return q>0?q:0;
}
/* A quota fiscal de um titular num imóvel num ano, para saber se o imóvel
   entra na declaração desse ano (D29): a maior que ele teve no ano — a casa
   entra se ele foi dono algum dia, e cada movimento conta depois pela quota
   do seu dia (fiscoQuota). Uma casa vendida antes de 1 de janeiro do ano
   (p.vendido anterior a esse dia; dados.js:imovelVendido) já não entra; a
   vendida durante o ano entra, com as rendas e os gastos do ano.
   Recebe: p — o imóvel; o — o id do titular ('' por inteiro); ano — o ano dos
   rendimentos (número ou texto).
   Devolve: a quota (0 a 1). */
function fiscoQuotaNoAno(p,o,ano){
  const A=String(anoIrs(ano));
  if(!p||imovelVendido(p,addDays(A+'-01-01',-1)))return 0;
  return Math.max.apply(null,fiscoDiasDasQuotas(p,A).map(d=>fiscoQuota(p,o,d)));
}
/* As afetações da caderneta sobre as quais o AIMI não incide (CIMI art.
   135.º-B n.º 2: os urbanos «comerciais, industriais ou para serviços» e
   «outros», do art. 6.º n.º 1 b) e d)), com o porquê em palavras. A
   habitação e os terrenos para construção ficam sujeitos. */
const FISCO_AIMI_AFETACOES_FORA={comercio:'afetação de comércio',servicos:'afetação de serviços',industria:'afetação de indústria',outros:'afetação de outros fins'};
/* Uma despesa é o AIMI: Impostos › AIMI pelo id da categoria (o nome pode
   mudar — dados.js:txCatIrsId: a marca do movimento, a árvore desta conta, o
   nome de origem), ou pelos nomes de origem quando nada o tem.
   Recebe: t — o movimento.
   Devolve: true/false. */
function fiscoEhAimi(t){
  if(!t||t.kind!=='expense')return false;
  const cat=String(t.category||'').trim(),sub=String(t.sub||'').trim();
  const id=sub?txCatIrsId(t,true):'';
  return id==='impostos/aimi'||(!id&&cat==='Impostos'&&sub==='AIMI');
}
/* Porque é que um prédio fica fora do quadro 9 (D71): o AIMI só incide nos
   urbanos (CIMI art. 135.º-B n.º 1), não incide nos de comércio, serviços,
   indústria e outros fins — pela afetação da caderneta (p.afetacao), nunca
   pela finalidade do contrato, que é o uso que o inquilino lhe dá — nem nos
   habitacionais arrendados no Programa de Apoio ao Arrendamento (n.º 2;
   desde 1/9/2026 lê-se RSAA, DL 97/2026 art. 14.º a)): um prédio cujas
   linhas do ano são todas isentas por um desses programas. Nem num prédio
   comprado depois de 1 de janeiro do ano (p.purchaseDate): a titularidade do
   AIMI afere-se nesse dia (CIMI art. 135.º-A n.º 3), e o AIMI pago no ano —
   o desse mesmo ano, art. 135.º-H — não incidiu sobre ele (N070). Sem a data
   de compra a app não sabe, e o prédio fica.
   Recebe: p — o imóvel; ls — as linhas do ano desse imóvel (array); ano
   (opcional) — o ano dos rendimentos (sem ele, a compra não se olha).
   Devolve: {motivo:'compra'|'rustico'|'afetacao'|'paa', porque} ou null
   quando o AIMI incide. */
function fiscoAimiExclusao(p,ls,ano){
  const A=String(ano||''),pd=String(p.purchaseDate||'');
  if(/^\d{4}$/.test(A)&&/^\d{4}-\d{2}-\d{2}$/.test(pd)&&pd>A+'-01-01')return {motivo:'compra',porque:'comprado depois de 1 de janeiro: o AIMI deste ano não incidiu sobre ele'};
  if(p.tipoPredio==='R')return {motivo:'rustico',porque:'prédio rústico'};
  const af=FISCO_AIMI_AFETACOES_FORA[p.afetacao];
  if(af)return {motivo:'afetacao',porque:af};
  const prog=l=>l.isencao&&(l.isencao.id==='paa'||l.isencao.id==='rsaa');
  if(ls.length&&ls.every(prog))return {motivo:'paa',porque:'arrendado no '+(ls[0].isencao.curto||ls[0].isencao.id.toUpperCase())};
  return null;
}
/* O AIMI do ano para o quadro 9. É de quem o pagou, não de um imóvel (CIMI
   art. 135.º-C; o 9101 é o total liquidado ao sujeito passivo): cada despesa
   Impostos › AIMI paga no ano (fora dos gastos — CIRS art. 41.º n.º 1) conta
   inteira, sem peso nem quota (D32), para o titular que a pagou — e, sem
   «pago por», para quem declara, sem imóvel (semImovel) ou num imóvel desta
   declaração; de outro, não conta. O «Fora dos totais» não a tira. Sem «pago
   por» num imóvel com mais do que um dono na app vai também a semPagador.
   Os prédios do quadro 9 são os que deram rendas e sobre os quais o AIMI
   incide (fiscoAimiExclusao, com o comprado depois de 1 de janeiro); os de
   fora vão a excluidos, com o porquê, e não pesam no VPT de nenhum dos lados
   da conta (nem com os números da demonstração). O VPT
   de cada um é o da quota dos titulares (quotaDe: a matriz diz a parte de
   cada comproprietário). Com os números da demonstração de liquidação do ano
   (irsSituacao(ano).aimi, em demonstracao), a parte que abate à coleta (CIMI
   art. 135.º-I; CIRS art. 78.º n.º 1 l)) é o total dela × o VPT dos prédios
   do quadro 9 ÷ o valor tributável dela; sem eles, o AIMI pago × esse VPT ÷
   o dos urbanos da declaração sujeitos ao AIMI (vptTotal, só os que a app
   tem — sem o VPT de um, a parte não se calcula e diz-se qual falta). Nunca
   mais do que a coleta das rendas (abate). INCERTO: o art. 135.º-I remete
   para a coleta à taxa de 28 %; fica a estimativa da página, igual ou menor.
   Recebe: ano — o ano; semImovel — a parte (0 a 1) de um movimento sem imóvel
   nesta declaração; props — os imóveis do âmbito {id: imóvel}; quotaDe — a
   quota dos titulares num imóvel; L — as linhas; imposto — a coleta estimada
   das rendas (euros).
   Devolve: {total, n, predios:[{propertyId, imovel, quadro, vpt}],
   vptArrendados, vptTotal, semVpt:[nome], parte, abate, demonstracao:
   {total, valorTributavel}|null, excluidos:[{propertyId, imovel, motivo,
   porque, arrendado}], semPagador:[{txId, imovel, valor}],
   afetacaoPorConfirmar:[{propertyId, imovel}]} — total o AIMI pago (n
   movimentos); afetacaoPorConfirmar os prédios do quadro 9 sem afetação e
   com um contrato não habitacional; parte e abate null quando falta um VPT;
   ou null sem AIMI pago no ano e sem o total da demonstração. */
function fiscoAimi(ano,semImovel,props,quotaDe,L,imposto){
  const A=String(ano);let total=0,n=0;const semPagador=[];
  (db.transactions||[]).forEach(t=>{
    if(!fiscoEhAimi(t)||!String(t.date||'').startsWith(A))return;
    const ps=txProps(t),amt=Number(t.amount)||0,meus=ps.filter(p=>props[p.id]);
    const v=t.paidBy||!ps.length?amt*semImovel(t):meus.length?amt:0;
    if(!(v>0))return;
    total+=v;n++;
    if(!t.paidBy&&meus.some(p=>{const q=quotasFiscais(p,t.date);return Object.keys(q).filter(o=>q[o]>0).length>1}))
      semPagador.push({txId:t.id,imovel:meus.map(p=>p.name).join(', '),valor:r2(amt)});
  });
  const dm=(fiscoSituacaoDoAno(ano,'').aimi)||{};
  const demonstracao=dm.total!=null||dm.valorTributavel!=null?{total:dm.total!=null?dm.total:null,valorTributavel:dm.valorTributavel!=null?dm.valorTributavel:null}:null;
  if(!n&&!(demonstracao&&demonstracao.total>0))return null;
  const linhasDe={};L.forEach(l=>{if(props[l.propertyId])(linhasDe[l.propertyId]||(linhasDe[l.propertyId]=[])).push(l)});
  const vptDe=p=>(Number(p.vpt)||0)*quotaDe(p),fora={},excluidos=[];
  Object.keys(props).forEach(k=>{const p=props[k],ls=linhasDe[k]||[],x=fiscoAimiExclusao(p,ls,A);
    if(x){fora[k]=1;excluidos.push({propertyId:p.id,imovel:p.name,motivo:x.motivo,porque:x.porque,arrendado:ls.length>0})}});
  const vistos={},predios=[],arr=[];
  L.forEach(l=>{const p=props[l.propertyId];if(!p||vistos[p.id]||fora[p.id])return;vistos[p.id]=1;arr.push(p);
    predios.push({propertyId:p.id,imovel:p.name,quadro:l.quadro,vpt:r2(vptDe(p))})});
  /* um prédio do quadro 9 sem afetação na ficha e com um contrato não
     habitacional é talvez uma loja: não se tira (manda a caderneta), diz-se */
  const nh=((irsAno(ano)||{}).naturezas||{}).naoHabitacional||'';
  const afetacaoPorConfirmar=arr.filter(p=>!p.afetacao&&nh&&linhasDe[p.id].some(l=>l.natureza===nh)).map(p=>({propertyId:p.id,imovel:p.name}));
  const urbanos=Object.keys(props).filter(k=>!fora[k]).map(k=>props[k]);
  const vt=demonstracao&&demonstracao.valorTributavel>0?demonstracao.valorTributavel:null;
  const semVpt=(vt?arr:urbanos).filter(p=>!(Number(p.vpt)>0)).map(p=>p.name);
  const vptArr=sum(predios.map(x=>x.vpt)),vptTot=sum(urbanos.map(vptDe));
  const base=demonstracao&&demonstracao.total!=null?demonstracao.total:total,den=vt||vptTot;
  const parte=semVpt.length||!(den>0)?null:r2(base*Math.min(1,vptArr/den));
  return {total:r2(total),n:n,predios:predios,vptArrendados:r2(vptArr),vptTotal:r2(vptTot),semVpt:semVpt,
    parte:parte,abate:parte==null?null:r2(Math.min(parte,Math.max(0,imposto))),
    demonstracao:demonstracao,excluidos:excluidos,semPagador:semPagador,afetacaoPorConfirmar:afetacaoPorConfirmar};
}
