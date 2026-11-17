/* ================= FISCO · TITULARES =================
   Quem declara, e por que quota: as escolhas do senhorio para o IRS
   (db.settings.irs), a letra A ou B de cada proprietário, quem sou eu na
   Declaração, os titulares (eu e, em tributação conjunta, o cônjuge), o
   titular de uma linha, a quota de cada um num imóvel e o AIMI do quadro 9
   (que é pela quota dos titulares). Partiu-se do fisco.js (KAN-125); o
   resumo é o fisco-resumo.js. O que a página é e como se lê o ano vive no
   topo do fisco.js. */

/* As escolhas do senhorio para o IRS (db.settings.irs), sempre completas — um
   settings antigo, ou um que ainda não passou pelo fillCats, não as tem. Só
   lê: quem grava é o fiscoGravarIrs.
   Devolve: {conjunta, titulares, dispensaRecibos, outrosRendimentos} (objeto novo). */
function fiscoIrsDefs(){return normIrsDefs(db.settings&&db.settings.irs)}
/* A letra de um proprietário nas colunas «Titular» do Anexo F: em tributação
   conjunta a que ele escolheu (A, por omissão), sem conjunta sempre A — cada
   um entrega o seu Anexo F.
   Recebe: oid — o id do proprietário; ano (opcional) — o ano dos rendimentos (ainda não muda
   nada: as letras valem para todos os anos); defs (opcional) — o fiscoIrsDefs() já lido.
   Devolve: 'A' ou 'B'. */
function fiscoLetra(oid,ano,defs){
  const d=defs||fiscoIrsDefs();
  return d.conjunta&&d.titulares[oid]==='B'?'B':'A';
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
/* Os titulares da Declaração: eu e, em tributação conjunta, os proprietários
   marcados como B nas definições (o cônjuge) — cada um entra pela sua
   quota-parte, com a sua letra; eu levo a minha (A por omissão). Sem saber
   quem és (fiscoEu vazio, ou '' pedido de propósito), ninguém: os valores vão
   por inteiro, de todos os proprietários, e com vários sem sessão diz-se.
   Recebe: eu (opcional) — o id de quem declara; omitido, o fiscoEu; '' para
   por inteiro; ano (opcional) — o ano dos rendimentos (ainda não muda nada).
   Devolve: {eu, ids, porInteiro, semSessao} — ids os titulares, eu à cabeça
   ([] por inteiro); semSessao true quando é por inteiro por não haver sessão
   e haver mais do que um proprietário. */
function fiscoTitulares(eu,ano){
  const auto=eu===undefined||eu===null;
  if(auto)eu=fiscoEu();
  if(!eu)return {eu:'',ids:[],porInteiro:true,semSessao:auto&&(db.owners||[]).length>1};
  const d=fiscoIrsDefs(),ids=[eu];
  if(d.conjunta)(db.owners||[]).forEach(o=>{if(o.id!==eu&&d.titulares[o.id]==='B')ids.push(o.id)});
  return {eu:eu,ids:ids,porInteiro:false,semSessao:false};
}
/* O titular de uma linha: a letra do titular dela; por inteiro (sem saber
   quem és), as letras dos donos do imóvel com quota — «A/B» num imóvel dos
   dois cônjuges em conjunta, que no Anexo F vai em duas linhas, uma por
   titular, cada uma com a sua quota (CIRS art. 19.º; INCERTO nas instruções,
   que não falam dos bens comuns em conjunta). Com sessão cada linha é já de
   um titular só (resumoFiscal), e o «A/B» não aparece.
   Recebe: p — o imóvel (pode faltar); titularId — o id do titular da linha, ou vazio;
   ano (opcional) — o ano dos rendimentos (ainda não muda nada).
   Devolve: 'A', 'B' ou 'A/B'. */
function fiscoTitularDe(p,titularId,ano){
  const d=fiscoIrsDefs();
  if(titularId)return fiscoLetra(titularId,ano,d);
  if(!p||!d.conjunta)return 'A';
  const s=sharesOf(p),ls={};
  Object.keys(s).forEach(o=>{if(s[o]>0)ls[fiscoLetra(o,ano,d)]=1});
  const out=Object.keys(ls).sort();
  return out.length?out.join('/'):'A';
}
/* A quota fiscal de um titular num imóvel numa data. Hoje é só a quota-parte do
   imóvel (shareOf), e a data ainda não conta: fica a ponte para o dia em que
   a quota mude ao longo do tempo. Sem titular (a declaração por inteiro),
   o imóvel inteiro.
   Recebe: p — o imóvel; o — o id do titular ('' por inteiro); data — a data
   'AAAA-MM-DD' do movimento (ainda sem efeito).
   Devolve: a quota (0 a 1). */
function fiscoQuota(p,o,data){return o?shareOf(p,o):1}
/* A quota fiscal de um titular num imóvel num ano, para saber se o imóvel
   entra na declaração. Hoje é o mesmo que fiscoQuota, e o ano ainda não
   conta.
   Recebe: p — o imóvel; o — o id do titular ('' por inteiro); ano — o ano dos
   rendimentos (ainda sem efeito).
   Devolve: a quota (0 a 1). */
function fiscoQuotaNoAno(p,o,ano){return fiscoQuota(p,o,ano+'-12-31')}
/* O AIMI do ano para o quadro 9: as despesas «Impostos › AIMI» pagas no ano
   (fora dos gastos — CIRS art. 41.º n.º 1), pelo peso de cada imóvel e pela
   quota dos titulares da declaração; uma sem imóvel conta como os outros
   movimentos sem imóvel do resumo (semImovel: inteira quando a pagou um dos
   titulares, ou sem «pago por»). A parte que abate à coleta (CIMI art. 135.º-I; CIRS art.
   78.º n.º 1 l)) é a do VPT dos prédios que deram rendas no ano sobre o VPT de
   todos os prédios urbanos sujeitos ao AIMI (o 9102), e nunca mais do que a
   coleta das rendas — sem englobamento, a estimativa à taxa de cada contrato.
   INCERTO: o art. 135.º-I remete para a coleta à taxa de 28 %; a leitura
   prudente fica pela estimativa da página, que é igual ou mais baixa. O 9102
   conta só os prédios urbanos que a app tem; sem o VPT de um deles, a parte
   não se calcula e diz-se qual falta.
   Recebe: ano — o ano; semImovel — a parte (0 a 1) que um movimento sem
   imóvel tem nesta declaração; props — os imóveis do âmbito {id: imóvel};
   quotaDe — a quota dos titulares num imóvel; L — as linhas; imposto — a
   coleta estimada das rendas (euros).
   Devolve: {total, n, predios:[{propertyId, imovel, quadro, vpt}],
   vptArrendados, vptTotal, semVpt:[nome], parte, abate} — parte e abate null
   quando falta um VPT — ou null sem AIMI no ano. */
function fiscoAimi(ano,semImovel,props,quotaDe,L,imposto){
  const A=String(ano);let total=0,n=0;
  (db.transactions||[]).forEach(t=>{
    if(t.kind!=='expense'||!String(t.date||'').startsWith(A)||!countsInTotals(t))return;
    if(String(t.category||'').trim()!=='Impostos'||String(t.sub||'').trim()!=='AIMI')return;
    const ps=txProps(t),amt=Number(t.amount)||0;let v=0;
    if(ps.length)ps.forEach(p=>{if(!props[p.id])return;const w=txWeight(t,p.id,false);if(w>0)v+=amt*w*quotaDe(p)});
    else v=amt*semImovel(t);
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
